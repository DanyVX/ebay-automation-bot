import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

interface CreateRuleBody {
  listingId: string;
  competitorQuery: string;
  strategy: "match_lowest" | "undercut_lowest";
  undercutAmount?: number;
  undercutPercent?: number;
  floorPrice: number;
  ceilingPrice?: number;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("repricing_rules")
    .select("*, listing:listings(sku, title, price, listing_url)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load rules" }, { status: 500 });
  }
  return NextResponse.json({ rules: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body: CreateRuleBody = await request.json();
  if (!body.listingId || !body.competitorQuery?.trim() || !body.strategy || !body.floorPrice) {
    return NextResponse.json(
      { error: "listingId, competitorQuery, strategy, and floorPrice are required" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(body.floorPrice) || body.floorPrice <= 0) {
    return NextResponse.json({ error: "floorPrice must be a positive number" }, { status: 400 });
  }
  if (body.ceilingPrice !== undefined && body.ceilingPrice < body.floorPrice) {
    return NextResponse.json({ error: "ceilingPrice cannot be below floorPrice" }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data: listing, error: listingErr } = await service
    .from("listings")
    .select("id")
    .eq("id", body.listingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (listingErr || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const { data, error } = await service
    .from("repricing_rules")
    .upsert(
      {
        user_id: user.id,
        listing_id: body.listingId,
        competitor_query: body.competitorQuery.trim(),
        strategy: body.strategy,
        undercut_amount: body.undercutAmount ?? null,
        undercut_percent: body.undercutPercent ?? null,
        floor_price: body.floorPrice,
        ceiling_price: body.ceilingPrice ?? null,
        enabled: true,
      },
      { onConflict: "listing_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
  return NextResponse.json({ rule: data });
}
