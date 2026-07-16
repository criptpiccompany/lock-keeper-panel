import { createClient } from "npm:@supabase/supabase-js@2";

type AppRole = "ADMIN" | "FINANCEIRO" | "CLOSER";

export type AuthorizedCaller = {
  userId: string | null;
  isService: boolean;
  roles: AppRole[];
};

/**
 * Autoriza chamadas privilegiadas sem confiar em dados enviados no body.
 * Agendamentos usam a service role; chamadas humanas usam o JWT do usuário.
 */
export async function authorizeRequest(
  req: Request,
  allowedRoles: AppRole[],
): Promise<AuthorizedCaller> {
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!token) throw new Error("UNAUTHORIZED");
  if (serviceKey && token === serviceKey) {
    return { userId: null, isService: true, roles: [] };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("UNAUTHORIZED");

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleError) throw roleError;

  const roles = (roleRows ?? []).map((row) => row.role as AppRole);
  if (!roles.some((role) => allowedRoles.includes(role))) {
    throw new Error("FORBIDDEN");
  }

  return { userId: user.id, isService: false, roles };
}

export function authorizationError(error: unknown, corsHeaders: HeadersInit) {
  const message = error instanceof Error ? error.message : "UNAUTHORIZED";
  const status = message === "FORBIDDEN" ? 403 : 401;
  return new Response(JSON.stringify({ error: status === 403 ? "Forbidden" : "Unauthorized" }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
