import type { ChannelKind } from "../domain";

// The scenario script format (P0.7). One script = one scripted case: who the
// customer is, what they and the other parties say and when, what the agent's
// decisions branch into, and the case content the agent UI shows. Plain data,
// JSON-serializable by construction (no functions, no JSX), so profile packs
// and the console can load it. The scenario player (P0.5c) plays `steps` and
// `branches` against the engine; the console's canned-lines panel (P0.6)
// lists the customer lines. Types only here: validation and the helpers that
// turn steps into `SimCustomerAction`s are in ./validate.ts.

export type ScenarioSpeaker = "customer" | "bot" | "agent";

/** What a step's `at` counts from. `launch` is the default; `answered` is
 *  when the agent accepts (or the call auto-answers); `takeover` is when the
 *  agent takes the contact over from the bot. Steps in a branch count from
 *  the moment the branch starts and take no anchor. */
export type ScenarioAnchor = "launch" | "answered" | "takeover";

interface StepBase {
  /** Unique within the script (main steps and every branch). */
  id: string;
  /** Milliseconds after the anchor. Negative (launch anchor, `say` and
   *  `event` only) means it already happened when the contact arrived: the
   *  player seeds it into the transcript, in the past, without playing it. */
  at: number;
  anchor?: ScenarioAnchor;
  /** Plays only on these channels (e.g. "Chat started" on chat). */
  onlyOn?: ChannelKind[];
  /** `false` keeps a customer line out of the console's canned-lines panel. */
  canned?: false;
  /** Plays only when the condition holds. `note-addresses-customer`: the
   *  branch's note tells the bot to say something to the customer
   *  (`noteAddressesCustomer`, ./note-rules.ts); otherwise the step is
   *  skipped, so an internal instruction gets no customer-facing reply. */
  onlyIf?: "note-addresses-customer";
}

export type ScenarioStep = StepBase &
  (
    /** A line. On a digital channel a Message, on voice an Utterance, so the
     *  same script runs as chat or voice. A customer `say` is a
     *  `SimCustomerAction` message (digital) or speak (voice); a bot or agent
     *  `say` is a scripted party the player emits itself. */
    | { kind: "say"; speaker: ScenarioSpeaker; text: string }
    /** A typing indicator from `at` for `durationMs`. Digital channels only:
     *  ignored on voice (not an error), so a chat script runs as voice. */
    | { kind: "typing"; speaker: ScenarioSpeaker; durationMs: number }
    /** A system line in the thread ("Chat started", "Order placed"). */
    | { kind: "event"; text: string }
    | { kind: "hangUp" }
    /** A presentation beat: `instruction` is an interstitial row (`text`,
     *  `by`, `link` = side-panel key); `approval` and `wrap-up` are cards
     *  (`ref` into `content`); `close` closes the chat; `dismiss`
     *  unassigns it. `unlessTakenOver` (wrap-up, dismiss): only if the agent
     *  never took over. instruction, approval and wrap-up become a `Message`
     *  with an `annotation`. */
    | {
        kind: "beat";
        beat: "instruction" | "approval" | "wrap-up" | "close" | "dismiss";
        ref?: string;
        text?: string;
        by?: string;
        link?: string;
        unlessTakenOver?: true;
      }
  );

/** What the agent's decision sets off. `{note}` in a step's text is replaced
 *  with what the agent typed, and `{name}` with the decision's `vars.name`,
 *  only in a branch that lists the input. */
export interface ScenarioBranch {
  label: string;
  /** `note` (what the agent typed) or the names of other values the
   *  decision carries. */
  inputs?: string[];
  /** `action`: started directly by an agent-UI action outside the thread
   *  (e.g. a next-best-action card step), not by a decision or wrap-up card. */
  trigger?: "action";
  steps: ScenarioStep[];
}

