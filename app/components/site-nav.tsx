"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/network", label: "Network" },
  { href: "/signals", label: "Signals" },
  { href: "/dns", label: "DNS" },
  { href: "/evidence", label: "Evidence" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-[1220px] px-4 sm:px-6">
        <nav className="flex min-h-[72px] items-center justify-between gap-6">
          <Link
            href="/"
            className="group flex items-center gap-3"
          >
            <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-blue-600 text-[11px] font-black text-white shadow-lg shadow-blue-600/20 transition group-hover:bg-blue-700">
              IP
            </div>

            <div>
              <div className="text-sm font-extrabold tracking-[-0.02em] text-slate-950">
                IP Intelligence
              </div>

              <div className="mt-0.5 text-[8px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
                Investigation Workstation
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 md:flex">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-4 py-2 text-[11px] font-bold transition ${
                    active
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-950"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <Link
            href="/"
            className="rounded-xl bg-blue-600 px-5 py-3 text-[11px] font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700"
          >
            Investigate IP
          </Link>
        </nav>

        <div className="flex gap-1 overflow-x-auto pb-3 md:hidden">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-bold ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
