import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { resolve4, resolve6, reverse } from "node:dns/promises";

export const dynamic = "force-dynamic";

type SecurityValue = boolean | null;
type SignalState = "DETECTED" | "CLEAR" | "UNKNOWN";
type FcrdnsStatus = "VERIFIED" | "MISMATCH" | "NO_PTR";

type RiskContribution = {
  indicator: string;
  points: number;
  reason: string;
};

type EvidenceItem = {
  indicator: string;
  status: SignalState;
  source: string;
  rawField: string;
  normalizedValue: string;
  riskPoints: number;
  explanation: string;
};

type PipelineStage = {
  name: string;
  status: "complete" | "warning" | "skipped";
  durationMs: number;
  detail: string;
};

type RdapEntity = {
  name: string;
  roles: string[];
};

type IntelligenceResult = {
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

type CacheEntry = {
  expires: number;
  value: IntelligenceResult;
};

type RateEntry = {
  count: number;
  reset: number;
};

const cache = new Map<string, CacheEntry>();
const rateLimit = new Map<string, RateEntry>();

const CACHE_TTL = 5 * 60 * 1000;
const RATE_WINDOW = 10 * 60 * 1000;
const RATE_MAX = 30;

const API_TIMEOUT = 6500;
const DNS_TIMEOUT = 3000;
const RDAP_TIMEOUT = 5000;

function elapsed(start: number) {
  return Math.max(0, Math.round(performance.now() - start));
}

function normalizeIp(ip: string) {
  return ip.replace(/^::ffff:/i, "").trim();
}

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return normalizeIp(
    forwarded?.split(",")[0]?.trim() ||
      realIp ||
      ""
  );
}

function ipv4ToNumber(ip: string) {
  return ip
    .split(".")
    .map(Number)
    .reduce(
      (acc, part) =>
        ((acc << 8) | part) >>> 0,
      0
    );
}

function inIpv4Range(
  ip: string,
  base: string,
  prefix: number
) {
  const mask =
    prefix === 0
      ? 0
      : (0xffffffff << (32 - prefix)) >>> 0;

  return (
    (ipv4ToNumber(ip) & mask) ===
    (ipv4ToNumber(base) & mask)
  );
}

function isReservedIp(ip: string) {
  const version = isIP(ip);

  if (version === 4) {
    const ranges: Array<[string, number]> = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];

    return ranges.some(([base, prefix]) =>
      inIpv4Range(ip, base, prefix)
    );
  }

  if (version === 6) {
    const value = ip.toLowerCase();

    return (
      value === "::" ||
      value === "::1" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe8") ||
      value.startsWith("fe9") ||
      value.startsWith("fea") ||
      value.startsWith("feb") ||
      value.startsWith("2001:db8")
    );
  }

  return true;
}

function checkRateLimit(clientIp: string) {
  const now = Date.now();
  const current = rateLimit.get(clientIp);

  if (!current || current.reset <= now) {
    rateLimit.set(clientIp, {
      count: 1,
      reset: now + RATE_WINDOW,
    });

    return true;
  }

  if (current.count >= RATE_MAX) {
    return false;
  }

  current.count += 1;

  return true;
}

function asRecord(
  value: unknown
): Record<string, unknown> | null {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return null;
}

function text(
  value: unknown,
  fallback = "Unknown"
) {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (
    typeof value === "number" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return fallback;
}

function nestedText(
  value: unknown,
  keys: string[],
  fallback = "Unknown"
) {
  const object = asRecord(value);

  if (!object) {
    return text(value, fallback);
  }

  for (const key of keys) {
    const candidate = object[key];

    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }

    if (
      typeof candidate === "number" ||
      typeof candidate === "bigint"
    ) {
      return String(candidate);
    }
  }

  return fallback;
}

function securityFlag(
  value: unknown
): SecurityValue {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .toLowerCase();

    if (
      ["true", "1", "yes"].includes(
        normalized
      )
    ) {
      return true;
    }

    if (
      ["false", "0", "no"].includes(
        normalized
      )
    ) {
      return false;
    }
  }

  return null;
}

