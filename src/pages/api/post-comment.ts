export const prerender = false;
import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { checkRateLimit, getClientIp } from "../../lib/rate-limit";
import { sendEmail } from "../../lib/resend";
import { supabaseInsert } from "../../lib/supabase";
import { asString, isValidEmail, jsonResponse, parseBoolean, safeMessage } from "../../lib/validation";
import { getAppEnv } from "../../lib/env";

export const POST: APIRoute = async ({ request }) => {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`post-comment:${ip}`, 5, 60_000)) {
      return jsonResponse({ ok: false, error: "Muitas tentativas. Tente novamente em instantes." }, 429);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ ok: false, error: "Payload invalido." }, 400);
    }

    const data = body as Record<string, unknown>;
    const name = asString(data.name);
    const email = asString(data.email).toLowerCase();
    const comment = safeMessage(asString(data.comment), 5000);
    const postSlug = asString(data.post_slug);
    const postTitle = asString(data.post_title);
    const consent = parseBoolean(data.consent);
    const hpField = asString(data.hp_field);

    if (hpField) {
      return jsonResponse({ ok: true });
    }

    if (!name || !email || !comment || !postSlug || !postTitle) {
      return jsonResponse({ ok: false, error: "Preencha todos os campos obrigatorios." }, 400);
    }

    if (!isValidEmail(email)) {
      return jsonResponse({ ok: false, error: "E-mail invalido." }, 400);
    }

    if (!consent) {
      return jsonResponse({ ok: false, error: "Consentimento obrigatorio para contato." }, 400);
    }

    const ipHash = createHash("sha256").update(ip).digest("hex");

    await supabaseInsert("post_comments_leads", {
      name,
      email,
      comment,
      post_slug: postSlug,
      post_title: postTitle,
      consent,
      source: "post-comment",
      ip_hash: ipHash,
    });

    const env = getAppEnv();
    await sendEmail({
      to: env.contactInboxEmail,
      subject: `[Comentario] ${postTitle}`,
      html: `<h2>Novo comentario captado</h2><p><strong>Post:</strong> ${postTitle}</p><p><strong>Slug:</strong> ${postSlug}</p><p><strong>Nome:</strong> ${name}</p><p><strong>E-mail:</strong> ${email}</p><p><strong>Comentario:</strong></p><p>${comment.replace(/\n/g, "<br>")}</p>`,
      text: `Novo comentario captado\nPost: ${postTitle}\nSlug: ${postSlug}\nNome: ${name}\nEmail: ${email}\nComentario:\n${comment}`,
    });

    return jsonResponse({ ok: true, message: "Comentario enviado com sucesso." });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "Nao foi possivel enviar seu comentario." }, 500);
  }
};
