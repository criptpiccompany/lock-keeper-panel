import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "closer.teste@criptpic.dev";
  const password = "Teste@123456";
  const nome = "Closer Teste";

  // Check if exists
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    userId = data.user!.id;
  }

  const { data: team } = await supabase.from("teams").select("id").eq("name", "CRIPTPIC").single();

  await supabase.from("profiles").upsert({
    id: userId,
    nome,
    team_id: team!.id,
    status: "approved",
  });

  await supabase.from("user_roles").upsert(
    { user_id: userId, role: "CLOSER" },
    { onConflict: "user_id,role" }
  );

  return new Response(
    JSON.stringify({ ok: true, email, password, user_id: userId }),
    { headers: { "Content-Type": "application/json" } }
  );
});
