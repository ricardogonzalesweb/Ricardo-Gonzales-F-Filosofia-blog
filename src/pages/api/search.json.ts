import type { APIRoute } from "astro";
import { getPosts, formatNotionDate } from "../../lib/notion";

export const GET: APIRoute = async () => {
  const posts = await getPosts();

  const index = posts.map((post) => ({
    slug: `/blog/${post.slug}`,
    title: post.title,
    excerpt: post.excerpt ?? "",
    tags: post.tags,
    author: post.author,
    date: post.publishedAt
      ? formatNotionDate(post.publishedAt, "pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "",
    initial: post.title[0]?.toUpperCase() ?? "A",
  }));

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
