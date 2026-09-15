"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eyebrow, PageHeader, Panel, SectionTitle, Shell, StatusBadge } from "@/app/components/intel-ui";
import { createInvestigation, saveInvestigation, type InvestigationIndicator } from "@/app/lib/investigations";
import type { IpData } from "@/app/lib/intelligence";

type BulkResult = { value: string; type: "IPv4" | "IPv6" | "Domain" | "Hostname"; organization: string; asn: string; risk: number | null; severity: string; status: "Queued" | "Investigating" | "Complete" | "Unavailable"; data?: IpData };

export default function BulkInvestigationPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [results, setResults] = useState<BulkResult[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  async function runBatch() {
    const values = Array.from(new Set(input.split(/\r?\n/).map((value) => value.trim().toLowerCase()).filter(Boolean)));
    if (!values.length) { setMessage("Add one indicator per line."); return; }
    if (values.length > 10) { setMessage("The conservative batch limit is 10 indicators."); return; }
    const initial: BulkResult[] = values.map((value) => ({ value, type: value.includes(":") ? "IPv6" : /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) ? "IPv4" : value.includes(".") ? "Hostname" : "Domain", organization: "—", asn: "—", risk: null, severity: "Unavailable", status: "Queued" }));
    setResults(initial);
    setRunning(true);
    setMessage("");
    for (let index = 0; index < initial.length; index += 1) {
      const current = initial[index];
      setResults((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, status: "Investigating" } : item));
      if (current.type === "Domain" || current.type === "Hostname") {
        setResults((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, status: "Unavailable" } : item));
        continue;
      }
      try {
        const response = await fetch(`/api/ip?ip=${encodeURIComponent(current.value)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json() as IpData;
        setResults((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, value: data.ip, organization: data.network.company, asn: data.network.asn, risk: data.risk.score, severity: data.risk.level, status: "Complete", data } : item));
      } catch {
        setResults((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, status: "Unavailable" } : item));
      }
    }
    setRunning(false);
  }

  function createCaseFromResults() {
    const selected = results.filter((item) => item.status === "Complete" && item.data);
    if (!selected.length) { setMessage("Complete at least one supported IP before creating a case."); return; }
    const first = selected[0].data as IpData;
    const item = createInvestigation(first, `Bulk investigation · ${selected.length} indicators`);
    const additional: InvestigationIndicator[] = selected.slice(1).map((result) => ({ id: `indicator-${Date.now()}-${result.value}`, value: result.data?.ip ?? result.value, type: result.data?.version ?? "IPv4", addedAt: new Date().toISOString(), lastInvestigatedAt: new Date().toISOString(), enrichment: result.data }));
    item.indicators.push(...additional);
    item.timeline.push(...additional.map((entry) => ({ id: `event-${Date.now()}-${entry.id}`, timestamp: new Date().toISOString(), type: "Indicator added" as const, description: `${entry.value} enriched and added from bulk analysis.` })));
    saveInvestigation(item);
    router.push(`/investigations/${encodeURIComponent(item.id)}`);
  }

  const complete = results.filter((item) => item.status === "Complete").length;

  return <Shell><PageHeader eyebrow="Bulk analysis" title="Investigate a small set of indicators." description="Paste newline-separated indicators and process supported IP addresses sequentially through the existing enrichment pipeline. Domains and hostnames are shown as unavailable until DNS-derived enrichment is available." aside={<span className="rounded-xl bg-blue-50 px-4 py-3 text-[11px] font-bold text-blue-700">Maximum 10 indicators</span>} /><Panel><Eyebrow>Input queue</Eyebrow><SectionTitle>One indicator per line.</SectionTitle><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={'8.8.8.8\n1.1.1.1\nexample.com'} rows={7} className="mt-5 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-7 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={running} onClick={() => void runBatch()} className="rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">{running ? "Investigating…" : "Run bulk analysis"}</button>{results.length > 0 && <span role="status" className="text-xs font-semibold text-slate-500">{complete} / {results.length} investigated</span>}{complete > 0 && <button type="button" onClick={createCaseFromResults} className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Create case from completed</button>}</div>{message && <p role="alert" className="mt-4 text-xs font-semibold text-amber-700">{message}</p>}</Panel>{results.length > 0 && <div className="mt-6"><Panel><Eyebrow>Batch results</Eyebrow><SectionTitle>Enrichment status</SectionTitle><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-slate-200 text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400"><tr><th className="pb-3 pr-4">Indicator</th><th className="pb-3 pr-4">Type</th><th className="pb-3 pr-4">Organization</th><th className="pb-3 pr-4">ASN</th><th className="pb-3 pr-4">Risk</th><th className="pb-3 pr-4">Severity</th><th className="pb-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{results.map((result) => <tr key={result.value}><td className="py-4 pr-4 font-mono font-bold text-slate-950">{result.value}</td><td className="py-4 pr-4 text-slate-500">{result.type}</td><td className="py-4 pr-4 font-semibold text-slate-700">{result.organization}</td><td className="py-4 pr-4 font-mono text-slate-700">{result.asn}</td><td className="py-4 pr-4 font-mono font-black">{result.risk ?? "—"}</td><td className="py-4 pr-4">{result.severity}</td><td className="py-4"><StatusBadge label={result.status} status={result.status === "Complete" ? "CLEAR" : result.status === "Unavailable" ? "UNKNOWN" : "UNKNOWN"} /></td></tr>)}</tbody></table></div></Panel></div>}</Shell>;
}
