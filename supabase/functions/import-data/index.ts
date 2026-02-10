import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCSV(csvText: string, delimiter = ";") {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(delimiter);
    const row: Record<string, any> = {};
    for (let j = 0; j < headers.length; j++) {
      let val = (values[j] || "").trim();
      if (val === "" || val === "undefined") val = null;
      if (val === "true") val = true;
      if (val === "false") val = false;
      row[headers[j]] = val;
    }
    rows.push(row);
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // --- Authentication: require a valid user ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Authorization: require ADMIN role ---
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleCheck } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "ADMIN",
    });

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { table, csv, clear_all } = await req.json();

    // Clear all tables first if requested
    if (clear_all) {
      await adminClient.from("close_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("influencers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("user_roles").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("profiles").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Audit log
      await adminClient.from("audit_log").insert({
        user_id: user.id,
        user_nome: user.email || "admin",
        acao: "Importação",
        descricao: "Limpou todas as tabelas antes de importação",
        detalhes: { action: "clear_all" },
      });

      return new Response(JSON.stringify({ success: true, message: "All tables cleared" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!table || !csv) {
      return new Response(JSON.stringify({ error: "Missing table or csv" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = parseCSV(csv);

    // Clean up based on table
    if (table === "influencers") {
      for (const row of rows) {
        if (row.handle) row.handle = row.handle.replace(/^\t\s*/, "").trim();
        if (!row.owner_id) row.owner_id = null;
        if (!row.owner_nome) row.owner_nome = null;
        if (!row.last_closed_at) row.last_closed_at = null;
        if (!row.notas) row.notas = null;
      }
    }
    
    if (table === "close_events") {
      for (const row of rows) {
        if (row.influencer_handle) row.influencer_handle = row.influencer_handle.replace(/^\t\s*/, "").trim();
        if (!row.motivo) row.motivo = null;
      }
    }

    let totalErrors = 0;
    const batchSize = 50;
    const errorMessages: string[] = [];
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await adminClient.from(table).insert(batch);
      if (error) {
        console.error(`${table} batch ${i} error:`, error.message);
        errorMessages.push(`Batch ${i}: ${error.message}`);
        totalErrors++;
      }
    }

    // Audit log
    await adminClient.from("audit_log").insert({
      user_id: user.id,
      user_nome: user.email || "admin",
      acao: "Importação",
      descricao: `Importou ${rows.length} registros na tabela ${table}`,
      detalhes: { table, count: rows.length, errors: totalErrors },
    });

    return new Response(JSON.stringify({ 
      success: totalErrors === 0, 
      table,
      count: rows.length, 
      errors: totalErrors,
      errorMessages: errorMessages.slice(0, 5)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
