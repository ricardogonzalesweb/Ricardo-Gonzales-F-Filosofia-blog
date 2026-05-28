export const prerender = false;
import type { APIRoute } from "astro";
import { getAppEnv } from "../../lib/env";

export const GET: APIRoute = async () => {
  try {
    const env = getAppEnv();
    const envStatus = {
      hasSupabaseUrl: !!env.supabaseUrl,
      supabaseUrl: env.supabaseUrl,
      hasServiceRoleKey: !!env.supabaseServiceRoleKey,
      serviceRoleKeyPrefix: env.supabaseServiceRoleKey ? env.supabaseServiceRoleKey.slice(0, 20) : null,
      siteUrl: env.siteUrl,
    };

    // Test query newsletter_subscribers
    const query = new URLSearchParams({
      select: "id,email,status",
      limit: "1",
    });
    const res = await fetch(`${env.supabaseUrl}/rest/v1/newsletter_subscribers?${query.toString()}`, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
    });

    const dbStatus = {
      ok: res.ok,
      status: res.status,
      text: res.ok ? "Connected" : await res.text(),
    };

    return new Response(JSON.stringify({ ok: true, envStatus, dbStatus }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error.message, stack: error.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
