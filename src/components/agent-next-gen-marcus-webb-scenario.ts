// Marcus Webb — a scripted, one-off simulated INBOUND chat originally built
// for "Agent Workspace 2.0 Premium" only. Per a later explicit request ("if
// I push the L button on the keyboard it launches Marcus Webb's contact
// [in Premium] - do this for both Phase 1 and 1B"), `AgentNextGenPage.tsx`
// ("Phase 1") and `AgentWorkspaceAdvancedPage.tsx` ("Phase 1B"/Advanced —
// now just "Phase 1", per a later explicit request that also deleted
// AgentNextGenPage.tsx entirely; see App.tsx's own routing doc comment)
// also imported from this module — but ONLY `MARCUS_WEBB_ID`/
// `buildMarcusWebbInteraction`, to arm the same "L" launch, not the rest of
// this module's exports. AgentNextGenPage.tsx's own copy of that import is
// gone along with the rest of that file; `AgentWorkspaceAdvancedPage.tsx`
// is the only one of the two still doing this. Per that request's own
// explicit follow-up ("if it's easier for now - just launch the assignment
// - I have a new case I want to wire to it"), it deliberately does NOT
// wire up Premium's own scripted Copilot walkthrough
// (`MarcusWebbCopilotCard`, the `selectedAction`/`resetSteps`/etc. fields
// below, or this module's own `saveMarcusWebbScenario`/
// `resetMarcusWebbScenario`/`loadMarcusWebbScenario` persistence) — it
// tracks its own "has this page's load already fired the L trigger"
// locally instead (a plain `useState`, not this module's shared
// `localStorage` key), since a real case is expected to replace this
// scenario's own scripted content there before any of that step-tracking
// would matter.
//
// Unlike every other interaction-creation path in `AgentWorkspace2WithDesk
// Page.tsx`'s own file (`handleStartCall`, `handleQuickDial`, `handleRedial`,
// `handleReopenContactHistoryEntry`, `handleOpenAssignmentFromNotification`),
// which all start from an AGENT action, this one starts itself there: 30
// real seconds after the agent's status reads "available" (that file's own
// trigger `useEffect`), a chat from "Marcus Webb" — locked out of his
// account after several failed password-reset attempts — lands in the left
// nav exactly like a real inbound assignment, unprompted.
// `AgentWorkspaceAdvancedPage.tsx`'s own copy of this trigger (see above)
// fires on the "L" keypress instead — see that page's own trigger
// `useEffect` (right after `agentStatus`) for why.
//
// "Separate from the customer database" (per explicit request): `Marcus
// Webb` is NOT a `CREATE_NEW_CUSTOMERS` record — `MARCUS_WEBB_CUSTOMER_ID`
// matches nothing in that array on purpose. Contact History still gets a
// real entry for him anyway, for free, the exact same way every other
// dismissed interaction does — `handleDismissInteraction`'s own
// `buildDismissedContactHistoryEntry` call doesn't care whether the
// dismissed interaction's `customerId` belongs to a real directory record,
// only that an agent message was actually sent on it (see that handler's
// own doc comment) — no separate Contact History code needed here at all.
//
// Persistence ("remembered ... (local storage)", per explicit request):
// within a single page load, an agent's action log (which option they
// picked, whether they marked the steps complete, which reply they sent)
// stays in `localStorage` via this module's `save`/`load` pair — the same
// mechanism `agent-next-gen-case-database.ts` uses for every other
// interaction — so a component re-render (or a sibling component reading
// the same key) never loses that in-progress state.
//
// ACROSS a page reload, though, this scenario is deliberately reset to
// square one every time (`resetMarcusWebbScenario()`, called from
// `AgentWorkspace2WithDeskPage.tsx`'s own `marcusWebbState` initializer) —
// per explicit report ("it should reset when the user reloads the page, I
// can't have people opening the dev console each time"). An earlier version
// of this module instead rehydrated `triggered`/`interaction`/`copilotStep`
// from `localStorage` on mount so a refresh mid-scenario would resume
// exactly where the agent left off — that's no longer the goal: this is a
// demo scenario meant to be easy to re-trigger on demand (open DevTools and
// manually clear one `localStorage` key isn't a reasonable ask of anyone
// running the demo), so a plain reload is now itself the reset action, full
// stop, with no mid-scenario-survival case to weigh against it.
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";

