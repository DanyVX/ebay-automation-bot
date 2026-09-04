import { createClient } from "@/lib/supabase/server";
import { getEbayAccountForUser } from "@/lib/ebay/account";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ebay_connected?: string; ebay_error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const account = user ? await getEbayAccountForUser(user.id) : null;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {params.ebay_connected && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          eBay account connected successfully.
        </p>
      )}
      {params.ebay_error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Couldn&apos;t connect your eBay account ({params.ebay_error}). Please try again.
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">eBay account</h2>
        {account ? (
          <div className="mt-2 text-sm text-slate-600">
            <p>
              Status: <span className="font-medium text-green-700">Connected</span>
            </p>
            <p>Environment: {account.environment}</p>
            <p>
              Scopes: <span className="text-xs">{account.scopes.join(", ")}</span>
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No eBay account connected yet.</p>
        )}
        <a
          href="/api/ebay/connect"
          className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {account ? "Reconnect eBay account" : "Connect eBay account"}
        </a>
      </div>
    </div>
  );
}
