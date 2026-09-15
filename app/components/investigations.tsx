import Link from "next/link";
import {
  Eyebrow,
  Panel,
  SectionTitle,
  StatusBadge,
} from "@/app/components/intel-ui";
import type {
  Investigation,
  InvestigationIndicator,
  InvestigationSeverity,
  WatchlistEntry,
} from "@/app/lib/investigations";
import { formatAsn } from "@/app/lib/intelligence";

const severityClasses: Record<InvestigationSeverity, string> = {
  Critical: "bg-red-50 text-red-700",
  High: "bg-orange-50 text-orange-700",
  Medium: "bg-amber-50 text-amber-700",
  Low: "bg-blue-50 text-blue-700",
  Informational: "bg-slate-100 text-slate-600",
};

export function CaseCard({ item }: { item: Investigation }) {
  return (
    <Link href={`/investigations/${encodeURIComponent(item.id)}`} className="group block rounded-[20px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_50px_rgba(37,99,235,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">{item.id}</p>
          <h3 className="serif-title mt-2 text-2xl font-bold text-slate-950">{item.title}</h3>
        </div>
        <SeverityBadge severity={item.severity} />
      </div>
      <div className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
        <Summary label="Status" value={item.status} />
        <Summary label="Indicators" value={String(item.indicators.length)} />
        <Summary label="Risk" value={`${item.automatedRisk.score ?? "—"}/100`} />
      </div>
      <p className="mt-5 text-xs text-slate-400">Updated {formatDate(item.updatedAt)} · {item.owner}</p>
    </Link>
  );
}

export function CaseHeader({ item, actions }: { item: Investigation; actions?: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-[24px] border border-slate-200 bg-white px-6 py-7 shadow-[var(--shadow-card)] sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">{item.id}</p>
            <SeverityBadge severity={item.severity} />
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-slate-600">{item.status}</span>
          </div>
          <h1 className="serif-title mt-3 text-4xl font-bold leading-tight tracking-[-0.035em] text-slate-950 sm:text-5xl">{item.title}</h1>
          <p className="mt-3 text-xs text-slate-500">Local prototype case · Owner: {item.owner} · Updated {formatDate(item.updatedAt)}</p>
        </div>
        {actions}
      </div>
    </section>
  );
}

