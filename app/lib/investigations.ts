import type { IpData } from "@/app/lib/intelligence";

export type IndicatorType = "IPv4" | "IPv6" | "Domain" | "Hostname";
export type InvestigationStatus =
  | "Open"
  | "Investigating"
  | "Escalated"
  | "Closed";
export type InvestigationSeverity =
  | "Critical"
  | "High"
  | "Medium"
  | "Low"
  | "Informational";
export type AnalystVerdict =
  | "Unknown"
  | "Benign"
  | "Suspicious"
  | "Malicious"
  | "False Positive";
export type TimelineEventType =
  | "Investigation created"
  | "Indicator added"
  | "RDAP retrieved"
  | "PTR resolved"
  | "FCrDNS checked"
  | "Security signals evaluated"
  | "Risk assessment calculated"
  | "Analyst verdict changed"
  | "Severity changed"
  | "Indicator added to watchlist"
  | "Case escalated"
  | "Case closed";

export type InvestigationIndicator = {
  id: string;
  value: string;
  type: IndicatorType;
  addedAt: string;
  lastInvestigatedAt: string;
  enrichment?: IpData;
};

export type InvestigationTimelineEvent = {
  id: string;
  timestamp: string;
  type: TimelineEventType;
  description: string;
  metadata?: Record<string, string>;
};

export type Investigation = {
  id: string;
  title: string;
  status: InvestigationStatus;
  severity: InvestigationSeverity;
  createdAt: string;
  updatedAt: string;
  owner: string;
  indicators: InvestigationIndicator[];
  timeline: InvestigationTimelineEvent[];
  analystVerdict: AnalystVerdict;
  analystNotes: string;
  automatedRisk: {
    score: number | null;
    severity: InvestigationSeverity;
    confidence: number;
    contributions: string[];
  };
  confidence: number;
  recommendedActions: {
    section: "Immediate review" | "Validation" | "Containment considerations" | "Escalation";
    items: string[];
  }[];
};

export type WatchlistEntry = {
  id: string;
  value: string;
  type: IndicatorType;
  note: string;
  addedAt: string;
  lastInvestigatedAt: string | null;
};

export const INVESTIGATIONS_KEY = "ip-intelligence-investigations";
export const WATCHLIST_KEY = "ip-intelligence-watchlist";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function detectIndicatorType(value: string): IndicatorType {
  const normalized = value.trim();
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) return "IPv4";
  if (normalized.includes(":")) return "IPv6";
  return normalized.includes(".") ? "Hostname" : "Domain";
}

