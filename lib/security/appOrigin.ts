import "server-only";

function parseConfiguredOrigin(value: string) {
  const candidate = value.includes("://") ? value : `https://${value}`;
  const url = new URL(candidate);

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("The production app URL must use HTTPS.");
  }

  return url.origin;
}

export function getTrustedAppOrigin(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return parseConfiguredOrigin(configuredUrl);

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return parseConfiguredOrigin(vercelUrl);

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production.");
  }

  return new URL(request.url).origin;
}