/** This scenario's fixed left-nav/interaction identity — reused as both
 *  `Interaction.id` (left-nav slot key) and the value every trigger/render
 *  site below checks against to know "is the active interaction Marcus's
 *  scripted one." */
export const MARCUS_WEBB_ID = "marcus-webb-scenario";
/** Deliberately NOT a `CREATE_NEW_CUSTOMERS` id — see this file's own
 *  top-of-file comment for why that's the whole point. */
export const MARCUS_WEBB_CUSTOMER_ID = "MW-DEMO-0001";
export const MARCUS_WEBB_CUSTOMER_NAME = "Marcus Webb";
/** This scenario only ever has the one channel — a chat, same channel type
 *  `Thread.id`/`.type` both use for it throughout. */
export const MARCUS_WEBB_CHANNEL_ID = "chat";

/** Which Copilot card is currently showing for this scenario — mirrors the
 *  scripted flow's own stages (per explicit request): a 3-option decision
 *  card, a follow-up steps/investigation card for whichever option was
 *  picked, a suggested-replies card once that activity is marked complete,
 *  then a final "update status and dismiss?" card once the agent's chosen
 *  reply has actually been sent. `"idle"` means the wrap-up card has been
 *  dismissed via "Not yet" — per explicit request ("if the user selects not
 *  yet, just dismiss that card do not remove the How would you like to help
 *  Marcus card"), this does NOT hide the whole Copilot card the way `"done"`
 *  does: `MarcusWebbCopilotCard`'s `nextCard` if/else chain has no branch
 *  matching `"idle"`, so `nextCard` stays `null` and only the (always-
 *  rendered, permanently resolved) decision card keeps showing — nothing
 *  else in this scenario ever transitions back OUT of `"idle"`, since the
 *  wrap-up prompt is only ever triggered once. `"done"` hides the Copilot
 *  card entirely (the agent answered "Yes" at wrap-up and the interaction
 *  was actually dismissed). */
export type MarcusWebbCopilotStep = "decision" | "detail" | "message-options" | "wrapup" | "idle" | "done";

/** The 3 options on the initial decision card, per explicit request:
 *  "1) reset the password 2) give options to reset 3) investigate for
 *  malicious activity". */
export type MarcusWebbAction = "reset" | "options" | "investigate";

