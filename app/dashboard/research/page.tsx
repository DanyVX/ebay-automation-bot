import { createClient } from "@/lib/supabase/server";
import ResearchPanel from "@/components/ResearchPanel";
import type { ResearchItemRow } from "@/lib/ebay/types";

export default async function ResearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: items } = user
    ? await supabase
        .from("research_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Product research</h1>
      <p className="text-sm text-slate-500">
        Search a product idea to see current eBay competition: how many sellers are already
        listing it and the live price range. Uses eBay&apos;s public Browse API, so results
        reflect active listings, not historical sales.
      </p>
      <ResearchPanel initialItems={(items as ResearchItemRow[]) ?? []} />
    </div>
  );
}
