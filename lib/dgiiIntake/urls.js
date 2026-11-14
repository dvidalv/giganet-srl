/**
 * Client-safe URL helpers for DGII intake links (no mongoose / Node-only deps).
 */

/**
 * Public site origin for client-facing DGII intake links.
 * Prefer NEXT_PUBLIC_APP_URL, then APP_URL; NEXTAUTH_URL only as last env fallback.
 */
export function resolveDgiiIntakePublicBaseUrl(fallback = "") {
  const fromEnv = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    ""
  ).replace(/\/$/, "");
  return fromEnv || String(fallback || "").replace(/\/$/, "");
}

export function buildIntakePublicUrl(baseUrl, token) {
  const root = resolveDgiiIntakePublicBaseUrl(baseUrl);
  return `${root}/dgii-intake/${token}`;
}

export function buildAgentPublicUrl(baseUrl, agentToken) {
  const root = resolveDgiiIntakePublicBaseUrl(baseUrl);
  return `${root}/dgii-intake/agent/${agentToken}`;
}