export interface MarcusWebbScenarioState {
  /** Whether the 30s trigger has ever fired — checked by the trigger effect
   *  so this scripted chat only ever arrives once, not on every later
   *  available→30s-elapsed window. */
  triggered: boolean;
  /** Whether the agent has completed the final "update status and dismiss"
   *  step (or explicitly declined it) — once true, the mount-time
   *  rehydration effect stops re-inserting this interaction into
   *  `interactions` on refresh (it's over; nothing left to resume). */
  dismissed: boolean;
  /** The live `Interaction` this scenario built — persisted byte-for-byte
   *  (same reasoning as `agent-next-gen-case-database.ts`'s own
   *  `saveCaseRecord`) so a mid-scenario refresh can restore the exact same
   *  transcript, not a freshly re-synthesized one. `null` before the
   *  scenario has ever triggered. */
  interaction: Interaction | null;
  copilotStep: MarcusWebbCopilotStep;
  selectedAction?: MarcusWebbAction;
  /** Every action the agent has fully COMPLETED, in completion order,
   *  deduplicated — per explicit follow-up request ("once an item is
   *  completed keep it disabled"), refined by a further follow-up ("don't
   *  fully disable steps until they are complete (ie. the agent has sent a
   *  reply to the customer)"), and finally corrected by one more explicit
   *  follow-up ("once the step is completed (ie. the customer responds)"):
   *  an action is only added here once the CUSTOMER has actually responded
   *  to that action's suggested reply — `AgentWorkspace2WithDeskPage.tsx`'s
   *  `handleSendMessage`, inside its 2500ms simulated-customer-reply
   *  `setTimeout` (the `isMarcusWebbWrapupSend` branch), NOT at the
   *  synchronous moment the agent's own message goes out. NOT the instant
   *  it's picked off the decision card either (`handleMarcusWebbSelect
   *  Action` only ever sets `selectedAction`, below, never this array), and
   *  NOT when the detail steps/"Mark steps complete" are finished, since
   *  none of those mean the customer has actually replied yet. Unlike
   *  `selectedAction` (the CURRENT pick only, which changes if the agent
   *  switches to a different option before finishing it), this only ever
   *  grows: an action added here stays here for the rest of the scenario.
   *  The decision card (`MarcusWebbCopilotCard`, AgentWorkspace2WithDeskPage
   *  .tsx) — and, for "reset," each of its own 3 step checkboxes — both
   *  check membership in THIS array, not `selectedAction === action`, to
   *  decide their checkmark/`disabled` state, so a truly-completed option
   *  doesn't silently re-enable itself the moment the agent picks a
   *  different one afterward, while an option that's merely IN PROGRESS
   *  (picked, reply sent, but the customer hasn't responded yet) stays
   *  clickable/re-pickable. Defaults to `[]`, not `undefined` — every
   *  consumer can assume it's always a real (possibly empty) array. */
  selectedActions: MarcusWebbAction[];
  /** Set once the agent marks the "detail" card's steps/investigation as
   *  reviewed/complete — gates the composer's suggested-reply Copilot card
   *  (per explicit request, that only shows up "once the agent completes
   *  the activity"). For the "reset" action specifically, this is now set
   *  automatically the instant `resetSteps` below reads all-`true` (see
   *  `AgentWorkspace2WithDeskPage.tsx`'s own reset-step handlers) rather
   *  than via an explicit "Mark steps complete" button click — "options"/
   *  "investigate" still use that button, unaffected. */
  activityCompleted: boolean;
  /** Per-step completion for the "reset" action's own 3 scripted steps —
   *  per explicit request, each step in that card is independently
   *  clickable (performs its own real action — populates the composer,
   *  reveals reference data, generates a password) rather than being purely
   *  decorative copy under one shared "Mark Complete" button. Only
   *  meaningful when `selectedAction === "reset"`; "options"/"investigate"
   *  don't use this at all. Originally 4 steps (verify identity, generate
   *  password, send the password by email, confirm login) — the email step
   *  was removed per explicit request ("remove this step"), since step 2's
   *  own message already tells Marcus the password is on its way to his
   *  email, making a separate agent-facing "send the email" action
   *  redundant busywork. */
  resetSteps: MarcusWebbResetStepsProgress;
  /** Per-step CUSTOMER confirmation for the "reset" action's own 3 steps —
   *  distinct from `resetSteps` above (which flips true the instant the
   *  agent CLICKS a step, before anything has actually been sent or
   *  answered). Per explicit follow-up ("don't set the checked as completed
   *  until after the message is sent"), later corrected by a further
   *  explicit follow-up ("once the step is completed (ie. the customer
   *  responds)"), then finally clarified once more by a screenshot showing
   *  a real agent↔customer exchange for step 1 that still hadn't flipped
   *  the checkbox ("it's not updating in the copilot card to checked and
   *  disabled"): each step's own checkbox needs its OWN "the customer
   *  responded to THIS step's message" signal, not the single scenario-wide
   *  `selectedActions` flag (that one only fires once, at the very END of
   *  the whole "reset" flow, when the final suggested-reply/wrap-up
   *  exchange completes — see that field's own doc comment). Set from
   *  `AgentWorkspace2WithDeskPage.tsx`'s `handleSendMessage`, inside its
   *  generic (non-wrapup) simulated-customer-reply `setTimeout`: whenever a
   *  reply lands while `selectedAction === "reset"` and `copilotStep ===
   *  "detail"`, the FIRST entry in `MARCUS_WEBB_RESET_STEP_ORDER` that's
   *  `true` in `resetSteps` but still `false` here gets flipped — i.e.
   *  whichever step the agent most recently sent a message for advances on
   *  the very next reply, in order, regardless of how many steps have been
   *  clicked-but-not-yet-sent ahead of it. `MarcusWebbCopilotCard`'s
   *  reset-detail branch reads THIS (not `resetSteps` alone) to decide each
   *  checkbox's `"indeterminate"` (clicked, not yet confirmed) vs `true`
   *  (checked + `disabled`) visual state. Defaults to all-`false`, same
   *  shape/reasoning as `resetSteps` itself. */
  resetStepsConfirmed: MarcusWebbResetStepsProgress;
  /** The password generated by the "reset" flow's own step 2 — persisted
   *  (not just local component state) so a later re-render of step 2's own
   *  display keeps reading the SAME value, and so "Regenerate" can replace
   *  it in place without re-deriving anything else. `undefined` until step 2
   *  is clicked at least once. */
  resetTempPassword?: string;
  /** True from the moment the agent sends their very first message on this
   *  interaction, set once by `AgentWorkspace2WithDeskPage.tsx`'s
   *  `handleSendMessage` at the synchronous send moment (not the delayed
   *  simulated-customer-reply callback) the first time
   *  `interactionId === MARCUS_WEBB_ID` there. Originally drove the
   *  Customer Sentiment card directly (per an earlier explicit request,
   *  "after the agent responds for the first time, update the sentiment to
   *  be positive") — per a further explicit correction ("change the
   *  sentiment card after the CUSTOMER responds to the agent's first
   *  comment"), it no longer does; see `customerRespondedToFirstMessage`
   *  below for what does now. Kept purely as an internal bookkeeping flag:
   *  `handleSendMessage` still needs to know, synchronously at send time,
   *  "is this the agent's first message on this interaction" so it can
   *  snapshot that fact before it flips (same reasoning as
   *  `isMarcusWebbWrapupSend`'s own snapshot-at-send-time pattern) for the
   *  delayed simulated-customer-reply callback to read 2.5s later. Never
   *  reset back to `false` once set. */
  agentHasReplied: boolean;
  /** Per explicit request, with a screenshot of the agent's first reply
   *  landing without the Copilot card changing yet: "display the steps to
   *  reset card and change the sentiment card after the CUSTOMER responds
   *  to the agent's first comment (not triggered by reset)." Supersedes two
   *  earlier, separate signals — `agentHasReplied` alone (which drove the
   *  Customer Sentiment card at the AGENT's own send moment) and a keyword-
   *  matched `passwordResetOffered` (which looked for "reset"+"password" in
   *  the agent's own message text to reveal the KB card) — both replaced by
   *  this ONE signal, since the request folds both cards onto the same
   *  trigger. Set by `AgentWorkspace2WithDeskPage.tsx`'s `handleSendMessage`
   *  inside its delayed simulated-customer-reply `window.setTimeout`
   *  callback (not the agent's own synchronous send — this needs the
   *  CUSTOMER's simulated reply to actually land), guarded by a snapshot of
   *  `agentHasReplied` taken BEFORE that field flips at send time (so this
   *  only ever fires once, for the reply that follows the agent's
   *  genuinely first message — a customer "reply" following the agent's
   *  2nd+ message does nothing here). Read by `MarcusWebbCopilotCard` to
   *  both flip the Customer Sentiment card from Neutral to Positive AND
   *  reveal the "Password Reset Policy" knowledge-base card — the same
   *  boolean now gates both, per the request folding them onto one trigger.
   *  Never reset back to `false` once set. */
  customerRespondedToFirstMessage: boolean;
}

