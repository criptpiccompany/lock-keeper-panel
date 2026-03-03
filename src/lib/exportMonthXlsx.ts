import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_FEE_RATE } from "@/lib/constants";
import { getFeeLabel } from "@/hooks/useTeamFeeRate";

interface CloserProfile {
  id: string;
  nome: string;
  commission_rate: number;
}

const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthRange(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end, year: y, month: m };
}

/**
 * Export month data as XLSX.
 * @param monthKey e.g. "2026-02"
 * @param onProgress callback for progress messages
 * @param teamId optional team filter — when set, only exports data for that team
 * @param teamName optional label for file naming
 */
export async function exportMonthXlsx(
  monthKey: string,
  onProgress?: (msg: string) => void,
  teamId?: string,
  teamName?: string,
) {
  const { start, end, year, month } = monthRange(monthKey);
  const monthLabel = MONTH_NAMES_PT[month - 1];
  const suffix = teamName ? `_${teamName.replace(/[^a-zA-Z0-9]/g, "")}` : "";
  const fileName = `Backup_${monthLabel}_${year}${suffix}.xlsx`;

  onProgress?.("Carregando perfis...");

  // Build queries with optional team filter
  let profilesQuery = supabase.from("profiles").select("id, nome, commission_rate, status, team_id").order("nome");
  let recordsQuery = supabase
    .from("daily_influencer_records")
    .select("*, influencers!inner(handle)")
    .gte("date", start)
    .lte("date", end)
    .is("deleted_at", null)
    .order("date");
  let monthlyListQuery = supabase
    .from("monthly_influencer_list")
    .select("*")
    .eq("month", monthKey)
    .order("influencer_handle");
  let platformNamesQuery = supabase.from("monthly_platform_names").select("*").eq("month", monthKey);
  let influencersQuery = supabase.from("influencers").select("*").is("deleted_at", null).order("handle");
  let locksQuery = supabase.from("influencer_locks").select("*").gte("locked_until", new Date().toISOString());

  if (teamId) {
    profilesQuery = profilesQuery.eq("team_id", teamId);
    recordsQuery = recordsQuery.eq("team_id", teamId);
    monthlyListQuery = monthlyListQuery.eq("team_id", teamId);
    platformNamesQuery = platformNamesQuery.eq("team_id", teamId);
    influencersQuery = influencersQuery.eq("team_id", teamId);
  }

  const [
    { data: profiles },
    { data: allRecords },
    { data: allMonthlyList },
    { data: allPlatformNames },
    { data: allInfluencers },
    { data: allLocks },
    { data: allConflicts },
    { data: allAuditLogs },
    { data: allTeams },
  ] = await Promise.all([
    profilesQuery,
    recordsQuery,
    monthlyListQuery,
    platformNamesQuery,
    influencersQuery,
    locksQuery,
    teamId
      ? supabase.from("admin_conflicts").select("*").eq("month_key", monthKey)
      : supabase.from("admin_conflicts").select("*").eq("month_key", monthKey),
    supabase
      .from("audit_logs")
      .select("*")
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`)
      .order("created_at", { ascending: false }),
    supabase.from("teams").select("id, taxa_operacional"),
  ]);

  // Build team fee rate map
  const teamFeeMap = new Map<string, number>();
  (allTeams || []).forEach((t: any) => teamFeeMap.set(t.id, Number(t.taxa_operacional) ?? PLATFORM_FEE_RATE));

  const closers = ((profiles as any[]) || []).filter((p) => p.status === "approved") as (CloserProfile & { team_id?: string })[];
  const records = (allRecords as any[]) || [];
  const monthlyList = (allMonthlyList as any[]) || [];
  const platformNames = (allPlatformNames as any[]) || [];
  const influencers = (allInfluencers as any[]) || [];
  const locks = (allLocks as any[]) || [];
  const conflicts = (allConflicts as any[]) || [];
  const auditLogs = (allAuditLogs as any[]) || [];

  onProgress?.("Gerando planilha...");

  const wb = XLSX.utils.book_new();

  // ── Per-user sheets ──
  for (const closer of closers) {
    const closerFeeRate = closer.team_id ? teamFeeMap.get(closer.team_id) ?? PLATFORM_FEE_RATE : PLATFORM_FEE_RATE;
    const closerFeeLabel = getFeeLabel(closerFeeRate);
    const userRecords = records.filter((r: any) => r.closer_id === closer.id);
    const userMonthly = monthlyList.filter((m: any) => m.closer_id === closer.id);
    const userPlatform = platformNames.find((p: any) => p.closer_id === closer.id);
    const userInfluencers = influencers.filter((i: any) => i.owner_id === closer.id);
    const userLocks = locks.filter((l: any) => l.locked_by_user_id === closer.id);

    // 1) Diário
    const diarioRows = userRecords.map((r: any) => ({
      Data: r.date,
      Influenciador: r.influencers?.handle || "",
      "Valor Pago": formatBRL(Number(r.valor_pago) || 0),
      Faturamento: r.faturamento != null ? formatBRL(Number(r.faturamento)) : "",
      Acumulado: r.acumulado != null ? formatBRL(Number(r.acumulado)) : "",
      Status: r.status || "",
      Observação: r.observacao || "",
      "Comprovante URL": r.comprovante_url || "",
      "Comprovante URL 2": r.comprovante_url_2 || "",
      Compartilhado: r.is_shared ? "Sim" : "Não",
      "Nota Compartilhamento": r.shared_note || "",
    }));
    const wsDiario = XLSX.utils.json_to_sheet(diarioRows.length ? diarioRows : [{ "Sem dados": "" }]);
    XLSX.utils.book_append_sheet(wb, wsDiario, truncName(`${closer.nome} - Diario`));

    // 2) Balanço
    const commRate = closer.commission_rate ?? 0.1;
    const dayMap = new Map<string, { invested: number; revenue: number }>();
    userRecords.forEach((r: any) => {
      const ex = dayMap.get(r.date) || { invested: 0, revenue: 0 };
      ex.invested += Number(r.valor_pago) || 0;
      ex.revenue += Number(r.faturamento) || 0;
      dayMap.set(r.date, ex);
    });
    const balancoRows: any[] = [];
    let totInv = 0, totRev = 0, totFee = 0, totProfit = 0, totComm = 0, totSaldo = 0;
    dayMap.forEach((v, date) => {
      const fee = v.revenue * closerFeeRate;
      const profit = v.revenue - v.invested - fee;
      const comm = profit > 0 ? profit * commRate : 0;
      const saldo = profit - comm;
      totInv += v.invested; totRev += v.revenue; totFee += fee;
      totProfit += profit; totComm += comm; totSaldo += saldo;
      balancoRows.push({
        Data: date,
        Investido: formatBRL(v.invested),
        Faturado: formatBRL(v.revenue),
        [closerFeeLabel]: formatBRL(fee),
        Resultado: formatBRL(profit),
        Comissão: formatBRL(comm),
        "Saldo Final": formatBRL(saldo),
      });
    });
    balancoRows.push({
      Data: "TOTAL",
      Investido: formatBRL(totInv),
      Faturado: formatBRL(totRev),
      [closerFeeLabel]: formatBRL(totFee),
      Resultado: formatBRL(totProfit),
      Comissão: formatBRL(totComm),
      "Saldo Final": formatBRL(totSaldo),
    });
    const wsBalanco = XLSX.utils.json_to_sheet(balancoRows.length > 1 ? balancoRows : [{ "Sem dados": "" }]);
    XLSX.utils.book_append_sheet(wb, wsBalanco, truncName(`${closer.nome} - Balanco`));

    // 3) Lista do Mês
    const p1 = userPlatform?.platform_1_name || "Casa 1";
    const p2 = userPlatform?.platform_2_name || "Casa 2";
    const p3 = userPlatform?.platform_3_name || "Casa 3";
    const listaRows = userMonthly.map((m: any) => ({
      Influenciador: m.influencer_handle,
      [`${p1} Email`]: m.casa_1_email || "",
      [`${p1} Valor`]: m.casa_1_valor != null ? formatBRL(Number(m.casa_1_valor)) : "",
      [`${p2} Email`]: m.casa_2_email || "",
      [`${p2} Valor`]: m.casa_2_valor != null ? formatBRL(Number(m.casa_2_valor)) : "",
      [`${p3} Email`]: m.casa_3_email || "",
      [`${p3} Valor`]: m.casa_3_valor != null ? formatBRL(Number(m.casa_3_valor)) : "",
      "Valor Total": m.valor_total != null ? formatBRL(Number(m.valor_total)) : "",
      Observações: m.observacoes || "",
    }));
    const wsLista = XLSX.utils.json_to_sheet(listaRows.length ? listaRows : [{ "Sem dados": "" }]);
    XLSX.utils.book_append_sheet(wb, wsLista, truncName(`${closer.nome} - Lista`));

    // 4) Influenciadores
    const infRows = userInfluencers.map((i: any) => ({
      Handle: i.handle,
      Ativo: i.ativo ? "Sim" : "Não",
      "Último Fechamento": i.last_closed_at || "",
      Notas: i.notas || "",
    }));
    const wsInf = XLSX.utils.json_to_sheet(infRows.length ? infRows : [{ "Sem dados": "" }]);
    XLSX.utils.book_append_sheet(wb, wsInf, truncName(`${closer.nome} - Influenciadores`));

    // 5) Travados
    const lockRows = userLocks.map((l: any) => ({
      Handle: l.handle_normalized,
      "Travado Até": l.locked_until,
      "Última Atividade": l.last_activity_at,
    }));
    const wsLock = XLSX.utils.json_to_sheet(lockRows.length ? lockRows : [{ "Sem dados": "" }]);
    XLSX.utils.book_append_sheet(wb, wsLock, truncName(`${closer.nome} - Travados`));
  }

  // ── Admin sheets ──

  // Ranking Mensal
  onProgress?.("Gerando rankings...");
  const rankingRows: any[] = [];
  const closerMap = new Map(closers.map((c) => [c.id, c]));
  const aggMap = new Map<string, { investido: number; faturamento: number }>();
  records.forEach((r: any) => {
    const ex = aggMap.get(r.closer_id) || { investido: 0, faturamento: 0 };
    ex.investido += Number(r.valor_pago) || 0;
    ex.faturamento += Number(r.faturamento) || 0;
    aggMap.set(r.closer_id, ex);
  });
  aggMap.forEach((agg, closerId) => {
    const c = closerMap.get(closerId);
    if (!c) return;
    const cRate = c.team_id ? teamFeeMap.get(c.team_id) ?? PLATFORM_FEE_RATE : PLATFORM_FEE_RATE;
    const taxa = agg.faturamento * cRate;
    const lucro = agg.faturamento - agg.investido - taxa;
    const comissao = lucro > 0 ? lucro * c.commission_rate : 0;
    rankingRows.push({
      Closer: c.nome,
      Investido: formatBRL(agg.investido),
      Faturado: formatBRL(agg.faturamento),
      [getFeeLabel(cRate)]: formatBRL(taxa),
      Lucro: formatBRL(lucro),
      Comissão: formatBRL(comissao),
      "Lucro Líquido": formatBRL(lucro - comissao),
    });
  });
  rankingRows.sort((a: any, b: any) => b["Lucro Líquido"] - a["Lucro Líquido"]);
  const wsRankSem = XLSX.utils.json_to_sheet(rankingRows.length ? rankingRows : [{ "Sem dados": "" }]);
  XLSX.utils.book_append_sheet(wb, wsRankSem, "Ranking Mensal");

  // Conflitos
  const conflictRows = conflicts.map((c: any) => ({
    Tipo: c.type,
    Severidade: c.severity,
    Handle: c.handle || "",
    "Email Afiliado": c.affiliate_email || "",
    Nota: c.note || "",
    "Criado Em": c.created_at,
    "Resolvido Em": c.resolved_at || "",
  }));
  const wsConflicts = XLSX.utils.json_to_sheet(conflictRows.length ? conflictRows : [{ "Sem dados": "" }]);
  XLSX.utils.book_append_sheet(wb, wsConflicts, "Conflitos");

  // Auditoria Geral
  const auditRows = auditLogs.map((a: any) => ({
    Data: a.created_at,
    Ator: a.actor_nome || "",
    Papel: a.actor_role || "",
    Ação: a.action,
    Entidade: a.entity_type,
    "ID Entidade": a.entity_id || "",
    Descrição: a.description || "",
    Motivo: a.edit_reason || "",
  }));
  const wsAudit = XLSX.utils.json_to_sheet(auditRows.length ? auditRows : [{ "Sem dados": "" }]);
  XLSX.utils.book_append_sheet(wb, wsAudit, "Auditoria Geral");

  // Download
  onProgress?.("Baixando arquivo...");
  XLSX.writeFile(wb, fileName);
}

/** Truncate sheet name to 31 chars (Excel limit) */
function truncName(name: string): string {
  return name.length > 31 ? name.slice(0, 31) : name;
}
