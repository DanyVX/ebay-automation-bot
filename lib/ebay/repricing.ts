import { EBAY_API_BASE } from "./config";
import { getApplicationToken } from "./oauth";
import { bulkUpdatePriceQuantity } from "./inventory";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ListingRow, RepricingRuleRow } from "./types";

interface BrowseItemSummary {
  itemId: string;
  price?: { value: string; currency: string };
  itemWebUrl?: string;
}

// Searches active eBay listings for `query` and returns competitor prices,
// excluding the seller's own listing (matched by eBay listing/legacy id
// appearing in the item's web URL, since Browse API item ids don't line up
// 1:1 with the legacy listing id used elsewhere in this app).
export async function getCompetitorPrices(
  query: string,
  excludeListingId: string | null
): Promise<number[]> {
  const token = await getApplicationToken();
  const params = new URLSearchParams({ q: query, limit: "50", sort: "price" });
  const res = await fetch(`${EBAY_API_BASE}/buy/browse/v1/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });
  if (!res.ok) {
    throw new Error(`eBay Browse search failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const items: BrowseItemSummary[] = data.itemSummaries ?? [];

  return items
    .filter((item) => !excludeListingId || !item.itemWebUrl?.includes(excludeListingId))
    .map((item) => parseFloat(item.price?.value ?? "0"))
    .filter((price) => price > 0)
    .sort((a, b) => a - b);
}

// Applies a rule's strategy to a set of competitor prices and clamps the
// result to the rule's floor/ceiling. Returns null if there's nothing to
// price against (rule is skipped that cycle, never defaulted to a guess).
export function computeTargetPrice(
  rule: Pick<RepricingRuleRow, "strategy" | "undercut_amount" | "undercut_percent" | "floor_price" | "ceiling_price">,
  competitorPrices: number[]
): number | null {
  if (competitorPrices.length === 0) return null;

  const lowest = competitorPrices[0];
  let target = lowest;

  if (rule.strategy === "undercut_lowest") {
    if (rule.undercut_amount) {
      target = lowest - rule.undercut_amount;
    } else if (rule.undercut_percent) {
      target = lowest * (1 - rule.undercut_percent);
    }
  }

  if (target < rule.floor_price) target = rule.floor_price;
  if (rule.ceiling_price && target > rule.ceiling_price) target = rule.ceiling_price;

  return Math.round(target * 100) / 100;
}

export interface ApplyRuleResult {
  applied: boolean;
  reason: "no_competitors" | "no_change" | "updated";
  targetPrice?: number;
}

// Evaluates one rule against live competitor prices and, if the computed
// target differs meaningfully from the current price, pushes the change to
// eBay and logs it. This is the function both the manual "run now" route
// and the reprice cron call.
export async function applyRule(
  rule: RepricingRuleRow,
  listing: ListingRow,
  accessToken: string
): Promise<ApplyRuleResult> {
  if (!listing.offer_id) return { applied: false, reason: "no_change" };

  const competitorPrices = await getCompetitorPrices(rule.competitor_query, listing.listing_id);
  const target = computeTargetPrice(rule, competitorPrices);
  if (target === null) return { applied: false, reason: "no_competitors" };

  const currentPrice = listing.price ?? 0;
  if (Math.abs(target - currentPrice) < 0.01) return { applied: false, reason: "no_change" };

  await bulkUpdatePriceQuantity(accessToken, [
    { sku: listing.sku, offerId: listing.offer_id, price: target },
  ]);

  const service = createServiceRoleClient();
  const now = new Date().toISOString();

  await service
    .from("listings")
    .update({ price: target, last_synced_at: now })
    .eq("id", listing.id);

  await service
    .from("repricing_rules")
    .update({ last_applied_price: target, last_applied_at: now })
    .eq("id", rule.id);

  await service.from("price_history").insert({
    listing_id: listing.id,
    user_id: rule.user_id,
    old_price: listing.price,
    new_price: target,
    old_quantity: listing.quantity,
    new_quantity: listing.quantity,
    reason: "repricing_rule",
  });

  return { applied: true, reason: "updated", targetPrice: target };
}
