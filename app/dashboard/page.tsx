import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEbayAccountForUser } from "@/lib/ebay/account";

export default async function DashboardOverview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const account = user ? await getEbayAccountForUser(user.id) : null;

  const { count: listingCount } = user
    ? await supabase.from("listings").select("id", { count: "exact", head: true }).eq("user_id", user.id)
    : { count: 0 };

  const { count: outOfStockCount } = user
    ? await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("quantity", 0)
    : { count: 0 };

  const { count: researchCount } = user
    ? await supabase.from("research_items").select("id", { count: "exact", head: true }).eq("user_id", user.id)
    : { count: 0 };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      {!account && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          You haven&apos;t connected an eBay account yet.{" "}
          <Link href="/dashboard/settings" className="font-medium underline">
            Connect it in Settings
          </Link>{" "}
          to start syncing listings.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Tracked listings" value={listingCount ?? 0} />
        <StatCard label="Out of stock" value={outOfStockCount ?? 0} />
        <StatCard label="Saved research items" value={researchCount ?? 0} />
      </div>

      <div className="flex gap-3">
        <Link
          href="/dashboard/listings"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Manage listings
        </Link>
        <Link
          href="/dashboard/research"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          Find products to sell
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}
