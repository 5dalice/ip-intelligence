import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/app/components/site-nav";

export const metadata: Metadata = {
  title: "Security Investigation & Enrichment Workstation",
  description:
    "Analyst-oriented IP enrichment, evidence correlation and explainable risk assessment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
