import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { getClientIp, checkRateLimit } from "../../lib/rate-limit";
import { sendEmail } from "../../lib/resend";
import { supabaseInsert } from "../../lib/supabase";
import { asString, isValidEmail, jsonResponse, parseBoolean, safeMessage } from "../../lib/validation";
import { getAppEnv } from "../../lib/env";

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`contact:${ip}`, 5, 60_000)) {
      return jsonResponse({ ok: false, error: "Muitas tentativas. Tente novamente em instantes." }, 429);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ ok: false, error: "Payload invalido." }, 400);
    }

    const name = asString((body as Record<string, unknown>).name);
    const email = asString((body as Record<string, unknown>).email).toLowerCase();
    const subject = asString((body as Record<string, unknown>).subject);
    const message = safeMessage(asString((body as Record<string, unknown>).message));
    const consent = parseBoolean((body as Record<string, unknown>).consent);
    const hpField = asString((body as Record<string, unknown>).hp_field);

    if (hpField) {
      return jsonResponse({ ok: true });
    }

    if (!name || !email || !subject || !message) {
      return jsonResponse({ ok: false, error: "Preencha todos os campos obrigatorios." }, 400);
    }

    if (!isValidEmail(email)) {
      return jsonResponse({ ok: false, error: "E-mail invalido." }, 400);
    }

    const ipHash = createHash("sha256").update(ip).digest("hex");
    await supabaseInsert("contact_messages", {
      name,
      email,
      subject,
      message,
      consent,
      ip_hash: ipHash,
    });

    const env = getAppEnv();
    await sendEmail({
      to: env.contactInboxEmail,
      subject: `[Contato] ${subject}`,
      html: `<h2>Novo contato recebido</h2><p><strong>Nome:</strong> ${name}</p><p><strong>E-mail:</strong> ${email}</p><p><strong>Assunto:</strong> ${subject}</p><p><strong>Mensagem:</strong></p><p>${message.replace(/\n/g, "<br>")}</p>`,
      text: `Novo contato recebido\nNome: ${name}\nEmail: ${email}\nAssunto: ${subject}\nMensagem:\n${message}`,
    });

    return jsonResponse({ ok: true, message: "Mensagem enviada com sucesso." });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "Nao foi possivel enviar sua mensagem." }, 500);
  }
};
