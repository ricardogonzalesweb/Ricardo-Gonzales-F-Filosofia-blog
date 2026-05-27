import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";

// ─── Client ────────────────────────────────────────────────────────────────

const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const NOTION_DATABASE_ID = import.meta.env.NOTION_DATABASE_ID;

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

const DATABASE_ID = normalizeNotionId(NOTION_DATABASE_ID) ?? "";

if (!NOTION_TOKEN) {
  throw new Error("Missing NOTION_TOKEN environment variable.");
}

if (!DATABASE_ID) {
  throw new Error("Missing NOTION_DATABASE_ID environment variable.");
}

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(DATABASE_ID)) {
  throw new Error(
    "Invalid NOTION_DATABASE_ID environment variable. Verify the database ID and use the ID from the Notion database URL."
  );
}

export const notion = new Client({
  auth: NOTION_TOKEN,
});

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  publishedAt: string;
  tags: string[];
  author: string;
  status: "Published" | "Draft";
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
  return (props.Tags?.multi_select ?? props.Categorias?.multi_select ?? []).map(
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

function getCoverImage(page: PageObjectResponse, props: Record<string, any>): string | null {
  if (page.cover?.type === "external") {
    return page.cover.external.url;
  }

  if (page.cover?.type === "file") {
    return page.cover.file.url;
  }

  const fileProp = props.Cover?.files ?? [];
  const file = fileProp[0];

  return file?.external?.url ?? file?.file?.url ?? null;
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

function pageToPost(page: PageObjectResponse): Post {
  const props = page.properties as Record<string, any>;

  const title = getTitle(props);
  const slug = getSlug(props, title);
  const excerpt = getExcerpt(props);
  const publishedAt = getPublishedAt(props, page);
  const tags = getTags(props);
  const author = getAuthor(props, page);
  const status = getStatus(props);
  const coverImage = getCoverImage(page, props);

  return { id: page.id, slug, title, excerpt, coverImage, publishedAt, tags, author, status };
}

let cachedDataSourceId: string | undefined;

async function resolveDataSourceId(): Promise<string> {
  if (cachedDataSourceId) {
    return cachedDataSourceId;
  }

  try {
    const database = (await notion.databases.retrieve({
      database_id: DATABASE_ID,
    })) as unknown as { data_sources?: Array<{ id: string }> };

    cachedDataSourceId = database.data_sources?.[0]?.id ?? DATABASE_ID;
    return cachedDataSourceId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to resolve Notion data source ID from database ${DATABASE_ID}: ${message}. ` +
        "Verify NOTION_DATABASE_ID and that the integration has access to the database."
    );
  }
}

async function queryDataSource(
  body: Record<string, unknown>
): Promise<{ results: unknown[] }> {
  const dataSourceId = await resolveDataSourceId();

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

  return sortPosts(
    (response.results as PageObjectResponse[])
      .map(pageToPost)
      .filter((post) => post.status === "Published")
  );
}

/**
 * Fetches all blocks for a given block/page ID, recursively fetching
 * children for blocks that have has_children = true (e.g. quote, callout, toggle).
 */
async function fetchBlocksWithChildren(blockId: string): Promise<BlockObjectResponse[]> {
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

  const blocks = await fetchBlocksWithChildren(page.id);

  return {
    ...pageToPost(page),
    blocks,
  };
}

/** Returns posts filtered by a tag. */
export async function getPostsByTag(tag: string): Promise<Post[]> {
  const response = await queryDataSource({ page_size: 100 });

  return sortPosts(
    (response.results as PageObjectResponse[])
      .map(pageToPost)
      .filter(
        (post) =>
          post.status === "Published" &&
          post.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
      )
  );
}

/** Returns all unique tags from published posts. */
export async function getAllTags(): Promise<string[]> {
  const posts = await getPosts();
  const set = new Set(posts.flatMap((p) => p.tags));
  return Array.from(set).sort();
}
