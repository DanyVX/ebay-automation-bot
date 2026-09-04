import { EBAY_API_BASE } from "./config";
import { getApplicationToken } from "./oauth";

export interface ResearchCandidate {
  title: string;
  category: string | null;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  activeListingCount: number;
  ebayItemId: string | null;
  imageUrl: string | null;
  itemUrl: string | null;
}

interface BrowseItemSummary {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  image?: { imageUrl: string };
  itemWebUrl?: string;
  categories?: { categoryName: string }[];
}

// Searches active eBay listings for `query` via the public Browse API and
// summarizes them into one research candidate: current market price range
// and how many sellers are already competing on it.
//
// Note: eBay's Browse API only exposes *active* listings, not sold/completed
// ones, so this is a demand *proxy* (competition + price spread), not true
// sell-through. Sold comps require the gated Marketplace Insights API.
export async function searchActiveListings(
  query: string,
  limit = 50
): Promise<ResearchCandidate | null> {
  const token = await getApplicationToken();
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(limit, 200)),
    sort: "price",
  });
  const res = await fetch(`${EBAY_API_BASE}/buy/browse/v1/item_summary/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });
  if (!res.ok) {
    throw new Error(`eBay Browse search failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const items: BrowseItemSummary[] = data.itemSummaries ?? [];
  if (items.length === 0) {
    return { title: query, category: null, avgPrice: null, minPrice: null, maxPrice: null, activeListingCount: data.total ?? 0, ebayItemId: null, imageUrl: null, itemUrl: null };
  }

  const prices = items.map((i) => parseFloat(i.price?.value ?? "0")).filter((p) => p > 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const top = items[0];

  return {
    title: top.title,
    category: top.categories?.[0]?.categoryName ?? null,
    avgPrice: avgPrice ? Number(avgPrice.toFixed(2)) : null,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    activeListingCount: data.total ?? items.length,
    ebayItemId: top.itemId ?? null,
    imageUrl: top.image?.imageUrl ?? null,
    itemUrl: top.itemWebUrl ?? null,
  };
}
