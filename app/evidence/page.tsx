"use client";

import { useMemo, useState } from "react";
import {
  EmptyInvestigation,
  Eyebrow,
  LoadingInvestigation,
  PageHeader,
  Panel,
  SectionTitle,
  Shell,
} from "@/app/components/intel-ui";
import { useInvestigation } from "@/app/components/use-investigation";
import {
  buildInvestigationReport,
  type PipelineStage,
} from "@/app/lib/intelligence";

export default function EvidencePage() {
  const { data, ready } = useInvestigation();
  const [tab, setTab] = useState<"normalized" | "raw">("normalized");
  const [copied, setCopied] = useState(false);

  const normalized = useMemo(() => {
    if (!data) return null;

    const { raw: _raw, ...rest } = data;
    void _raw;

    return rest;
  }, [data]);

  if (!ready) {
    return <Shell><LoadingInvestigation /></Shell>;
  }

  if (!data) {
    return <Shell><EmptyInvestigation /></Shell>;
  }

  function downloadReport() {
    if (!data) return;

    const blob = new Blob(
      [buildInvestigationReport(data)],
      { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      `ip-investigation-${data.ip.replaceAll(":", "-")}.txt`;

    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    if (!data) return;

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      `ip-intelligence-${data.ip.replaceAll(":", "-")}.json`;

    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyReport() {
    if (!data) return;

    await navigator.clipboard.writeText(
      buildInvestigationReport(data)
    );

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1400);
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Evidence"
        title="Evidence, processing & reporting."
        description="Inspect how the investigation was produced, compare normalized intelligence with the upstream responses and export the result for technical review."
      />

      <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel>
          <Eyebrow>Investigation pipeline</Eyebrow>
          <SectionTitle>Processing timeline</SectionTitle>

          <div className="mt-7">
            {data.pipeline.map((stage, index) => (
              <PipelineItem
                key={`${stage.name}-${index}`}
                stage={stage}
                last={index === data.pipeline.length - 1}
              />
            ))}
          </div>

          <div className="mt-7 rounded-[18px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-slate-400">Total response</span>
              <span className="font-mono font-black text-slate-900">
                {data.performance.responseTimeMs} ms
              </span>
            </div>

            <div className="mt-3 flex justify-between gap-4 text-xs">
              <span className="text-slate-400">Cache</span>
              <span className="font-mono font-black text-slate-900">
                {data.performance.cache}
              </span>
            </div>
          </div>
        </Panel>

        <Panel pink>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <Eyebrow>Technical evidence</Eyebrow>
              <SectionTitle>Normalized vs source data</SectionTitle>
            </div>

            <div className="flex rounded-full bg-white p-1">
              <button
                onClick={() => setTab("normalized")}
                className={`rounded-full px-4 py-2 text-[10px] font-black ${
                  tab === "normalized"
                    ? "bg-[#32101f] text-white"
                    : "text-[#9c466e]"
                }`}
              >
                Normalized
              </button>

              <button
                onClick={() => setTab("raw")}
                className={`rounded-full px-4 py-2 text-[10px] font-black ${
                  tab === "raw"
                    ? "bg-[#32101f] text-white"
                    : "text-[#9c466e]"
                }`}
              >
                Provider response
              </button>
            </div>
          </div>

          <pre className="mt-6 max-h-[650px] overflow-auto rounded-[22px] bg-[#28101b] p-5 text-xs leading-6 text-[#ffd5e5]">
            {JSON.stringify(
              tab === "normalized" ? normalized : data.raw,
              null,
              2
            )}
          </pre>
        </Panel>
      </div>

      <div className="px-5 pb-8 sm:px-8">
        <div className="rounded-[30px] bg-gradient-to-r from-[#ff4893] to-[#ff75b0] p-7 text-white sm:p-9">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <Eyebrow light>Investigation report</Eyebrow>

              <h2 className="mt-3 max-w-3xl font-serif text-4xl font-bold">
                Export the investigation with its evidence and caveats.
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
                The report contains target identity, network registration,
                DNS verification, security signals, risk reasoning, data
                quality and processing metadata.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadReport}
                className="rounded-full bg-white px-5 py-3 text-xs font-black text-[#d52b76]"
              >
                Download report
              </button>

              <button
                onClick={() => void copyReport()}
                className="rounded-full border border-white/35 px-5 py-3 text-xs font-black"
              >
                {copied ? "Copied" : "Copy report"}
              </button>

              <button
                onClick={exportJson}
                className="rounded-full border border-white/35 px-5 py-3 text-xs font-black"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function PipelineItem({
  stage,
  last,
}: {
  stage: PipelineStage;
  last: boolean;
}) {
  const dot =
    stage.status === "complete"
      ? "bg-emerald-500"
      : stage.status === "warning"
        ? "bg-amber-500"
        : "bg-slate-300";

  return (
    <div className="grid grid-cols-[22px_1fr] gap-3">
      <div className="flex flex-col items-center">
        <div className={`mt-1 h-3 w-3 rounded-full ${dot}`} />

        {!last && (
          <div className="min-h-16 w-px flex-1 bg-slate-200" />
        )}
      </div>

      <div className={last ? "" : "pb-5"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold">{stage.name}</p>
          <span className="font-mono text-xs font-bold text-blue-600">
            {stage.durationMs} ms
          </span>
        </div>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {stage.detail}
        </p>
      </div>
    </div>
  );
}
