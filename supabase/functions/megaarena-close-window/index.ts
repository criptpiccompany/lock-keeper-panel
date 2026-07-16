// Fecha a janela 12h→12h do dia anterior e grava em megaarena_janela_9h.
// Janela D = 12h (D-1 BRT) → 12h (D BRT). Executar após 12h BRT.
// Fórmula por afiliado:
//   valor_da_janela = (total_dia_ontem_23:59 - snapshot_ontem_12h) + snapshot_hoje_12h
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizationError, authorizeRequest } from '../_shared/authorize.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    await authorizeRequest(req, ['ADMIN']);
  } catch (error) {
    return authorizationError(error, corsHeaders);
  }

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

    // 12h BRT hoje = 15h UTC hoje. 12h BRT ontem = 15h UTC ontem.
    const windowEndUtc = new Date(brtToday.getTime() + 15 * 3600 * 1000);
    const windowStartUtc = new Date(brtYesterday.getTime() + 15 * 3600 * 1000);
    // Fim do dia BRT de ontem (23:59:59 BRT = 02:59:59 UTC hoje)
    const endOfYesterdayUtc = new Date(brtToday.getTime() + 2 * 3600 * 1000 + 59 * 60 * 1000 + 59 * 1000);

    // janela_date = dia da ABERTURA da janela (ontem BRT)
    const janelaDateStr = brtYesterday.toISOString().slice(0, 10);

    // Pega external_ids com snapshots entre a abertura e o fechamento da janela.
    const searchStart = new Date(windowStartUtc.getTime() - 30 * 60 * 1000).toISOString();
    const searchEnd = new Date(windowEndUtc.getTime() + 30 * 60 * 1000).toISOString();

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
    //   A = snapshot mais próximo da abertura (dentro de 60min antes)
    //   B = último snapshot do dia BRT de ontem (<= endOfYesterdayUtc)
    //   C = snapshot mais próximo do fechamento (dentro de 60min antes)
    // Se A ausente, assume 0. Se B ausente, assume A. Se C ausente, pula.
    // janela = (B - A) + C

    // Pega afiliados metadata para snapshot handle/closer
    const { data: affs } = await supabase
      .from('megaarena_afiliados')
      .select('external_id, handle, email, closer_name, cadastro_at')
      .in('external_id', ids);
    const affMap = new Map<string, any>();
    (affs ?? []).forEach((a: any) => affMap.set(a.external_id, a));

    const results: any[] = [];
    // Processa em lotes de 20 pra não abusar de round-trips
    const BATCH = 20;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const promises = chunk.map(async (id) => {
        // A: snapshot de abertura da janela
        const { data: aRow } = await supabase
          .from('megaarena_snapshots')
          .select('depositado_hoje_cents, comissao_hoje_cents, indicados, ativos, captured_at')
          .eq('afiliado_external_id', id)
          .lte('captured_at', windowStartUtc.toISOString())
          .gte('captured_at', new Date(windowStartUtc.getTime() - 60 * 60 * 1000).toISOString())
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
        // C: snapshot de fechamento da janela
        const { data: cRow } = await supabase
          .from('megaarena_snapshots')
          .select('depositado_hoje_cents, comissao_hoje_cents, indicados, ativos, captured_at')
          .eq('afiliado_external_id', id)
          .lte('captured_at', windowEndUtc.toISOString())
          .gte('captured_at', new Date(windowEndUtc.getTime() - 60 * 60 * 1000).toISOString())
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
        const indicadosInicio = aRow?.indicados ?? 0;
        const indicadosFim = cRow?.indicados ?? indicadosInicio;
        const ativosInicio = aRow?.ativos ?? 0;
        const ativosFim = cRow?.ativos ?? ativosInicio;

        const meta = affMap.get(id) ?? {};
        return {
          afiliado_external_id: id,
          janela_date: janelaDateStr,
          depositado_janela_cents: dep,
          comissao_janela_cents: com,
          handle_snapshot: meta.handle ?? null,
          closer_snapshot: meta.closer_name ?? null,
          email_snapshot: meta.email ?? null,
          cadastro_snapshot: meta.cadastro_at ?? null,
          window_start: windowStartUtc.toISOString(),
          window_end: windowEndUtc.toISOString(),
          indicados_inicio: indicadosInicio,
          indicados_fim: indicadosFim,
          indicados_delta: Math.max(0, indicadosFim - indicadosInicio),
          ativos_inicio: ativosInicio,
          ativos_fim: ativosFim,
          ativos_delta: Math.max(0, ativosFim - ativosInicio),
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
