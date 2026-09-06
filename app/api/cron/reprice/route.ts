import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/ebay/account";
import { applyRule } from "@/lib/ebay/repricing";
import type { EbayAccountRow, ListingRow, RepricingRuleRow } from "@/lib/ebay/types";

// Scheduled entry point that evaluates every enabled repricing rule across
// every connected account. Protect with CRON_SECRET the same way as
// /api/cron/sync.
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const service = createServiceRoleClient();
  const { data: rules, error } = await service.from("repricing_rules").select("*").eq("enabled", true);
  if (error) {
    return NextResponse.json({ error: "Failed to load rules" }, { status: 500 });
  }

  const accountCache = new Map<string, EbayAccountRow>();
  const results: { ruleId: string; applied?: boolean; reason?: string; error?: string }[] = [];

  for (const rule of (rules ?? []) as RepricingRuleRow[]) {
    try {
      const { data: listing } = await service
        .from("listings")
        .select("*")
        .eq("id", rule.listing_id)
        .maybeSingle();
      if (!listing) {
        results.push({ ruleId: rule.id, reason: "listing_missing" });
        continue;
      }

      let account = accountCache.get(rule.user_id);
      if (!account) {
        const { data } = await service
          .from("ebay_accounts")
          .select("*")
          .eq("user_id", rule.user_id)
          .maybeSingle();
        if (!data) {
          results.push({ ruleId: rule.id, reason: "no_account" });
          continue;
        }
        account = data as EbayAccountRow;
        accountCache.set(rule.user_id, account);
      }

      const accessToken = await getValidAccessToken(account);
      account.access_token = accessToken;
      const result = await applyRule(rule, listing as ListingRow, accessToken);
      results.push({ ruleId: rule.id, ...result });
    } catch (err) {
      console.error(`Reprice cron failed for rule ${rule.id}`, err);
      results.push({ ruleId: rule.id, error: "reprice failed" });
    }
  }

  return NextResponse.json({ results });
}
