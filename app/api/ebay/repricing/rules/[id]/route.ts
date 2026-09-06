import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

interface UpdateRuleBody {
  competitorQuery?: string;
  strategy?: "match_lowest" | "undercut_lowest";
  undercutAmount?: number | null;
  undercutPercent?: number | null;
  floorPrice?: number;
  ceilingPrice?: number | null;
  enabled?: boolean;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body: UpdateRuleBody = await request.json();
  if (body.floorPrice !== undefined && (!Number.isFinite(body.floorPrice) || body.floorPrice <= 0)) {
    return NextResponse.json({ error: "floorPrice must be a positive number" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.competitorQuery !== undefined) update.competitor_query = body.competitorQuery.trim();
  if (body.strategy !== undefined) update.strategy = body.strategy;
  if (body.undercutAmount !== undefined) update.undercut_amount = body.undercutAmount;
  if (body.undercutPercent !== undefined) update.undercut_percent = body.undercutPercent;
  if (body.floorPrice !== undefined) update.floor_price = body.floorPrice;
  if (body.ceilingPrice !== undefined) update.ceiling_price = body.ceilingPrice;
  if (body.enabled !== undefined) update.enabled = body.enabled;

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("repricing_rules")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }
  return NextResponse.json({ rule: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const service = createServiceRoleClient();
  const { error } = await service.from("repricing_rules").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
