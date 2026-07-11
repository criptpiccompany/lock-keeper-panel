import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateUserRequest {
  userId: string;
  action: "update_password" | "update_name" | "deactivate_user";
  newPassword?: string;
  newName?: string;
}


const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    const callerRole = roleData?.role;
    const isAdmin = callerRole === "ADMIN";

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, action, newPassword, newName }: UpdateUserRequest = await req.json();

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: "userId e action são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_password") {
      if (!newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateError) {
        console.error("Update password error:", updateError);
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Password updated for user ${userId} by ${callerRole} ${callerUser.email}`);

      return new Response(
        JSON.stringify({ success: true, message: "Senha alterada com sucesso" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "update_name") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas ADMIN pode alterar nomes" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!newName || newName.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Nome não pode estar vazio" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ nome: newName.trim() })
        .eq("id", userId);

      if (updateError) {
        console.error("Update name error:", updateError);
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Name updated for user ${userId} to "${newName}" by admin ${callerUser.email}`);

      return new Response(
        JSON.stringify({ success: true, message: "Nome alterado com sucesso" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "deactivate_user") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas ADMIN pode desativar contas" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (userId === callerUser.id) {
        return new Response(JSON.stringify({ error: "Você não pode desativar sua própria conta" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1) Marca o perfil como desativado (bloqueia RLS via is_approved)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ status: "disabled" })
        .eq("id", userId);

      if (profileError) {
        console.error("Deactivate profile error:", profileError);
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2) Bane o usuário no auth (impede novos logins). Ban longo = desativação efetiva.
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      } as any);

      if (banError) {
        console.error("Ban user error:", banError);
        return new Response(JSON.stringify({ error: banError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`User ${userId} deactivated by admin ${callerUser.email}`);

      return new Response(
        JSON.stringify({ success: true, message: "Conta desativada com sucesso" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });


  } catch (error: any) {
    console.error("Error in admin-update-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