export function AnalystAssessment({ item, onChange }: { item: Investigation; onChange: (field: "analystVerdict" | "analystNotes", value: string) => void }) {
  return (
    <Panel>
      <Eyebrow>Analyst assessment</Eyebrow>
      <SectionTitle>Human decision, separate from automation.</SectionTitle>
      <p className="mt-3 text-sm leading-6 text-slate-500">Automated risk is decision support. Record your independent assessment after reviewing the evidence.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <AssessmentMetric label="Automated risk" value={`${item.automatedRisk.score ?? "Unavailable"}/100`} />
        <AssessmentMetric label="Automated severity" value={item.automatedRisk.severity} />
        <AssessmentMetric label="Confidence" value={`${item.confidence}%`} />
      </div>
      <label className="mt-6 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500" htmlFor="analyst-verdict">Analyst verdict</label>
      <select id="analyst-verdict" value={item.analystVerdict} onChange={(event) => onChange("analystVerdict", event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
        {(["Unknown", "Benign", "Suspicious", "Malicious", "False Positive"] as const).map((verdict) => <option key={verdict}>{verdict}</option>)}
      </select>
      <label className="mt-5 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500" htmlFor="analyst-notes">Analyst notes</label>
      <textarea id="analyst-notes" value={item.analystNotes} onChange={(event) => onChange("analystNotes", event.target.value)} placeholder="Record observations, corroborating evidence or uncertainty..." rows={5} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" />
    </Panel>
  );
}

export function IncidentTimeline({ events }: { events: Investigation["timeline"] }) {
  return (
    <Panel>
      <Eyebrow>Audit trail</Eyebrow>
      <SectionTitle>Investigation timeline</SectionTitle>
      <div className="mt-7 space-y-0">
        {events.slice().reverse().map((event, index) => (
          <div key={event.id} className="grid grid-cols-[20px_1fr] gap-4">
            <div className="flex flex-col items-center"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-blue-50" />{index < events.length - 1 && <span className="min-h-14 w-px flex-1 bg-blue-100" />}</div>
            <div className={index < events.length - 1 ? "pb-5" : ""}><div className="flex flex-wrap justify-between gap-3"><p className="text-sm font-bold text-slate-900">{event.type}</p><time className="font-mono text-[10px] text-slate-400">{formatDate(event.timestamp)}</time></div><p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p></div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function RecommendedActions({ item }: { item: Investigation }) {
  return (
    <Panel blue>
      <Eyebrow>Defensive workflow</Eyebrow>
      <SectionTitle>Recommended actions</SectionTitle>
      <p className="mt-3 text-xs leading-5 text-slate-500">Conditional guidance based on available evidence. Infrastructure type alone is not proof of malicious activity.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {item.recommendedActions.map((group) => <div key={group.section}><p className="text-xs font-black text-slate-900">{group.section}</p><ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">{group.items.map((action) => <li key={action} className="flex gap-2"><span className="text-blue-600">•</span><span>{action}</span></li>)}</ul></div>)}
      </div>
    </Panel>
  );
}

export function IndicatorTable({ indicators }: { indicators: InvestigationIndicator[] }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><Eyebrow>Indicators</Eyebrow><SectionTitle>Enrichment inventory</SectionTitle></div><span className="text-xs text-slate-400">{indicators.length} saved</span></div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[660px] text-left text-xs"><thead className="border-b border-slate-200 text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400"><tr><th className="pb-3 pr-4">Indicator</th><th className="pb-3 pr-4">Organization</th><th className="pb-3 pr-4">ASN</th><th className="pb-3 pr-4">Risk</th><th className="pb-3">Evidence</th></tr></thead><tbody className="divide-y divide-slate-100">{indicators.map((indicator) => <tr key={indicator.id}><td className="py-4 pr-4"><span className="font-mono font-bold text-slate-950">{indicator.value}</span><span className="mt-1 block text-[10px] text-slate-400">{indicator.type}</span></td><td className="py-4 pr-4 font-semibold text-slate-700">{indicator.enrichment?.network.company ?? "Unavailable"}</td><td className="py-4 pr-4 font-mono font-semibold text-slate-700">{indicator.enrichment ? formatAsn(indicator.enrichment.network.asn) : "Unavailable"}</td><td className="py-4 pr-4 font-mono font-black text-slate-900">{indicator.enrichment?.risk.score ?? "—"}/100</td><td className="py-4">{indicator.enrichment ? <StatusBadge label={`${indicator.enrichment.evidence.length} signals`} status={indicator.enrichment.securityDataAvailable ? "CLEAR" : "UNKNOWN"} /> : <StatusBadge label="Unavailable" status="UNKNOWN" />}</td></tr>)}</tbody></table></div>
    </Panel>
  );
}

export function Watchlist({ entries, onRemove, onNote, onReinvestigate }: { entries: WatchlistEntry[]; onRemove: (id: string) => void; onNote: (id: string, note: string) => void; onReinvestigate: (entry: WatchlistEntry) => void }) {
  return <Panel><div className="flex flex-wrap items-end justify-between gap-3"><div><Eyebrow>Saved indicators</Eyebrow><SectionTitle>Watchlist</SectionTitle></div><span className="text-xs text-slate-400">Browser-local only</span></div>{entries.length === 0 ? <p className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No saved indicators yet. Add one from an investigation.</p> : <div className="mt-6 space-y-3">{entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"><div><p className="font-mono text-sm font-bold text-slate-950">{entry.value}</p><p className="mt-1 text-xs text-slate-400">{entry.type} · Added {formatDate(entry.addedAt)} · Last investigated {entry.lastInvestigatedAt ? formatDate(entry.lastInvestigatedAt) : "Never"}</p><input aria-label={`Note for ${entry.value}`} value={entry.note} onChange={(event) => onNote(entry.id, event.target.value)} placeholder="Add a local note" className="mt-3 w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div><div className="flex flex-wrap gap-2"><Link href={`/investigations?indicator=${encodeURIComponent(entry.value)}`} className="rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Open cases</Link><button type="button" onClick={() => onReinvestigate(entry)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Re-investigate</button><button type="button" onClick={() => onRemove(entry.id)} className="rounded-lg px-3 py-2 text-[10px] font-bold text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Remove</button></div></div>)}</div>}</Panel>;
}

function SeverityBadge({ severity }: { severity: InvestigationSeverity }) {
  return <span className={`rounded-full px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${severityClasses[severity]}`}>{severity}</span>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 font-mono text-xs font-bold text-slate-800">{value}</p></div>;
}

function AssessmentMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-slate-400">{label}</p><p className="mt-1 font-mono text-sm font-black text-slate-900">{value}</p></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
