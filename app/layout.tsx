import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/app/components/site-nav";

export const metadata: Metadata = {
  title: "IP Intelligence Workstation",
  description:
    "Investigate network ownership, DNS, RDAP and security signals for public IP addresses.",
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