/** `resetSteps`' own shape — see that field's own doc comment above. Named
 *  fields (not a plain `boolean[]`) so each step's own meaning stays
 *  self-evident at every call site instead of a magic index. */
export interface MarcusWebbResetStepsProgress {
  identityVerified: boolean;
  passwordGenerated: boolean;
  loginConfirmed: boolean;
}

const DEFAULT_RESET_STEPS: MarcusWebbResetStepsProgress = {
  identityVerified: false,
  passwordGenerated: false,
  loginConfirmed: false,
};

/** Fixed step order — see `resetStepsConfirmed`'s own doc comment
 *  (`MarcusWebbScenarioState`) for why `handleSendMessage` needs this to
 *  know WHICH step a given customer reply confirms. Exported (not just a
 *  private local) so that consumer doesn't have to duplicate the 3 key
 *  names/ordering itself — this module is the one source of truth for the
 *  reset flow's own shape. */
export const MARCUS_WEBB_RESET_STEP_ORDER: (keyof MarcusWebbResetStepsProgress)[] = [
  "identityVerified",
  "passwordGenerated",
  "loginConfirmed",
];

const STORAGE_KEY = "agent-next-gen:marcus-webb-scenario:v1";

const DEFAULT_STATE: MarcusWebbScenarioState = {
  triggered: false,
  dismissed: false,
  interaction: null,
  copilotStep: "decision",
  activityCompleted: false,
  selectedActions: [],
  resetSteps: DEFAULT_RESET_STEPS,
  // Separate object literal, not a reused reference to `DEFAULT_RESET_STEPS`
  // above — purely for readability (every update spreads into a fresh
  // object either way, so a shared reference would be harmless in
  // practice), keeping the two conceptually distinct fields visually
  // distinct here too.
  resetStepsConfirmed: { identityVerified: false, passwordGenerated: false, loginConfirmed: false },
  agentHasReplied: false,
  customerRespondedToFirstMessage: false,
};

