"use client";

import {
  EmptyInvestigation,
  Eyebrow,
  FeatureRow,
  LoadingInvestigation,
  PageHeader,
  Panel,
  SectionTitle,
  Shell,
  StatusBadge,
} from "@/app/components/intel-ui";
import { useInvestigation } from "@/app/components/use-investigation";

export default function DnsPage() {
  const { data, ready } = useInvestigation();

  if (!ready) {
    return <Shell><LoadingInvestigation /></Shell>;
  }

  if (!data) {
    return <Shell><EmptyInvestigation /></Shell>;
  }

  const dnsStatus =
    data.dns.fcrdns === "VERIFIED"
      ? "CLEAR"
      : data.dns.fcrdns === "MISMATCH"
        ? "DETECTED"
        : "UNKNOWN";

  return (
    <Shell>
      <PageHeader
        eyebrow="DNS"
        title="Reverse DNS & FCrDNS verification."
        description="Inspect the PTR record, resolve the resulting hostname forward again and determine whether it maps back to the original address."
        aside={
          <StatusBadge
            label={`FCrDNS ${data.dns.fcrdns}`}
            status={dnsStatus}
          />
        }
      />

      <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[1fr_0.8fr]">
        <Panel pink>
          <Eyebrow>Reverse DNS</Eyebrow>
          <SectionTitle>PTR investigation</SectionTitle>

          <div className="mt-6 space-y-3">
            <FeatureRow label="Target">
              {data.ip}
            </FeatureRow>

            <FeatureRow label="PTR">
              {data.dns.ptr}
            </FeatureRow>

            <FeatureRow label="FCrDNS">
              {data.dns.fcrdns}
            </FeatureRow>
          </div>

          <div className="mt-5 rounded-[20px] bg-white/70 p-5">
            <p className="text-sm leading-7 text-[#704056]">
              {data.dns.explanation}
            </p>
          </div>
        </Panel>

        <Panel>
          <Eyebrow>Verification state</Eyebrow>
          <SectionTitle>
            {data.dns.fcrdns}
          </SectionTitle>

          <div className="mt-7">
            {data.dns.fcrdns === "VERIFIED" && (
              <DnsExplanation
                title="Forward-confirmed"
                text="The PTR hostname resolves back to the investigated IP address. Reverse and forward DNS are consistent."
              />
            )}

            {data.dns.fcrdns === "MISMATCH" && (
              <DnsExplanation
                title="Forward mismatch"
                text="A reverse DNS hostname exists, but its forward DNS records do not include the investigated address."
              />
            )}

            {data.dns.fcrdns === "NO_PTR" && (
              <DnsExplanation
                title="No PTR evidence"
                text="The address has no usable PTR record, so forward-confirmed reverse DNS cannot be established."
              />
            )}
          </div>
        </Panel>
      </div>

      <div className="px-5 pb-8 sm:px-8">
        <Panel>
          <Eyebrow>Forward resolution</Eyebrow>
          <SectionTitle>Addresses returned by the PTR hostname</SectionTitle>

          <div className="mt-6 flex flex-wrap gap-2">
            {data.dns.resolvedAddresses.length ? (
              data.dns.resolvedAddresses.map((address) => (
                <code
                  key={address}
                  className="rounded-full bg-[#fff0f6] px-4 py-2 text-xs font-bold text-[#783853]"
                >
                  {address}
                </code>
              ))
            ) : (
              <p className="text-sm text-[#896074]">
                No forward A or AAAA records were available.
              </p>
            )}
          </div>

          <div className="mt-8 rounded-[20px] border border-[#f0c9d8] p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#b66086]">
              Why this matters
            </p>

            <p className="mt-3 max-w-4xl text-sm leading-7 text-[#805c6d]">
              FCrDNS is useful as a consistency signal, especially for
              infrastructure attribution and mail/network operations.
              Verification does not by itself establish trustworthiness or
              ownership of the endpoint.
            </p>
          </div>
        </Panel>
      </div>
    </Shell>
  );
}

function DnsExplanation({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[18px] border border-blue-100 bg-blue-50/70 p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-600" />
        <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-blue-600">
          Verification result
        </span>
      </div>

      <p className="serif-title text-2xl font-bold tracking-[-0.02em] text-slate-950">
        {title}
      </p>

      <p className="mt-3 text-sm leading-7 text-slate-500">
        {text}
      </p>
    </div>
  );
}
