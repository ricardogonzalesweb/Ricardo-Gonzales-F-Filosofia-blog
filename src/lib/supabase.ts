import { getAppEnv } from "./env";

export async function supabaseInsert(table: string, payload: Record<string, unknown>): Promise<void> {
  const env = getAppEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase insert failed (${table}): ${response.status} ${text}`);
  }
}

export async function supabaseUpsertSubscriber(email: string, token: string, source: string): Promise<void> {
  const env = getAppEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1/newsletter_subscribers?on_conflict=email`, {
    method: "POST",
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([
      {
        email,
        status: "pending",
        confirm_token: token,
        source,
        updated_at: new Date().toISOString(),
      },
    ]),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase upsert failed: ${response.status} ${text}`);
  }
}

export async function supabaseActivateSubscriber(token: string): Promise<string | null> {
  const env = getAppEnv();
  const query = new URLSearchParams({
    select: "id,email,status",
    confirm_token: `eq.${token}`,
    limit: "1",
  });

  const findResponse = await fetch(`${env.supabaseUrl}/rest/v1/newsletter_subscribers?${query.toString()}`, {
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    },
  });

  if (!findResponse.ok) {
    const text = await findResponse.text();
    throw new Error(`Supabase lookup failed: ${findResponse.status} ${text}`);
  }

  const rows = (await findResponse.json()) as Array<{ id: string; email: string; status: string }>;
  const row = rows[0];
  if (!row) return null;

  if (row.status !== "active") {
    const updateResponse = await fetch(`${env.supabaseUrl}/rest/v1/newsletter_subscribers?id=eq.${row.id}`, {
      method: "PATCH",
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status: "active",
        consent_at: new Date().toISOString(),
        confirm_token: null,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!updateResponse.ok) {
      const text = await updateResponse.text();
      throw new Error(`Supabase activation failed: ${updateResponse.status} ${text}`);
    }
  }

  return row.email;
}

export async function supabaseUnsubscribeByEmail(email: string): Promise<boolean> {
  const env = getAppEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1/newsletter_subscribers?email=eq.${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      status: "unsubscribed",
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase unsubscribe failed: ${response.status} ${text}`);
  }

  const rows = (await response.json()) as Array<{ id: string }>;
  return rows.length > 0;
}

/**
 * Upload a binary object to Supabase Storage and return the public URL.
 * Bucket must exist. Uses the service role key for authentication.
 */
export async function supabaseUploadObject(
  bucket: string,
  objectPath: string,
  data: Buffer | Uint8Array,
  contentType = "application/octet-stream"
): Promise<string> {
  const env = getAppEnv();
  const uploadUrl = `${env.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(objectPath)}`;

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      "Content-Type": contentType,
    },
    body: data,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase storage upload failed: ${res.status} ${text}`);
  }

  return `${env.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(objectPath)}`;
}

export type PostComment = {
  name: string;
  comment: string;
  created_at: string;
};

export async function supabaseGetApprovedComments(postSlug: string): Promise<PostComment[]> {
  const env = getAppEnv();
  const query = new URLSearchParams({
    select: "name,comment,created_at",
    post_slug: `eq.${postSlug}`,
    approved: "eq.true",
    order: "created_at.asc",
  });

  const response = await fetch(`${env.supabaseUrl}/rest/v1/post_comments_leads?${query.toString()}`, {
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase select comments failed: ${response.status} ${text}`);
  }

  return (await response.json()) as PostComment[];
}
