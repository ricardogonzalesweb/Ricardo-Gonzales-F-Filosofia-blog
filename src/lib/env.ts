export type AppEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  brevoApiKey: string;
  brevoFromEmail: string;
  brevoSenderName: string;
  brevoDoubleOptInTemplateId?: number;
  brevoWelcomeTemplateId?: number;
  brevoListId?: number;
  contactInboxEmail: string;
  siteUrl: string;
};

function firstValue(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
}

export function getAppEnv(): AppEnv {
  const supabaseUrl = firstValue(import.meta.env.SUPABASE_URL, process.env.SUPABASE_URL);
  const supabaseServiceRoleKey = firstValue(import.meta.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const brevoApiKey = firstValue(
    import.meta.env.BREVO_API_KEY,
    process.env.BREVO_API_KEY,
    import.meta.env.RESEND_API_KEY,
    process.env.RESEND_API_KEY
  );
  const fromEmail = firstValue(
    import.meta.env.BREVO_FROM_EMAIL,
    process.env.BREVO_FROM_EMAIL,
    import.meta.env.RESEND_FROM_EMAIL,
    process.env.RESEND_FROM_EMAIL
  );
  const senderName = firstValue(import.meta.env.BREVO_SENDER_NAME, process.env.BREVO_SENDER_NAME) ?? "Newsletter";
  const doubleOptInRaw = firstValue(import.meta.env.BREVO_DOUBLE_OPTIN_TEMPLATE_ID, process.env.BREVO_DOUBLE_OPTIN_TEMPLATE_ID);
  const templateRaw = firstValue(import.meta.env.BREVO_WELCOME_TEMPLATE_ID, process.env.BREVO_WELCOME_TEMPLATE_ID);
  const listRaw = firstValue(import.meta.env.BREVO_LIST_ID, process.env.BREVO_LIST_ID);
  const contactInboxEmail = firstValue(import.meta.env.CONTACT_INBOX_EMAIL, process.env.CONTACT_INBOX_EMAIL);
  const siteUrl = firstValue(import.meta.env.SITE_URL, process.env.SITE_URL);
  const doubleOptInTemplateId = doubleOptInRaw ? Number(doubleOptInRaw) : undefined;
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
    brevoDoubleOptInTemplateId: Number.isFinite(doubleOptInTemplateId) ? doubleOptInTemplateId : undefined,
    brevoWelcomeTemplateId: Number.isFinite(templateId) ? templateId : undefined,
    brevoListId: Number.isFinite(listId) ? listId : undefined,
    contactInboxEmail: contactInboxEmail ?? fromEmail,
    siteUrl,
  };
}
