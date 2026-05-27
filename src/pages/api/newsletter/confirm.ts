import type { APIRoute } from "astro";
import { sendEmail } from "../../../lib/resend";
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

      await sendEmail({
        to: email,
        subject: "Bem-vindo(a) a newsletter",
        template: {
          id: "21ed651d-078e-4e06-a3ad-b489f500657c",
          variables: {
            unsubscribe_url: unsubscribeUrl,
            preferences_url: preferencesUrl,
          },
        },
      });
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
