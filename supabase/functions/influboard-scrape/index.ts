// Influboard scraper - login Laravel + GET painel-de-consulta + cache em DB
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizationError, authorizeRequest } from '../_shared/authorize.ts';

const BASE = 'https://influboard.site';

function parseSetCookies(headers: Headers): Record<string, string> {
  const jar: Record<string, string> = {};
  // Deno: getSetCookie returns all Set-Cookie entries
  const all = (headers as any).getSetCookie?.() ?? [];
  for (const raw of all) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      jar[name] = value;
    }
  }
  return jar;
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function mergeJar(target: Record<string, string>, src: Record<string, string>) {
  for (const [k, v] of Object.entries(src)) target[k] = v;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    try {
      await authorizeRequest(req, ['ADMIN', 'CLOSER']);
    } catch (error) {
      return authorizationError(error, corsHeaders);
    }

    const email = Deno.env.get('INFLUBOARD_EMAIL');
    const password = Deno.env.get('INFLUBOARD_PASSWORD');
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Credenciais não configuradas' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    const jar: Record<string, string> = {};

    // 1) GET /login to obtain XSRF-TOKEN + session cookies
    const r1 = await fetch(`${BASE}/login`, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'manual',
    });
    mergeJar(jar, parseSetCookies(r1.headers));
    await r1.text();

    const xsrfRaw = jar['XSRF-TOKEN'];
    if (!xsrfRaw) {
      return new Response(JSON.stringify({ error: 'XSRF-TOKEN não recebido', step: 'GET /login', status: r1.status, cookies: Object.keys(jar) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const xsrf = decodeURIComponent(xsrfRaw);

    // 2) POST /login — Inertia JSON (site migrado para Inertia/Vue)
    const r2 = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Accept: 'text/html, application/xhtml+xml',
        'X-Inertia': 'true',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${BASE}/login`,
        Origin: BASE,
        Cookie: cookieHeader(jar),
        'X-XSRF-TOKEN': xsrf,
      },
      body: JSON.stringify({ email, password, remember: false }),
      redirect: 'manual',
    });
    mergeJar(jar, parseSetCookies(r2.headers));
    const loginLocation = r2.headers.get('location') ?? '';
    const loginStatus = r2.status;

    // Inertia: sucesso = 302 para /closer/*; falha = 302 de volta para /login
    if (loginStatus !== 302 && loginStatus !== 303) {
      const txt = await r2.text();
      return new Response(JSON.stringify({
        error: 'Login não retornou redirect',
        status: loginStatus,
        location: loginLocation,
        bodyPreview: txt.slice(0, 800),
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (/\/login/i.test(loginLocation)) {
      await r2.text();
      return new Response(JSON.stringify({
        error: 'Credenciais rejeitadas (redirect volta para /login) — senha do Influboard pode ter sido alterada',
        status: loginStatus,
        location: loginLocation,
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    await r2.text();

    // 3) GET /closer/painel-de-consulta as HTML (follow up to 3 redirects manually,
    //    propagating cookies — `redirect: 'follow'` drops the Cookie header on hop).
    let currentUrl = `${BASE}/closer/painel-de-consulta`;
    let r3: Response | null = null;
    let html = '';
    let finalStatus = 0;
    let finalLocation = '';
    let redirectChain: string[] = [];
    for (let hop = 0; hop < 4; hop++) {
      r3 = await fetch(currentUrl, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml',
          Referer: BASE,
          Cookie: cookieHeader(jar),
        },
        redirect: 'manual',
      });
      mergeJar(jar, parseSetCookies(r3.headers));
      finalStatus = r3.status;
      finalLocation = r3.headers.get('location') ?? '';
      redirectChain.push(`${finalStatus} ${currentUrl}${finalLocation ? ' -> ' + finalLocation : ''}`);
      if (finalStatus >= 300 && finalStatus < 400 && finalLocation) {
        currentUrl = finalLocation.startsWith('http') ? finalLocation : `${BASE}${finalLocation.startsWith('/') ? '' : '/'}${finalLocation}`;
        await r3.text();
        continue;
      }
      html = await r3.text();
      break;
    }

    // Extract Inertia data-page JSON from <script data-page="app" type="application/json">{...}</script>
    let inertiaData: any = null;
    let inertiaVersion: string | null = null;
    const scriptMatch = html.match(/<script[^>]*data-page="app"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      try {
        inertiaData = JSON.parse(scriptMatch[1]);
        inertiaVersion = inertiaData?.version ?? null;
      } catch (_) { /* ignore */ }
    }

    const props = inertiaData?.props ?? {};
    const lockedInfluencers = Array.isArray(props.lockedInfluencers) ? props.lockedInfluencers : [];

    // Detect silent auth failure: page didn't render the Inertia component or user is missing.
    const authOk = !!props?.auth?.user;
    const sessionFailed = !inertiaData || !authOk || /\/login/i.test(currentUrl);

    // Persist to cache (service role)
    let cacheError: string | null = null;
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      if (sessionFailed) {
        // Do NOT wipe the cache on silent auth failure — keep last good data.
        cacheError = `Sessão inválida (login não autenticou). finalUrl=${currentUrl} chain=${redirectChain.join(' | ')}`;
      } else if (lockedInfluencers.length > 0) {
        const rows = lockedInfluencers.map((inf: any) => ({
          external_id: inf.id ?? null,
          handle: inf.handle,
          handle_normalized: String(inf.handle ?? '').replace(/^@/, '').toLowerCase(),
          instagram_url: inf.instagram_url ?? null,
          lock_expires_at: inf.lock_expires_at ?? null,
          closer_name: Array.isArray(inf.closers) ? inf.closers.map((c: any) => c.name).join(', ') : null,
          team_name: inf.team?.name ?? null,
          fetched_at: new Date().toISOString(),
        }));

        // Replace strategy for current cache: delete all then insert
        await supabase.from('influboard_locked_cache').delete().neq('id', -1);
        const { error: insErr } = await supabase.from('influboard_locked_cache').insert(rows);
        if (insErr) cacheError = insErr.message;

        // ---- Persistent renewal history -----------------------------------
        const handles = rows.map(r => r.handle_normalized);
        const { data: existingHistory } = await supabase
          .from('influboard_lock_history')
          .select('handle_normalized, last_expires_at, lock_count, first_locked_at')
          .in('handle_normalized', handles);
        const histMap = new Map<string, any>();
        (existingHistory ?? []).forEach((h: any) => histMap.set(h.handle_normalized, h));

        const nowIso = new Date().toISOString();
        const TOLERANCE_MS = 60 * 60 * 1000;

        const upserts = rows.map(r => {
          const prev = histMap.get(r.handle_normalized);
          const newExpMs = r.lock_expires_at ? new Date(r.lock_expires_at).getTime() : 0;
          const prevExpMs = prev?.last_expires_at ? new Date(prev.last_expires_at).getTime() : 0;
          let lock_count = prev?.lock_count ?? 1;
          if (!prev) {
            lock_count = 1;
          } else if (newExpMs > prevExpMs + TOLERANCE_MS) {
            lock_count = (prev.lock_count ?? 1) + 1;
          }
          return {
            handle_normalized: r.handle_normalized,
            handle: r.handle,
            first_locked_at: prev?.first_locked_at ?? nowIso,
            last_locked_at: nowIso,
            last_expires_at: r.lock_expires_at,
            lock_count,
            last_closer_name: r.closer_name,
            last_team_name: r.team_name,
          };
        });

        if (upserts.length > 0) {
          const { error: hErr } = await supabase
            .from('influboard_lock_history')
            .upsert(upserts, { onConflict: 'handle_normalized' });
          if (hErr && !cacheError) cacheError = hErr.message;
        }
      } else {
        // Page rendered ok, but list legitimately empty.
        await supabase.from('influboard_locked_cache').delete().neq('id', -1);
      }

      await supabase.from('influboard_sync_meta').upsert({
        id: 1,
        last_run_at: new Date().toISOString(),
        last_count: sessionFailed ? 0 : lockedInfluencers.length,
        last_status: sessionFailed || cacheError ? 'error' : 'ok',
        last_error: cacheError,
      });
    } catch (e) {
      cacheError = String((e as Error).message);
    }

    return new Response(JSON.stringify({
      ok: !sessionFailed,
      loginStatus,
      finalStatus,
      finalUrl: currentUrl,
      redirectChain,
      component: inertiaData?.component ?? null,
      authUser: props?.auth?.user ?? null,
      sessionFailed,
      count: lockedInfluencers.length,
      lockedInfluencers,
      cacheError,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
