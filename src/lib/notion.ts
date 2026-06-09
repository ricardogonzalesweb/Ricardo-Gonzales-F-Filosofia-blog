import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { supabaseUploadObject } from "./supabase";

// ─── Client ────────────────────────────────────────────────────────────────

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = import.meta.env.NOTION_DATABASE_ID;
let notionClient: Client | undefined;

function normalizeNotionId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const clean = value.replace(/[^0-9a-f]/gi, "");
  if (clean.length !== 32) return value;
  return [
    clean.slice(0, 8),
    clean.slice(8, 12),
    clean.slice(12, 16),
    clean.slice(16, 20),
    clean.slice(20),
  ].join("-");
}

function getNotionConfig(): { token: string; databaseId: string } {
  const databaseId = normalizeNotionId(NOTION_DATABASE_ID) ?? "";

  if (!NOTION_TOKEN) {
    throw new Error("Missing NOTION_TOKEN environment variable.");
  }

  if (!databaseId) {
    throw new Error("Missing NOTION_DATABASE_ID environment variable.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)) {
    throw new Error(
      "Invalid NOTION_DATABASE_ID environment variable. Verify the database ID and use the ID from the Notion database URL."
    );
  }

  return {
    token: NOTION_TOKEN,
    databaseId,
  };
}

function getNotionClient(): Client {
  if (!notionClient) {
    notionClient = new Client({
      auth: getNotionConfig().token,
    });
  }

  return notionClient;
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  publishedAt: string;
  tags: string[];
  categories: string[];
  author: string;
  status: "Published" | "Draft";
  readingTime: string | null;
}

export interface PostWithBlocks extends Post {
  blocks: BlockObjectResponse[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function richTextToPlain(richText: RichTextItemResponse[]): string {
  return richText.map((t) => t.plain_text).join("");
}

function getTitle(props: Record<string, any>): string {
  return richTextToPlain(
    props.Title?.title ?? props.Title?.rich_text ?? props.Name?.title ?? props.Name?.rich_text ?? []
  );
}

function getSlug(props: Record<string, any>, title: string): string {
  return (
    props.Slug?.formula?.string ||
    richTextToPlain(props.Slug?.rich_text ?? []) ||
    title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  );
}

function getExcerpt(props: Record<string, any>): string {
  return richTextToPlain(props.Excerpt?.rich_text ?? props.Descrição?.rich_text ?? []);
}

function getPublishedAt(props: Record<string, any>, page: PageObjectResponse): string {
  return (
    props.PublishedAt?.date?.start ??
    props.Data?.date?.start ??
    page.created_time ??
    ""
  );
}

export function parseNotionDate(dateString: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(dateString);
}

export function formatNotionDate(
  dateString: string,
  locale = "pt-BR",
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }
): string {
  const parsed = parseNotionDate(dateString);
  return isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString(locale, options);
}

function getTags(props: Record<string, any>): string[] {
  return (props.Tags?.multi_select ?? []).map(
    (t: { name: string }) => t.name
  );
}

function getCategories(props: Record<string, any>): string[] {
  return (props.Categorias?.multi_select ?? []).map(
    (t: { name: string }) => t.name
  );
}

function getStatus(props: Record<string, any>): Post["status"] {
  const statusName = props.Status?.status?.name ?? props.Status?.select?.name ?? "";

  if (
    statusName === "Published" ||
    statusName === "Concluído" ||
    statusName === "Publicado" ||
    statusName === "Done" ||
    props.Publicado?.checkbox === true
  ) {
    return "Published";
  }

  return "Draft";
}

// ─── Image Caching ─────────────────────────────────────────────────────────

const COVERS_DIR = path.join(process.cwd(), "public", "notion-covers");
const USE_LOCAL_COVER_CACHE = import.meta.env.DEV;

/**
 * Downloads a remote image and saves it to public/notion-covers/.
 * Returns the local URL path (e.g. /notion-covers/abc123.jpg).
 * If the file already exists, it skips downloading.
 */
async function downloadAndCacheImage(url: string): Promise<string> {
  // Create a stable filename hash from the URL (without query params that change on each API call)
  const urlObj = new URL(url);
  // Use the pathname (without expiring query params) for hashing
  const hashSource = urlObj.origin + urlObj.pathname;
  const hash = crypto.createHash("md5").update(hashSource).digest("hex");

  // Detect extension from the URL path
  const extMatch = urlObj.pathname.match(/\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : ".jpg";

  const filename = `${hash}${ext}`;
  const localPath = path.join(COVERS_DIR, filename);
  const publicUrl = `/notion-covers/${filename}`;

  // Local public files are useful in dev, but they are ignored by git and
  // are not guaranteed to exist in production deployments.
  if (USE_LOCAL_COVER_CACHE && fs.existsSync(localPath)) {
    return publicUrl;
  }

  if (!USE_LOCAL_COVER_CACHE) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[notion] Failed to fetch cover image for Supabase: ${response.status} ${url}`);
        return url;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      const uploaded = await supabaseUploadObject("notion-covers", filename, buffer, contentType);
      console.log(`[notion] Uploaded cover image to Supabase: ${uploaded}`);
      return uploaded;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[notion] Could not upload cover image to Supabase:`, errMsg);
      return url;
    }
  }

  // Try to create directory and save file. On read-only filesystems (e.g. serverless),
  // avoid throwing: fall back to returning the original remote URL so rendering continues.
  try {
    // Ensure directory exists
    fs.mkdirSync(COVERS_DIR, { recursive: true });

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[notion] Failed to download cover image: ${response.status} ${url}`);
      return url; // Fallback to original URL
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    console.log(`[notion] Cached cover image: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    // Likely a read-only filesystem error in serverless envs (ENOENT/EPERM). Try uploading to Supabase Storage as fallback.
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[notion] Could not cache cover image locally (attempting Supabase upload):`, errMsg);

    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const buffer = Buffer.from(await resp.arrayBuffer());
        const contentType = resp.headers.get("content-type") ?? "application/octet-stream";
        try {
          const uploaded = await supabaseUploadObject("notion-covers", filename, buffer, contentType);
          console.log(`[notion] Uploaded cover image to Supabase: ${uploaded}`);
          return uploaded;
        } catch (uploadErr) {
          const uploadMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          console.warn("[notion] Supabase upload failed:", uploadMsg);
        }
      }
    } catch (fetchErr) {
      const fetchMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.warn("[notion] Could not fetch remote image for Supabase upload:", fetchMsg);
    }

    return url; // Final fallback to remote URL
  }
}

/**
 * Returns true if the URL is a temporary Notion/AWS-hosted file
 * (as opposed to an external user-provided URL that won't expire).
 */
function isNotionHostedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname.includes("s3.us-west-2.amazonaws.com") ||
      hostname.includes("s3-us-west-2.amazonaws.com") ||
      hostname.includes("s3.amazonaws.com") ||
      hostname.includes("prod-files-secure") ||
      hostname.includes("secure.notion-static.com") ||
      hostname.includes("notion-static.com") ||
      hostname.includes("files.notion.so")
    );
  } catch {
    return false;
  }
}

async function getCoverImage(page: PageObjectResponse, props: Record<string, any>): Promise<string | null> {
  let url: string | null = null;

  // Try to get cover from page.cover first
  if (page.cover?.type === "external") {
    url = page.cover.external.url;
    console.log(`[notion] Cover from page.cover.external: ${url}`);
  } else if (page.cover?.type === "file") {
    url = page.cover.file.url;
    console.log(`[notion] Cover from page.cover.file: ${url}`);
  } else {
    // Fallback to properties
    const fileProp = props.Cover?.files ?? [];
    const file = fileProp[0];
    url = file?.external?.url ?? file?.file?.url ?? null;
    if (url) {
      console.log(`[notion] Cover from props.Cover.files: ${url}`);
    }
  }

  if (!url) {
    console.log(`[notion] No cover image found for page ${page.id}`);
    return null;
  }

  // Only download & cache Notion-hosted (temporary) URLs
  if (isNotionHostedUrl(url)) {
    console.log(`[notion] URL is Notion-hosted, attempting to download & cache...`);
    const cached = await downloadAndCacheImage(url);
    console.log(`[notion] Downloaded & cached cover: ${cached}`);
    return cached;
  }

  console.log(`[notion] URL is external, returning as-is: ${url}`);
  return url;
}

async function cacheNotionHostedFileUrl(url: string): Promise<string> {
  if (!isNotionHostedUrl(url)) {
    return url;
  }

  return downloadAndCacheImage(url);
}

async function cacheBlockFileUrls(blocks: BlockObjectResponse[]): Promise<BlockObjectResponse[]> {
  await Promise.all(
    blocks.map(async (block: any) => {
      if (block.type === "image") {
        if (block.image?.type === "file" && block.image.file?.url) {
          block.image.file.url = await cacheNotionHostedFileUrl(block.image.file.url);
        } else if (block.image?.type === "external" && block.image.external?.url) {
          block.image.external.url = await cacheNotionHostedFileUrl(block.image.external.url);
        }
      }

      if (block.type === "callout") {
        if (block.callout?.icon?.type === "file" && block.callout.icon.file?.url) {
          block.callout.icon.file.url = await cacheNotionHostedFileUrl(block.callout.icon.file.url);
        } else if (block.callout?.icon?.type === "external" && block.callout.icon.external?.url) {
          block.callout.icon.external.url = await cacheNotionHostedFileUrl(block.callout.icon.external.url);
        }
      }

      if (Array.isArray(block._children) && block._children.length > 0) {
        await cacheBlockFileUrls(block._children);
      }
    })
  );

  return blocks;
}

function getAuthor(props: Record<string, any>, page: PageObjectResponse): string {
  const authorText = richTextToPlain(
    props.Autor?.rich_text ?? props.Author?.rich_text ?? []
  );

  const personNames = (props.Autor?.people ?? props.Author?.people ?? [])
    .map((person: any) => person?.name)
    .filter(Boolean)
    .join(", ");

  return (
    authorText ||
    personNames ||
    (page.created_by as { name?: string })?.name ||
    "Autor desconhecido"
  );
}

function getReadingTime(props: Record<string, any>): string | null {
  const propName = Object.keys(props).find(
    (key) => key.toLowerCase() === "tempo de leitura" || key.toLowerCase() === "reading time"
  );
  if (!propName) return null;

  const prop = props[propName];
  if (!prop) return null;

  let value: string | null = null;

  if (prop.type === "formula") {
    const formulaVal = prop.formula;
    if (formulaVal.type === "string") value = formulaVal.string || null;
    if (formulaVal.type === "number") value = formulaVal.number?.toString() || null;
  } else if (prop.type === "number") {
    value = prop.number != null ? prop.number.toString() : null;
  } else if (prop.type === "rich_text") {
    value = richTextToPlain(prop.rich_text ?? []);
  }

  if (!value) return null;

  value = value.trim();

  // Se for apenas número, adiciona "min" para ficar esteticamente correto
  if (/^\d+$/.test(value)) {
    return `${value} min`;
  }

  return value;
}

async function pageToPost(page: PageObjectResponse): Promise<Post> {
  const props = page.properties as Record<string, any>;

  const title = getTitle(props);
  const slug = getSlug(props, title);
  const excerpt = getExcerpt(props);
  const publishedAt = getPublishedAt(props, page);
  const tags = getTags(props);
  const categories = getCategories(props);
  const author = getAuthor(props, page);
  const status = getStatus(props);
  const coverImage = await getCoverImage(page, props);
  const readingTime = getReadingTime(props);

  return { id: page.id, slug, title, excerpt, coverImage, publishedAt, tags, categories, author, status, readingTime };
}

let cachedDataSourceId: string | undefined;

async function resolveDataSourceId(): Promise<string> {
  if (cachedDataSourceId) {
    return cachedDataSourceId;
  }

  const { databaseId } = getNotionConfig();
  const notion = getNotionClient();

  try {
    const database = (await notion.databases.retrieve({
      database_id: databaseId,
    })) as unknown as { data_sources?: Array<{ id: string }> };

    cachedDataSourceId = database.data_sources?.[0]?.id ?? databaseId;
    return cachedDataSourceId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to resolve Notion data source ID from database ${databaseId}: ${message}. ` +
        "Verify NOTION_DATABASE_ID and that the integration has access to the database."
    );
  }
}

