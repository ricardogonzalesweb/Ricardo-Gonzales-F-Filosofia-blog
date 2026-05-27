export type AppEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  brevoApiKey: string;
  brevoFromEmail: string;
  brevoSenderName: string;
  brevoWelcomeTemplateId?: number;
  brevoListId?: number;
  contactInboxEmail: string;
  siteUrl: string;
};

export function getAppEnv(): AppEnv {
  const supabaseUrl = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const brevoApiKey =
    import.meta.env.BREVO_API_KEY ??
    process.env.BREVO_API_KEY ??
    import.meta.env.RESEND_API_KEY ??
    process.env.RESEND_API_KEY;
  const fromEmail =
    (import.meta.env.BREVO_FROM_EMAIL ??
      process.env.BREVO_FROM_EMAIL ??
      import.meta.env.RESEND_FROM_EMAIL ??
      process.env.RESEND_FROM_EMAIL) as string | undefined;
  const senderName = (import.meta.env.BREVO_SENDER_NAME ?? process.env.BREVO_SENDER_NAME ?? "Newsletter") as string;
  const templateRaw = (import.meta.env.BREVO_WELCOME_TEMPLATE_ID ?? process.env.BREVO_WELCOME_TEMPLATE_ID) as string | undefined;
  const listRaw = (import.meta.env.BREVO_LIST_ID ?? process.env.BREVO_LIST_ID) as string | undefined;
  const contactInboxEmail = import.meta.env.CONTACT_INBOX_EMAIL ?? process.env.CONTACT_INBOX_EMAIL;
  const siteUrl = import.meta.env.SITE_URL ?? process.env.SITE_URL;
  const templateId = templateRaw ? Number(templateRaw) : undefined;
  const listId = listRaw ? Number(listRaw) : undefined;

  if (!supabaseUrl) throw new Error("Missing environment variable: SUPABASE_URL");
  if (!supabaseServiceRoleKey) throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
  if (!brevoApiKey) throw new Error("Missing environment variable: BREVO_API_KEY");
  if (!fromEmail) throw new Error("Missing environment variable: BREVO_FROM_EMAIL");
  if (!siteUrl) throw new Error("Missing environment variable: SITE_URL");

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    brevoApiKey,
    brevoFromEmail: fromEmail,
    brevoSenderName: senderName,
    brevoWelcomeTemplateId: Number.isFinite(templateId) ? templateId : undefined,
    brevoListId: Number.isFinite(listId) ? listId : undefined,
    contactInboxEmail: contactInboxEmail ?? fromEmail,
    siteUrl,
  };
}
