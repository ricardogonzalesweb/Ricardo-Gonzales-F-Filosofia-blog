export const prerender = false;
import type { APIRoute } from "astro";
import { sendEmail, upsertBrevoContactToList } from "../../../lib/brevo";
import { supabaseActivateSubscriber } from "../../../lib/supabase";
import { getAppEnv } from "../../../lib/env";

export const GET: APIRoute = async ({ url, redirect }) => {
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return redirect("/newsletter?status=invalid", 302);
  }

  try {
    const email = await supabaseActivateSubscriber(token);
    if (!email) {
      return redirect("/newsletter?status=invalid", 302);
    }

    try {
      const env = getAppEnv();
      const unsubscribeUrl = `${env.siteUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
      const preferencesUrl = `${env.siteUrl}/newsletter`;
      if (env.brevoListId) {
        await upsertBrevoContactToList(email, env.brevoListId);
      }

      if (env.brevoWelcomeTemplateId) {
        await sendEmail({
          to: email,
          subject: "Bem-vindo(a) a newsletter",
          template: {
            id: env.brevoWelcomeTemplateId,
            variables: {
              unsubscribe_url: unsubscribeUrl,
              preferences_url: preferencesUrl,
            },
          },
        });
      } else {
        await sendEmail({
          to: email,
          subject: "Bem-vindo(a) a newsletter",
          html: `<h2>Bem-vindo(a)!</h2><p>Sua inscricao foi confirmada com sucesso.</p><p>Obrigado por fazer parte da nossa comunidade.</p><p>Gerenciar assinatura: <a href="${preferencesUrl}">${preferencesUrl}</a></p><p>Cancelar inscricao: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>`,
          text: `Bem-vindo(a)! Sua inscricao foi confirmada com sucesso. Gerenciar assinatura: ${preferencesUrl}. Cancelar inscricao: ${unsubscribeUrl}`,
        });
      }
    } catch (emailError) {
      // Nao bloqueia a confirmacao da newsletter em caso de falha no envio.
      console.error("Welcome email error:", emailError);
    }

    return redirect("/newsletter?status=confirmed", 302);
  } catch (error) {
    console.error(error);
    return redirect("/newsletter?status=error", 302);
  }
};
