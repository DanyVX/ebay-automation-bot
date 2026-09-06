"use client";

import { useState } from "react";
import Link from "next/link";
import type { ListingRow } from "@/lib/ebay/types";

export default function ListingsTable({ initialListings }: { initialListings: ListingRow[] }) {
  const [listings, setListings] = useState(initialListings);
  const [editing, setEditing] = useState<Record<string, { price?: string; quantity?: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(null);

  function setDraft(id: string, field: "price" | "quantity", value: string) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveRow(listing: ListingRow) {
    const draft = editing[listing.id];
    if (!draft) return;

    const price = draft.price !== undefined && draft.price !== "" ? Number(draft.price) : undefined;
    const quantity =
      draft.quantity !== undefined && draft.quantity !== "" ? Number(draft.quantity) : undefined;
    if (price === undefined && quantity === undefined) return;

    setSavingId(listing.id);
    setErrorId(null);
    try {
      const res = await fetch("/api/ebay/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, price, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");

      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id
            ? { ...l, price: price ?? l.price, quantity: quantity ?? l.quantity }
            : l
        )
      );
      setEditing((prev) => {
        const next = { ...prev };
        delete next[listing.id];
        return next;
      });
    } catch (err) {
      setErrorId({ id: listing.id, message: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setSavingId(null);
    }
  }

  if (listings.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No listings yet. Connect your eBay account and hit &quot;Sync now&quot;.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2">SKU</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Price</th>
            <th className="px-4 py-2">Quantity</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => {
            const draft = editing[listing.id];
            const dirty = draft && (draft.price !== undefined || draft.quantity !== undefined);
            return (
              <tr key={listing.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{listing.sku}</div>
                  {listing.listing_url && (
                    <a
                      href={listing.listing_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 underline"
                    >
                      View on eBay
                    </a>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500">{listing.status ?? "-"}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 rounded border border-slate-300 px-2 py-1"
                    value={draft?.price ?? listing.price ?? ""}
                    onChange={(e) => setDraft(listing.id, "price", e.target.value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    className="w-20 rounded border border-slate-300 px-2 py-1"
                    value={draft?.quantity ?? listing.quantity ?? ""}
                    onChange={(e) => setDraft(listing.id, "quantity", e.target.value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    disabled={!dirty || savingId === listing.id}
                    onClick={() => saveRow(listing)}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-white disabled:opacity-40"
                  >
                    {savingId === listing.id ? "Saving..." : "Save"}
                  </button>
                  {errorId?.id === listing.id && (
                    <p className="mt-1 text-xs text-red-600">{errorId.message}</p>
                  )}
                  <Link
                    href={`/dashboard/repricing?listingId=${listing.id}`}
                    className="ml-2 text-xs text-slate-500 underline"
                  >
                    Set up repricing
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
