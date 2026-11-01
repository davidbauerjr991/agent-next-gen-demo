// The sim's org tree (P-CONFIG-LAYERS): one tenant, one enterprise, one contact center and four teams, each with a
// profile, so every layer is exercised. The demo's persona picks the employee, and so the chain (PLAN Decisions
// 2026-11-01). The agent persona is inert: its upper layers set only Phase 1 defaults and lock nothing, so a fresh
// desktop resolves exactly as it would with no org at all. Skills (Billing, Sales) are data on the employee, never a
// layer. No profile here sets or locks `workspace` or `home`: the persona and its Home card set stay the agent's.
import type { EmployeeId } from "../../domain";
import type { EmployeeRecord, OrgChain, OrgLayerFile, OrgLayerProvider, ScheduleRole, TeamRecord } from "../../providers";
import { DEFAULT_LATENCY, type LatencyRange } from "./sim-transport";
import { sampleMs } from "./sim-util";

const employee = (id: string) => id as EmployeeId;

/** `{ [section]: { value } }`: the sections a profile sets (no `v`: the schema the app runs). */
const sections = (values: Record<string, unknown>) => Object.fromEntries(Object.entries(values).map(([k, value]) => [k, { value }]));

const layer = (level: OrgLayerFile["level"], id: string, name: string, values: Record<string, unknown>, locks: string[] = []): OrgLayerFile => ({
  level,
  id,
  name,
  sections: sections(values),
  locks,
});

/** For a direct customer the tenant sets nothing (for a BPO it's the BPO, and each client an enterprise). */
const TENANT = layer("tenant", "northwind", "Northwind", {});
const ENTERPRISE = layer("enterprise", "northwind-retail", "Northwind Retail", { channels: { voice: true } });
const CONTACT_CENTER = layer("contactCenter", "northwind-care", "Northwind Care", { voice: { controlsLocation: "bottom" } });

const TEAM_PROFILES: Record<string, OrgLayerFile> = {
  atlas: layer("team", "atlas", "Atlas", { notifications: { toasts: { duration: 8 } } }),
  birch: layer("team", "birch", "Birch", {}),
  supervisors: layer("team", "supervisors", "Supervisors", { notifications: { toasts: { duration: 12 } } }, ["notifications"]),
  sales: layer(
    "team",
    "sales",
    "Sales",
    { outbound: { launcher: { dialpad: true, search: true, all: true } } },
    ["outbound"],
  ),
};

export const SIM_TEAMS: TeamRecord[] = [
  { id: "atlas", name: "Atlas", supervisors: [employee("emp-dana-supervisor")] },
  { id: "birch", name: "Birch", supervisors: [employee("emp-dana-supervisor"), employee("emp-lee-lead")] },
  { id: "supervisors", name: "Supervisors", supervisors: [employee("emp-ops-manager")] },
  { id: "sales", name: "Sales", supervisors: [employee("emp-lee-lead")] },
];

/** The demo personas as employee records. */
export const SIM_EMPLOYEES: Record<ScheduleRole, EmployeeRecord> = {
  agent: { id: employee("emp-agent"), name: "Agent", primaryTeam: "atlas", teams: ["atlas"], supervises: [], skills: ["billing"] },
  sales: { id: employee("emp-sales"), name: "Sales", primaryTeam: "sales", teams: ["sales", "atlas"], supervises: [], skills: ["sales"] },
  supervisor: {
    id: employee("emp-dana-supervisor"),
    name: "Supervisor",
    primaryTeam: "supervisors",
    teams: ["supervisors"],
    supervises: ["atlas", "birch"],
    skills: ["billing", "sales"],
  },
};

/** The employee's chain: tenant, enterprise and contact center, then the team profiles of every team they're in,
 *  the primary one marked (only it enters resolution). */
export function simOrgChain(role: ScheduleRole): OrgChain {
  const record = SIM_EMPLOYEES[role];
  const teams = record.teams.map((id) => ({ ...TEAM_PROFILES[id], primary: id === record.primaryTeam }));
  return {
    employee: record,
    teams: SIM_TEAMS.filter((t) => record.teams.includes(t.id) || record.supervises.includes(t.id)),
    layers: [TENANT, ENTERPRISE, CONTACT_CENTER, ...teams],
  };
}

export function createSimOrgLayerProvider(options?: { latency?: LatencyRange }): OrgLayerProvider {
  const latency = options?.latency ?? DEFAULT_LATENCY;
  return {
    async chainFor(role) {
      await new Promise<void>((resolve) => setTimeout(resolve, sampleMs(latency)));
      return simOrgChain(role);
    },
  };
}