function numberOrNull(value: unknown) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function safeRaw(
  raw: Record<string, unknown>
) {
  const clone = { ...raw };

  delete clone.key;
  delete clone.api_key;
  delete clone.token;

  return clone;
}

function expandIpv6(ip: string) {
  let value = ip.toLowerCase();

  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    const ipv4Part = value.slice(lastColon + 1);

    if (isIP(ipv4Part) === 4) {
      const octets = ipv4Part
        .split(".")
        .map(Number);

      const high = (
        (octets[0] << 8) |
        octets[1]
      ).toString(16);

      const low = (
        (octets[2] << 8) |
        octets[3]
      ).toString(16);

      value =
        value.slice(0, lastColon) +
        ":" +
        high +
        ":" +
        low;
    }
  }

  const parts = value.split("::");

  if (parts.length > 2) {
    return ip.toLowerCase();
  }

  const left = parts[0]
    ? parts[0].split(":").filter(Boolean)
    : [];

  const right =
    parts.length === 2 && parts[1]
      ? parts[1].split(":").filter(Boolean)
      : [];

  if (parts.length === 1) {
    if (left.length !== 8) {
      return ip.toLowerCase();
    }

    return left
      .map((part) =>
        part.padStart(4, "0")
      )
      .join(":");
  }

  const missing =
    8 - left.length - right.length;

  if (missing < 0) {
    return ip.toLowerCase();
  }

  const groups = [
    ...left,
    ...Array(missing).fill("0"),
    ...right,
  ];

  return groups
    .map((part) =>
      part.padStart(4, "0")
    )
    .join(":");
}

function comparableIp(ip: string) {
  const normalized = normalizeIp(ip);

  if (isIP(normalized) === 6) {
    return expandIpv6(normalized);
  }

  return normalized;
}

function protocolAnalysis(ip: string) {
  if (isIP(ip) === 4) {
    const decimalNumber =
      ipv4ToNumber(ip);

    const hexadecimal =
      "0x" +
      decimalNumber
        .toString(16)
        .toUpperCase()
        .padStart(8, "0");

    const binary = ip
      .split(".")
      .map((part) =>
        Number(part)
          .toString(2)
          .padStart(8, "0")
      )
      .join(".");

    return {
      classification:
        "Globally routable public IPv4",
      decimal: String(decimalNumber),
      hexadecimal,
      binary,
      expanded: null,
    };
  }

  return {
    classification:
      "Globally routable public IPv6",
    decimal: null,
    hexadecimal: null,
    binary: null,
    expanded: expandIpv6(ip),
  };
}

async function dnsInvestigation(ip: string) {
  const started = performance.now();

  try {
    const hostnames = await Promise.race([
      reverse(ip),

      new Promise<string[]>(
        (_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "PTR lookup timeout"
                )
              ),
            DNS_TIMEOUT
          )
      ),
    ]);

    const ptr =
      hostnames[0] || null;

    if (!ptr) {
      return {
        durationMs: elapsed(started),
        ptr: "No PTR record found",
        fcrdns: "NO_PTR" as FcrdnsStatus,
        resolvedAddresses: [],
        explanation:
          "No reverse DNS PTR record exists for this address.",
      };
    }

    let addresses: string[] = [];

    try {
      const [v4, v6] =
        await Promise.all([
          resolve4(ptr).catch(
            () => [] as string[]
          ),

          resolve6(ptr).catch(
            () => [] as string[]
          ),
        ]);

      addresses = [...v4, ...v6];
    } catch {
      addresses = [];
    }

    const target =
      comparableIp(ip);

    const verified =
      addresses.some(
        (address) =>
          comparableIp(address) ===
          target
      );

    return {
      durationMs: elapsed(started),
      ptr,
      fcrdns: verified
        ? ("VERIFIED" as FcrdnsStatus)
        : ("MISMATCH" as FcrdnsStatus),
      resolvedAddresses: addresses,
      explanation: verified
        ? "Forward-confirmed reverse DNS succeeded: the PTR hostname resolves back to the investigated IP."
        : "A PTR record exists, but its forward DNS records do not resolve back to the investigated IP.",
    };
  } catch {
    return {
      durationMs: elapsed(started),
      ptr: "No PTR record found",
      fcrdns: "NO_PTR" as FcrdnsStatus,
      resolvedAddresses: [],
      explanation:
        "No usable PTR record was returned before the DNS timeout.",
    };
  }
}

