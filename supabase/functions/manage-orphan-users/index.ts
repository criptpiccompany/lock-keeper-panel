import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    if (roleData?.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Apenas admins" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, userIds } = await req.json();

    if (action === "list") {
      // Get all profiles
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, status, created_at")
        .order("nome");

      // Get all auth users
      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const authIds = new Set((authUsers || []).map((u: any) => u.id));

      // Get roles
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role");
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));

      const orphans = (profiles || [])
        .filter((p: any) => !authIds.has(p.id))
        .map((p: any) => ({
          id: p.id,
          nome: p.nome,
          status: p.status,
          role: roleMap.get(p.id) || "CLOSER",
          created_at: p.created_at,
        }));

      return new Response(JSON.stringify({ orphans, totalProfiles: profiles?.length || 0, totalAuth: authUsers?.length || 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return new Response(JSON.stringify({ error: "userIds obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify all are actually orphans (no auth entry)
      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const authIds = new Set((authUsers || []).map((u: any) => u.id));
      
      const nonOrphans = userIds.filter((id: string) => authIds.has(id));
      if (nonOrphans.length > 0) {
        return new Response(JSON.stringify({ error: "Alguns IDs possuem conta auth e não podem ser excluídos por aqui", ids: nonOrphans }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete from user_roles then profiles
      await supabaseAdmin.from("user_roles").delete().in("user_id", userIds);
      await supabaseAdmin.from("profiles").delete().in("id", userIds);

      console.log(`Orphan users deleted: ${userIds.join(", ")} by admin ${callerUser.email}`);

      return new Response(JSON.stringify({ success: true, deleted: userIds.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in manage-orphan-users:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