async function queryDataSource(
  body: Record<string, unknown>
): Promise<{ results: unknown[] }> {
  const dataSourceId = await resolveDataSourceId();
  const notion = getNotionClient();

  try {
    return (await notion.dataSources.query({
      data_source_id: dataSourceId,
      ...body,
    })) as { results: unknown[] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to query Notion data source ${dataSourceId}: ${message}. ` +
        "Verify NOTION_DATABASE_ID, ensure the database is shared with the integration, and that the integration has access."
    );
  }
}

// ─── API calls ─────────────────────────────────────────────────────────────

function sortPosts(posts: Post[]): Post[] {
  return posts.sort((a, b) => {
    const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bDate - aDate;
  });
}

/** Returns all published posts ordered by date (newest first). */
export async function getPosts(): Promise<Post[]> {
  const response = await queryDataSource({ page_size: 100 });

  const allPosts = await Promise.all(
    (response.results as PageObjectResponse[]).map(pageToPost)
  );

  return sortPosts(allPosts.filter((post) => post.status === "Published"));
}

/**
 * Fetches all blocks for a given block/page ID, recursively fetching
 * children for blocks that have has_children = true (e.g. quote, callout, toggle).
 */
async function fetchBlocksWithChildren(blockId: string): Promise<BlockObjectResponse[]> {
  const notion = getNotionClient();
  const blocksResponse = await notion.blocks.children.list({
    block_id: blockId,
    page_size: 100,
  });

  const blocks = blocksResponse.results as BlockObjectResponse[];

  await Promise.all(
    blocks.map(async (block: any) => {
      if (block.has_children) {
        block._children = await fetchBlocksWithChildren(block.id);
      }
    })
  );

  return blocks;
}

/** Returns a single post by slug, or null if not found. */
export async function getPostBySlug(
  slug: string
): Promise<PostWithBlocks | null> {
  const response = await queryDataSource({ page_size: 100 });

  const page = (response.results as PageObjectResponse[]).find((page) => {
    const props = page.properties as Record<string, any>;
    return getSlug(props, getTitle(props)) === slug;
  });

  if (!page) return null;

  const [post, blocks] = await Promise.all([
    pageToPost(page),
    fetchBlocksWithChildren(page.id),
  ]);

  return {
    ...post,
    blocks: await cacheBlockFileUrls(blocks),
  };
}

/** Returns posts filtered by a tag. */
export async function getPostsByTag(tag: string): Promise<Post[]> {
  const response = await queryDataSource({ page_size: 100 });

  const allPosts = await Promise.all(
    (response.results as PageObjectResponse[]).map(pageToPost)
  );

  return sortPosts(
    allPosts.filter(
      (post) =>
        post.status === "Published" &&
        post.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    )
  );
}

/** Returns posts filtered by a category. */
export async function getPostsByCategory(category: string): Promise<Post[]> {
  const response = await queryDataSource({ page_size: 100 });

  const allPosts = await Promise.all(
    (response.results as PageObjectResponse[]).map(pageToPost)
  );

  return sortPosts(
    allPosts.filter(
      (post) =>
        post.status === "Published" &&
        post.categories.some((c) => c.toLowerCase() === category.toLowerCase())
    )
  );
}

/** Returns all unique tags from published posts. */
export async function getAllTags(): Promise<string[]> {
  const posts = await getPosts();
  const set = new Set(posts.flatMap((p) => p.tags));
  return Array.from(set).sort();
}

/** Returns all unique categories from published posts. */
export async function getAllCategories(): Promise<string[]> {
  const posts = await getPosts();
  const set = new Set(posts.flatMap((p) => p.categories));
  return Array.from(set).sort();
}
