import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { searchActiveListings } from "@/lib/ebay/research";

// Runs a product-research search for one query and saves the resulting
// candidate for the signed-in user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { query } = await request.json();
  if (!query || typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const candidate = await searchActiveListings(query.trim());
    if (!candidate) {
      return NextResponse.json({ error: "No results" }, { status: 404 });
    }

    const service = createServiceRoleClient();
    const { data, error } = await service
      .from("research_items")
      .insert({
        user_id: user.id,
        query: query.trim(),
        title: candidate.title,
        category: candidate.category,
        avg_sold_price: candidate.avgPrice,
        min_sold_price: candidate.minPrice,
        max_sold_price: candidate.maxPrice,
        active_listing_count: candidate.activeListingCount,
        ebay_item_id: candidate.ebayItemId,
        image_url: candidate.imageUrl,
        item_url: candidate.itemUrl,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (err) {
    console.error("eBay research search failed", err);
    return NextResponse.json({ error: "Research search failed" }, { status: 502 });
  }
}
