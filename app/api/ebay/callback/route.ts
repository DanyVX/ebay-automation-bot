import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { exchangeCodeForToken, verifyOAuthState } from "@/lib/ebay/oauth";
import { EBAY_ENV, EBAY_OAUTH_SCOPES } from "@/lib/ebay/config";

// eBay redirects the user back here after they approve (or deny) access.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?ebay_error=missing_code", appUrl)
    );
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?ebay_error=invalid_state", appUrl)
    );
  }

  try {
    const token = await exchangeCodeForToken(code);
    const now = Date.now();
    const supabase = createServiceRoleClient();

    await supabase.from("ebay_accounts").upsert(
      {
        user_id: verified.userId,
        environment: EBAY_ENV,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        access_token_expires_at: new Date(now + token.expires_in * 1000).toISOString(),
        refresh_token_expires_at: new Date(
          now + (token.refresh_token_expires_in ?? 47304000) * 1000
        ).toISOString(),
        scopes: EBAY_OAUTH_SCOPES,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,environment" }
    );

    return NextResponse.redirect(new URL("/dashboard/settings?ebay_connected=1", appUrl));
  } catch (err) {
    console.error("eBay OAuth callback failed", err);
    return NextResponse.redirect(new URL("/dashboard/settings?ebay_error=token_exchange", appUrl));
  }
}