// Lazy-hydrated cache, `localStorage`-backed with a `try`/`catch` fallback
// to a plain in-memory value for the rest of the session — identical
// pattern to `agent-next-gen-case-database.ts`'s own `readCache`/
// `writeCache` (see that file for the full reasoning: private
// browsing/storage-disabled contexts, corrupt JSON, SSR/non-browser
// import-time safety).
let cache: MarcusWebbScenarioState | null = null;

function readCache(): MarcusWebbScenarioState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? { ...DEFAULT_STATE, ...(JSON.parse(raw) as MarcusWebbScenarioState) } : { ...DEFAULT_STATE };
  } catch {
    cache = { ...DEFAULT_STATE };
  }
  return cache;
}

function writeCache(next: MarcusWebbScenarioState) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Same fallback as `readCache` — the in-memory `cache` above still
    // serves the rest of this session correctly, it just won't survive an
    // actual reload.
  }
}

export function loadMarcusWebbScenario(): MarcusWebbScenarioState {
  return readCache();
}

/** Wipes this scenario back to `DEFAULT_STATE`, in both the in-memory
 *  `cache` and `localStorage` itself — called once, from
 *  `AgentWorkspace2WithDeskPage.tsx`'s own `marcusWebbState` initializer, so
 *  every fresh page load starts the scenario over rather than resuming
 *  (see this file's own top-of-file comment for why). Clearing the
 *  `localStorage` key too, not just the in-memory `cache`, matters here:
 *  without it, a stale `triggered: true` left over from an earlier page
 *  load would still exist on disk even though this particular tab's `cache`
 *  now reads fresh — a SECOND tab/reload reading `localStorage` directly
 *  (rather than through this same in-memory `cache`) would see the stale
 *  value. */
export function resetMarcusWebbScenario(): MarcusWebbScenarioState {
  cache = { ...DEFAULT_STATE };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same fallback as `readCache`/`writeCache` — nothing to clean up if
    // storage was never reachable in the first place.
  }
  return cache;
}

