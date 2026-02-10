import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { entity_id, entity_type, edit_reason, field_changes, influencer_handle } = await req.json();

    if (!entity_id || !edit_reason || edit_reason.trim().length < 8) {
      return new Response(JSON.stringify({ error: "edit_reason is required (min 8 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Update the most recent audit log for this entity with the edit reason
    const { data: logs } = await adminClient
      .from("audit_logs")
      .select("id")
      .eq("entity_id", entity_id)
      .eq("action", "UPDATE")
      .order("created_at", { ascending: false })
      .limit(1);

    let auditLogId: string | null = null;
    if (logs && logs.length > 0) {
      auditLogId = logs[0].id;
      await adminClient
        .from("audit_logs")
        .update({ edit_reason: edit_reason.trim() })
        .eq("id", auditLogId);
    }

    // Get user profile for notification
    const { data: profile } = await adminClient
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .single();

    // Create admin notification
    await adminClient.from("admin_notifications").insert({
      actor_user_id: user.id,
      actor_nome: profile?.nome || user.email?.split("@")[0] || "Desconhecido",
      actor_email: user.email,
      entity_type: entity_type || "daily_influencer_records",
      entity_id,
      influencer_handle: influencer_handle || null,
      action: "UPDATE",
      field_changes: field_changes || null,
      edit_reason: edit_reason.trim(),
      audit_log_id: auditLogId,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
