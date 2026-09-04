import { createServiceRoleClient } from "@/lib/supabase/server";
import { refreshUserToken } from "./oauth";
import type { EbayAccountRow } from "./types";

// Returns a valid access token for this eBay account, refreshing and
// persisting a new one first if the cached token is expired or about to be.
export async function getValidAccessToken(account: EbayAccountRow): Promise<string> {
  const expiresAt = new Date(account.access_token_expires_at).getTime();
  const isFresh = expiresAt > Date.now() + 60_000;
  if (isFresh) return account.access_token;

  const refreshed = await refreshUserToken(account.refresh_token);
  const accessTokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const supabase = createServiceRoleClient();
  await supabase
    .from("ebay_accounts")
    .update({
      access_token: refreshed.access_token,
      access_token_expires_at: accessTokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  return refreshed.access_token;
}

export async function getEbayAccountForUser(
  userId: string
): Promise<EbayAccountRow | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("ebay_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
