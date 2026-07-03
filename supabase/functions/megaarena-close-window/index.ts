// Fecha a janela 09h→09h do dia anterior e grava em megaarena_janela_9h.
// Janela D = 09h (D-1 BRT) → 09h (D BRT). Chamada às 09h05 BRT.
// Fórmula por afiliado:
//   valor_da_janela = (total_dia_ontem_23:59 - snapshot_ontem_09h) + snapshot_hoje_09h
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// BRT = UTC-3, sem DST.
function brtDayBounds(date: Date) {
  // date interpretado em BRT: retorna limites em UTC do dia BRT (00h..24h)
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 3, 0, 0)); // 00h BRT = 03h UTC
  const end = new Date(Date.UTC(y, m, d, 27, 0, 0)); // 24h BRT = 03h UTC do dia seguinte
  return { start, end };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // "hoje" e "ontem" em BRT
    const nowUtc = new Date();
    // BRT date atual
    const brtNow = new Date(nowUtc.getTime() - 3 * 3600 * 1000);
    const brtToday = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate()));
    const brtYesterday = new Date(brtToday.getTime() - 86400000);

    // 09h BRT hoje = 12h UTC hoje. 09h BRT ontem = 12h UTC ontem.
    const nineTodayUtc = new Date(brtToday.getTime() + 12 * 3600 * 1000);
    const nineYesterdayUtc = new Date(brtYesterday.getTime() + 12 * 3600 * 1000);
    // Fim do dia BRT de ontem (23:59:59 BRT = 02:59:59 UTC hoje)
    const endOfYesterdayUtc = new Date(brtToday.getTime() + 2 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000);

    // janela_date = dia da ABERTURA da janela (ontem BRT)
    const janelaDateStr = brtYesterday.toISOString().slice(0, 10);

    // Pega todos external_ids que tiveram algum snapshot em qualquer momento entre nineYesterday e nineToday+30min
    const searchStart = new Date(nineYesterdayUtc.getTime() - 30 * 60 * 1000).toISOString();
    const searchEnd = new Date(nineTodayUtc.getTime() + 30 * 60 * 1000).toISOString();

    const { data: distinctAff, error: dErr } = await supabase
      .from('megaarena_snapshots')
      .select('afiliado_external_id')
      .gte('captured_at', searchStart)
      .lte('captured_at', searchEnd);
    if (dErr) throw dErr;
    const ids = Array.from(new Set((distinctAff ?? []).map((r: any) => r.afiliado_external_id)));

    if (ids.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'Sem snapshots na janela', janela_date: janelaDateStr }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Para cada afiliado, buscar:
    //   A = snapshot mais próximo <= nineYesterdayUtc (dentro de 30min antes)
    //   B = último snapshot do dia BRT de ontem (<= endOfYesterdayUtc)
    //   C = snapshot mais próximo <= nineTodayUtc (dentro de 30min antes)
    // Se A ausente, assume 0. Se B ausente, assume A. Se C ausente, pula.
    // janela = (B - A) + C

    // Pega afiliados metadata para snapshot handle/closer
    const { data: affs } = await supabase
      .from('megaarena_afiliados')
      .select('external_id, handle, closer_name')
      .in('external_id', ids);
    const affMap = new Map<string, any>();
    (affs ?? []).forEach((a: any) => affMap.set(a.external_id, a));

    const results: any[] = [];
    // Processa em lotes de 20 pra não abusar de round-trips
    const BATCH = 20;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const promises = chunk.map(async (id) => {
        // A: <= 09h ontem
        const { data: aRow } = await supabase
          .from('megaarena_snapshots')
          .select('depositado_hoje_cents, comissao_hoje_cents, captured_at')
          .eq('afiliado_external_id', id)
          .lte('captured_at', nineYesterdayUtc.toISOString())
          .gte('captured_at', new Date(nineYesterdayUtc.getTime() - 60 * 60 * 1000).toISOString())
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        // B: último de ontem BRT
        const { data: bRow } = await supabase
          .from('megaarena_snapshots')
          .select('depositado_hoje_cents, comissao_hoje_cents, captured_at')
          .eq('afiliado_external_id', id)
          .lte('captured_at', endOfYesterdayUtc.toISOString())
          .gte('captured_at', new Date(brtYesterday.getTime() + 3 * 3600 * 1000).toISOString())
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        // C: <= 09h hoje
        const { data: cRow } = await supabase
          .from('megaarena_snapshots')
          .select('depositado_hoje_cents, comissao_hoje_cents, captured_at')
          .eq('afiliado_external_id', id)
          .lte('captured_at', nineTodayUtc.toISOString())
          .gte('captured_at', new Date(nineTodayUtc.getTime() - 60 * 60 * 1000).toISOString())
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const A = aRow?.depositado_hoje_cents ?? 0;
        const Ac = aRow?.comissao_hoje_cents ?? 0;
        const B = bRow?.depositado_hoje_cents ?? A;
        const Bc = bRow?.comissao_hoje_cents ?? Ac;
        const C = cRow?.depositado_hoje_cents ?? 0;
        const Cc = cRow?.comissao_hoje_cents ?? 0;

        const dep = Math.max(0, (B - A)) + Math.max(0, C);
        const com = Math.max(0, (Bc - Ac)) + Math.max(0, Cc);

        const meta = affMap.get(id) ?? {};
        return {
          afiliado_external_id: id,
          janela_date: janelaDateStr,
          depositado_janela_cents: dep,
          comissao_janela_cents: com,
          handle_snapshot: meta.handle ?? null,
          closer_snapshot: meta.closer_name ?? null,
          computed_at: new Date().toISOString(),
        };
      });
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    // Upsert
    const { error: upErr } = await supabase
      .from('megaarena_janela_9h')
      .upsert(results, { onConflict: 'afiliado_external_id,janela_date' });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({
      ok: true,
      janela_date: janelaDateStr,
      count: results.length,
      total_depositado_cents: results.reduce((s, r) => s + r.depositado_janela_cents, 0),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
