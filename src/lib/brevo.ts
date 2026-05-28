import { getAppEnv } from "./env";

type EmailPayload = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: {
    id: number;
    variables?: Record<string, any>;
  };
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const env = getAppEnv();
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];

  // Se a chave começar com "re_", envia utilizando a API da Resend
  if (env.brevoApiKey.startsWith("re_")) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.brevoApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${env.brevoSenderName} <${env.brevoFromEmail}>`,
        to: recipients,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Resend error: ${response.status} ${text}`);
    }
    return;
  }

  // Caso contrário, continua usando a Brevo
  const body: Record<string, any> = {
    sender: {
      name: env.brevoSenderName,
      email: env.brevoFromEmail,
    },
    to: recipients.map((email) => ({ email })),
    subject: payload.subject,
  };

  if (payload.template) {
    body.templateId = payload.template.id;
    if (payload.template.variables) {
      body.params = payload.template.variables;
    }
  } else {
    body.htmlContent = payload.html;
    body.textContent = payload.text;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo error: ${response.status} ${text}`);
  }
}

export async function upsertBrevoContactToList(email: string, listId: number): Promise<void> {
  const env = getAppEnv();
  const response = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      listIds: [listId],
      updateEnabled: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo contact error: ${response.status} ${text}`);
  }
}

export async function sendBrevoDoubleOptIn(email: string, templateId: number, listId: number, redirectionUrl: string): Promise<void> {
  const env = getAppEnv();
  const response = await fetch("https://api.brevo.com/v3/contacts/doubleOptinConfirmation", {
    method: "POST",
    headers: {
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      includeListIds: [listId],
      templateId,
      redirectionUrl,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo double opt-in error: ${response.status} ${text}`);
  }
}
