"use client";

import { useState } from "react";
import type { ListingRow, RepricingRuleWithListing, RepricingStrategy } from "@/lib/ebay/types";

interface Props {
  initialRules: RepricingRuleWithListing[];
  listings: ListingRow[];
  preselectedListingId?: string;
}

export default function RepricingRules({ initialRules, listings, preselectedListingId }: Props) {
  const [rules, setRules] = useState(initialRules);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [listingId, setListingId] = useState(preselectedListingId ?? listings[0]?.id ?? "");
  const [competitorQuery, setCompetitorQuery] = useState("");
  const [strategy, setStrategy] = useState<RepricingStrategy>("undercut_lowest");
  const [undercutAmount, setUndercutAmount] = useState("0.50");
  const [floorPrice, setFloorPrice] = useState("");
  const [ceilingPrice, setCeilingPrice] = useState("");
  const [creating, setCreating] = useState(false);

  const rulesByListingId = new Set(rules.map((r) => r.listing_id));
  const availableListings = listings.filter((l) => !rulesByListingId.has(l.id));

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (!listingId || !competitorQuery.trim() || !floorPrice) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/ebay/repricing/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          competitorQuery,
          strategy,
          undercutAmount: strategy === "undercut_lowest" ? Number(undercutAmount) : undefined,
          floorPrice: Number(floorPrice),
          ceilingPrice: ceilingPrice ? Number(ceilingPrice) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create rule");
      const listing = listings.find((l) => l.id === listingId) ?? null;
      setRules((prev) => [{ ...data.rule, listing }, ...prev]);
      setCompetitorQuery("");
      setFloorPrice("");
      setCeilingPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(rule: RepricingRuleWithListing) {
    const res = await fetch(`/api/ebay/repricing/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (res.ok) {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)));
    }
  }

  async function deleteRule(id: string) {
    const res = await fetch(`/api/ebay/repricing/rules/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== id));
    }
  }

  async function runRule(id: string) {
    setRunningId(id);
    setError(null);
    try {
      const res = await fetch("/api/ebay/repricing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      const result = data.results?.[0];
      if (result?.applied) {
        setRules((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  last_applied_price: result.targetPrice,
                  last_applied_at: new Date().toISOString(),
                  listing: r.listing ? { ...r.listing, price: result.targetPrice } : r.listing,
                }
              : r
          )
        );
      } else if (result?.reason === "no_competitors") {
        setError("No competitor listings found for that search term — rule left unchanged.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={createRule}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Listing
          <select
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {availableListings.length === 0 && <option value="">No listings available</option>}
            {availableListings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.sku} {l.price ? `($${l.price})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Competitor search term
          <input
            value={competitorQuery}
            onChange={(e) => setCompetitorQuery(e.target.value)}
            placeholder="e.g. wireless earbuds bluetooth"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Strategy
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as RepricingStrategy)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="undercut_lowest">Undercut lowest competitor</option>
            <option value="match_lowest">Match lowest competitor</option>
          </select>
        </label>

        {strategy === "undercut_lowest" && (
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Undercut amount ($)
            <input
              type="number"
              step="0.01"
              value={undercutAmount}
              onChange={(e) => setUndercutAmount(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Floor price ($) — never go below
          <input
            type="number"
            step="0.01"
            value={floorPrice}
            onChange={(e) => setFloorPrice(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Ceiling price ($) — optional cap
          <input
            type="number"
            step="0.01"
            value={ceilingPrice}
            onChange={(e) => setCeilingPrice(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>

        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={creating || !listingId}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {creating ? "Adding..." : "Add rule"}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rules.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No repricing rules yet. Add one above.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2">Listing</th>
                <th className="px-4 py-2">Searching for</th>
                <th className="px-4 py-2">Strategy</th>
                <th className="px-4 py-2">Floor / Ceiling</th>
                <th className="px-4 py-2">Last applied</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-medium">{rule.listing?.sku ?? rule.listing_id}</div>
                    <div className="text-xs text-slate-400">
                      current: {rule.listing?.price ? `$${rule.listing.price}` : "-"}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{rule.competitor_query}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {rule.strategy === "undercut_lowest"
                      ? `Undercut by $${rule.undercut_amount ?? 0}`
                      : "Match lowest"}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    ${rule.floor_price}
                    {rule.ceiling_price ? ` - $${rule.ceiling_price}` : ""}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {rule.last_applied_price ? `$${rule.last_applied_price}` : "never"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => runRule(rule.id)}
                        disabled={runningId === rule.id || !rule.enabled}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        {runningId === rule.id ? "Running..." : "Run now"}
                      </button>
                      <button
                        onClick={() => toggleEnabled(rule)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100"
                      >
                        {rule.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-xs text-red-600 underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
