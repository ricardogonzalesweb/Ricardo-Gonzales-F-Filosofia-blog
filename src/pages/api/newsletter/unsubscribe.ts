export const prerender = false;
import type { APIRoute } from "astro";
import { supabaseUnsubscribeByEmail } from "../../../lib/supabase";
import { isValidEmail } from "../../../lib/validation";

export const GET: APIRoute = async ({ url, redirect }) => {
  const email = url.searchParams.get("email")?.trim().toLowerCase() || "";

  if (!email || !isValidEmail(email)) {
    return redirect("/newsletter?status=invalid", 302);
  }

  try {
    const updated = await supabaseUnsubscribeByEmail(email);
    return redirect(updated ? "/newsletter?status=unsubscribed" : "/newsletter?status=invalid", 302);
  } catch (error) {
    console.error(error);
    return redirect("/newsletter?status=error", 302);
  }
};
