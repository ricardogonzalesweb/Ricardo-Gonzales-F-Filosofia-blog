export const prerender = false;
import type { APIRoute } from "astro";
import { randomBytes } from "node:crypto";
import { getClientIp, checkRateLimit } from "../../../lib/rate-limit";
import { sendEmail } from "../../../lib/resend";
import { supabaseUpsertSubscriber } from "../../../lib/supabase";
import { asString, isValidEmail, jsonResponse, parseBoolean } from "../../../lib/validation";
import { getAppEnv } from "../../../lib/env";

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`newsletter:${ip}`, 5, 60_000)) {
      return jsonResponse({ ok: false, error: "Muitas tentativas. Tente novamente em instantes." }, 429);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ ok: false, error: "Payload invalido." }, 400);
    }

    const email = asString((body as Record<string, unknown>).email).toLowerCase();
    const consent = parseBoolean((body as Record<string, unknown>).consent);
    const hpField = asString((body as Record<string, unknown>).hp_field);

    if (hpField) {
      return jsonResponse({ ok: true });
    }

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ ok: false, error: "E-mail invalido." }, 400);
    }

    if (!consent) {
      return jsonResponse({ ok: false, error: "Consentimento obrigatorio para assinar a newsletter." }, 400);
    }

    const token = randomBytes(24).toString("hex");
    await supabaseUpsertSubscriber(email, token, "site-newsletter");

    const env = getAppEnv();
    const confirmUrl = `${env.siteUrl}/api/newsletter/confirm?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Confirme sua inscricao na newsletter",
      html: `<h2>Confirme sua inscricao</h2><p>Para concluir, clique no link abaixo:</p><p><a href="${confirmUrl}">Confirmar inscricao</a></p><p>Se voce nao solicitou, ignore este e-mail.</p>`,
      text: `Confirme sua inscricao acessando: ${confirmUrl}`,
    });

    return jsonResponse({ ok: true, message: "Enviamos um e-mail para confirmar sua inscricao." });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "Nao foi possivel processar sua inscricao." }, 500);
  }
};
