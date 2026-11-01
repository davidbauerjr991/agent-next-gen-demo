import type { EmployeeId } from "../domain";
import type { ScheduleRole } from "./schedule-provider";

/** The levels an org assigns profiles at (P-CONFIG-LAYERS; PLAN Decisions 2026-11-01). Skills are not a level: they're
 *  data on contacts and queues, and a skill's behaviour is a per-assignment policy. */
export type OrgLayerLevel = "tenant" | "enterprise" | "contactCenter" | "team";

/** One org layer's profile, in the profile file's shape (`{ [section]: { v?, value } }`, the sections it sets) plus
 *  its level. A missing `v` means the schema the app runs. */
export interface OrgLayerFile {
  level: OrgLayerLevel;
  id: string;
  name: string;
  /** A team: whether it's the employee's primary team, the only one whose profile enters the chain. */
  primary?: boolean;
  sections: Record<string, { v?: number; value: unknown }>;
  locks: string[];
}

/** A team: its members are on the employee records; supervision is a team property, not a layer. */
export interface TeamRecord {
  id: string;
  name: string;
  supervisors: EmployeeId[];
}

/** The signed-in employee as the org sees them. The desktop and the permission set resolve through the primary team
 *  only; the other memberships are for routing, supervision and visibility. */
export interface EmployeeRecord {
  id: EmployeeId;
  name: string;
  primaryTeam: string;
  teams: string[];
  /** Teams this employee supervises. */
  supervises: string[];
  skills: string[];
  /** P-EMPLOYEES. */
  permissionSet?: string;
}

/** The employee's chain: the record, their teams, and the profiles that apply, top to bottom. */
export interface OrgChain {
  employee: EmployeeRecord;
  teams: TeamRecord[];
  layers: OrgLayerFile[];
}

/** Where the org layers come from (P-CONFIG-LAYERS). Until P-EMPLOYEES' directory and SessionProvider the demo's
 *  persona picks the employee (`role`); P-ADMIN puts a SettingsProvider beside it as the second configuration
 *  contract. */
export interface OrgLayerProvider {
  chainFor(role: ScheduleRole): Promise<OrgChain>;
}
