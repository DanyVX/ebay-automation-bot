import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getEbayAccountForUser, getValidAccessToken } from "@/lib/ebay/account";
import { listAllOffers, getInventoryItem } from "@/lib/ebay/inventory";

// Pulls the seller's current offers + inventory from eBay and upserts them
// into the `listings` cache table. Called from the dashboard "Sync now"
// button and from the scheduled cron route.
export async function POST() {
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

  try {
    const accessToken = await getValidAccessToken(account);
    const offers = await listAllOffers(accessToken);

    const service = createServiceRoleClient();
    let synced = 0;

    for (const offer of offers) {
      if (!offer.sku) continue;
      let quantity: number | undefined;
      try {
        const item = await getInventoryItem(accessToken, offer.sku);
        quantity = item.availability?.shipToLocationAvailability?.quantity;
      } catch {
        // Inventory item may have been deleted while the offer lingers; skip qty.
      }

      const price = offer.pricingSummary?.price?.value
        ? Number(offer.pricingSummary.price.value)
        : null;

      await service.from("listings").upsert(
        {
          user_id: user.id,
          ebay_account_id: account.id,
          sku: offer.sku,
          offer_id: offer.offerId,
          listing_id: offer.listingId ?? offer.listing?.listingId ?? null,
          price,
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

    return NextResponse.json({ synced, total: offers.length });
  } catch (err) {
    console.error("eBay sync failed", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }
}
