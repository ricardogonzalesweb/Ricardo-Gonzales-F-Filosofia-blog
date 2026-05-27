const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidEmail(email: string): boolean {
  return emailRegex.test(email);
}

export function safeMessage(value: string, max = 4000): string {
  return value.replace(/\u0000/g, "").slice(0, max).trim();
}

export function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "on", "yes"].includes(value.toLowerCase());
  }
  return false;
}

export function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
