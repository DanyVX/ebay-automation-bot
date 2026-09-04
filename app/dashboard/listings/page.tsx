import { createClient } from "@/lib/supabase/server";
import ListingsTable from "@/components/ListingsTable";
import SyncButton from "@/components/SyncButton";
import type { ListingRow } from "@/lib/ebay/types";

export default async function ListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listings } = user
    ? await supabase
        .from("listings")
        .select("*")
        .eq("user_id", user.id)
        .order("last_synced_at", { ascending: false })
    : { data: [] };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Listings</h1>
        <SyncButton />
      </div>
      <ListingsTable initialListings={(listings as ListingRow[]) ?? []} />
    </div>
  );
}
