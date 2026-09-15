"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AnalystAssessment,
  CaseHeader,
  IncidentTimeline,
  IndicatorTable,
  RecommendedActions,
} from "@/app/components/investigations";
import { Eyebrow, Panel, SectionTitle, Shell } from "@/app/components/intel-ui";
import {
  buildCaseMarkdown,
  detectIndicatorType,
  normalizeIndicator,
  readInvestigation,
  updateInvestigation,
  type Investigation,
  type InvestigationSeverity,
  type InvestigationStatus,
} from "@/app/lib/investigations";
import type { IpData } from "@/app/lib/intelligence";

export default function InvestigationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Investigation | null>(null);
  const [indicator, setIndicator] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItem(readInvestigation(decodeURIComponent(params.id)));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [params.id]);

  if (!item) return <Shell><div className="rounded-[24px] bg-white px-6 py-24 text-center text-sm text-slate-500">This local investigation could not be found.</div></Shell>;

  function save(update: (current: Investigation) => Investigation) {
    if (!item) return;
    const updated = updateInvestigation(item.id, update);
    if (updated) setItem(updated);
  }

  function updateAssessment(field: "analystVerdict" | "analystNotes", value: string) {
    save((current) => ({ ...current, [field]: value, timeline: field === "analystVerdict" && current.analystVerdict !== value ? [...current.timeline, { id: `event-${Date.now()}`, timestamp: new Date().toISOString(), type: "Analyst verdict changed", description: `Analyst verdict changed to ${value}.` }] : current.timeline } as Investigation));
  }

  async function addIndicator(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    const value = normalizeIndicator(indicator);
    if (!value) return;
    if (item.indicators.some((entry) => entry.value === value)) {
      setMessage("That indicator is already in this case.");
      return;
    }
    if (detectIndicatorType(value) === "Domain" || detectIndicatorType(value) === "Hostname") {
      setMessage("Domain and hostname indicators are recorded as unavailable until DNS-derived enrichment is available.");
      save((current) => ({ ...current, indicators: [...current.indicators, { id: `indicator-${Date.now()}`, value, type: detectIndicatorType(value), addedAt: new Date().toISOString(), lastInvestigatedAt: new Date().toISOString() }], timeline: [...current.timeline, { id: `event-${Date.now()}`, timestamp: new Date().toISOString(), type: "Indicator added", description: `${value} added without IP enrichment.` }] }));
      setIndicator("");
      return;
    }
    setMessage("Investigating indicator through the existing enrichment pipeline…");
    try {
      const response = await fetch(`/api/ip?ip=${encodeURIComponent(value)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The indicator could not be investigated.");
      const data = await response.json() as IpData;
      save((current) => ({ ...current, indicators: [...current.indicators, { id: `indicator-${Date.now()}`, value: data.ip, type: data.version, addedAt: new Date().toISOString(), lastInvestigatedAt: new Date().toISOString(), enrichment: data }], timeline: [...current.timeline, { id: `event-${Date.now()}`, timestamp: new Date().toISOString(), type: "Indicator added", description: `${data.ip} enriched and added to the case.`, metadata: { type: data.version } }] }));
      setIndicator("");
      setMessage(`${data.ip} was enriched and added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The indicator could not be investigated.");
    }
  }

  function exportFile(kind: "json" | "markdown") {
    if (!item) return;
    const contents = kind === "json" ? JSON.stringify(item, null, 2) : buildCaseMarkdown(item);
    const blob = new Blob([contents], { type: kind === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${item.id.toLowerCase()}.${kind === "json" ? "json" : "md"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Shell>
      <CaseHeader item={item} actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => exportFile("markdown")} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-bold text-slate-700 transition hover:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Markdown</button><button type="button" onClick={() => exportFile("json")} className="rounded-xl bg-blue-600 px-4 py-3 text-[11px] font-bold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Export JSON</button></div>} />
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"><label htmlFor="case-status" className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-700">Case status</label><select id="case-status" value={item.status} onChange={(event) => save((current) => ({ ...current, status: event.target.value as InvestigationStatus, timeline: event.target.value === "Escalated" ? [...current.timeline, { id: `event-${Date.now()}`, timestamp: new Date().toISOString(), type: "Case escalated", description: "Case escalated by the analyst." }] : current.timeline }))} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200">{["Open", "Investigating", "Escalated", "Closed"].map((status) => <option key={status}>{status}</option>)}</select><label htmlFor="case-severity" className="ml-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-700">Severity</label><select id="case-severity" value={item.severity} onChange={(event) => save((current) => ({ ...current, severity: event.target.value as InvestigationSeverity, timeline: [...current.timeline, { id: `event-${Date.now()}`, timestamp: new Date().toISOString(), type: "Severity changed", description: `Case severity changed to ${event.target.value}.` }] }))} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200">{["Critical", "High", "Medium", "Low", "Informational"].map((severity) => <option key={severity}>{severity}</option>)}</select><button type="button" onClick={() => router.push("/investigations")} className="ml-auto text-xs font-bold text-blue-700 underline underline-offset-4">Back to cases</button></div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><AnalystAssessment item={item} onChange={updateAssessment} /><Panel><Eyebrow>Potential investigation context</Eyebrow><SectionTitle>MITRE ATT&CK context</SectionTitle><p className="mt-4 text-sm leading-6 text-slate-600">This observation may warrant investigation of activity associated with infrastructure access, external remote services or command-and-control patterns.</p><p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">ATT&CK context is investigative guidance and does not constitute detection of a technique.</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600">Contextual hypothesis</span><span className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600">Requires corroboration</span></div></Panel></div>

      <div className="mt-6"><IndicatorTable indicators={item.indicators} /></div>
      <div className="mt-6"><Panel><Eyebrow>Add indicator</Eyebrow><SectionTitle>Expand the case carefully.</SectionTitle><p className="mt-3 text-sm text-slate-500">IP indicators use the existing backend enrichment pipeline sequentially. Domains and hostnames are recorded as unavailable until supported DNS-derived enrichment exists.</p><form onSubmit={addIndicator} className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={indicator} onChange={(event) => setIndicator(event.target.value)} placeholder="IPv4, IPv6, domain or hostname" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /><button type="submit" className="rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">Add indicator</button></form>{message && <p role="status" className="mt-3 text-xs font-semibold text-blue-700">{message}</p>}</Panel></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><IncidentTimeline events={item.timeline} /><RecommendedActions item={item} /></div>
      <div className="mt-6"><Panel><Eyebrow>Control context</Eyebrow><SectionTitle>Compliance / control context</SectionTitle><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">This workflow may provide supporting evidence for security monitoring, incident management and investigation activities. It does not establish compliance or certification.</p><div className="mt-6 grid gap-3 md:grid-cols-3"><Control framework="NIST Cybersecurity Framework" area="Detect / Respond" /><Control framework="CIS Critical Security Controls" area="Incident response management" /><Control framework="ISO/IEC 27001" area="Information security event management" /></div><p className="mt-5 text-xs text-slate-400">Control references are informational context and do not establish organizational compliance or certification.</p></Panel></div>
    </Shell>
  );
}

function Control({ framework, area }: { framework: string; area: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-900">{framework}</p><p className="mt-2 text-xs text-slate-500">{area}</p><p className="mt-2 text-[11px] leading-5 text-slate-400">Relevant as supporting workflow context.</p></div>; }
