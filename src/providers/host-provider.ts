// The host seam (P-EXTRACT, for P-EMBED). Types only. The Workspace runs
// standalone today; embedded in another app (a CRM, a ticketing tool) it
// gets its session and its current customer/case from that host and can
// post back to it. Like every provider, every method is async.

/** Who is signed in, as the host knows them. */
export interface HostSession {
  agentId: string;
  displayName: string;
}

/** What the host is showing: the record the Workspace should follow. Both
 *  absent standalone, where the Workspace's own selection is the context. */
export interface HostContext {
  customerId?: string;
  caseId?: string;
}

/** A message to the host (e.g. "a contact ended, open its record"). */
export interface HostMessage {
  type: string;
  payload?: unknown;
}

export type HostKind = "standalone" | "embedded";

export interface HostProvider {
  readonly hostKind: HostKind;
  getSession(): Promise<HostSession>;
  getContext(): Promise<HostContext>;
  /** Standalone has no host: a no-op. */
  postToHost(message: HostMessage): Promise<void>;
}
