export const prerender = false;
import type { APIRoute } from "astro";
import { supabaseGetApprovedComments } from "../../lib/supabase";
import { jsonResponse } from "../../lib/validation";

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug")?.trim();

  if (!slug) {
    return jsonResponse({ ok: false, error: "Parâmetro slug é obrigatório." }, 400);
  }

  try {
    const comments = await supabaseGetApprovedComments(slug);
    return jsonResponse({ ok: true, comments });
  } catch (error) {
    console.error(`Error loading comments for ${slug}:`, error);
    return jsonResponse({ ok: false, error: "Não foi possível carregar os comentários." }, 500);
  }
};
