import crypto from "crypto";
import { EBAY_API_BASE, EBAY_AUTH_BASE, EBAY_OAUTH_SCOPES, requireEnv } from "./config";
import type { EbayTokenResponse } from "./types";

function basicAuthHeader(): string {
  const id = requireEnv("EBAY_CLIENT_ID");
  const secret = requireEnv("EBAY_CLIENT_SECRET");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

// Signs `state` so /api/ebay/callback can trust it wasn't forged, and binds
// it to the user who started the OAuth flow.
export function signOAuthState(userId: string): string {
  const secret = requireEnv("EBAY_OAUTH_STATE_SECRET");
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${userId}.${nonce}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyOAuthState(state: string): { userId: string } | null {
  try {
    const secret = requireEnv("EBAY_OAUTH_STATE_SECRET");
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [userId, nonce, signature] = decoded.split(".");
    if (!userId || !nonce || !signature) return null;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${userId}.${nonce}`)
      .digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    return { userId };
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(state: string): string {
  const ruName = requireEnv("EBAY_RU_NAME");
  const params = new URLSearchParams({
    client_id: requireEnv("EBAY_CLIENT_ID"),
    redirect_uri: ruName,
    response_type: "code",
    scope: EBAY_OAUTH_SCOPES.join(" "),
    state,
  });
  return `${EBAY_AUTH_BASE}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<EbayTokenResponse> {
  const ruName = requireEnv("EBAY_RU_NAME");
  const res = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ruName,
    }),
  });
  if (!res.ok) {
    throw new Error(`eBay token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function refreshUserToken(refreshToken: string): Promise<EbayTokenResponse> {
  const res = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: EBAY_OAUTH_SCOPES.join(" "),
    }),
  });
  if (!res.ok) {
    throw new Error(`eBay token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Application (client-credentials) token, used for public read-only calls
// like Browse API search that aren't tied to a specific seller.
let cachedAppToken: { token: string; expiresAt: number } | null = null;

export async function getApplicationToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now() + 60_000) {
    return cachedAppToken.token;
  }
  const res = await fetch(`${EBAY_API_BASE}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });
  if (!res.ok) {
    throw new Error(`eBay application token request failed: ${res.status} ${await res.text()}`);
  }
  const data: EbayTokenResponse = await res.json();
  cachedAppToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}
