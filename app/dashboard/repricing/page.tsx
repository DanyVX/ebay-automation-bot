import { createClient } from "@/lib/supabase/server";
import RepricingRules from "@/components/RepricingRules";
import type { ListingRow, RepricingRuleWithListing } from "@/lib/ebay/types";

export default async function RepricingPage({
  searchParams,
}: {
  searchParams: Promise<{ listingId?: string }>;
}) {
  const { listingId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rules } = user
    ? await supabase
        .from("repricing_rules")
        .select("*, listing:listings(sku, title, price, listing_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: listings } = user
    ? await supabase
        .from("listings")
        .select("*")
        .eq("user_id", user.id)
        .order("sku", { ascending: true })
    : { data: [] };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Repricing rules</h1>
      <p className="text-sm text-slate-500">
        Set a floor price and a competitor search term for a listing. The bot compares against
        live active eBay listings for that search and keeps your price at or under the lowest
        one it finds, never below your floor.
      </p>
      <RepricingRules
        initialRules={(rules as unknown as RepricingRuleWithListing[]) ?? []}
        listings={(listings as ListingRow[]) ?? []}
        preselectedListingId={listingId}
      />
    </div>
  );
}
