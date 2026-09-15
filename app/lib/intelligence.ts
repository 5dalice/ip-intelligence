export type SecurityValue = boolean | null;
export type SignalState = "DETECTED" | "CLEAR" | "UNKNOWN";
export type FcrdnsStatus = "VERIFIED" | "MISMATCH" | "NO_PTR";

export type RiskContribution = {
  indicator: string;
  points: number;
  reason: string;
};

export type EvidenceItem = {
  indicator: string;
  status: SignalState;
  source: string;
  rawField: string;
  normalizedValue: string;
  riskPoints: number;
  explanation: string;
};

export type PipelineStage = {
  name: string;
  status: "complete" | "warning" | "skipped";
  durationMs: number;
  detail: string;
};

export type RdapEntity = {
  name: string;
  roles: string[];
};

export type IpData = {
  ip: string;
  version: "IPv4" | "IPv6";
  summary: string;

  location: {
    city: string;
    region: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
    timezone: string;
    accuracyNotice: string;
  };

  network: {
    company: string;
    asn: string;
    cidr: string;
    netname: string;
    networkType: string;
    reverseDns: string;
  };

  rdap: {
    available: boolean;
    handle: string;
    name: string;
    type: string;
    country: string;
    startAddress: string;
    endAddress: string;
    parentHandle: string;
    entities: RdapEntity[];
  };

  dns: {
    ptr: string;
    fcrdns: FcrdnsStatus;
    resolvedAddresses: string[];
    explanation: string;
  };

  protocol: {
    classification: string;
    decimal: string | null;
    hexadecimal: string | null;
    binary: string | null;
    expanded: string | null;
  };

  security: {
    vpn: SecurityValue;
    proxy: SecurityValue;
    tor: SecurityValue;
    hosting: SecurityValue;
    abuser: SecurityValue;
  };

  evidence: EvidenceItem[];

  risk: {
    available: boolean;
    score: number | null;
    level: string;
    formula: string;
    contributions: RiskContribution[];
  };

  dataQuality: {
    score: number;
    level: "HIGH" | "MEDIUM" | "LOW";
    availableSignals: number;
    totalSignals: number;
    missing: string[];
    explanation: string;
  };

  pipeline: PipelineStage[];

  performance: {
    responseTimeMs: number;
    cache: "HIT" | "MISS";
  };

  securityDataAvailable: boolean;

  raw: {
    provider: Record<string, unknown>;
    rdap: Record<string, unknown> | null;
  };

  note: string;
};

export function getSecuritySignalCoverage(data: Pick<IpData, "evidence">) {
  const total = data.evidence.length;
  const evaluated = data.evidence.filter(
    (item) => item.status !== "UNKNOWN"
  ).length;

  return {
    evaluated,
    unavailable: total - evaluated,
    total,
    allUnavailable: total > 0 && evaluated === 0,
    fullyEvaluated: total > 0 && evaluated === total,
  };
}

export const LATEST_KEY = "ip-intelligence-latest";
export const HISTORY_KEY = "ip-intelligence-history";

export function saveLatestInvestigation(data: IpData) {
  localStorage.setItem(LATEST_KEY, JSON.stringify(data));

  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const current: unknown = raw ? JSON.parse(raw) : [];

    const history = Array.isArray(current)
      ? current.filter((value): value is string => typeof value === "string")
      : [];

    const updated = [
      data.ip,
      ...history.filter((ip) => ip !== data.ip),
    ].slice(0, 8);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([data.ip]));
  }
}

