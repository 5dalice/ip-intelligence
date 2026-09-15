"use client";

import {
  EmptyInvestigation,
  Eyebrow,
  LoadingInvestigation,
  PageHeader,
  Panel,
  SectionTitle,
  Shell,
  StatusBadge,
} from "@/app/components/intel-ui";
import { useInvestigation } from "@/app/components/use-investigation";
import {
  getSecuritySignalCoverage,
  type EvidenceItem,
} from "@/app/lib/intelligence";

export default function SignalsPage() {
  const { data, ready } = useInvestigation();

  if (!ready) {
    return <Shell><LoadingInvestigation /></Shell>;
  }

  if (!data) {
    return <Shell><EmptyInvestigation /></Shell>;
  }

  const coverage = getSecuritySignalCoverage(data);
  const riskUnavailable = !data.risk.available || coverage.allUnavailable;

  return (
    <Shell>
      <PageHeader
        eyebrow="Signals"
        title="Threat telemetry & explainable risk."
        description="Separate observed security indicators from interpretation. UNKNOWN is never treated as CLEAR, and every weighted detection can be traced back to its evidence source."
      />

      <div className="grid gap-5 p-5 sm:p-8 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <Eyebrow>Threat signal matrix</Eyebrow>
          <SectionTitle>Security signals</SectionTitle>

          <div className="mt-6 space-y-3">
            {data.evidence.map((item) => (
              <EvidenceCard key={item.indicator} item={item} />
            ))}
          </div>
        </Panel>

        <Panel>
          <Eyebrow>Explainable risk engine</Eyebrow>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-7">
            <div>
              <p className={`font-serif text-6xl font-bold ${riskUnavailable ? "text-slate-500" : "text-slate-950"}`}>
                {data.risk.score ?? "—"}
                <span className="text-xl text-[#b57492]">/100</span>
              </p>

              <p className={`mt-2 text-xs font-black uppercase tracking-[0.2em] ${riskUnavailable ? "text-slate-500" : "text-[#d52b76]"}`}>
                {riskUnavailable ? "UNAVAILABLE" : data.risk.level}
              </p>
            </div>

            <RiskGauge score={riskUnavailable ? null : data.risk.score} unavailable={riskUnavailable} />
          </div>

          <div className={`mt-7 rounded-[20px] p-5 ${riskUnavailable ? "bg-slate-100" : "bg-[#fff0f6]"}`}>
            <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${riskUnavailable ? "text-slate-500" : "text-[#b65d85]"}`}>
              Risk assessment
            </p>

            {riskUnavailable ? (
              <>
                <p className="mt-3 text-sm font-bold text-slate-700">Insufficient security telemetry</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">The available data is not sufficient to calculate a defensible risk score.</p>
              </>
            ) : (
              <p className="mt-3 font-mono text-xs leading-6">{data.risk.formula}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              <span><strong className="font-mono text-slate-700">{coverage.evaluated} of {coverage.total}</strong> evaluated</span>
              <span><strong className="font-mono text-slate-700">{coverage.unavailable}</strong> unavailable</span>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {data.risk.contributions.length ? (
              data.risk.contributions.map((item) => (
                <div
                  key={item.indicator}
                  className="rounded-[18px] border border-[#f2c6d8] p-4"
                >
                  <div className="flex justify-between gap-4">
                    <p className="font-bold">{item.indicator}</p>
                    <p className="font-mono font-black text-[#dd2a77]">
                      +{item.points}
                    </p>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-[#875f72]">
                    {item.reason}
                  </p>
                </div>
              ))
            ) : riskUnavailable ? (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                No weighted risk conclusion is available because the required security signals could not be evaluated.
              </div>
            ) : (
              <div className="rounded-[18px] bg-[#effcf4] p-4 text-sm font-bold text-[#207047]">
                No weighted risk indicators detected.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 px-5 pb-8 sm:px-8 lg:grid-cols-[0.75fr_1.25fr]">
        <Panel pink>
          <Eyebrow>Evidence coverage</Eyebrow>
          <SectionTitle>Data quality</SectionTitle>

          <div className="mt-6 flex items-center gap-6">
            <QualityGauge score={data.dataQuality.score} />

            <div>
              <p className="text-3xl font-black">
                {data.dataQuality.level}
              </p>

              <p className="mt-1 text-sm text-[#986178]">
                {data.dataQuality.availableSignals}/
                {data.dataQuality.totalSignals} expected signals available
              </p>
            </div>
          </div>

          <p className="mt-6 text-xs leading-5 text-[#8c6074]">
            {data.dataQuality.explanation}
          </p>
        </Panel>

        <Panel>
          <Eyebrow>Missing evidence</Eyebrow>
          <SectionTitle>What do we not know?</SectionTitle>

          <div className="mt-6 flex flex-wrap gap-2">
            {data.dataQuality.missing.length ? (
              data.dataQuality.missing.map((item) => (
                <StatusBadge
                  key={item}
                  label={item}
                  status="UNKNOWN"
                />
              ))
            ) : (
              <StatusBadge
                label="No expected evidence missing"
                status="CLEAR"
              />
            )}
          </div>

          <p className="mt-6 max-w-3xl text-sm leading-7 text-[#876074]">
            Missing evidence reduces investigation coverage. It does not
            imply that an indicator is absent. This distinction prevents
            unavailable telemetry from being misrepresented as a clean
            security result.
          </p>
        </Panel>
      </div>
    </Shell>
  );
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  return (
    <details className="rounded-[18px] border border-slate-200 bg-slate-50/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
        <span className="font-bold">{item.indicator}</span>

        <div className="flex items-center gap-2">
          {item.riskPoints > 0 && (
            <span className="font-mono text-xs font-black text-blue-600">
              +{item.riskPoints}
            </span>
          )}

          <StatusBadge
            label={item.status === "CLEAR" ? "NOT DETECTED" : item.status}
            status={item.status}
          />
        </div>
      </summary>

      <div className="border-t border-slate-200 px-4 py-4">
        <p className="text-xs leading-6 text-slate-500">
          {item.explanation}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Meta label="Source" value={item.source} />
          <Meta label="Raw field" value={item.rawField} />
          <Meta label="Normalized" value={item.normalizedValue} />
        </div>
      </div>
    </details>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-[11px] font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}

function RiskGauge({
  score,
  unavailable = false,
}: {
  score: number | null;
  unavailable?: boolean;
}) {
  const value = score ?? 0;

  return (
    <div
      className="grid h-32 w-32 place-items-center rounded-full"
      style={
        unavailable
          ? { background: "#e2e8f0" }
          : {
              background: `conic-gradient(#e9317c ${value * 3.6}deg, #f7d9e5 0deg)`,
            }
      }
    >
      <div className="grid h-24 w-24 place-items-center rounded-full bg-white">
        <div className="text-center">
          <p className="text-2xl font-black">{score ?? "—"}</p>
          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
            {unavailable ? "unavailable" : "risk score"}
          </p>
        </div>
      </div>
    </div>
  );
}

function QualityGauge({ score }: { score: number }) {
  return (
    <div
      className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#e9317c ${score * 3.6}deg, #f4bcd2 0deg)`,
      }}
    >
      <div className="grid h-20 w-20 place-items-center rounded-full bg-[#ffdce9]">
        <span className="text-xl font-black">{score}%</span>
      </div>
    </div>
  );
}
