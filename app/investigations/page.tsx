"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CaseCard, Watchlist } from "@/app/components/investigations";
import { Eyebrow, PageHeader, Panel, Shell } from "@/app/components/intel-ui";
import {
  addToWatchlist,
  createInvestigation,
  readInvestigations,
  readWatchlist,
  removeFromWatchlist,
  saveInvestigation,
  updateWatchlist,
  type Investigation,
  type WatchlistEntry,
} from "@/app/lib/investigations";
import { readLatestInvestigation, saveLatestInvestigation, type IpData } from "@/app/lib/intelligence";

export default function InvestigationsPage() {
  const [cases, setCases] = useState<Investigation[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCases(readInvestigations());
      setWatchlist(readWatchlist());
      setReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function createCase() {
    const data = readLatestInvestigation();
    if (!data) {
      setMessage("Run an IP investigation from Overview before creating a case.");
      return;
    }
    const item = saveInvestigation(createInvestigation(data, title.trim() || undefined));
    setCases((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
    setTitle("");
    setMessage(`${item.id} created locally.`);
  }

  function addWatchlistIndicator() {
    const data = readLatestInvestigation();
    if (!data) {
      setMessage("Run an IP investigation from Overview before adding a saved indicator.");
      return;
    }
    const entry = addToWatchlist(data.ip, "", new Date().toISOString());
    setWatchlist((current) => [entry, ...current.filter((item) => item.value !== entry.value)]);
    setMessage(`${data.ip} added to the browser-local watchlist.`);
  }

  async function reinvestigate(entry: WatchlistEntry) {
    setMessage(`Re-investigating ${entry.value}…`);
    try {
      const response = await fetch(`/api/ip?ip=${encodeURIComponent(entry.value)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("The indicator could not be investigated.");
      const data = await response.json() as IpData;
      saveLatestInvestigation(data);
      updateWatchlist(entry.id, { lastInvestigatedAt: new Date().toISOString() });
      setWatchlist(readWatchlist());
      setMessage(`${entry.value} was re-investigated and the latest result is available on Overview.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The indicator could not be investigated.");
    }
  }

  if (!ready) return <Shell><div className="rounded-[24px] bg-white px-6 py-24 text-center text-sm text-slate-500">Loading local cases…</div></Shell>;

  return (
    <Shell>
      <PageHeader eyebrow="Security Investigation & Enrichment Workstation" title="Cases, indicators and analyst workflow." description="Create browser-local investigation cases from real IP enrichment, track evidence and record a human assessment. This prototype is workflow simulation, not an enterprise case database." aside={<div className="flex flex-wrap gap-2"><Link href="/investigations/bulk" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[11px] font-bold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Bulk analysis</Link><Link href="/" className="rounded-xl bg-blue-600 px-4 py-3 text-[11px] font-bold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Investigate IP</Link></div>} />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <Eyebrow>New investigation</Eyebrow>
          <h2 className="serif-title mt-2 text-3xl font-bold text-slate-950">Create from the latest lookup.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">Cases begin with the latest real enrichment snapshot stored by Overview. Add more indicators from the case detail view.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional case title" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /><button type="button" onClick={createCase} className="rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">Create case</button></div>
          <button type="button" onClick={addWatchlistIndicator} className="mt-4 text-xs font-bold text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Add latest indicator to watchlist</button>
          {message && <p role="status" className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">{message}</p>}
        </Panel>
        <Panel blue>
          <Eyebrow>Prototype workspace</Eyebrow>
          <h2 className="serif-title mt-2 text-3xl font-bold text-slate-950">A local evidence trail.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Automated risk, provider-derived data, observed evidence and analyst decisions remain visibly distinct. No background monitoring or external case system is connected.</p>
          <div className="mt-6 grid grid-cols-3 gap-2"><Stat label="Open" value={String(cases.filter((item) => item.status !== "Closed").length)} /><Stat label="Indicators" value={String(cases.reduce((sum, item) => sum + item.indicators.length, 0))} /><Stat label="Watchlist" value={String(watchlist.length)} /></div>
        </Panel>
      </div>

      <section className="mt-8"><div className="mb-4 flex items-end justify-between gap-3"><div><Eyebrow>Investigation register</Eyebrow><h2 className="serif-title mt-2 text-3xl font-bold text-slate-950">Recent cases</h2></div><span className="text-xs text-slate-400">Browser-local prototype data</span></div>{cases.length ? <div className="grid gap-4 md:grid-cols-2">{cases.map((item) => <CaseCard key={item.id} item={item} />)}</div> : <div className="rounded-[20px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm text-slate-500">No cases yet. Investigate an IP, then create a case from this workspace.</div>}</section>
      <section className="mt-8"><Watchlist entries={watchlist} onRemove={(id) => { removeFromWatchlist(id); setWatchlist(readWatchlist()); }} onNote={(id, note) => { updateWatchlist(id, { note }); setWatchlist(readWatchlist()); }} onReinvestigate={(entry) => void reinvestigate(entry)} /></section>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/80 px-3 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 font-mono text-lg font-black text-slate-900">{value}</p></div>; }
