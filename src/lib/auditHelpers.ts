// Human-readable audit log descriptions and shared types/constants

export interface AuditLog {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_nome: string | null;
  actor_role: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  field_changes: Record<string, any> | null;
  description: string | null;
  edit_reason: string | null;
}

export const ENTITY_LABELS: Record<string, string> = {
  daily_influencer_records: "Registro Diário",
  influencers: "Influenciador",
  daily_sheets: "Dia (Seção)",
  close_events: "Evento de Fechamento",
  monthly_influencer_list: "Lista do Mês",
  monthly_platform_names: "Plataformas",
};

export const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  INSERT: { label: "Criação", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  UPDATE: { label: "Edição", className: "bg-amber-50 text-amber-700 border-amber-200" },
  DELETE: { label: "Exclusão", className: "bg-red-50 text-red-700 border-red-200" },
};

export const FIELD_LABELS: Record<string, string> = {
  valor_pago: "Valor Pago",
  faturamento: "Faturamento",
  acumulado: "Acumulado",
  status: "Status",
  comprovante_url: "Comprovante",
  observacao: "Observação",
  handle: "Influenciador",
  owner_id: "Responsável",
  owner_nome: "Responsável",
  ativo: "Ativo",
  last_closed_at: "Último Fechamento",
  notas: "Notas",
  influencer_handle: "Influenciador",
  acao: "Ação",
  motivo: "Motivo",
  feito_por_nome: "Feito Por",
  closer_id: "Closer",
  influencer_id: "Influenciador",
  date: "Data",
  month: "Mês",
  casa_1_valor: "Valor Plataforma 1",
  casa_1_email: "Email Plataforma 1",
  casa_2_valor: "Valor Plataforma 2",
  casa_2_email: "Email Plataforma 2",
  casa_3_valor: "Valor Plataforma 3",
  casa_3_email: "Email Plataforma 3",
  valor_total: "Valor Total",
  observacoes: "Observações",
  platform_1_name: "Nome Plataforma 1",
  platform_2_name: "Nome Plataforma 2",
  platform_3_name: "Nome Plataforma 3",
};

const FINANCIAL_FIELDS = new Set([
  "valor_pago", "faturamento", "acumulado", "valor_total",
  "casa_1_valor", "casa_2_valor", "casa_3_valor",
]);

const SENSITIVE_FIELDS = new Set([
  "valor_pago", "faturamento", "acumulado", "valor_total",
  "casa_1_valor", "casa_2_valor", "casa_3_valor",
  "commission_rate", "comprovante_url",
]);

const HIDDEN_DETAIL_FIELDS = new Set([
  "id", "closer_id", "influencer_id", "owner_id", "feito_por_id",
  "deleted_at", "deleted_by",
]);

/** Check if an audit log represents a sensitive action (financial, deletion, commission) */
export function isSensitiveAction(log: AuditLog): boolean {
  if (log.action === "DELETE") return true;
  if (!log.field_changes) return false;
  const keys = Object.keys(log.field_changes).filter(k => k !== "before" && k !== "after");
  return keys.some(k => SENSITIVE_FIELDS.has(k));
}

/** Extract a handle from field_changes data */
export function extractHandle(log: AuditLog): string | null {
  const fc = log.field_changes;
  if (!fc) return null;
  const data = fc.after || fc.before || fc;
  if (data.handle) return `@${data.handle}`;
  if (data.influencer_handle) return `@${data.influencer_handle}`;
  return null;
}

function extractDate(log: AuditLog): string | null {
  const fc = log.field_changes;
  if (!fc) return null;
  const data = fc.after || fc.before || fc;
  if (data.date) {
    try {
      const d = new Date(data.date + "T00:00:00");
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    } catch { return data.date; }
  }
  return null;
}

/** Check if a log involves a comprovante/attachment change */
export function isAttachmentAction(log: AuditLog): boolean {
  if (!log.field_changes) return false;
  if (log.action === "UPDATE") {
    return Object.keys(log.field_changes).some(k => k === "comprovante_url");
  }
  if (log.action === "INSERT" && log.field_changes.after) {
    return !!(log.field_changes.after as any).comprovante_url;
  }
  return false;
}

/** Check if a field change is financial and return direction */
export function financialDirection(key: string, change: { before: any; after: any }): "up" | "down" | null {
  if (!FINANCIAL_FIELDS.has(key)) return null;
  const before = parseFloat(change.before) || 0;
  const after = parseFloat(change.after) || 0;
  if (after > before) return "up";
  if (after < before) return "down";
  return null;
}

export function isFinancialField(key: string): boolean {
  return FINANCIAL_FIELDS.has(key);
}

