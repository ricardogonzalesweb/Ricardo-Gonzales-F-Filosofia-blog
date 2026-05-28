export const prerender = false;
import type { APIRoute } from "astro";
import { getAppEnv } from "../../lib/env";
import { supabaseGetApprovedComments } from "../../lib/supabase";

export const GET: APIRoute = async () => {
  try {
    const env = getAppEnv();
    const testSlug = "ansiedade-santo-agostinho-ja-explicava-isso-ha-seculos";
    
    let commentsResult: any = null;
    let commentsError: string | null = null;
    let commentsStack: string | null = null;

    try {
      commentsResult = await supabaseGetApprovedComments(testSlug);
    } catch (e: any) {
      commentsError = e.message;
      commentsStack = e.stack;
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      testSlug,
      commentsResult,
      commentsError,
      commentsStack,
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
