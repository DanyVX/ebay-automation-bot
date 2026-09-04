import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">eBay Automation Bot</h1>
      <p className="max-w-xl text-slate-600">
        Sync prices and stock, push bulk updates, and research profitable products to list —
        all through eBay&apos;s official Sell &amp; Browse APIs.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700"
      >
        Get started
      </Link>
    </main>
  );
}
