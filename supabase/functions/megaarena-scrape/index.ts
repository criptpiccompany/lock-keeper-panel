// MegaArena scraper — Laravel login + GET /adm/planos (Hoje) + snapshot em DB
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const BASE = 'https://megaarenabrasil.com';

function parseSetCookies(headers: Headers): Record<string, string> {
  const jar: Record<string, string> = {};
  const all = (headers as any).getSetCookie?.() ?? [];
  for (const raw of all) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return jar;
}
const cookieHeader = (jar: Record<string, string>) =>
  Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
const mergeJar = (t: Record<string, string>, s: Record<string, string>) => {
  for (const [k, v] of Object.entries(s)) t[k] = v;
};

// Converte "R$ 1.234,56" → 123456 (centavos). Aceita "R$ 0,00", "0", "" → 0.
function brlToCents(raw: string | null | undefined): number {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(digits);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

function parseTableRows(html: string): any[] {
  // Extrai <tr> do tbody. Estratégia genérica: pega todas <tr>, para cada uma pega células <td>.
  const rows: any[] = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRe = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  const stripTags = (s: string) =>
    s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
     .replace(/\s+/g, ' ').trim();

  let m;
  while ((m = trRe.exec(html)) !== null) {
    const inner = m[1];
    const cells: string[] = [];
    let tm;
    tdRe.lastIndex = 0;
    while ((tm = tdRe.exec(inner)) !== null) cells.push(tm[1]);
    if (cells.length >= 8) {
      // Layout esperado (baseado no print):
      // 0 Afiliado (+ID), 1 E-mail, 2 Closer, 3 Indicados, 4 Ativos,
      // 5 Depositado, 6 Comissão, 7 Sacado, 8 Status, 9 Cadastro
      const afiliadoText = stripTags(cells[0]);
      const idMatch = afiliadoText.match(/ID:\s*(\d+)/i);
      const handle = afiliadoText.replace(/ID:\s*\d+/i, '').trim();
      const external_id = idMatch ? idMatch[1] : handle; // fallback

      rows.push({
        external_id,
        handle,
        email: stripTags(cells[1] ?? ''),
        closer_name: stripTags(cells[2] ?? '') || null,
        indicados: parseInt(stripTags(cells[3] ?? '0').replace(/\D/g, ''), 10) || 0,
        ativos: parseInt(stripTags(cells[4] ?? '0').replace(/\D/g, ''), 10) || 0,
        depositado_hoje_cents: brlToCents(stripTags(cells[5] ?? '')),
        comissao_hoje_cents: brlToCents(stripTags(cells[6] ?? '')),
        sacado_cents: brlToCents(stripTags(cells[7] ?? '')),
        status: stripTags(cells[8] ?? '') || null,
        cadastro_raw: stripTags(cells[9] ?? '') || null,
      });
    }
  }
  return rows;
}

function parseCadastro(raw: string | null): string | null {
  if (!raw) return null;
  // "03/07/2026 12:16"
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const [_, dd, mm, yyyy, hh, mi] = m;
  // BRT (UTC-3) → UTC
  const date = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00-03:00`);
  return date.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const email = Deno.env.get('MEGAARENA_EMAIL');
  const password = Deno.env.get('MEGAARENA_PASSWORD');
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Credenciais não configuradas' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
  const jar: Record<string, string> = {};
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const setMeta = async (status: string, count: number, error: string | null) => {
    await supabase.from('megaarena_sync_meta').upsert({
      id: 1,
      last_run_at: new Date().toISOString(),
      last_status: status,
      last_count: count,
      last_error: error,
    });
  };

  try {
    // 1) GET /adm/login
    const loginPaths = ['/adm/login', '/adm', '/login'];
    let loginUrl = '';
    let xsrf = '';
    let loginHtml = '';
    for (const p of loginPaths) {
      const r = await fetch(`${BASE}${p}`, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        redirect: 'manual',
      });
      mergeJar(jar, parseSetCookies(r.headers));
      const body = await r.text();
      if (jar['XSRF-TOKEN']) {
        loginUrl = `${BASE}${p}`;
        loginHtml = body;
        xsrf = decodeURIComponent(jar['XSRF-TOKEN']);
        break;
      }
    }
    if (!xsrf) {
      await setMeta('error', 0, 'XSRF-TOKEN não recebido em nenhuma rota de login');
      return new Response(JSON.stringify({
        error: 'XSRF-TOKEN não recebido', cookies: Object.keys(jar),
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Extract CSRF token from meta tag as fallback
    const csrfMeta = loginHtml.match(/<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"/i);
    const csrfToken = csrfMeta?.[1];

    // 2) POST login
    const body = new URLSearchParams({ email, password, remember: 'on' });
    if (csrfToken) body.append('_token', csrfToken);
    const r2 = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml',
        Referer: loginUrl,
        Origin: BASE,
        Cookie: cookieHeader(jar),
        'X-XSRF-TOKEN': xsrf,
      },
      body: body.toString(),
      redirect: 'manual',
    });
    mergeJar(jar, parseSetCookies(r2.headers));
    if (r2.status !== 302 && r2.status !== 303) {
      const txt = await r2.text();
      await setMeta('error', 0, `Login não retornou redirect (status ${r2.status})`);
      return new Response(JSON.stringify({
        error: 'Login não retornou redirect',
        status: r2.status,
        bodyPreview: txt.slice(0, 500),
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    await r2.text();

    // 3) GET /adm/planos paginado, filtro periodo=hoje
    const allRows: any[] = [];
    const redirectChain: string[] = [];
    let sessionOk = true;

    for (let page = 1; page <= 20; page++) {
      let url = `${BASE}/adm/planos?periodo=hoje&page=${page}`;
      let html = '';
      let status = 0;
      // segue até 3 hops preservando cookies
      for (let hop = 0; hop < 3; hop++) {
        const r = await fetch(url, {
          headers: {
            'User-Agent': UA,
            Accept: 'text/html,application/xhtml+xml',
            Referer: `${BASE}/adm/planos`,
            Cookie: cookieHeader(jar),
          },
          redirect: 'manual',
        });
        mergeJar(jar, parseSetCookies(r.headers));
        status = r.status;
        const loc = r.headers.get('location') ?? '';
        redirectChain.push(`p${page} ${status} ${url}${loc ? ' -> ' + loc : ''}`);
        if (status >= 300 && status < 400 && loc) {
          url = loc.startsWith('http') ? loc : `${BASE}${loc.startsWith('/') ? '' : '/'}${loc}`;
          await r.text();
          continue;
        }
        html = await r.text();
        break;
      }

      if (/\/login|\/adm\/login/i.test(url)) {
        sessionOk = false;
        break;
      }

      const rows = parseTableRows(html);
      if (rows.length === 0) break; // sem mais dados
      allRows.push(...rows);
      if (rows.length < 10) break; // última página (menos que o page-size)
    }

    if (!sessionOk) {
      await setMeta('error', 0, `Sessão inválida (redirect para login). chain=${redirectChain.slice(-3).join(' | ')}`);
      return new Response(JSON.stringify({
        error: 'Sessão inválida', redirectChain,
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (allRows.length === 0) {
      await setMeta('error', 0, 'Nenhuma linha extraída do HTML');
      return new Response(JSON.stringify({
        error: 'Nenhuma linha extraída',
        htmlPreview: redirectChain,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4) Upsert em megaarena_afiliados
    const nowIso = new Date().toISOString();
    const affRows = allRows.map((r) => ({
      external_id: r.external_id,
      handle: r.handle,
      email: r.email,
      closer_name: r.closer_name,
      cadastro_at: parseCadastro(r.cadastro_raw),
      last_seen_at: nowIso,
    }));
    const { error: affErr } = await supabase
      .from('megaarena_afiliados')
      .upsert(affRows, { onConflict: 'external_id' });
    if (affErr) console.error('afiliados upsert error', affErr);

    // 5) Insert snapshots
    const snaps = allRows.map((r) => ({
      afiliado_external_id: r.external_id,
      captured_at: nowIso,
      depositado_hoje_cents: r.depositado_hoje_cents,
      comissao_hoje_cents: r.comissao_hoje_cents,
      sacado_cents: r.sacado_cents,
      indicados: r.indicados,
      ativos: r.ativos,
      status: r.status,
    }));
    const { error: snapErr } = await supabase.from('megaarena_snapshots').insert(snaps);
    if (snapErr) console.error('snapshots insert error', snapErr);

    await setMeta(snapErr || affErr ? 'error' : 'ok', allRows.length, snapErr?.message ?? affErr?.message ?? null);

    return new Response(JSON.stringify({
      ok: true,
      count: allRows.length,
      sample: allRows.slice(0, 3),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    await setMeta('error', 0, String((err as Error).message));
    return new Response(JSON.stringify({ error: String((err as Error).message) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