/** Shallow-merges `patch` onto whatever's currently stored and persists the
 *  result — every call site below reads the freshly-returned state back out
 *  rather than re-deriving it, so a chain of several patches in the same
 *  handler always builds on the truly-latest value. */
export function saveMarcusWebbScenario(patch: Partial<MarcusWebbScenarioState>): MarcusWebbScenarioState {
  const next = { ...readCache(), ...patch };
  writeCache(next);
  return next;
}

/** Marcus's own opening message — what the customer already said the
 *  moment this scripted chat "arrives," per explicit request ("Marcus is
 *  asking for help resetting his password, he has tried multiple times and
 *  now he is locked out"). */
const MARCUS_WEBB_OPENING_MESSAGE =
  "Hi, I'm trying to reset my password but it keeps failing. I've tried several times now and I think I'm locked out of my account completely. Can you help me get back in?";

/** Builds this scenario's `Interaction` from scratch — called once, by the
 *  30s trigger. `clockTick` is the same shared 1s counter every other
 *  interaction-creation handler in `AgentWorkspace2WithDeskPage.tsx` stamps
 *  onto a fresh `Thread.startTick`/`lastCustomerMessageTick` with. No
 *  `startedFresh` (on the `Interaction` OR the `Thread`) — same reasoning
 *  as `handleOpenAssignmentFromNotification`'s own new-card branch: this
 *  represents an already-existing exchange (Marcus already said his piece)
 *  arriving pre-populated, not a blank-slate agent-initiated launch, so it
 *  should render its real opening message immediately rather than
 *  `InteractionTranscript`'s empty-draft state. Also means `copilotAvailable`
 *  (`agent-next-gen-customer-info-panel.tsx`) reads true from the very
 *  first render — `!startedFresh` alone satisfies it — so Copilot is ready
 *  with its decision card the instant the agent opens this card, no
 *  separate "wait for a reply" step needed. */
export function buildMarcusWebbInteraction(clockTick: number): Interaction {
  const openingMessage: TranscriptMessage = {
    id: `marcus-webb-${Date.now()}-opening`,
    sender: "customer",
    name: MARCUS_WEBB_CUSTOMER_NAME,
    initials: "MW",
    timestamp: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    text: MARCUS_WEBB_OPENING_MESSAGE,
  };
  const channel: Thread = {
    id: MARCUS_WEBB_CHANNEL_ID,
    type: "chat",
    startTick: clockTick,
    lastCustomerMessageTick: clockTick,
    awaitingResponse: true,
    messageCount: 1,
    contactId: `MW-CONTACT-${Date.now()}`,
    // Same field every other channel's own routed-in skill uses
    // (`Thread.preview` — see `handleStartCall`'s own `preview: skillLabel`
    // for the general pattern) — surfaces as the Session Details/record-
    // header "Skill" field. Per explicit request, Marcus's chat routes to
    // General Support.
    preview: "AI Review",
  };
  return {
    id: MARCUS_WEBB_ID,
    interactionId: `MW-INTERACTION-${Date.now()}`,
    customerName: MARCUS_WEBB_CUSTOMER_NAME,
    customerId: MARCUS_WEBB_CUSTOMER_ID,
    threads: [channel],
    currentThreadId: channel.id,
    liveMessages: { [MARCUS_WEBB_CHANNEL_ID]: [openingMessage] },
  };
}

/** Per-action content for the "detail" Copilot card (the one that follows
 *  the initial 3-option decision card) and the suggested-reply card after
 *  that — per explicit request: "reset"/"options" get concrete STEPS to
 *  work through; "investigate" gets an INFORMATION summary instead (there's
 *  nothing to "complete" about reviewing a report, hence `cardKind`
 *  branching the detail card's own copy/button label below). All content
 *  here is synthesized/fictional, same "canned demo data" treatment as
 *  every other synthetic customer/interaction fixture in this app —
 *  ordinary prototype content, not real security guidance. */
