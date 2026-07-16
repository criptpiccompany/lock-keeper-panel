import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authorizationError, authorizeRequest } from "../_shared/authorize.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let caller;
    try {
      caller = await authorizeRequest(req, ["ADMIN", "FINANCEIRO", "CLOSER"]);
    } catch (error) {
      return authorizationError(error, corsHeaders);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { receiptId } = await req.json();
    if (!receiptId) {
      return new Response(JSON.stringify({ error: "receiptId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rec, error: recErr } = await supabase
      .from("daily_receipt_uploads")
      .select("id, closer_id, file_url, file_type, parsed_data")
      .eq("id", receiptId)
      .single();
    if (recErr || !rec) throw recErr || new Error("not found");
    const canReadAnyReceipt = caller.isService || caller.roles.some((role) => role === "ADMIN" || role === "FINANCEIRO");
    if (!canReadAnyReceipt && rec.closer_id !== caller.userId) {
      return authorizationError(new Error("FORBIDDEN"), corsHeaders);
    }
    const manualInfluencer = (rec as any)?.parsed_data?.manual_influencer ?? null;

    if (rec.file_type === "pdf") {
      await supabase.from("daily_receipt_uploads")
        .update({ parse_status: "unsupported", parsed_at: new Date().toISOString() })
        .eq("id", receiptId);
      return new Response(JSON.stringify({ ok: true, skipped: "pdf" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sign URL if needed
    const path = rec.file_url.split("/comprovantes/")[1];
    let imageUrl = rec.file_url;
    if (path) {
      const { data: signed } = await supabase.storage.from("comprovantes").createSignedUrl(path, 600);
      if (signed?.signedUrl) imageUrl = signed.signedUrl;
    }

    // Mark processing
    await supabase.from("daily_receipt_uploads")
      .update({ parse_status: "processing" }).eq("id", receiptId);

    const prompt = `Analise este comprovante de pagamento brasileiro (PIX, TED, transferência) e extraia os dados.
Responda APENAS com JSON válido neste formato exato (use null para campos não encontrados):
{
  "valor": "120,00",
  "destinatario": "Nome completo do recebedor",
  "cpf_cnpj": "123.456.789-00",
  "banco": "Nome do banco/instituição destino",
  "data": "08/06/2026",
  "hora": "14:32",
  "tipo": "PIX|TED|DOC|Transferência",
  "id_transacao": "código/end-to-end"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI error", aiRes.status, txt);
      await supabase.from("daily_receipt_uploads")
        .update({ parse_status: "error", parsed_at: new Date().toISOString() })
        .eq("id", receiptId);
      return new Response(JSON.stringify({ error: "ai_failed", status: aiRes.status, detail: txt }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const text: string = aiJson.choices?.[0]?.message?.content || "";
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: any = null;
    try {
      const match = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : cleaned);
    } catch (e) {
      parsed = { raw: text };
    }

    const merged = { ...(parsed || {}), ...(manualInfluencer ? { manual_influencer: manualInfluencer } : {}) };
    await supabase.from("daily_receipt_uploads")
      .update({
        parsed_data: merged,
        parse_status: "done",
        parsed_at: new Date().toISOString(),
      })
      .eq("id", receiptId);

    return new Response(JSON.stringify({ ok: true, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("parse-receipt error", err);
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
