import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getEbayAccountForUser, getValidAccessToken } from "@/lib/ebay/account";
import { bulkUpdatePriceQuantity } from "@/lib/ebay/inventory";

interface UpdateBody {
  listingId: string; // our internal `listings.id`, not eBay's listingId
  price?: number;
  quantity?: number;
  reason?: string;
}

// Pushes a price and/or quantity change for one listing to eBay, then
// updates our cache and records the change in price_history.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body: UpdateBody = await request.json();
  if (!body.listingId || (body.price === undefined && body.quantity === undefined)) {
    return NextResponse.json({ error: "listingId and price and/or quantity required" }, { status: 400 });
  }
  if (body.price !== undefined && (!Number.isFinite(body.price) || body.price <= 0)) {
    return NextResponse.json({ error: "price must be a positive number" }, { status: 400 });
  }
  if (body.quantity !== undefined && (!Number.isInteger(body.quantity) || body.quantity < 0)) {
    return NextResponse.json({ error: "quantity must be a non-negative integer" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: listing, error: listingErr } = await service
    .from("listings")
    .select("*")
    .eq("id", body.listingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (listingErr || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (!listing.offer_id) {
    return NextResponse.json({ error: "Listing has no eBay offer to update" }, { status: 400 });
  }

  const account = await getEbayAccountForUser(user.id);
  if (!account) {
    return NextResponse.json({ error: "No eBay account connected" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(account);
    await bulkUpdatePriceQuantity(accessToken, [
      {
        sku: listing.sku,
        offerId: listing.offer_id,
        price: body.price,
        quantity: body.quantity,
      },
    ]);

    await service
      .from("listings")
      .update({
        price: body.price ?? listing.price,
        quantity: body.quantity ?? listing.quantity,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", listing.id);

    await service.from("price_history").insert({
      listing_id: listing.id,
      user_id: user.id,
      old_price: listing.price,
      new_price: body.price ?? listing.price,
      old_quantity: listing.quantity,
      new_quantity: body.quantity ?? listing.quantity,
      reason: body.reason ?? "manual update",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("eBay listing update failed", err);
    return NextResponse.json({ error: "Failed to update listing on eBay" }, { status: 502 });
  }
}
