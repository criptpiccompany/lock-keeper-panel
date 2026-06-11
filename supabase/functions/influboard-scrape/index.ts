// Influboard scraper - login Laravel + GET painel-de-consulta
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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

    // 2) POST /login (form-encoded)
    const body = new URLSearchParams({ email, password, remember: 'on' });
    const r2 = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml',
        Referer: `${BASE}/login`,
        Origin: BASE,
        Cookie: cookieHeader(jar),
        'X-XSRF-TOKEN': xsrf,
      },
      body: body.toString(),
      redirect: 'manual',
    });
    mergeJar(jar, parseSetCookies(r2.headers));
    const loginLocation = r2.headers.get('location') ?? '';
    const loginStatus = r2.status;

    // Laravel redirects 302 on success
    if (loginStatus !== 302 && loginStatus !== 303) {
      const txt = await r2.text();
      return new Response(JSON.stringify({
        error: 'Login não retornou redirect',
        status: loginStatus,
        location: loginLocation,
        bodyPreview: txt.slice(0, 800),
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    await r2.text();

    // 3) GET /closer/painel-de-consulta as HTML (to discover Inertia version)
    const r3 = await fetch(`${BASE}/closer/painel-de-consulta`, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        Referer: BASE,
        Cookie: cookieHeader(jar),
      },
      redirect: 'manual',
    });
    mergeJar(jar, parseSetCookies(r3.headers));
    const finalStatus = r3.status;
    const finalLocation = r3.headers.get('location') ?? '';
    const html = await r3.text();

    // Extract Inertia data-page JSON (try several quoting/attribute patterns)
    let inertiaData: any = null;
    let inertiaVersion: string | null = null;
    const patterns = [
      /data-page=(?:"|&quot;)((?:(?!data-page=)[\s\S])*?)(?:"|&quot;)\s*>/,
      /data-page='([^']+)'/,
      /data-page="((?:\\.|[^"\\])+)"/,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m) {
        try {
          const decoded = m[1]
            .replaceAll('&quot;', '"')
            .replaceAll('&#039;', "'")
            .replaceAll('&apos;', "'")
            .replaceAll('&amp;', '&')
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>');
          inertiaData = JSON.parse(decoded);
          inertiaVersion = inertiaData?.version ?? null;
          break;
        } catch (_) { /* try next */ }
      }
    }

    // 4) Re-fetch as Inertia JSON (much cleaner: returns props directly)
    let inertiaJson: any = null;
    let inertiaJsonStatus: number | null = null;
    try {
      const r4 = await fetch(`${BASE}/closer/painel-de-consulta`, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html, application/xhtml+xml',
          Referer: `${BASE}/closer/dashboard`,
          Cookie: cookieHeader(jar),
          'X-Inertia': 'true',
          'X-Requested-With': 'XMLHttpRequest',
          ...(inertiaVersion ? { 'X-Inertia-Version': inertiaVersion } : {}),
        },
        redirect: 'manual',
      });
      inertiaJsonStatus = r4.status;
      mergeJar(jar, parseSetCookies(r4.headers));
      const txt = await r4.text();
      try { inertiaJson = JSON.parse(txt); } catch { inertiaJson = { _raw: txt.slice(0, 1500) }; }
    } catch (e) {
      inertiaJson = { error: String((e as Error).message) };
    }

    return new Response(JSON.stringify({
      ok: true,
      loginStatus,
      loginLocation,
      finalStatus,
      finalLocation,
      htmlLength: html.length,
      htmlPreview: html.slice(0, 1500),
      inertiaVersion,
      inertiaData,
      inertiaJsonStatus,
      inertiaJson,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
