import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getEbayAccountForUser, getValidAccessToken } from "@/lib/ebay/account";
import { applyRule } from "@/lib/ebay/repricing";
import type { ListingRow, RepricingRuleRow } from "@/lib/ebay/types";

interface RunBody {
  ruleId?: string; // omit to run every enabled rule for this user
}

// Runs the signed-in user's enabled repricing rule(s) immediately. Used by
// the dashboard's "Run now" button (single rule or "run all").
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const account = await getEbayAccountForUser(user.id);
  if (!account) {
    return NextResponse.json({ error: "No eBay account connected" }, { status: 400 });
  }

  const body: RunBody = await request.json().catch(() => ({}));
  const service = createServiceRoleClient();

  let query = service.from("repricing_rules").select("*").eq("user_id", user.id).eq("enabled", true);
  if (body.ruleId) query = query.eq("id", body.ruleId);
  const { data: rules, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to load rules" }, { status: 500 });
  }
  if (!rules || rules.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const accessToken = await getValidAccessToken(account);
    const results = [];

    for (const rule of rules as RepricingRuleRow[]) {
      const { data: listing } = await service
        .from("listings")
        .select("*")
        .eq("id", rule.listing_id)
        .maybeSingle();
      if (!listing) {
        results.push({ ruleId: rule.id, applied: false, reason: "listing_missing" });
        continue;
      }
      const result = await applyRule(rule, listing as ListingRow, accessToken);
      results.push({ ruleId: rule.id, ...result });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Repricing run failed", err);
    return NextResponse.json({ error: "Repricing run failed" }, { status: 502 });
  }
}
