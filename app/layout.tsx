import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eBay Automation Bot",
  description: "Automate pricing, stock, and product research for your eBay store.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
