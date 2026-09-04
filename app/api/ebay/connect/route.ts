import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl, signOAuthState } from "@/lib/ebay/oauth";

// Starts the eBay OAuth consent flow: redirects the signed-in user to
// eBay's hosted authorization page.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  const state = signOAuthState(user.id);
  return NextResponse.redirect(buildAuthorizeUrl(state));
}
