/**
 * Verifies a Cloudflare Turnstile token server-side.
 * @param {string} token - Value from form field `cf-turnstile-response`
 * @param {string} [remoteip] - Client IP (optional, forwarded to Cloudflare)
 * @returns {Promise<boolean>}
 */
export async function verifyTurnstileToken(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Turnstile] TURNSTILE_SECRET_KEY no está definida; se omite la verificación solo en desarrollo."
      );
      return true;
    }
    return false;
  }

  if (!token || typeof token !== "string" || token.trim().length < 10) {
    return false;
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  if (remoteip) {
    body.set("remoteip", remoteip);
  }

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return false;
  }

  const data = await res.json();
  return data.success === true;
}
