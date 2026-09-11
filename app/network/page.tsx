"use client";

import {
  DataBox,
  EmptyInvestigation,
  Eyebrow,
  FeatureRow,
  LoadingInvestigation,
  PageHeader,
  Panel,
  SectionTitle,
  Shell,
} from "@/app/components/intel-ui";
import { useInvestigation } from "@/app/components/use-investigation";
import { formatAsn } from "@/app/lib/intelligence";

export default function NetworkPage() {
  const { data, ready } = useInvestigation();

  if (!ready) {
    return (
      <Shell>
        <LoadingInvestigation />
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <EmptyInvestigation />
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Network"
        title="Network identity & registration."
        description="Analyze who announces and controls the address space, how the network is registered and how the address is represented at the protocol layer."
        aside={
          <div className="rounded-[20px] bg-[#ffdce9] px-5 py-4">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#b65b84]">
              Target
            </p>
            <p className="mt-2 font-mono text-sm font-black">
              {data.ip}
            </p>
          </div>
        }
      />

      <div className="grid gap-5 p-0 lg:grid-cols-2">
        <Panel>
          <Eyebrow>Routing intelligence</Eyebrow>
          <SectionTitle>ASN & network identity</SectionTitle>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <DataBox
              label="Organization"
              value={data.network.company}
            />
            <DataBox
              label="ASN"
              value={formatAsn(data.network.asn)}
            />
            <DataBox
              label="CIDR / Prefix"
              value={data.network.cidr}
            />
            <DataBox
              label="Netname"
              value={data.network.netname}
            />
            <DataBox
              label="Network type"
              value={data.network.networkType}
            />
            <DataBox
              label="Protocol"
              value={data.version}
            />
          </div>
        </Panel>

        <Panel pink>
          <Eyebrow>Registration intelligence</Eyebrow>
          <SectionTitle>RDAP registry record</SectionTitle>

          <div className="mt-6 space-y-3">
            <FeatureRow label="Status">
              {data.rdap.available ? "AVAILABLE" : "UNAVAILABLE"}
            </FeatureRow>

            <FeatureRow label="Name">
              {data.rdap.name}
            </FeatureRow>

            <FeatureRow label="Handle">
              {data.rdap.handle}
            </FeatureRow>

            <FeatureRow label="Type">
              {data.rdap.type}
            </FeatureRow>

            <FeatureRow label="Country">
              {data.rdap.country}
            </FeatureRow>

            <FeatureRow label="Range">
              {data.rdap.startAddress} → {data.rdap.endAddress}
            </FeatureRow>

            <FeatureRow label="Parent">
              {data.rdap.parentHandle}
            </FeatureRow>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Panel pink>
          <Eyebrow>RDAP entities</Eyebrow>
          <SectionTitle>Registered contacts</SectionTitle>

          <div className="mt-6 space-y-3">
            {data.rdap.entities.length ? (
              data.rdap.entities.map((entity, index) => (
                <div
                  key={`${entity.name}-${index}`}
                  className="rounded-[18px] bg-white/75 p-4"
                >
                  <p className="font-bold">{entity.name}</p>
                  <p className="mt-1 text-xs text-[#97627a]">
                    {entity.roles.length
                      ? entity.roles.join(", ")
                      : "No role supplied"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#94647a]">
                No RDAP entities were returned.
              </p>
            )}
          </div>
        </Panel>

        <Panel>
          <Eyebrow>Protocol analysis</Eyebrow>
          <SectionTitle>Address representation</SectionTitle>

          <div className="mt-6 space-y-3">
            <FeatureRow label="Classification">
              {data.protocol.classification}
            </FeatureRow>

            {data.protocol.decimal && (
              <FeatureRow label="32-bit decimal">
                {data.protocol.decimal}
              </FeatureRow>
            )}

            {data.protocol.hexadecimal && (
              <FeatureRow label="Hexadecimal">
                {data.protocol.hexadecimal}
              </FeatureRow>
            )}

            {data.protocol.binary && (
              <div className="rounded-[18px] bg-[#fff0f6] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#b56388]">
                  Binary
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-6">
                  {data.protocol.binary}
                </p>
              </div>
            )}

            {data.protocol.expanded && (
              <div className="rounded-[18px] bg-[#fff0f6] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#b56388]">
                  Expanded IPv6
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-6">
                  {data.protocol.expanded}
                </p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel dark>
          <Eyebrow light>Analyst note</Eyebrow>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-white/60">
            ASN ownership, RDAP registration and IP intelligence describe
            network infrastructure. They do not identify the individual
            person using an address.
          </p>
        </Panel>
      </div>
    </Shell>
  );
}