export function readLatestInvestigation(): IpData | null {
  try {
    const raw = localStorage.getItem(LATEST_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as IpData;
  } catch {
    return null;
  }
}

export function formatAsn(asn: string) {
  if (asn === "Unknown") return asn;

  return asn.toUpperCase().startsWith("AS")
    ? asn
    : `AS${asn}`;
}

export function mapUrl(latitude: number, longitude: number) {
  const offset = 0.08;

  return (
    "https://www.openstreetmap.org/export/embed.html" +
    `?bbox=${encodeURIComponent(
      `${longitude - offset},${latitude - offset},${longitude + offset},${latitude + offset}`
    )}` +
    "&layer=mapnik" +
    `&marker=${encodeURIComponent(`${latitude},${longitude}`)}`
  );
}

export function buildInvestigationReport(data: IpData) {
  const signals = data.evidence
    .map(
      (item) =>
        `${item.indicator.padEnd(24)} ${item.status.padEnd(10)} ${
          item.riskPoints ? `+${item.riskPoints}` : ""
        }`
    )
    .join("\n");

  const contributions = data.risk.contributions.length
    ? data.risk.contributions
        .map(
          (item) =>
            `- ${item.indicator}: +${item.points}\n  ${item.reason}`
        )
        .join("\n")
    : getSecuritySignalCoverage(data).allUnavailable
      ? "Insufficient security telemetry to calculate a defensible risk score."
      : "No weighted risk indicators detected.";

  const pipeline = data.pipeline
    .map(
      (stage) =>
        `${stage.name.padEnd(30)} ${String(stage.durationMs).padStart(5)} ms  ${stage.status.toUpperCase()}`
    )
    .join("\n");

  return `IP INTELLIGENCE — INVESTIGATION REPORT
============================================================

TARGET
------------------------------------------------------------
IP Address             ${data.ip}
Protocol               ${data.version}
Classification         ${data.protocol.classification}

EXECUTIVE SUMMARY
------------------------------------------------------------
${data.summary}

NETWORK IDENTITY
------------------------------------------------------------
Organization           ${data.network.company}
ASN                    ${formatAsn(data.network.asn)}
CIDR / Prefix          ${data.network.cidr}
Netname                ${data.network.netname}
Network Type           ${data.network.networkType}

RDAP REGISTRATION
------------------------------------------------------------
Available              ${data.rdap.available ? "YES" : "NO"}
Handle                 ${data.rdap.handle}
Name                   ${data.rdap.name}
Type                   ${data.rdap.type}
Country                ${data.rdap.country}
Range                  ${data.rdap.startAddress} -> ${data.rdap.endAddress}
Parent Handle          ${data.rdap.parentHandle}

APPROXIMATE GEOLOCATION
------------------------------------------------------------
City                   ${data.location.city}
Region                 ${data.location.region}
Country                ${data.location.country}
Timezone               ${data.location.timezone}

DNS INVESTIGATION
------------------------------------------------------------
PTR                    ${data.dns.ptr}
FCrDNS                 ${data.dns.fcrdns}
Forward addresses      ${
    data.dns.resolvedAddresses.length
      ? data.dns.resolvedAddresses.join(", ")
      : "None"
  }

SECURITY SIGNALS
------------------------------------------------------------
${signals}

HEURISTIC RISK
------------------------------------------------------------
Score                  ${data.risk.score ?? "Unavailable"}${
    data.risk.score !== null ? "/100" : ""
  }
Level                  ${data.risk.level}
Formula                ${data.risk.formula}

${contributions}

DATA QUALITY
------------------------------------------------------------
Coverage               ${data.dataQuality.score}%
Level                  ${data.dataQuality.level}
Available signals      ${data.dataQuality.availableSignals}/${data.dataQuality.totalSignals}
Missing                ${
    data.dataQuality.missing.length
      ? data.dataQuality.missing.join(", ")
      : "None"
  }

PIPELINE
------------------------------------------------------------
${pipeline}

PERFORMANCE
------------------------------------------------------------
Response               ${data.performance.responseTimeMs} ms
Cache                  ${data.performance.cache}

NOTICE
------------------------------------------------------------
${data.note}

IP geolocation is approximate. This report does not establish
identity, exact physical location, compromise or malicious intent.
`;
}
