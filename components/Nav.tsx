"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/listings", label: "Listings" },
  { href: "/dashboard/repricing", label: "Repricing" },
  { href: "/dashboard/research", label: "Research" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="font-semibold">eBay Automation Bot</span>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              pathname === link.href
                ? "text-sm font-medium text-slate-900"
                : "text-sm text-slate-500 hover:text-slate-900"
            }
          >
            {link.label}
          </Link>
        ))}
      </div>
      <button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-900">
        Sign out
      </button>
    </nav>
  );
}
