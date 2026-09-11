import Link from "next/link";
import type { ReactNode } from "react";
import type { SignalState } from "@/app/lib/intelligence";

export function Shell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1220px] px-4 py-7 sm:px-6 sm:py-10">
      {children}
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <section className="mb-6 rounded-[24px] border border-slate-200 bg-white px-6 py-8 shadow-[var(--shadow-card)] sm:px-8 sm:py-9">
      <div className="flex flex-wrap items-end justify-between gap-7">
        <div className="max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>

          <h1 className="serif-title mt-3 text-4xl font-bold leading-[1.03] tracking-[-0.035em] text-slate-950 sm:text-5xl">
            {title}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500">
            {description}
          </p>
        </div>

        {aside}
      </div>
    </section>
  );
}

export function Panel({
  children,
  blue = false,
  pink = false,
  dark = false,
  className = "",
}: {
  children: ReactNode;
  blue?: boolean;
  pink?: boolean;
  dark?: boolean;
  className?: string;
}) {
  const appearance =
    dark
      ? "border-slate-800 bg-slate-950 text-white"
      : blue || pink
        ? "border-blue-100 bg-[#f5f9ff] text-slate-950"
        : "border-slate-200 bg-white text-slate-950";

  return (
    <section
      className={`rounded-[24px] border p-6 shadow-[var(--shadow-card)] sm:p-7 ${appearance} ${className}`}
    >
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <p
      className={`text-[10px] font-extrabold uppercase tracking-[0.22em] ${
        light
          ? "text-blue-300"
          : "text-blue-600"
      }`}
    >
      {children}
    </p>
  );
}

export function SectionTitle({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <h2
      className={`serif-title mt-2 text-[30px] font-bold leading-tight tracking-[-0.025em] ${
        light
          ? "text-white"
          : "text-slate-950"
      }`}
    >
      {children}
    </h2>
  );
}

export function DataBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50/75 px-4 py-4">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-slate-400">
        {label}
      </p>

      <p className="technical-value mt-2 break-all font-mono text-[13px] font-bold leading-5 text-slate-900">
        {value}
      </p>
    </div>
  );
}

export function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-4">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.17em] text-slate-400">
        {label}
      </p>

      <p className="technical-value mt-2 break-all font-mono text-[13px] font-extrabold text-slate-950">
        {value}
      </p>
    </div>
  );
}

export function FeatureRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-4 sm:grid-cols-[140px_1fr] sm:items-center">
      <span className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </span>

      <span className="technical-value break-all font-mono text-xs font-semibold leading-5 text-slate-800">
        {children}
      </span>
    </div>
  );
}

export function Pill({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-blue-700">
      {children}
    </span>
  );
}

export function StatusBadge({
  label,
  status,
}: {
  label: string;
  status: SignalState;
}) {
  const classes =
    status === "DETECTED"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "CLEAR"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${classes}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "DETECTED"
            ? "bg-red-500"
            : status === "CLEAR"
              ? "bg-emerald-500"
              : "bg-amber-500"
        }`}
      />

      {label}
    </span>
  );
}

export function EmptyInvestigation() {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white px-6 py-20 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto max-w-lg">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-600/20">
          IP
        </div>

        <Eyebrow>No active investigation</Eyebrow>

        <h2 className="serif-title mt-3 text-4xl font-bold tracking-[-0.03em] text-slate-950">
          Start with an IP address.
        </h2>

        <p className="mt-4 text-sm leading-7 text-slate-500">
          Run an investigation from Overview before opening the
          specialist workspaces.
        </p>

        <Link
          href="/"
          className="mt-7 inline-flex rounded-xl bg-blue-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700"
        >
          Open Overview
        </Link>
      </div>
    </section>
  );
}

export function LoadingInvestigation() {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white px-8 py-24 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />

      <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400">
        Loading investigation
      </p>
    </section>
  );
}
