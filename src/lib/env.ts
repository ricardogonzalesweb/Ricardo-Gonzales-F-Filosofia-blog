export type AppEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  resendApiKey: string;
  resendFromEmail: string;
  contactInboxEmail: string;
  siteUrl: string;
};

function required(name: string): string {
  const metaEnv = (import.meta as any)?.env || {};
  const value = metaEnv[name] ?? process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value as string;
}

export function getAppEnv(): AppEnv {
  return {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    resendApiKey: required("RESEND_API_KEY"),
    resendFromEmail: required("RESEND_FROM_EMAIL"),
    contactInboxEmail:
      ((import.meta as any)?.env?.CONTACT_INBOX_EMAIL as string) ?? process.env.CONTACT_INBOX_EMAIL ?? required("RESEND_FROM_EMAIL"),
    siteUrl: required("SITE_URL"),
  };
}
