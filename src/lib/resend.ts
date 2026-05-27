import { getAppEnv } from "./env";

type EmailPayload = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: {
    id: string;
    variables?: Record<string, any>;
  };
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const env = getAppEnv();
  const body: Record<string, any> = {
    from: env.resendFromEmail,
    to: payload.to,
    subject: payload.subject,
  };

  if (payload.template) {
    body.template = payload.template;
  } else {
    body.html = payload.html;
    body.text = payload.text;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend error: ${response.status} ${text}`);
  }
}