export function normalizeIndicator(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function severityFromScore(score: number | null): InvestigationSeverity {
  if (score === null) return "Informational";
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  if (score >= 15) return "Low";
  return "Informational";
}

export function confidenceFromData(data: IpData) {
  return Math.max(0, Math.min(100, data.dataQuality.score));
}

export function recommendedActionsFor(data: IpData) {
  const conditionalContainment =
    data.risk.score !== null && data.risk.score >= 60
      ? "Consider temporary blocking only when malicious activity is corroborated."
      : "Do not block based on this assessment alone; corroborate with observed activity first.";

  return [
    {
      section: "Immediate review" as const,
      items: [
        "Review authentication and security logs involving this indicator.",
        "Check whether the indicator appears in existing incidents.",
      ],
    },
    {
      section: "Validation" as const,
      items: [
        "Validate whether observed traffic is expected for the owning organization.",
        "Review affected accounts, sessions or workloads when applicable.",
      ],
    },
    {
      section: "Containment considerations" as const,
      items: [conditionalContainment],
    },
    {
      section: "Escalation" as const,
      items: [
        "Escalate to the SOC or security function when correlated suspicious activity exists.",
      ],
    },
  ];
}

function timelineFor(data: IpData, timestamp: string) {
  const events: InvestigationTimelineEvent[] = [
    { id: makeId("event"), timestamp, type: "Investigation created", description: `Case created for ${data.ip}.` },
    { id: makeId("event"), timestamp, type: "Indicator added", description: `${data.ip} added as the first indicator.`, metadata: { type: data.version } },
  ];

  if (data.rdap.available) {
    events.push({ id: makeId("event"), timestamp, type: "RDAP retrieved", description: "Registration data was returned by the RDAP pipeline." });
  }
  if (data.dns.ptr !== "Unavailable" && data.dns.ptr !== "None") {
    events.push({ id: makeId("event"), timestamp, type: "PTR resolved", description: `PTR evidence was returned: ${data.dns.ptr}.` });
  }
  events.push(
    { id: makeId("event"), timestamp, type: "FCrDNS checked", description: `Forward-confirmed reverse DNS state: ${data.dns.fcrdns}.` },
    { id: makeId("event"), timestamp, type: "Security signals evaluated", description: `${data.evidence.length} security evidence items were evaluated.` },
    { id: makeId("event"), timestamp, type: "Risk assessment calculated", description: `Automated risk assessment calculated at ${data.risk.score ?? "unavailable"}/100.` },
  );
  return events;
}

export function createInvestigation(data: IpData, title = `Investigation of ${data.ip}`): Investigation {
  const timestamp = now();
  const severity = severityFromScore(data.risk.score);
  const confidence = confidenceFromData(data);
  const indicator: InvestigationIndicator = {
    id: makeId("indicator"),
    value: data.ip,
    type: data.version,
    addedAt: timestamp,
    lastInvestigatedAt: timestamp,
    enrichment: data,
  };

  return {
    id: nextCaseId(),
    title,
    status: "Open",
    severity,
    createdAt: timestamp,
    updatedAt: timestamp,
    owner: "Local analyst",
    indicators: [indicator],
    timeline: timelineFor(data, timestamp),
    analystVerdict: "Unknown",
    analystNotes: "",
    automatedRisk: {
      score: data.risk.score,
      severity,
      confidence,
      contributions: data.risk.contributions.map((item) => `${item.indicator}: ${item.reason}`),
    },
    confidence,
    recommendedActions: recommendedActionsFor(data),
  };
}

function nextCaseId() {
  const year = new Date().getFullYear();
  const existing = readInvestigations();
  const highest = existing.reduce((max, item) => {
    const match = item.id.match(/CASE-\d{4}-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `CASE-${year}-${String(highest + 1).padStart(4, "0")}`;
}

export function readInvestigations(): Investigation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVESTIGATIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as Investigation[] : [];
  } catch {
    return [];
  }
}

export function saveInvestigations(items: Investigation[]) {
  if (typeof window !== "undefined") localStorage.setItem(INVESTIGATIONS_KEY, JSON.stringify(items));
}

export function saveInvestigation(item: Investigation) {
  saveInvestigations([item, ...readInvestigations().filter((current) => current.id !== item.id)]);
  return item;
}

export function readInvestigation(id: string) {
  return readInvestigations().find((item) => item.id === id) ?? null;
}

export function updateInvestigation(id: string, update: (item: Investigation) => Investigation) {
  const current = readInvestigation(id);
  if (!current) return null;
  const updated = update({ ...current, updatedAt: now() });
  saveInvestigation(updated);
  return updated;
}

export function readWatchlist(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as WatchlistEntry[] : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchlistEntry[]) {
  if (typeof window !== "undefined") localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
}

export function addToWatchlist(value: string, note = "", lastInvestigatedAt: string | null = null) {
  const normalized = normalizeIndicator(value);
  const current = readWatchlist().filter((item) => item.value !== normalized);
  const entry: WatchlistEntry = {
    id: makeId("watch"),
    value: normalized,
    type: detectIndicatorType(normalized),
    note,
    addedAt: now(),
    lastInvestigatedAt,
  };
  saveWatchlist([entry, ...current]);
  return entry;
}

export function removeFromWatchlist(id: string) {
  saveWatchlist(readWatchlist().filter((item) => item.id !== id));
}

export function updateWatchlist(id: string, update: Partial<WatchlistEntry>) {
  saveWatchlist(readWatchlist().map((item) => item.id === id ? { ...item, ...update } : item));
}

export function buildCaseMarkdown(item: Investigation) {
  const indicators = item.indicators.map((indicator) => `- ${indicator.value} (${indicator.type})`).join("\n");
  const timeline = item.timeline.map((event) => `- ${event.timestamp} | ${event.type} | ${event.description}`).join("\n");
  const actions = item.recommendedActions.map((group) => `### ${group.section}\n${group.items.map((action) => `- ${action}`).join("\n")}`).join("\n\n");
  const enrichment = item.indicators.map((indicator) => indicator.enrichment ? `### ${indicator.value}\n- Organization: ${indicator.enrichment.network.company}\n- ASN: ${indicator.enrichment.network.asn}\n- CIDR: ${indicator.enrichment.network.cidr}\n- PTR: ${indicator.enrichment.dns.ptr}\n- FCrDNS: ${indicator.enrichment.dns.fcrdns}\n- Risk: ${indicator.enrichment.risk.score ?? "Unavailable"}/100` : `### ${indicator.value}\n- Enrichment unavailable`).join("\n\n");
  return `# ${item.title}\n\n## Case metadata\n- ID: ${item.id}\n- Status: ${item.status}\n- Severity: ${item.severity}\n- Owner: ${item.owner}\n- Created: ${item.createdAt}\n- Updated: ${item.updatedAt}\n\n## Indicators\n${indicators}\n\n## Automated assessment\n- Risk: ${item.automatedRisk.score ?? "Unavailable"}/100\n- Severity: ${item.automatedRisk.severity}\n- Confidence: ${item.confidence}%\n- Contributing factors: ${item.automatedRisk.contributions.join("; ") || "None recorded"}\n\n## Analyst verdict\n- Verdict: ${item.analystVerdict}\n- Notes: ${item.analystNotes || "None recorded"}\n\n## Enrichment\n${enrichment}\n\n## Timeline\n${timeline}\n\n## Recommended actions\n${actions}\n\n## MITRE ATT&CK context\nPotential investigation context only. This observation may warrant investigation of activity associated with infrastructure access or command-and-control patterns. ATT&CK context is investigative guidance and does not constitute detection of a technique.\n\n## Compliance / control context\nThis workflow may provide supporting evidence for security monitoring, incident management and investigation activities. Control references are informational context and do not establish organizational compliance or certification.\n\n## Methodology disclaimer\nAutomated risk is decision support, not an authoritative malicious or benign verdict. Provider-derived information, observed evidence, heuristic inference and analyst decisions are presented separately.\n\nGenerated: ${new Date().toISOString()}\n`;
}