export const MARCUS_WEBB_ACTION_CONFIG: Record<
  MarcusWebbAction,
  {
    /** Decision-card button label. */
    optionLabel: string;
    /** Detail-card title. */
    cardTitle: string;
    cardKind: "steps" | "info";
    items: string[];
    /** Optional standalone callout, rendered in its own warning-styled
     *  container OUTSIDE the main detail card (not mixed into `items`) —
     *  per explicit request, so a recommendation/warning line reads as its
     *  own flagged callout rather than another bullet in the activity
     *  summary. Currently only "investigate" sets this; the detail-card
     *  branch that has no `recommendation` keeps rendering `completeLabel`'s
     *  button inside the main card exactly as before. When present, the
     *  button moves into the warning container instead. */
    recommendation?: string;
    /** Detail-card's bottom button label — "Mark Complete" for an actual
     *  checklist, "Continue" for a pure information card. */
    completeLabel: string;
    /** Suggested replies offered once the detail card is marked complete —
     *  clicking one populates the chat composer (see
     *  `InteractionComposer`'s own `prefill` prop) without sending it. */
    messageOptions: string[];
  }
> = {
  // Declaration order here IS the decision card's own render order
  // (`MarcusWebbCopilotCard`'s "decision" branch maps
  // `Object.keys(MARCUS_WEBB_ACTION_CONFIG)` straight into buttons, no
  // separate ordering array) — per explicit request: investigate first,
  // options second, reset last.
  investigate: {
    optionLabel: "Investigate for malicious activity",
    cardTitle: "Account activity for Marcus",
    cardKind: "info",
    items: [
      "5 failed login attempts in the last 12 minutes",
      "Attempts originated from 3 different IP addresses (192.0.2.14, 203.0.113.88, 198.51.100.23)",
      "No prior login history from any of these IP addresses",
      "No other recent suspicious activity — no data changes, no new devices added",
    ],
    recommendation:
      "Recommendation: treat as a probable brute-force attempt — reset the password AND enable step-up verification before restoring access",
    completeLabel: "Continue",
    messageOptions: [
      "Hi Marcus, thanks for your patience — I reviewed your account and reset your password for security, since I noticed some unusual login attempts. You'll also see an extra verification step at your next login to help keep your account safe.",
      "I found a few unusual login attempts on your account, so I've reset your password and added extra verification for your protection. You're all set to log back in.",
    ],
  },
  options: {
    optionLabel: "Give options to reset",
    cardTitle: "Reset options for Marcus",
    cardKind: "steps",
    items: [
      "Confirm Marcus's verified email and phone number on file",
      "Walk him through the self-service options: emailed reset link, SMS one-time code, or security questions",
      "Let Marcus choose which method he'd like to use",
      "Confirm he received it and was able to reset successfully",
    ],
    completeLabel: "Mark steps complete",
    messageOptions: [
      "Hi Marcus, you've got a few ways to reset it yourself: an emailed link, a text code, or your security questions. Which would you like to use?",
      "No problem, Marcus — I can send a reset link to your email or a one-time code to your phone right now. Which do you prefer?",
    ],
  },
  reset: {
    optionLabel: "Reset the password",
    cardTitle: "Resetting Marcus's password",
    cardKind: "steps",
    items: [
      "Verify Marcus's identity (date of birth or last 4 of SSN on file)",
      "Generate a secure temporary password",
      "Confirm Marcus can log in, then prompt him to set a new password",
    ],
    completeLabel: "Mark steps complete",
    messageOptions: [
      "Hi Marcus, I've reset your password and sent a temporary one to your email on file — you'll be prompted to create a new password the moment you log back in. Let me know if you run into any trouble!",
      "Thanks for your patience, Marcus. Your password has been reset — check your email for a temporary password and the next steps to finish setting a new one.",
    ],
  },
};

/** Customer's wrap-up reply once the agent sends one of the suggested
 *  messages above — same "canned, not a real conversation engine"
 *  treatment `CUSTOMER_AUTO_REPLY_POOL` already gets in
 *  `agent-next-gen-transcript.tsx`, just scenario-specific instead of
 *  randomly picked, since this reply needs to read as a direct response to
 *  THIS particular resolution rather than a generic one. */
