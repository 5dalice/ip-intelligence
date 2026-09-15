"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";

import {
  HISTORY_KEY,
  type IpData,
  formatAsn,
  mapUrl,
  saveLatestInvestigation,
} from "@/app/lib/intelligence";

import {
  DataBox,
  Eyebrow,
  Metric,
  Panel,
  Pill,
  SectionTitle,
  Shell,
  StatusBadge,
} from "@/app/components/intel-ui";

export default function OverviewPage() {
  const [data, setData] = useState<IpData | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [inputError, setInputError] = useState("");
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  function refreshHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];

      setHistory(
        Array.isArray(parsed)
          ? parsed.filter(
              (item): item is string => typeof item === "string"
            )
          : []
      );
    } catch {
      setHistory([]);
    }
  }

  async function lookup(ip?: string) {
    setLoading(true);
    setError("");
    setInputError("");

    try {
      const endpoint = ip
        ? `/api/ip?ip=${encodeURIComponent(ip)}`
        : "/api/ip";

      const response = await fetch(endpoint, {
        cache: "no-store",
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Unable to investigate the IP address.";

        throw new Error(message);
      }

      const intelligence = result as IpData;

      setData(intelligence);
      saveLatestInvestigation(intelligence);
      refreshHistory();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void lookup();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateInput(value: string) {
    if (!value) return "Enter an IPv4 or IPv6 address.";

    if (/\s/.test(value)) {
      return "IP addresses cannot contain spaces.";
    }

    if (value.length > 45) {
      return "The value is too long to be a valid IP address.";
    }

    const ipv4Like =
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);

    const ipv6Like = value.includes(":");

    if (!ipv4Like && !ipv6Like) {
      return "Enter an IP address, not a hostname or URL.";
    }

    if (ipv4Like) {
      const parts = value.split(".").map(Number);

      if (
        parts.some(
          (part) => part < 0 || part > 255
        )
      ) {
        return "One or more IPv4 octets are outside 0–255.";
      }
    }

    return "";
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = query.trim();
    const validation = validateInput(value);

    if (validation) {
      setInputError(validation);
      return;
    }

    void lookup(value);
  }

  return (
    <Shell>
      <section className="cyber-grid relative overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-b from-blue-50 via-[#f8fbff] to-white px-5 pb-7 pt-8 shadow-[0_20px_60px_rgba(37,99,235,0.07)] sm:px-10 sm:pb-10 sm:pt-11">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/85 px-3 py-1.5 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-blue-700">
              IP · ASN · RDAP · DNS · Threat Intelligence
            </span>
          </div>

          <h1 className="serif-title mx-auto mt-5 max-w-4xl text-4xl font-bold leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-6xl">
            Understand the network behind
            <span className="mx-2 rounded-lg bg-blue-600 px-3 text-white">
              any IP
            </span>
            address.
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Investigate ownership, registration, DNS consistency,
            security signals and explainable risk from one public
            IPv4 or IPv6 address.
          </p>

          <form
            onSubmit={submit}
            aria-label="Investigate an IP address"
            className="mx-auto mt-6 max-w-2xl rounded-2xl border border-blue-200 bg-white p-2 shadow-[0_15px_45px_rgba(37,99,235,0.14)] ring-4 ring-blue-50/70"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setInputError("");
                }}
                placeholder="Enter public IPv4 or IPv6 address"
                spellCheck={false}
                aria-invalid={Boolean(inputError)}
                aria-describedby={inputError ? "ip-input-error" : undefined}
                className="min-w-0 flex-1 rounded-xl border border-transparent bg-slate-50 px-5 py-4 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:bg-blue-50/60 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="min-h-12 rounded-xl bg-blue-600 px-7 py-4 text-xs font-extrabold text-white shadow-[0_8px_24px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-blue-400 disabled:shadow-none"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {loading && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {loading ? "Investigating" : "Investigate IP"}
                </span>
              </button>
            </div>
          </form>

          {inputError && (
            <p id="ip-input-error" className="mx-auto mt-2 max-w-2xl text-left text-xs font-semibold text-red-700">
              {inputError}
            </p>
          )}

          {error && (
            <div role="alert" className="mx-auto mt-3 flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-2.5 text-left text-xs text-red-700">
              <span>{error}</span>
              <button type="button" onClick={() => void lookup(query.trim() || undefined)} className="shrink-0 font-bold text-red-800 underline decoration-red-300 underline-offset-2 transition hover:text-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Retry</button>
            </div>
          )}

          {loading && !data && !error && (
            <p role="status" className="mt-3 text-xs font-semibold text-slate-500">
              Preparing the latest investigation…
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-x-7 gap-y-3 text-xs font-semibold text-slate-500">
            <TrustItem>RDAP registration</TrustItem>
            <TrustItem>FCrDNS verification</TrustItem>
            <TrustItem>Explainable risk</TrustItem>
            <TrustItem>Evidence-first analysis</TrustItem>
          </div>
        </div>

        {data && (
          <div className="relative z-10 mx-auto mt-9 max-w-5xl rounded-[24px] border border-slate-200/80 bg-white p-2.5 shadow-[0_25px_80px_rgba(15,23,42,0.12)] sm:mt-10">
            <div className="overflow-hidden rounded-[19px]">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                    Active investigation
                  </p>

                  <p className="mt-1 break-all font-mono text-xl font-black tracking-tight text-slate-950">
                    {data.ip}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Pill>{data.version}</Pill>
                  <Pill>{data.performance.responseTimeMs} ms</Pill>
                  <Pill>Cache {data.performance.cache}</Pill>
                </div>
              </div>

              <div className="grid gap-px border-t border-slate-200/80 bg-slate-200/80 sm:grid-cols-2 lg:grid-cols-4">
                <PreviewStat
                  label="Organization"
                  value={data.network.company}
                  featured
                />

                <PreviewStat
                  label="ASN"
                  value={formatAsn(data.network.asn)}
                  featured
                />

                <PreviewStat
                  label="Risk"
                  value={
                    data.risk.score === null
                      ? "Unavailable"
                      : `${data.risk.score}/100 · ${data.risk.level}`
                  }
                  featured
                />

                <PreviewStat
                  label="Approx. location"
                  value={`${data.location.city}, ${data.location.country}`}
                />
              </div>

              <div className="grid gap-6 bg-white p-5 sm:p-6 lg:grid-cols-[1.3fr_0.7fr]">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-blue-600">
                    Investigation summary
                  </p>

                  <p className="serif-title mt-3 text-xl font-bold leading-relaxed text-slate-950 sm:text-2xl">
                    {data.summary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Metric
                    label="Data quality"
                    value={`${data.dataQuality.score}%`}
                  />

                  <Metric
                    label="FCrDNS"
                    value={data.dns.fcrdns}
                  />

                  <Metric
                    label="CIDR"
                    value={data.network.cidr}
                  />

                  <Metric
                    label="Network type"
                    value={data.network.networkType}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="py-14 sm:py-18">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Investigation workspaces</Eyebrow>

          <h2 className="serif-title mt-3 text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Understand the infrastructure,
            not just the address.
          </h2>

          <p className="mt-5 text-sm leading-7 text-slate-500">
            Each workspace focuses on a different layer of the investigation
            so complex data stays readable and auditable.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <CapabilityCard
            number="01"
            title="Network Intelligence"
            description="ASN, CIDR, network ownership, protocol representation and RDAP registration."
            href="/network"
          />

          <CapabilityCard
            number="02"
            title="Threat Signals"
            description="VPN, proxy, Tor, hosting and abuse telemetry with explainable weighting."
            href="/signals"
          />

          <CapabilityCard
            number="03"
            title="DNS Verification"
            description="PTR records and forward-confirmed reverse DNS correlation."
            href="/dns"
          />

          <CapabilityCard
            number="04"
            title="Evidence"
            description="Processing pipeline, normalized data, source responses and reports."
            href="/evidence"
          />
        </div>
      </section>

      {data && (
        <>
          <section className="grid gap-6 pb-14 lg:grid-cols-[1.1fr_0.9fr]">
            <Panel>
              <Eyebrow>Security posture</Eyebrow>
              <SectionTitle>
                Risk that can be explained.
              </SectionTitle>

              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-500">
                The score is derived from explicit signals. Unknown telemetry
                remains unknown instead of being silently interpreted as safe.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <DataBox
                  label="Risk score"
                  value={
                    data.risk.score === null
                      ? "Unavailable"
                      : `${data.risk.score}/100`
                  }
                />

                <DataBox
                  label="Risk level"
                  value={data.risk.level}
                />

                <DataBox
                  label="Data quality"
                  value={`${data.dataQuality.score}% · ${data.dataQuality.level}`}
                />

                <DataBox
                  label="Signals available"
                  value={`${data.dataQuality.availableSignals}/${data.dataQuality.totalSignals}`}
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {data.evidence.map((item) => (
                  <StatusBadge
                    key={item.indicator}
                    label={`${item.indicator}: ${item.status}`}
                    status={item.status}
                  />
                ))}
              </div>

              <Link
                href="/signals"
                className="mt-7 inline-flex items-center gap-2 text-xs font-extrabold text-blue-600 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-4"
              >
                Explore threat signals
                <span>→</span>
              </Link>
            </Panel>

            <Panel blue>
              <Eyebrow>Analyst workflow</Eyebrow>
              <SectionTitle>
                From raw IP to evidence.
              </SectionTitle>

              <div className="mt-7 space-y-0">
                <ProcessStep
                  number="01"
                  title="Validate"
                  text="Confirm public IPv4/IPv6 syntax and reject reserved address space."
                />

                <ProcessStep
                  number="02"
                  title="Enrich"
                  text="Collect network ownership, geolocation and provider security telemetry."
                />

                <ProcessStep
                  number="03"
                  title="Correlate"
                  text="Combine DNS, RDAP and normalized intelligence into one model."
                />

                <ProcessStep
                  number="04"
                  title="Assess"
                  text="Produce explainable risk and evidence-coverage metrics."
                  last
                />
              </div>
            </Panel>
          </section>

          {data.location.latitude !== null &&
            data.location.longitude !== null && (
              <section className="pb-14">
                <div className="grid overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[var(--shadow-card)] lg:grid-cols-[360px_1fr]">
                  <div className="p-7 sm:p-9">
                    <Eyebrow>Approximate geolocation</Eyebrow>

                    <h2 className="serif-title mt-3 text-4xl font-bold tracking-[-0.04em] text-slate-950">
                      {data.location.city},
                      <br />
                      {data.location.country}
                    </h2>

                    <div className="mt-7 grid gap-3">
                      <DataBox
                        label="Region"
                        value={data.location.region}
                      />

                      <DataBox
                        label="Timezone"
                        value={data.location.timezone}
                      />
                    </div>

                    <p className="mt-5 text-xs leading-6 text-slate-500">
                      {data.location.accuracyNotice}
                    </p>
                  </div>

                  <iframe
                    title="Approximate IP location"
                    className="h-[390px] w-full border-0 lg:h-full lg:min-h-[420px]"
                    src={mapUrl(
                      data.location.latitude,
                      data.location.longitude
                    )}
                  />
                </div>
              </section>
            )}
        </>
      )}

      {history.length > 0 && (
        <section className="pb-14">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Eyebrow>History</Eyebrow>

                <h2 className="serif-title mt-2 text-2xl font-bold text-slate-950">
                  Recent investigations
                </h2>
              </div>

              <p className="text-xs text-slate-400">
                Stored locally in your browser
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {history.map((ip) => (
                <button
                  key={ip}
                  onClick={() => {
                    setQuery(ip);
                    void lookup(ip);
                  }}
                  aria-label={`Investigate ${ip}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-xs font-bold text-slate-600 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
                >
                  {ip}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        IP Intelligence Workstation · Network ownership · RDAP · DNS · Explainable risk
      </footer>
    </Shell>
  );
}

function TrustItem({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-4 w-4 place-items-center rounded-full border border-blue-200 bg-blue-50 text-[8px] font-black text-blue-600">
        ✓
      </span>
      {children}
    </span>
  );
}

function PreviewStat({
  label,
  value,
  featured = false,
}: {
  label: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <div className={`min-h-[105px] bg-white p-5 ${featured ? "sm:min-h-[118px]" : ""}`}>
      <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>

      <p className={`mt-3 break-words leading-6 text-slate-950 ${featured ? "text-base font-black" : "text-sm font-bold"}`}>
        {value}
      </p>
    </div>
  );
}

function CapabilityCard({
  number,
  title,
  description,
  href,
}: {
  number: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_50px_rgba(37,99,235,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-4"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-black text-blue-600">
          {number}
        </span>

        <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-50 text-sm text-slate-400 transition group-hover:bg-blue-600 group-hover:text-white">
          →
        </span>
      </div>

      <h3 className="serif-title mt-8 text-2xl font-bold text-slate-950">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </Link>
  );
}

function ProcessStep({
  number,
  title,
  text,
  last = false,
}: {
  number: string;
  title: string;
  text: string;
  last?: boolean;
}) {
  return (
    <div className="grid grid-cols-[38px_1fr] gap-4">
      <div className="flex flex-col items-center">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 font-mono text-[9px] font-black text-white">
          {number}
        </div>

        {!last && (
          <div className="min-h-16 w-px flex-1 bg-blue-200" />
        )}
      </div>

      <div className={last ? "" : "pb-6"}>
        <p className="font-bold text-slate-950">
          {title}
        </p>

        <p className="mt-1 text-xs leading-6 text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}
