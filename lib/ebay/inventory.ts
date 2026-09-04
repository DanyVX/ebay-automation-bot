import { EBAY_API_BASE } from "./config";

async function ebayFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${EBAY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept-Language": "en-US",
      "Content-Language": "en-US",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`eBay API ${path} failed: ${res.status} ${await res.text()}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export interface EbayOffer {
  offerId: string;
  sku: string;
  listingId?: string;
  status: string;
  pricingSummary?: { price?: { value: string; currency: string } };
  availableQuantity?: number;
  listing?: { listingId?: string };
}

export interface EbayInventoryItem {
  sku: string;
  product?: { title?: string; imageUrls?: string[] };
  availability?: { shipToLocationAvailability?: { quantity?: number } };
}

// Fetches every offer (one per listed SKU) for the authenticated seller,
// paging through eBay's 200-item-per-page limit.
export async function listAllOffers(accessToken: string): Promise<EbayOffer[]> {
  const offers: EbayOffer[] = [];
  let offset = 0;
  const limit = 200;
  for (;;) {
    const data = await ebayFetch(
      accessToken,
      `/sell/inventory/v1/offer?limit=${limit}&offset=${offset}`
    );
    const page: EbayOffer[] = data?.offers ?? [];
    offers.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }
  return offers;
}

export async function getInventoryItem(
  accessToken: string,
  sku: string
): Promise<EbayInventoryItem> {
  return ebayFetch(accessToken, `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`);
}

export interface PriceQuantityUpdate {
  sku: string;
  offerId: string;
  price?: number;
  currency?: string;
  quantity?: number;
}

// Updates price and/or quantity for up to 25 SKUs per call using eBay's
// bulk endpoint, which is the recommended way to push routine repricing.
export async function bulkUpdatePriceQuantity(
  accessToken: string,
  updates: PriceQuantityUpdate[]
) {
  const chunks: PriceQuantityUpdate[][] = [];
  for (let i = 0; i < updates.length; i += 25) chunks.push(updates.slice(i, i + 25));

  const results = [];
  for (const chunk of chunks) {
    const body = {
      requests: chunk.map((u) => ({
        sku: u.sku,
        offers:
          u.price !== undefined
            ? [{ offerId: u.offerId, price: { value: u.price.toFixed(2), currency: u.currency ?? "USD" } }]
            : undefined,
        shipToLocationAvailability:
          u.quantity !== undefined ? { quantity: u.quantity } : undefined,
      })),
    };
    const data = await ebayFetch(accessToken, `/sell/inventory/v1/bulk_update_price_quantity`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    results.push(data);
  }
  return results;
}
