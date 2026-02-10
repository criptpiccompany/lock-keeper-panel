import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Jaro-Winkler similarity
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const l1 = s1.length;
  const l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0;

  const matchWindow = Math.max(Math.floor(Math.max(l1, l2) / 2) - 1, 0);
  const s1Matches = new Array(l1).fill(false);
  const s2Matches = new Array(l2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, l2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / l1 + matches / l2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(l1, l2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function normalizeHandle(h: string): string {
  let n = h.toLowerCase().trim().replace(/\s+/g, "");
  if (!n.startsWith("@")) n = "@" + n;
  return n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { monthKey } = await req.json();
    if (!monthKey) {
      return new Response(JSON.stringify({ error: "monthKey required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all monthly list entries for the month
    const { data: listData, error: listError } = await adminClient
      .from("monthly_influencer_list")
      .select("id, closer_id, influencer_id, influencer_handle, casa_1_email, casa_1_valor, casa_2_email, casa_2_valor, casa_3_email, casa_3_valor, valor_total, observacoes")
      .eq("month", monthKey);

    if (listError) throw listError;
    const rows = listData || [];

    // Fetch closer names
    const closerIds = [...new Set(rows.map((r: any) => r.closer_id))];
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, nome")
      .in("id", closerIds);
    const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.nome]));

    const conflicts: any[] = [];

    // 1. HANDLE_DUPLICATE_ACROSS_USERS
    const handleGroups = new Map<string, any[]>();
    for (const r of rows) {
      const key = normalizeHandle(r.influencer_handle);
      const list = handleGroups.get(key) || [];
      list.push(r);
      handleGroups.set(key, list);
    }

    for (const [handle, group] of handleGroups) {
      const uniqueClosers = [...new Set(group.map((r: any) => r.closer_id))];
      if (uniqueClosers.length >= 2) {
        conflicts.push({
          month_key: monthKey,
          type: "HANDLE_DUPLICATE_ACROSS_USERS",
          severity: "warning",
          handle,
          users_involved: uniqueClosers.map((id) => ({
            id,
            nome: nameMap.get(id) || "?",
          })),
          meta: {
            entries: group.map((r: any) => ({
              row_id: r.id,
              closer_id: r.closer_id,
              closer_nome: nameMap.get(r.closer_id) || "?",
              handle: r.influencer_handle,
              casa_1_email: r.casa_1_email,
              casa_1_valor: r.casa_1_valor,
              casa_2_email: r.casa_2_email,
              casa_2_valor: r.casa_2_valor,
              casa_3_email: r.casa_3_email,
              casa_3_valor: r.casa_3_valor,
              valor_total: r.valor_total,
            })),
          },
        });
      }
    }

    // 2. EMAIL_DUPLICATE_ACROSS_USERS
    const emailGroups = new Map<string, any[]>();
    for (const r of rows) {
      for (const emailField of ["casa_1_email", "casa_2_email", "casa_3_email"]) {
        const email = (r as any)[emailField]?.trim().toLowerCase();
        if (!email) continue;
        const list = emailGroups.get(email) || [];
        list.push({ ...r, _source_field: emailField });
        emailGroups.set(email, list);
      }
    }

    for (const [email, group] of emailGroups) {
      const uniqueClosers = [...new Set(group.map((r: any) => r.closer_id))];
      if (uniqueClosers.length >= 2) {
        conflicts.push({
          month_key: monthKey,
          type: "EMAIL_DUPLICATE_ACROSS_USERS",
          severity: "critical",
          affiliate_email: email,
          handle: group.map((r: any) => r.influencer_handle).join(", "),
          users_involved: uniqueClosers.map((id) => ({
            id,
            nome: nameMap.get(id) || "?",
          })),
          meta: {
            entries: group.map((r: any) => ({
              row_id: r.id,
              closer_id: r.closer_id,
              closer_nome: nameMap.get(r.closer_id) || "?",
              handle: r.influencer_handle,
              email,
              source_field: r._source_field,
              casa_1_email: r.casa_1_email,
              casa_1_valor: r.casa_1_valor,
              casa_2_email: r.casa_2_email,
              casa_2_valor: r.casa_2_valor,
              casa_3_email: r.casa_3_email,
              casa_3_valor: r.casa_3_valor,
              valor_total: r.valor_total,
            })),
          },
        });
      }
    }

    // 3. MULTIPLE_EMAILS_SAME_HANDLE_SAME_USER
    for (const r of rows) {
      const emails = new Set<string>();
      for (const f of ["casa_1_email", "casa_2_email", "casa_3_email"]) {
        const e = (r as any)[f]?.trim().toLowerCase();
        if (e) emails.add(e);
      }
      if (emails.size >= 2) {
        conflicts.push({
          month_key: monthKey,
          type: "MULTIPLE_EMAILS_SAME_HANDLE_SAME_USER",
          severity: "info",
          handle: normalizeHandle(r.influencer_handle),
          users_involved: [{ id: r.closer_id, nome: nameMap.get(r.closer_id) || "?" }],
          meta: {
            emails: [...emails],
            row_id: r.id,
            handle: r.influencer_handle,
            closer_nome: nameMap.get(r.closer_id) || "?",
            casa_1_email: r.casa_1_email,
            casa_2_email: r.casa_2_email,
            casa_3_email: r.casa_3_email,
          },
        });
      }
    }

    // 4. SIMILAR_HANDLE_POSSIBLE_DUPLICATE (fuzzy match across users)
    const allHandles = [...handleGroups.keys()];
    const checkedPairs = new Set<string>();
    for (let i = 0; i < allHandles.length; i++) {
      for (let j = i + 1; j < allHandles.length; j++) {
        const h1 = allHandles[i];
        const h2 = allHandles[j];
        if (h1 === h2) continue;
        const pairKey = [h1, h2].sort().join("|");
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const sim = jaroWinkler(h1, h2);
        if (sim >= 0.88) {
          const g1 = handleGroups.get(h1)!;
          const g2 = handleGroups.get(h2)!;
          const allEntries = [...g1, ...g2];
          const uniqueClosers = [...new Set(allEntries.map((r: any) => r.closer_id))];
          conflicts.push({
            month_key: monthKey,
            type: "SIMILAR_HANDLE_POSSIBLE_DUPLICATE",
            severity: "warning",
            handle: `${h1} ≈ ${h2}`,
            users_involved: uniqueClosers.map((id) => ({
              id,
              nome: nameMap.get(id) || "?",
            })),
            meta: {
              similarity: Math.round(sim * 100) / 100,
              handle_1: h1,
              handle_2: h2,
              entries: allEntries.map((r: any) => ({
                row_id: r.id,
                closer_id: r.closer_id,
                closer_nome: nameMap.get(r.closer_id) || "?",
                handle: r.influencer_handle,
                valor_total: r.valor_total,
              })),
            },
          });
        }
      }
    }

    // Delete old conflicts for this month, insert new ones
    await adminClient
      .from("admin_conflicts")
      .delete()
      .eq("month_key", monthKey)
      .is("resolved_at", null);

    if (conflicts.length > 0) {
      const { error: insertError } = await adminClient
        .from("admin_conflicts")
        .insert(conflicts);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ scanned: rows.length, conflicts: conflicts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("scan-conflicts error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
