export type EbayEnvironment = "production" | "sandbox";

export interface EbayAccountRow {
  id: string;
  user_id: string;
  ebay_user_id: string | null;
  environment: EbayEnvironment;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  scopes: string[];
}

export interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
}

export interface ListingRow {
  id: string;
  user_id: string;
  ebay_account_id: string;
  sku: string;
  offer_id: string | null;
  listing_id: string | null;
  title: string | null;
  price: number | null;
  currency: string | null;
  quantity: number | null;
  quantity_sold: number | null;
  status: string | null;
  listing_url: string | null;
  last_synced_at: string;
}

export type RepricingStrategy = "match_lowest" | "undercut_lowest";

export interface RepricingRuleRow {
  id: string;
  user_id: string;
  listing_id: string;
  competitor_query: string;
  strategy: RepricingStrategy;
  undercut_amount: number | null;
  undercut_percent: number | null;
  floor_price: number;
  ceiling_price: number | null;
  enabled: boolean;
  last_applied_price: number | null;
  last_applied_at: string | null;
  created_at: string;
}

export interface RepricingRuleWithListing extends RepricingRuleRow {
  listing: Pick<ListingRow, "sku" | "title" | "price" | "listing_url"> | null;
}

export interface ResearchItemRow {
  id: string;
  query: string;
  title: string;
  category: string | null;
  avg_sold_price: number | null;
  min_sold_price: number | null;
  max_sold_price: number | null;
  sold_count_90d: number | null;
  active_listing_count: number | null;
  sell_through_rate: number | null;
  ebay_item_id: string | null;
  image_url: string | null;
  item_url: string | null;
  saved: boolean;
}