export const MARCUS_WEBB_THANKS_MESSAGE =
  "Thank you so much for your help! I'm back in now. I really appreciate you sorting this out so quickly.";

// ── "reset" action's 3 clickable steps (per explicit request) ──
// Each step below performs its own real action when clicked (composer
// prefill, revealing reference data, generating a password) rather than
// being static copy under one shared "Mark Complete" button — see
// `MarcusWebbScenarioState.resetSteps`'s own doc comment. Deliberately
// scoped to "reset" only; "options"/"investigate" keep the original generic
// items-list + button card unchanged.
//
// This used to be 4 steps, with a step 3 ("send the temporary password to
// Marcus's verified email on file") that opened a dedicated email `Thread`
// on Marcus's interaction and populated it with an email-template composer
// prefill. Removed per explicit request ("remove this step") — step 2's own
// message already tells Marcus the password is on its way to his email, so
// a separate agent-facing "send it" click was redundant. The email-specific
// plumbing that only existed to support it (`MARCUS_WEBB_EMAIL_CHANNEL_ID`,
// `MARCUS_WEBB_EMAIL_ADDRESS`, `buildMarcusWebbResetEmailTemplate`) was
// removed along with it, rather than left as dead exports.

/** Synthetic, already-redacted — same "canned demo data" treatment as
 *  every other piece of fictional content in this scenario (see
 *  `MARCUS_WEBB_ACTION_CONFIG`'s own doc comment); displayed in the Copilot
 *  card itself (agent-facing reference data) once step 1 is clicked, NEVER
 *  sent to the customer via any composer prefill below. */
export const MARCUS_WEBB_REDACTED_SSN = "•••-••-4821";

/** Step 1's composer prefill — asks Marcus to confirm identity, never
 *  echoes `MARCUS_WEBB_REDACTED_SSN` back to him (that value is for the
 *  agent's own reference only). */
export const MARCUS_WEBB_RESET_VERIFY_MESSAGE =
  "Hi Marcus, before I can go any further, can you confirm your date of birth or the last 4 digits of the SSN we have on file for you?";

/** Step 2's composer prefill — confirms a password is being generated
 *  without stating it in chat; the real value is only ever sent to Marcus's
 *  email on file (real support practice: never send a password over chat),
 *  handled as an implicit part of this step rather than its own separate
 *  agent click. */
export const MARCUS_WEBB_RESET_PASSWORD_GENERATED_MESSAGE =
  "Thanks, that checks out. I'm generating a secure temporary password for you now and sending it straight to your email on file — you'll have it in just a moment.";

/** Step 3's composer prefill, sent on the chat channel once the password's
 *  gone out (see step 2's own message above). */
export const MARCUS_WEBB_RESET_LOGIN_CONFIRM_MESSAGE =
  "Hi Marcus, you should be all set! Try logging in with the temporary password I just sent to your email, and you'll be asked to set a new password right away. Let me know if you run into any issues.";

const PASSWORD_WORDS = ["Falcon", "Harbor", "Ember", "Quartz", "Meadow", "Comet", "Cedar", "Lantern"];
const PASSWORD_SYMBOLS = ["!", "#", "$", "%", "&", "*"];

/** Generates one plausible-looking temporary password for the "reset"
 *  flow's own step 2 — purely cosmetic/demo content (a word + 4 digits + a
 *  symbol), not a real secure-generation algorithm; re-called as-is by the
 *  "Regenerate" affordance next to step 2's own display. */
export function generateMarcusWebbTempPassword(): string {
  const word = PASSWORD_WORDS[Math.floor(Math.random() * PASSWORD_WORDS.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  const symbol = PASSWORD_SYMBOLS[Math.floor(Math.random() * PASSWORD_SYMBOLS.length)];
  return `${word}${digits}${symbol}`;
}
