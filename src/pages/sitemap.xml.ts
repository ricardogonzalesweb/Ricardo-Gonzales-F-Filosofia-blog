import type { APIRoute } from "astro";
import { getPosts, getAllTags } from "../lib/notion";

/**
 * Sitemap dinâmico que inclui todas as rotas estáticas e dinâmicas do site.
 * Necessário porque o astro-sitemap NÃO funciona com output: 'server' (SSR).
 * O Googlebot acessa esta rota para descobrir todas as páginas do site.
 */

const SITE_URL = "https://ricardogonzalesoficial.com.br";

/** Páginas estáticas do site (atualize se adicionar novas páginas). */
const STATIC_PAGES = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/blog", changefreq: "daily", priority: "0.9" },
  { loc: "/sobre", changefreq: "monthly", priority: "0.6" },
  { loc: "/contato", changefreq: "monthly", priority: "0.5" },
  { loc: "/newsletter", changefreq: "monthly", priority: "0.5" },
  { loc: "/doacoes", changefreq: "monthly", priority: "0.4" },
  { loc: "/privacidade", changefreq: "yearly", priority: "0.3" },
  { loc: "/termos", changefreq: "yearly", priority: "0.3" },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toW3CDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export const GET: APIRoute = async () => {
  // Buscar todos os posts e tags do Notion
  const [posts, tags] = await Promise.all([getPosts(), getAllTags()]);

  const now = new Date().toISOString();

  // Montar as entradas do sitemap
  let urls = "";

  // 1. Páginas estáticas
  for (const page of STATIC_PAGES) {
    urls += `
  <url>
    <loc>${escapeXml(SITE_URL + page.loc)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }

  // 2. Posts do blog (rotas dinâmicas /blog/[slug])
  for (const post of posts) {
    urls += `
  <url>
    <loc>${escapeXml(SITE_URL + "/blog/" + post.slug)}</loc>
    <lastmod>${toW3CDate(post.publishedAt)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  // 3. Páginas de tags (rotas dinâmicas /blog/tag/[tag])
  for (const tag of tags) {
    urls += `
  <url>
    <loc>${escapeXml(SITE_URL + "/blog/tag/" + encodeURIComponent(tag.toLowerCase()))}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`.trim();

  return new Response(sitemap, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};