/** Generate a human-readable description for an audit log */
export function humanDescription(log: AuditLog): string {
  const handle = extractHandle(log);
  const date = extractDate(log);
  const entity = log.entity_type;
  const action = log.action;
  const fc = log.field_changes;

  if (entity === "daily_influencer_records") {
    const suffix = handle ? ` para ${handle}` : "";
    const dateSuffix = date ? ` no dia ${date}` : "";

    if (action === "INSERT") return `Adicionou registro diário${suffix}${dateSuffix}`;
    if (action === "DELETE") return `Removeu registro diário${suffix}${dateSuffix}`;

    if (fc) {
      const keys = Object.keys(fc).filter(k => k !== "before" && k !== "after");
      if (keys.length === 1) {
        const k = keys[0];
        if (k === "valor_pago") return `Alterou valor pago${suffix}${dateSuffix}`;
        if (k === "faturamento") return `Alterou faturamento${suffix}${dateSuffix}`;
        if (k === "acumulado") return `Alterou acumulado${suffix}${dateSuffix}`;
        if (k === "comprovante_url") return `Inseriu comprovante de pagamento${suffix}${dateSuffix}`;
        if (k === "status") {
          const after = (fc[k] as any)?.after;
          return `Alterou status${suffix} para "${after || "—"}"${dateSuffix}`;
        }
        if (k === "observacao") return `Editou observação${suffix}${dateSuffix}`;
      }
      if (keys.some(k => ["valor_pago", "faturamento", "acumulado"].includes(k))) {
        return `Editou valores financeiros${suffix}${dateSuffix}`;
      }
      return `Editou registro diário${suffix}${dateSuffix}`;
    }
    return `Editou registro diário${suffix}${dateSuffix}`;
  }

  if (entity === "influencers") {
    if (action === "INSERT") return `Cadastrou influenciador ${handle || ""}`.trim();
    if (action === "DELETE") return `Removeu influenciador ${handle || ""} do sistema`.trim();
    if (fc) {
      const keys = Object.keys(fc).filter(k => k !== "before" && k !== "after");
      if (keys.includes("ativo")) {
        const after = (fc.ativo as any)?.after;
        return after === false
          ? `Desativou influenciador ${handle || ""}`.trim()
          : `Reativou influenciador ${handle || ""}`.trim();
      }
      if (keys.includes("owner_nome") || keys.includes("owner_id")) {
        const ownerAfter = (fc.owner_nome as any)?.after;
        return `Atribuiu influenciador ${handle || ""} para ${ownerAfter || "novo responsável"}`.trim();
      }
      if (keys.includes("last_closed_at")) return `Registrou fechamento de ${handle || "influenciador"}`.trim();
      if (keys.includes("notas")) return `Editou notas de ${handle || "influenciador"}`.trim();
    }
    return `Editou influenciador ${handle || ""}`.trim();
  }

  if (entity === "close_events") {
    if (action === "INSERT") {
      const acao = fc?.after?.acao || fc?.acao;
      if (acao === "FECHAR") return `Fechou influenciador ${handle || ""}`.trim();
      if (acao === "SOLTAR") return `Soltou influenciador ${handle || ""}`.trim();
      return `Registrou evento de fechamento para ${handle || "influenciador"}`.trim();
    }
    if (action === "DELETE") return `Removeu evento de fechamento de ${handle || "influenciador"}`.trim();
    return `Editou evento de fechamento de ${handle || "influenciador"}`.trim();
  }

  if (entity === "daily_sheets") {
    if (action === "INSERT") return `Criou seção do dia ${date || ""}`.trim();
    if (action === "DELETE") return `Removeu seção do dia ${date || ""}`.trim();
    return `Editou seção do dia ${date || ""}`.trim();
  }

  if (entity === "monthly_influencer_list") {
    if (action === "INSERT") return `Adicionou ${handle || "influenciador"} na lista do mês`.trim();
    if (action === "DELETE") return `Removeu ${handle || "influenciador"} da lista do mês`.trim();
    if (fc) {
      const keys = Object.keys(fc).filter(k => k !== "before" && k !== "after");
      const hasValor = keys.some(k => k.startsWith("casa_") && k.endsWith("_valor"));
      const hasEmail = keys.some(k => k.startsWith("casa_") && k.endsWith("_email"));
      if (hasValor && hasEmail) return `Editou valores e emails de ${handle || "influenciador"} na lista do mês`.trim();
      if (hasValor) return `Editou valores de ${handle || "influenciador"} na lista do mês`.trim();
      if (hasEmail) return `Editou email de afiliado de ${handle || "influenciador"} na lista do mês`.trim();
    }
    return `Editou ${handle || "influenciador"} na lista do mês`.trim();
  }

  if (entity === "monthly_platform_names") {
    if (action === "INSERT") return "Configurou nomes de plataformas do mês";
    return "Editou nomes de plataformas do mês";
  }

  const entityLabel = ENTITY_LABELS[entity] || entity;
  if (action === "INSERT") return `Criou ${entityLabel.toLowerCase()}`;
  if (action === "DELETE") return `Removeu ${entityLabel.toLowerCase()}`;
  return `Editou ${entityLabel.toLowerCase()}`;
}

/** Filter out internal fields for display in the detail modal */
export function getDisplayFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (key === "before" || key === "after") continue;
    if (HIDDEN_DETAIL_FIELDS.has(key)) continue;
    result[key] = val;
  }
  return result;
}

export function getDisplayData(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (HIDDEN_DETAIL_FIELDS.has(key)) continue;
    result[key] = val;
  }
  return result;
}

export function formatValue(val: any): string {
  if (val === null || val === undefined) return "(vazio)";
  if (typeof val === "boolean") return val ? "Sim" : "Não";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/** Format a numeric value as BRL currency */
export function formatCurrency(val: any): string {
  const num = parseFloat(val);
  if (isNaN(num)) return formatValue(val);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const PAGE_SIZE = 50;