function rdapEntityName(
  value: unknown
) {
  const entity = asRecord(value);

  if (!entity) {
    return "Unknown entity";
  }

  const vcard =
    entity.vcardArray;

  if (
    Array.isArray(vcard) &&
    Array.isArray(vcard[1])
  ) {
    for (const item of vcard[1]) {
      if (
        Array.isArray(item) &&
        item[0] === "fn" &&
        typeof item[3] === "string"
      ) {
        return item[3];
      }
    }
  }

  return text(
    entity.handle,
    "Unknown entity"
  );
}

function parseRdapEntities(
  value: unknown
): RdapEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 8)
    .map((entry) => {
      const object =
        asRecord(entry);

      const roles =
        object &&
        Array.isArray(object.roles)
          ? object.roles.filter(
              (
                role
              ): role is string =>
                typeof role ===
                "string"
            )
          : [];

      return {
        name: rdapEntityName(
          entry
        ),
        roles,
      };
    });
}

async function rdapInvestigation(
  ip: string
) {
  const started = performance.now();
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    RDAP_TIMEOUT
  );

  try {
    const response = await fetch(
      `https://rdap.org/ip/${encodeURIComponent(
        ip
      )}`,
      {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept:
            "application/rdap+json, application/json",
        },
      }
    );

    if (!response.ok) {
      return {
        durationMs: elapsed(started),
        available: false,
        raw: null,
        handle: "Unavailable",
        name: "Unavailable",
        type: "Unavailable",
        country: "Unknown",
        startAddress: "Unknown",
        endAddress: "Unknown",
        parentHandle: "Unknown",
        entities: [] as RdapEntity[],
      };
    }

    const payload: unknown =
      await response.json();

    const raw =
      asRecord(payload);

    if (!raw) {
      throw new Error(
        "Invalid RDAP response"
      );
    }

    return {
      durationMs: elapsed(started),
      available: true,
      raw,
      handle: text(raw.handle),
      name: text(raw.name),
      type: text(raw.type),
      country: text(raw.country),
      startAddress:
        text(raw.startAddress),
      endAddress:
        text(raw.endAddress),
      parentHandle:
        text(raw.parentHandle),
      entities:
        parseRdapEntities(
          raw.entities
        ),
    };
  } catch {
    return {
      durationMs: elapsed(started),
      available: false,
      raw: null,
      handle: "Unavailable",
      name: "Unavailable",
      type: "Unavailable",
      country: "Unknown",
      startAddress: "Unknown",
      endAddress: "Unknown",
      parentHandle: "Unknown",
      entities: [] as RdapEntity[],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function signalState(
  value: SecurityValue
): SignalState {
  if (value === true) {
    return "DETECTED";
  }

  if (value === false) {
    return "CLEAR";
  }

  return "UNKNOWN";
}

function buildEvidence(
  security: IntelligenceResult["security"]
): EvidenceItem[] {
  const definitions: Array<{
    key: keyof IntelligenceResult["security"];
    label: string;
    rawField: string;
    points: number;
    explanation: string;
  }> = [
    {
      key: "vpn",
      label: "VPN",
      rawField: "is_vpn",
      points: 25,
      explanation:
        "VPN infrastructure can obscure the originating network and is therefore treated as an anonymization signal.",
    },
    {
      key: "proxy",
      label: "Proxy",
      rawField: "is_proxy",
      points: 25,
      explanation:
        "Proxy infrastructure may relay traffic on behalf of another endpoint and reduces direct attribution confidence.",
    },
    {
      key: "tor",
      label: "Tor exit node",
      rawField: "is_tor",
      points: 40,
      explanation:
        "Tor exit nodes intentionally provide anonymity and receive a higher heuristic weight.",
    },
    {
      key: "hosting",
      label:
        "Hosting / datacenter",
      rawField:
        "is_datacenter",
      points: 15,
      explanation:
        "Datacenter infrastructure differs from typical residential access networks and is commonly used for automated services.",
    },
    {
      key: "abuser",
      label:
        "Abuse indicator",
      rawField:
        "is_abuser",
      points: 35,
      explanation:
        "The upstream intelligence provider associates this address or network with abuse-related observations.",
    },
  ];

  return definitions.map(
    ({
      key,
      label,
      rawField,
      points,
      explanation,
    }) => {
      const value =
        security[key];

      return {
        indicator: label,
        status:
          signalState(value),
        source: "ipapi.is",
        rawField,
        normalizedValue:
          value === null
            ? "null"
            : String(value),
        riskPoints:
          value === true
            ? points
            : 0,
        explanation,
      };
    }
  );
}

function calculateRisk(
  evidence: EvidenceItem[]
) {
  const available =
    evidence.some(
      (item) =>
        item.status !==
        "UNKNOWN"
    );

  if (!available) {
    return {
      available: false,
      score: null,
      level: "UNAVAILABLE",
      formula:
        "Insufficient security telemetry to calculate a defensible risk score",
      contributions:
        [] as RiskContribution[],
    };
  }

  const contributions =
    evidence
      .filter(
        (item) =>
          item.status ===
          "DETECTED"
      )
      .map((item) => ({
        indicator:
          item.indicator,
        points:
          item.riskPoints,
        reason:
          item.explanation,
      }));

  const rawScore =
    contributions.reduce(
      (sum, item) =>
        sum + item.points,
      0
    );

  const score =
    Math.min(rawScore, 100);

  const level =
    score >= 60
      ? "HIGH"
      : score >= 25
        ? "MEDIUM"
        : "LOW";

  const formula =
    contributions.length
      ? `Base 0 → ${contributions
          .map(
            (item) =>
              `${item.indicator} +${item.points}`
          )
          .join(
            " → "
          )} → Final ${score}/100`
      : "Base 0 → No weighted detections → Final 0/100";

  return {
    available: true,
    score,
    level,
    formula,
    contributions,
  };
}

function calculateDataQuality(input: {
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  company: string;
  asn: string;
  cidr: string;
  netname: string;
  security:
    IntelligenceResult["security"];
  rdapAvailable: boolean;
}) {
  const checks = [
    {
      label: "City",
      ok: input.city !== "Unknown",
    },
    {
      label: "Country",
      ok:
        input.country !==
        "Unknown",
    },
    {
      label: "Coordinates",
      ok:
        input.latitude !==
          null &&
        input.longitude !==
          null,
    },
    {
      label: "Organization",
      ok:
        input.company !==
        "Unknown",
    },
    {
      label: "ASN",
      ok:
        input.asn !==
        "Unknown",
    },
    {
      label: "CIDR / prefix",
      ok:
        input.cidr !==
        "Unknown",
    },
    {
      label: "Netname",
      ok:
        input.netname !==
        "Unknown",
    },
    {
      label: "RDAP",
      ok:
        input.rdapAvailable,
    },
    {
      label: "VPN signal",
      ok:
        input.security.vpn !==
        null,
    },
    {
      label: "Proxy signal",
      ok:
        input.security.proxy !==
        null,
    },
    {
      label: "Tor signal",
      ok:
        input.security.tor !==
        null,
    },
    {
      label:
        "Datacenter signal",
      ok:
        input.security.hosting !==
        null,
    },
    {
      label: "Abuse signal",
      ok:
        input.security.abuser !==
        null,
    },
  ];

  const availableSignals =
    checks.filter(
      (item) => item.ok
    ).length;

  const totalSignals =
    checks.length;

  const score =
    Math.round(
      (availableSignals /
        totalSignals) *
        100
    );

  const level:
    | "HIGH"
    | "MEDIUM"
    | "LOW" =
    score >= 80
      ? "HIGH"
      : score >= 55
        ? "MEDIUM"
        : "LOW";

  const missing =
    checks
      .filter(
        (item) => !item.ok
      )
      .map(
        (item) => item.label
      );

  return {
    score,
    level,
    availableSignals,
    totalSignals,
    missing,
    explanation:
      "Data quality measures evidence coverage and field availability. It is not a probability that the risk classification is correct.",
  };
}

function buildSummary(input: {
  company: string;
  asn: string;
  networkType: string;
  country: string;
  city: string;
  security:
    IntelligenceResult["security"];
  dns:
    IntelligenceResult["dns"];
}) {
  const detected = Object
    .entries(input.security)
    .filter(
      ([, value]) =>
        value === true
    )
    .map(([key]) => key);

  const unknown = Object
    .values(input.security)
    .filter(
      (value) =>
        value === null
    ).length;

  const network =
    `${input.company}` +
    (input.asn !== "Unknown"
      ? ` (${input.asn.startsWith("AS") ? input.asn : `AS${input.asn}`})`
      : "") +
    (input.networkType !==
    "Unknown"
      ? `, classified as ${input.networkType}`
      : "");

  const location =
    input.city !== "Unknown" ||
    input.country !== "Unknown"
      ? `Approximate geolocation indicates ${[
          input.city !==
          "Unknown"
            ? input.city
            : null,
          input.country !==
          "Unknown"
            ? input.country
            : null,
        ]
          .filter(Boolean)
          .join(", ")}.`
      : "Approximate geolocation is unavailable.";

  let securitySummary =
    unknown === Object.keys(input.security).length
      ? "Security signal evaluation was unavailable."
      : "No weighted security indicators were detected among evaluated signals.";

  if (detected.length) {
    securitySummary =
      `Detected security indicators: ${detected.join(
        ", "
      )}.`;
  }

  if (unknown > 0) {
    securitySummary +=
      ` ${unknown} security signal${
        unknown === 1 ? "" : "s"
      } remain unknown.`;
  }

  const dnsSummary =
    input.dns.fcrdns ===
    "VERIFIED"
      ? "Forward-confirmed reverse DNS is verified."
      : input.dns.fcrdns ===
          "MISMATCH"
        ? "A PTR record exists but forward-confirmed reverse DNS does not match."
        : "No PTR record was available for FCrDNS verification.";

  return `${network}. ${location} ${securitySummary} ${dnsSummary}`;
}

export async function GET(
  request: NextRequest
) {
  const totalStarted =
    performance.now();

  const pipeline:
    PipelineStage[] = [];

  try {
    const validationStarted =
      performance.now();

    const clientIp =
      getClientIp(request);

    if (!clientIp) {
      return NextResponse.json(
        {
          error:
            "Could not determine client IP.",
        },
        { status: 400 }
      );
    }

    if (
      !checkRateLimit(
        clientIp
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Rate limit reached. Please try again later.",
        },
        { status: 429 }
      );
    }

    const requestedIp =
      request.nextUrl.searchParams.get(
        "ip"
      );

    const ip =
      normalizeIp(
        requestedIp ||
          clientIp
      );

    if (!isIP(ip)) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid IPv4 or IPv6 address.",
        },
        { status: 400 }
      );
    }

    if (isReservedIp(ip)) {
      return NextResponse.json(
        {
          error:
            "Private, reserved and documentation IP ranges cannot be analyzed.",
        },
        { status: 400 }
      );
    }

    pipeline.push({
      name: "Input validation",
      status: "complete",
      durationMs:
        elapsed(
          validationStarted
        ),
      detail:
        `${isIP(ip) === 6 ? "IPv6" : "IPv4"} syntax and public-address policy validated.`,
    });

    const cacheStarted =
      performance.now();

    const cached =
      cache.get(ip);

    if (
      cached &&
      cached.expires >
        Date.now()
    ) {
      const cachedResult = {
        ...cached.value,

        pipeline: [
          pipeline[0],
          {
            name:
              "Cache lookup",
            status:
              "complete" as const,
            durationMs:
              elapsed(
                cacheStarted
              ),
            detail:
              "Fresh normalized intelligence served from the in-memory cache.",
          },
        ],

        performance: {
          responseTimeMs:
            elapsed(
              totalStarted
            ),
          cache:
            "HIT" as const,
        },
      };

      return NextResponse.json(
        cachedResult,
        {
          headers: {
            "Cache-Control":
              "private, no-store",
          },
        }
      );
    }

    if (cached) {
      cache.delete(ip);
    }

    pipeline.push({
      name: "Cache lookup",
      status: "complete",
      durationMs:
        elapsed(
          cacheStarted
        ),
      detail:
        "No fresh cached investigation was available.",
    });

    const providerStarted =
      performance.now();

    const apiKey =
      process.env.IPAPI_KEY;

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        API_TIMEOUT
      );

    let providerResponse:
      Response;

    try {
      const body: Record<
        string,
        string
      > = {
        q: ip,
      };

      if (apiKey) {
        body.key = apiKey;
      }

      providerResponse =
        await fetch(
          "https://api.ipapi.is",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body
              ),

            cache: "no-store",

            signal:
              controller.signal,
          }
        );
    } finally {
      clearTimeout(timeout);
    }

    if (
      !providerResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            providerResponse.status ===
            429
              ? "The external IP intelligence service rate limit was reached."
              : `IP intelligence service returned HTTP ${providerResponse.status}.`,
        },
        {
          status:
            providerResponse.status,
        }
      );
    }

    const providerPayload:
      unknown =
      await providerResponse.json();

    const raw =
      asRecord(
        providerPayload
      );

    if (!raw) {
      return NextResponse.json(
        {
          error:
            "The IP intelligence service returned an invalid response.",
        },
        { status: 502 }
      );
    }

    pipeline.push({
      name:
        "IP intelligence",
      status: "complete",
      durationMs:
        elapsed(
          providerStarted
        ),
      detail:
        "Geolocation, network ownership and security telemetry retrieved.",
    });

    const [dns, rdap] =
      await Promise.all([
        dnsInvestigation(ip),
        rdapInvestigation(ip),
      ]);

    pipeline.push({
      name:
        "DNS investigation",
      status:
        dns.fcrdns ===
        "MISMATCH"
          ? "warning"
          : "complete",
      durationMs:
        dns.durationMs,
      detail:
        `PTR and forward-confirmed reverse DNS: ${dns.fcrdns}.`,
    });

    pipeline.push({
      name:
        "RDAP registration",
      status:
        rdap.available
          ? "complete"
          : "warning",
      durationMs:
        rdap.durationMs,
      detail:
        rdap.available
          ? "Authoritative registration metadata retrieved through RDAP bootstrap."
          : "RDAP registration metadata was unavailable or timed out.",
    });

    const normalizationStarted =
      performance.now();

    const locationRaw =
      asRecord(
        raw.location
      );

    const companyRaw =
      asRecord(
        raw.company
      );

    const asnRaw =
      asRecord(raw.asn);

    const security = {
      vpn: securityFlag(
        raw.is_vpn
      ),

      proxy: securityFlag(
        raw.is_proxy
      ),

      tor: securityFlag(
        raw.is_tor
      ),

      hosting:
        securityFlag(
          raw.is_datacenter
        ),

      abuser:
        securityFlag(
          raw.is_abuser
        ),
    };

    const city =
      text(
        locationRaw?.city ??
          raw.city
      );

    const region =
      text(
        locationRaw?.state ??
          locationRaw?.region ??
          raw.region
      );

    const country =
      text(
        locationRaw?.country ??
          raw.country
      );

    const latitude =
      numberOrNull(
        locationRaw?.latitude ??
          locationRaw?.lat ??
          raw.latitude ??
          raw.lat
      );

    const longitude =
      numberOrNull(
        locationRaw?.longitude ??
          locationRaw?.lon ??
          raw.longitude ??
          raw.lon
      );

    const timezone =
      text(
        locationRaw?.timezone ??
          raw.timezone
      );

    const company =
      nestedText(
        raw.company,
        [
          "name",
          "company",
          "domain",
        ]
      );

    const asn =
      nestedText(
        raw.asn,
        [
          "asn",
          "number",
          "name",
        ]
      );

    const cidr =
      text(
        companyRaw?.network ??
          asnRaw?.route ??
          asnRaw?.network ??
          raw.network
      );

    const netname =
      text(
        companyRaw?.netname ??
          asnRaw?.netname ??
          raw.netname ??
          rdap.name
      );

    const networkType =
      text(
        companyRaw?.type ??
          asnRaw?.type ??
          raw.type ??
          rdap.type
      );

    const evidence =
      buildEvidence(
        security
      );

    const risk =
      calculateRisk(
        evidence
      );

    const dataQuality =
      calculateDataQuality({
        city,
        country,
        latitude,
        longitude,
        company,
        asn,
        cidr,
        netname,
        security,
        rdapAvailable:
          rdap.available,
      });

    const protocol =
      protocolAnalysis(ip);

    const dnsResult = {
      ptr: dns.ptr,
      fcrdns:
        dns.fcrdns,
      resolvedAddresses:
        dns.resolvedAddresses,
      explanation:
        dns.explanation,
    };

    const summary =
      buildSummary({
        company,
        asn,
        networkType,
        country,
        city,
        security,
        dns: dnsResult,
      });

    pipeline.push({
      name:
        "Normalization & correlation",
      status: "complete",
      durationMs:
        elapsed(
          normalizationStarted
        ),
      detail:
        "Provider, RDAP and DNS records normalized into a single investigation schema.",
    });

    const riskStarted =
      performance.now();

    pipeline.push({
      name:
        "Heuristic risk engine",
      status:
        risk.available
          ? "complete"
          : "warning",
      durationMs:
        elapsed(
          riskStarted
        ),
      detail:
        risk.available
          ? `${risk.level} risk classification produced from explainable weighted signals.`
          : "Risk engine could not classify the address because security signals are unavailable.",
    });

    const result:
      IntelligenceResult = {
      ip,

      version:
        isIP(ip) === 6
          ? "IPv6"
          : "IPv4",

      summary,

      location: {
        city,
        region,
        country,
        latitude,
        longitude,
        timezone,
        accuracyNotice:
          "IP geolocation is approximate. The map marker represents an estimated area and must not be interpreted as an exact physical address.",
      },

      network: {
        company,
        asn,
        cidr,
        netname,
        networkType,
        reverseDns:
          dns.ptr,
      },

      rdap: {
        available:
          rdap.available,
        handle:
          rdap.handle,
        name:
          rdap.name,
        type:
          rdap.type,
        country:
          rdap.country,
        startAddress:
          rdap.startAddress,
        endAddress:
          rdap.endAddress,
        parentHandle:
          rdap.parentHandle,
        entities:
          rdap.entities,
      },

      dns: dnsResult,

      protocol,

      security,

      evidence,

      risk,

      dataQuality,

      pipeline,

      performance: {
        responseTimeMs:
          elapsed(
            totalStarted
          ),
        cache: "MISS",
      },

      securityDataAvailable:
        Object.values(
          security
        ).some(
          (value) =>
            value !== null
        ),

      raw: {
        provider:
          safeRaw(raw),
        rdap:
          rdap.raw,
      },

      note:
        "Risk classification is heuristic and does not establish that an IP address, host, network or user is malicious.",
    };

    cache.set(ip, {
      value: result,
      expires:
        Date.now() +
        CACHE_TTL,
    });

    return NextResponse.json(
      result,
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "IP investigation error:",
      error
    );

    const message =
      error instanceof Error &&
      error.name ===
        "AbortError"
        ? "The upstream intelligence service timed out."
        : "Unable to complete the IP investigation.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
