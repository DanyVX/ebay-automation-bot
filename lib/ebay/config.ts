import type { EbayEnvironment } from "./types";

export const EBAY_ENV: EbayEnvironment =
  (process.env.EBAY_ENV as EbayEnvironment) === "sandbox" ? "sandbox" : "production";

export const EBAY_API_BASE =
  EBAY_ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

export const EBAY_AUTH_BASE =
  EBAY_ENV === "sandbox" ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";

// Scopes requested during OAuth consent. `sell.inventory` covers listing
// price/quantity updates, `sell.account` covers policy/account reads.
export const EBAY_OAUTH_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
];

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
