import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/ebay/account";
import { listAllOffers, getInventoryItem } from "@/lib/ebay/inventory";
import type { EbayAccountRow } from "@/lib/ebay/types";

// Scheduled entry point (call from Vercel Cron / GitHub Actions) that
// resyncs price & stock for every connected eBay account. Protect this
// route by setting CRON_SECRET and requiring it as a bearer token.
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const service = createServiceRoleClient();
  const { data: accounts, error } = await service.from("ebay_accounts").select("*");
  if (error) {
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }

  const results: { userId: string; synced?: number; error?: string }[] = [];

  for (const account of (accounts ?? []) as EbayAccountRow[]) {
    try {
      const accessToken = await getValidAccessToken(account);
      const offers = await listAllOffers(accessToken);
      let synced = 0;

      for (const offer of offers) {
        if (!offer.sku) continue;
        let quantity: number | undefined;
        try {
          const item = await getInventoryItem(accessToken, offer.sku);
          quantity = item.availability?.shipToLocationAvailability?.quantity;
        } catch {
          // ignore missing inventory item
        }

        await service.from("listings").upsert(
          {
            user_id: account.user_id,
            ebay_account_id: account.id,
            sku: offer.sku,
            offer_id: offer.offerId,
            listing_id: offer.listingId ?? offer.listing?.listingId ?? null,
            price: offer.pricingSummary?.price?.value
              ? Number(offer.pricingSummary.price.value)
              : null,
            currency: offer.pricingSummary?.price?.currency ?? "USD",
            quantity: quantity ?? null,
            status: offer.status,
            listing_url:
              offer.listingId ?? offer.listing?.listingId
                ? `https://www.ebay.com/itm/${offer.listingId ?? offer.listing?.listingId}`
                : null,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "ebay_account_id,sku" }
        );
        synced += 1;
      }

      results.push({ userId: account.user_id, synced });
    } catch (err) {
      console.error(`Cron sync failed for account ${account.id}`, err);
      results.push({ userId: account.user_id, error: "sync failed" });
    }
  }

  return NextResponse.json({ results });
}
