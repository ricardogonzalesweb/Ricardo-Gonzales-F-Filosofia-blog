export const prerender = false;
import type { APIRoute } from "astro";
import { getAppEnv } from "../../lib/env";
import { supabaseActivateSubscriber } from "../../lib/supabase";

export const GET: APIRoute = async () => {
  try {
    const env = getAppEnv();
    
    // Test activate subscriber with the specific token
    const testToken = "3f64cbf9a839b58149037d3d99e862e94c4c84cec71c312a";
    let activationResult: any = null;
    let activationError: string | null = null;
    
    try {
      activationResult = await supabaseActivateSubscriber(testToken);
    } catch (e: any) {
      activationError = e.message;
    }

    // Direct fetch test
    const query = new URLSearchParams({
      select: "id,email,status",
      confirm_token: `eq.${testToken}`,
      limit: "1",
    });
    const res = await fetch(`${env.supabaseUrl}/rest/v1/newsletter_subscribers?${query.toString()}`, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
    });

    const directRows = res.ok ? await res.json() : null;

    return new Response(JSON.stringify({ 
      ok: true, 
      testToken,
      activationResult,
      activationError,
      directRows,
      envStatus: {
        hasSupabaseUrl: !!env.supabaseUrl,
        supabaseUrl: env.supabaseUrl,
        hasServiceRoleKey: !!env.supabaseServiceRoleKey,
        siteUrl: env.siteUrl,
      }
    }), {
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