export interface ScenarioStart {
  /** Per-channel address overrides; the rest derive from the entity. */
  addresses?: Partial<Record<ChannelKind, string>>;
  /** Custom pre-contact summary lines (voice). */
  summary?: string[];
  /** `agent`: offered and rings until the agent accepts. `auto`: answered at
   *  once, no accept or decline. `delivered`: routed to the agent already
   *  connected (bot-handled cases), no ring. */
  answer: "agent" | "auto" | "delivered";
  /** Delivered in review: the bot handled it, the agent reads along until
   *  they take over. The engine reports it as `Interaction.review`. */
  review?: true;
  /** The contact started this long before launch (sets its wait clock). */
  ageMs?: number;
}

export interface ScenarioEntity {
  /** Stable key for canned lines; also the card id the pages use today. */
  key: string;
  name: string;
  caseId: string;
  /** The directory record, if the customer has one. */
  directoryId?: string;
  phone?: string;
  email?: string;
}

export interface ApprovalDecisionContent {
  /** Also the key of the branch this decision starts. */
  value: string;
  title: string;
  description?: string;
  noteLabel?: string;
  notePlaceholder?: string;
  callRequest?: boolean;
  suggestions?: string[];
  suggestionLinks?: Record<string, string>;
  suggestionReplacements?: Record<string, string>;
  panel?: {
    headline: string;
    description: string;
    memory: string;
    card: { title: string; sub: string };
    article?: { label: string; link: string };
    confirmLabel: string;
  };
  repeatable?: boolean;
  result: string;
}

/** An approval-request or escalation card. Structurally the same as the
 *  agent UI's `TranscriptApprovalSummary` (a test keeps them assignable), but
 *  declared here so scripts import nothing from components. */
export interface ApprovalCardContent {
  title: string;
  headline: string;
  description: string;
  checklist: { label: string; detail: string; status: "done" | "attention"; badge?: string; link?: string }[];
  memoryTitle: string;
  memory: string[];
  sentimentLabel: string;
  sentimentValue: string;
  sentimentLevel: number;
  hideDetails?: boolean;
  decisions?: ApprovalDecisionContent[];
}

export interface WrapUpContent {
  title: string;
  summary: string;
  disposition: string;
  buttonLabel: string;
  /** The branch that plays when the agent completes the wrap-up. */
  completeBranch?: string;
}

/** What the agent UI shows for the case. Strings and arrays only. */
export interface ScenarioContent {
  /** Side-panel keys the content may link to (`[label](key)`, `link`s).
   *  The panel bodies are components, keyed by these. */
  panelKeys: string[];
  overview?: {
    subtitle: string;
    tags: string[];
    detailedSummary: string[];
    realTimeSummary: string;
    snapshot: string[];
    nextBestAction?: string;
  };
  caseContext?: {
    priority: string;
    status: string;
    incident: string;
    pinned: string[];
    profile: string;
    memory: string[];
  };
  copilot?: {
    suggestions: string[];
    /** Chip label → panel key. */
    links: Record<string, string>;
    /** A used chip is swapped for this one. */
    replacements?: Record<string, string>;
  };
  approvals?: Record<string, ApprovalCardContent>;
  wrapUps?: Record<string, WrapUpContent>;
}

export interface ScenarioScript {
  version: 1;
  id: string;
  title: string;
  summary: string;
  entity: ScenarioEntity;
  /** The default channel. A launch can override it (`channel` on the player
   *  and the helpers), so the same script runs as chat or voice. */
  channel: ChannelKind;
  /** The skill the contact is routed to: its display name and, when the
   *  engine has one by that name, its id. */
  skill: { name: string; id?: string };
  /** Display names for the scripted parties. The agent's defaults to the
   *  signed-in agent. */
  participants?: { bot?: string; agent?: string };
  start: ScenarioStart;
  /** A dev-launcher hint (today's hotkeys); the format doesn't depend on it. */
  launch?: { hotkey?: string };
  steps: ScenarioStep[];
  branches?: Record<string, ScenarioBranch>;
  /** Extra canned lines for the console, beyond the customer `say` steps. */
  canned?: { label?: string; text: string }[];
  content: ScenarioContent;
}
