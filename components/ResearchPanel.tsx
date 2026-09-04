"use client";

import { useState } from "react";
import type { ResearchItemRow } from "@/lib/ebay/types";

export default function ResearchPanel({ initialItems }: { initialItems: ResearchItemRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ebay/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setItems((prev) => [data.item, ...prev]);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. wireless earbuds, vintage camera lens..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
            {item.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt={item.title} className="mb-2 h-32 w-full rounded object-contain" />
            )}
            <p className="text-xs uppercase tracking-wide text-slate-400">{item.query}</p>
            <p className="line-clamp-2 font-medium">{item.title}</p>
            <div className="mt-2 grid grid-cols-2 gap-1 text-sm text-slate-600">
              <span>Avg price</span>
              <span className="text-right">
                {item.avg_sold_price ? `$${item.avg_sold_price}` : "-"}
              </span>
              <span>Price range</span>
              <span className="text-right">
                {item.min_sold_price && item.max_sold_price
                  ? `$${item.min_sold_price} - $${item.max_sold_price}`
                  : "-"}
              </span>
              <span>Active listings</span>
              <span className="text-right">{item.active_listing_count ?? "-"}</span>
            </div>
            {item.item_url && (
              <a
                href={item.item_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-slate-500 underline"
              >
                View top listing
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
