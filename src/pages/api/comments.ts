export const prerender = false;
import type { APIRoute } from "astro";
import { supabaseGetApprovedComments } from "../../lib/supabase";

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug")?.trim();

  if (!slug) {
    return new Response(JSON.stringify({ ok: false, error: "Parametro slug e obrigatorio." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const comments = await supabaseGetApprovedComments(slug);
    return new Response(JSON.stringify({ ok: true, comments }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`Error loading comments for ${slug}:`, error);
    return new Response(JSON.stringify({ ok: false, error: "Nao foi possivel carregar os comentarios." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
