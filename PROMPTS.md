# Agent Workspace Simulation — Step Prompts

**Target repo:** `~/GitHub-Local/agent-next-gen-demo` — run every session from that directory. lyra-ui (`~/GitHub-Local/lyra-ui`) is consumed through the Vite source alias; steps that touch shared components edit it in place, and only when the prompt explicitly authorizes it (CLAUDE.md forbids unrequested lyra edits).

How to use: one step per fresh Claude Code session (or `/clear`). Paste the step's prompt in **plan mode** (Shift+Tab) with the "Plan" model. To approve with changes, type them in the plan box's comment field and press Enter; pick "Yes" on the revised plan. To implement on a different model than you planned with, press Esc at the approval prompt, `/model`, then type `Implement the approved plan.` Finish every step with WRAP-UP. Model names are roles — **Opus = architect**, **Sonnet = implementer**.

Default split: **Plan: Opus · Implement: Sonnet.** Steps marked **Implement: Opus** are architecture-defining or large-refactor steps. Escalate any step to Opus if a bug survives two Sonnet attempts. Use **"manually approve edits"** on steps marked ✋ (they edit the big page files or lyra-ui); auto mode is fine elsewhere.

**Code layout (established in P0.1–P0.4):** `src/domain/` (domain types, types only) · `src/providers/` (provider contracts, types only) · `src/adapters/<impl>/` (implementations: `placeholder/`, `sim/`, later `twilio/`, `cxone/`) · `src/provider-context/` (React context, hooks, `IfCapable`) · `src/profiles/` (ContactCenterProfile) · `src/data/` (DatabaseHandle). Dev handles: `window.__providers`, `window.__simCustomer` (until P0.6).

**Browser checks** are listed for you to run (Claude Code can't see your browser). Prompts end with "list browser checks for me" where one is needed.

Execution order below differs from PLAN.md's numbering where it reduces risk. Step labels reference PLAN.md's numbering.

---

## Universal follow-ups

**IMPLEMENT** (only needed if you approved with Esc instead of "Yes"):
```
Implement the approved plan. Keep edits to the files you listed. If you need to touch anything else, stop and tell me why before doing it. Verification scaled to risk: type-check always; run the test suite (npm test) when the step touches providers, adapters or the store; list any browser checks for me rather than skipping them.
```

**WRAP-UP** (end of every step — Sonnet is fine):
```
Wrap up this step: run the type-check and the test suite, update PROGRESS.md (done / deferred / decisions made / known gaps / browser checks pending), add any new decisions to the Decisions section of PLAN.md, and commit with the message "Phase <X> step <N>: <one-line summary>".
```

**BUG LOOP:**
```
<describe what you see>. Reproduce it first, find the root cause before changing anything, explain the cause in two sentences, then fix it. Don't work around it.
```

---

## Done

- **P-SETUP** — CLAUDE.md, PROGRESS.md.
- **P0.1** — domain model (`src/domain`), legacy mapping note.
- **Chores** — tsc resolves lyra-ui (baseline 4 app / 3 lyra); lyra sync review; voice-call-controls decision (keep the app's local file); 27 app errors fixed; ContainerHeader `title: ReactNode` + `titleText` (lyra).
- **P0.2** — provider contracts (`src/providers`), incl. extra commands, `ProviderError`, `listOutboundSkills`.
- **P0.3** — provider context, StrictMode-safe provider cache, `IfCapable`, `window.__providers`.
- **P0.4** — `SimulatedInteractionProvider` + `SimEngine` + `SimTransport` (`src/adapters/sim`), browser-verified.
- **P0.8, P0.5.0, P0.5a, P-CHORE-TICK, P0.5b.1, P0.5b.2** — see PROGRESS.md.
- **P0.5d.1** — provider wiring for voice controls, incoming tile and the inline wrap-up card (see PROGRESS.md); the prompts below for 5d.2 build on it.

**Execution order (revised 2026-10-15):** finish 5d.1 → P0.7 → P0.5c → P-SETTINGS → P0.5d.2 → P0.9.1–9.3 → P0.6 → Phase 1 (incl. P1.4a, P1.4b) → Phase 2 → Phase 3 → Phase 4 (incl. P4.4a, P4.11) → remaining verticals → Phase 5 (incl. P5.6, P5.7) → Phase 6 → Phase 7 → P-ADAPTER sequence.

---

## Phase 0 — remaining

### P-REALIGN — Sync PLAN.md and PROGRESS.md to this file   (Sonnet · Sonnet) — run first
```
Read CLAUDE.md, PLAN.md, PROGRESS.md and PROMPTS.md (I just replaced PROMPTS.md with a revised version). Docs-only realignment, no code changes. Update PLAN.md's phase bodies (leave the Decisions section untouched) and PROGRESS.md's step table so they match PROMPTS.md and the decisions already recorded:
- Phase 0: step 2 lists the full command set, ProviderError and listOutboundSkills; step 4 lives in src/adapters/sim with __simCustomer as a stand-in until step 6; add step 5.0 "Interaction store + view-model adapter" before 5a; step 5a also authorizes the lyra AgentProfile change; add step 5d "Voice bar, incoming tile and wrap-up onto the provider"; step 7 (scenario format) now runs before 5c.
- Phase 2: add step 0 "Render performance pass" before step 1.
- Phase 3: audio stops when an interaction's state leaves active/held, not on ended; MediaProvider has no speak() — the sim media provider drives TTS from transcript events itself.
- Phase 4: compliance gates are added to the AssistCard contract in step 5; cards and extracted fields arrive as AssistProvider events.
PROGRESS.md: mark done steps done, keep Known gaps and Deferred as they are. Commit "Docs: realign PLAN and PROGRESS with revised PROMPTS".
```

### P0.8 — Contract test suite   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 8 (contract tests), pulled forward before step 5. In plan mode, propose a test runner that fits this Vite project, and a contract suite parameterized by any InteractionProvider factory that runs incoming → accept → message → hold → end → completeWrapUp, asserting events and state transitions, plus: ack-before-event ordering, idempotent no-op commands (no event), "not-supported" for every command whose capability is false, "invalid-state" and "not-found" cases, ended reasons including customer hang-up and transfer through wrap-up, and dispose() rejecting pending and later calls. Run it against SimulatedInteractionProvider with an in-memory transport and zero latency. Also include the provider-cache lifecycle tests noted in PROGRESS.md (StrictMode remount reuses the set, real unmount disposes, key change swaps sets). Done = suite passes, runs with one npm script (npm test), and PLAN.md records it as the bar every future adapter must pass. Don't write code yet.
```

### P0.5.0 — Interaction store + view-model adapter   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5.0 — the layer every migration needs before any page can consume provider state. In plan mode, propose a store in src/provider-context/ that subscribes to the active InteractionProvider, hydrates via getSnapshot()/getTranscript() on mount, applies snapshot events by upsert-by-id (idempotent, replay-safe), and exposes hooks (e.g. useAgentState(), useInteractions(), useInteraction(id), useTranscript(id)). Plus a pure adapter that builds the pages' existing view model — the left-nav card Interaction with threads[] — by grouping domain Interactions on journeyId (per the P0.1 decision), so pages can switch one feature at a time without changing their render code. Components consume hooks, never the store object. No page changes yet. Done = hooks work against the sim (tests with the in-memory transport cover hydrate, upsert, ended, and the view-model grouping); npm test passes. Don't write code yet.
```

### P0.5a — Agent leg onto the provider   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5a. I'm explicitly authorizing a lyra-ui change for this step. In plan mode, propose: (1) in lyra AgentProfile, add optional controlled props (agent-leg status + an onAgentLegToggle callback) so it can display external state, keeping today's uncontrolled behavior when they're absent — backward compatible, with a story; (2) in the app, drive it from useAgentState() and connectAgentLeg/disconnectAgentLeg, gated with IfCapable on capabilities.interaction.agentLeg; (3) retire the in-memory agent-next-gen-agent-leg-state module once nothing uses it. Preserve current behavior exactly: connected on fresh load, no toast on load, toast only on real disconnect/reconnect (driven by stateChanged leg transitions, not a first-render flag), status carries across tier switches (the provider cache keeps the set alive across page swaps — confirm). Also decide whether voice dial requires leg "connected" (deferred from P0.4). Grep page files; targeted edits. Commit lyra and app separately. Done = behavior identical, npm test passes, no setTimeout left in AgentProfile's leg path; list browser checks for me. Don't write code yet.
```

P0.5b was split in two (2026-10-14). Once cards come from the store, every path that creates or changes a card must go through the provider, not just dial. 5b.1 lays the provider groundwork with no page changes; 5b.2 moves the pages.

### P0.5b.1 — Provider groundwork for store-backed nav cards   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5b.1. No page changes. In plan mode, propose: domain Interaction gains caseId, contactName and acceptedAt; InteractionProvider gains reopen(ReopenRequest) behind capabilities.reopen; DialRequest gains addressLabel and contactName; the one-active-voice-contact rule (with hold, whichever voice contact becomes active holds the others; without hold, a second live voice contact rejects invalid-state); a sim seed fixture (SIM_DEMO_SEED: the notification assignments as offered, routed contacts, loaded once per engine) passed by the sim factory; and buildNavCards changes (offered contacts excluded, contacts on one thread key folded with reopenedContacts, Thread.providerInteractionId, card entityId, customerId from caseId, startTick from acceptedAt). Contract tests for all of it, a drift test tying the seed to the page's notification fixtures, and view-model tests. Done = npm test passes; tsc at baseline. Don't write code yet.
```

### P0.5b.2 — Pages onto store-backed nav cards   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5b.2; 5b.1 is committed. In plan mode, propose moving both AgentWorkspace2WithDeskPage and AgentWorkspaceAdvancedPage onto store-backed nav cards, following PLAN.md's "P0.5b.2 design" decision: a shared useNavCards (store cards + UI overlay + page-local scenario cards, patchCard in place of setInteractions), a shared useOutboundDial for every dial and redial path, accept/reopen/associateEntity for notifications, Contact History, Search and customer linking, and the journeyId re-key inventory done in one change. Hold, hang-up and Unassign & Dismiss move onto hold/end/completeWrapUp because the store owns state; if the plan gets too large to review comfortably, split those three into a 5b.3. Also make the sim latency adjustable for demos. List Desk's visual before/after (rows 12 and 13) for approval. Grep; targeted edits; both pages share one path. Done = every card behaves as today, driven entirely by provider events (no optimistic local state); npm test passes; list browser checks for me, including: seed contacts appear once after Advanced ↔ Desk switches, carried-over timers keep their elapsed time, a second call auto-holds the first, and a reopen folds into the existing thread. Don't write code yet.
```

### P0.5d.1 — Voice controls, incoming tile and wrap-up card (provider wiring)   ✋ (Plan: Opus · Implement: Opus) — done
The original P0.5d prompt was split (2026-10-14). 5d.1 is done; see PROGRESS.md and PLAN.md Decisions for what it built (controlled voice controls, `IncomingOfferActions`, the inline wrap-up card, per-channel drafts, hold chips, recording dot, one call per customer, inbound skill and pre-contact summary).

### P0.5d.2 — Parity convergence + layout slots   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5d.2. 5d.1 is committed. In plan mode, propose, in shared code first:
- Layout slots: a <LayoutSlot anchor="voice-bar" | "incoming-tile" | "right-panel" | …> component that each page places once; the voice bar, the incoming tile and the right panel mount through it instead of inline JSX, so Phase 7's LayoutConfig can move them without page edits. Phase 1 and Phase 2 pass their current anchors; no visual change from this alone.
- Row 1 and 6: Desk's persistent voice bar outside the card view (visible on Home too), with the "View Transcript?" confirm.
- Rows 7, 8, 9, 23: one CONTACT_HANDLING_FLAGS + capabilities replacing the per-page SHOW_* constants (End Call on both pages; Consult/Transfer, kebab and add participant capability-gated; Outcome always visible on voice rows).
- Row 20: remove Desk's hover-preview Outcome entry point.
- Row 21: opening a notification expands the left nav on both pages.
- Row 11: the voice icon in the record header on both pages.
- Row 14, closing the exception: Phase 1 adopts Phase 2's full New Outbound launcher (groups, search, Favorites) with the Agents, Skills and My Team groups removed on both pages (PLAN.md "Settings and configuration": New Outbound is customers and external numbers only; Skills stays only as the dial's outbound skill picker). "Call previous agent" moves to the Contact History row as a consult action placeholder until P0.9.
- Scripted scenario cards are on the provider after 5c, so no scenario exceptions remain.
For every visual change on either page, give a before/after and wait for my approval. Done = both pages behave identically apart from tabs, panels and home; npm test passes; type-check at baseline; list browser checks for me. Don't write code yet.
```

### P-SETTINGS — Persistent demo settings   (Plan: Opus · Implement: Sonnet) — after P0.5c
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. Chore: persistent demo settings (PLAN.md "Settings and configuration"). In plan mode, propose: (1) inventory the Settings page on both pages: every setting, what it controls, live or placeholder — report before proposing; (2) a shared settings store next to src/provider-context/ with useSetting/useSettings hooks both pages read, no page-local setting state, settings apply immediately; (3) localStorage, keyed per tier, versioned (a changed setting type falls back to its default), surviving reloads and closed tabs, cleared only by "Reset to defaults" on the Settings page, every read/write in try/catch with defaults when storage is unavailable; (4) say which settings belong with profile/database data (P1.4) and keep them out; (5) a Connections section skeleton (one row per seam, "Simulated" status, Test/Save disabled until adapters exist) so later steps have somewhere to land. No visual changes except making dead settings work; before/after for any setting that changes layout. Tests for the store (defaults, persistence, reset, version fallback, unavailable storage). List browser checks. Don't write code yet.
```

### P0.9.1 — Transfer/merge contract, directory, messaging, participants   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 9.1 (PLAN.md Phase 0 §9). No page changes. In plan mode, propose: capabilities transfer.consult, conference.merge, conference.split, assist.monitor/whisper/barge; Interaction.participants[] with role/state/joinedAt and participant events; the engine's consult (customer holds, target rings, complete/merge/cancel), merge of two calls into one conference interaction (originals end with reason "merged"; split restores them), transfer ending with reason "transferred" and the target; a DirectoryProvider contract (listAgents, listQueues, listSupervisors, getPresence, presenceChanged) with a sim that serves the New Outbound fixtures and changes presence on its own; a MessagingProvider contract (threads, messages, presence; hand-raise threads carry contact context) with a sim that has a simulated supervisor replying after a delay; placeholders for both; the virtual agent listed in the directory as a transfer target (stub until Phase 6). Contract suites for both new providers; the interaction suite gains consult/merge/split cases gated on capabilities. Done = npm test passes; tsc at baseline. Don't write code yet.
```

### P0.9.2 — Consult strip, hand raise, messaging drawer, participants UI   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 9.2; 9.1 is committed. In plan mode, propose, in shared code for both pages: the consult strip under the voice bar ("Consulting <name> · mm:ss", Complete transfer / Merge / Cancel) and a target picker over DirectoryProvider; "Merge with <other call>" from a held card's chip menu and the bar; hand raise on the voice bar and the chat composer row (hand chip on the nav row; opens the messaging drawer on a supervisor thread prefilled with contact context; supervisor monitor/whisper/barge/take-over gated by capability); the messaging drawer (top-bar toggle, available without assignments, tabs per thread, unread badge, pop-out, never changes the active assignment); the nav card's participant-count badge (try the statusBadge slot first); the record header's participant avatar switcher driving the right-hand panels (agent participant → presence card); the transcript labeled by speaker; the wrap-up card taking one disposition per customer participant. Before/afters for every visual change; lyra changes only with my authorization. Done = blind transfer, consult→complete, consult→merge, merge of two held calls, split, hand raise and a teammate chat all work against the sim on both pages; npm test passes; list browser checks for me. Don't write code yet.
```

### P0.9.3 — Agent console window   (Plan: Opus · Implement: Sonnet) — after P0.6
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 9.3. In plan mode, propose #/agent-console?as=<agentId>: a second agent desktop (same Vite app) attached to the agent window's sim session through the P0.6 discovery handshake, acting as that directory agent or supervisor. A transfer rings there and accepting removes it here; a consult or merge shows the participants in both windows; a hand raise opens there as the supervisor with the context card. Done = the two-window demo runs end to end; list browser checks for me. Don't write code yet.
```

### P0.6 — Customer console route   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 6. In plan mode, propose a #/customer-console route (same Vite app, lyra-ui styling) built on the sim protocol's SimCustomerAction messages (startInbound, message, typing, hangUp), replacing window.__simCustomer. Solve engine discovery across windows: the engine lives in the agent window and is session-scoped by sessionId, so the console needs a way to find active sessions (e.g. an announce/hello message) and pick one. The console lists that session's interactions, can attach to one, or start an inbound one "as <entity>" or "as unknown caller" (free phone/name entry), carrying identifiers and pre-contact context. The console must not render inside ProviderRoot's agent providers and the agent UI must not know it exists. No chat/voice UI yet — shell and handshake only. Done = the console in a second window sees the agent's session and starting an inbound contact produces an incoming offer in the agent app; list browser checks for me. Don't write code yet.
```

### P0.7 — Scenario script format   (Plan: Opus · Implement: Sonnet) — before 5c
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 7, run before 5c so the scenario player is built once against this format. In plan mode, propose a TS/JSON scenario format — customer lines per entity per channel, optional timing hints, expressed as SimCustomerAction-compatible steps — loadable by the engine's scenario player (5c) and the console's canned-lines panel, and port the Marcus Webb scenario into it as data (no player yet). Done = Marcus Webb's script validates against the format type; npm test covers loading it. Don't write code yet.
```

### P0.5c — Scenario player; retire page timers   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5c. In plan mode, propose a scenario player inside SimEngine that plays P0.7-format scripts as customer actions and transcript/message events on schedule (paused on hold, stopped when the interaction leaves active/held), and migrate the Marcus Webb scenario's inline page timers onto it so pages only render events via the P0.5.0 hooks. Keep scenario content unchanged. Done = Marcus Webb replay looks identical; no scenario setTimeouts remain in page components; npm test passes; list browser checks for me. Don't write code yet.
```

---

## Phase 1 — Vertical profiles and database management

### P1.1 — ContactCenterProfile type and registry   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 1. In plan mode, propose expanding the stub ContactCenterProfile in src/profiles/ into the full type — terminology (entity name and labels), schema (entity fields + related collections with status vocabularies), generators, scenario scripts (P0.7 format), intent pack (Tier 1 patterns/slots, Tier 2 tools + system prompt), compliance behaviors, dispositions, handoff-snapshot template — and a registry under src/profiles/verticals/. Define a "telecom" profile describing the data the app uses today and make it the active profile instead of PLACEHOLDER_PROFILE. Done = type compiles, registry resolves "telecom", the provider context exposes it, nothing visible changes. Don't write code yet.
```

### P1.3 — Generator engine   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 3. In plan mode, propose a shared deterministic synthetic-data engine (seeded RNG, distributions, date ranges, status mixes, name/address pools) producing domain Entity and RelatedRecord values, with per-collection generators supplied by profiles and "showcase" records that are guaranteed to exist. Implement the telecom generators: entities, payments (mostly succeeded, some declined, occasional refund), lines/plans, outages, interaction history (as past domain Interactions per the P0.1 decision). Done = generating 500 telecom entities with histories is fast and reproducible for a given seed; Marcus Webb exists as a showcase record with at least five declined payments; npm test covers determinism. Don't write code yet.
```

### P1.4 — Named databases + SimulatedCustomerDataProvider   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 4. In plan mode, propose IndexedDB (Dexie) named databases behind the DatabaseHandle in src/data/, each tagged with its profile id, and SimulatedCustomerDataProvider in src/adapters/sim/ implementing the full CustomerDataProvider contract — including findNearMatches, getContactHistory, and getCollection(name, query) with status/limit/sort/since/until/minAmount — emitting entityChanged/collectionChanged. Wire it into the sim provider set via the factory's database dep; create, switch, export/import JSON, reset-to-demo. Add a CustomerDataProvider contract suite alongside P0.8's. Done = a telecom database generates, persists across reload, and the provider answers queries; npm test passes. Don't write code yet.
```

### P1.4a — Interaction history persistence   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 4a (PLAN.md Phase 1 §4a). In plan mode, propose: CustomerDataProvider.recordInteraction, called by the engine on completeWrapUp with the finished interaction (participants, duration, outcome, disposition, tags, summary, transcript, end reason), emitting collectionChanged("interactions"); Home's Contact History, the customer panel's history accordion and the Details-panel transcript tab for earlier journey contacts read from getContactHistory; the page-side "Today" row goes away; reopen pulls the real prior transcript; unknown callers get a provisional record until linked; export/import JSON includes history. Contract test: a completed wrap-up appears in getContactHistory(entityId). Done = a dialed, wrapped-up call shows in Home history with its outcome and transcript after a reload; list browser checks for me. Don't write code yet.
```

### P1.4b — Native tickets   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 4b (PLAN.md Phase 1 §4b). In plan mode, propose tickets as a related collection on every profile's schema (id, title, status, priority, owner, the contact that opened it, notes), linked to the interaction that opened them and every contact that touches them; "Create ticket" on the wrap-up card carrying summary and disposition; the ticket visible on history rows and the customer panel; getCollection("tickets", …) answering P4-style queries. Mapping to a vendor ticketing system is a later connection under the sync rules; here just keep externalId free for it. Done = a ticket created from wrap-up shows on the customer and in Contact History; list browser checks for me. Don't write code yet.
```

### P1.8 — Route existing screens through the data provider   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 8. In plan mode, propose routing buildCustomerContextOverviewInfo, contact history, the transactions panel, New Outbound's customer search, and the console picker through CustomerDataProvider and the active (telecom) profile, replacing direct reads of CUSTOMER_LIST_RECORDS and friends. Marcus Webb becomes a scenario in the telecom pack keyed by his entity id. Grep the read sites; targeted edits. Done = every screen shows the same data as before, sourced from the database; list browser checks for me. Don't write code yet.
```

### P1.7a — Schema-driven Customer Profile card   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 7a. I'm explicitly authorizing lyra-ui changes for this step if CustomerContextOverview needs new props; keep them backward compatible with a story. In plan mode, propose making the Customer Profile card render from the active profile's entity schema — field list, labels, tags, the "View <entity> info" link text — with the telecom profile reproducing today's layout exactly, keeping the shared Accordion styling and the entrance animation. Done = telecom renders identically; a stub profile with different fields renders them without code changes; list browser checks for me. Don't write code yet.
```

### P1.7b — Schema-driven Details-panel accordions   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 7b. In plan mode, propose making DetailsPanelAccordions render the entity card, snapshot, and one accordion per related collection the profile declares (Files stays), driven by schema, keeping the staggered entrance animation ordering. Done = telecom shows today's panel; a stub profile with three collections shows three accordions; list browser checks for me. Don't write code yet.
```

### P1.7c — Generic related-records panel   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 7c. In plan mode, propose generalizing the Marcus Webb transactions panel into a related-records panel that renders any collection from the profile's schema via getCollection (columns, status badges, sorting), opened from the Details panel or later from an AI card action. Done = payments render as today for telecom; the same component renders a different collection from a stub profile; list browser checks for me. Don't write code yet.
```

### P1.5 — Create-database wizard   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 5. In plan mode, propose a Create Database wizard (lyra-ui Modal + form components): pick vertical → name → size and history depth → seed → optional file import (hook only; 1.6 fills it) → generate → connect; plus a database switcher and export/import/reset controls in the app chrome. Switching databases changes the provider-cache key, so the provider set swaps automatically — confirm. Done = a user can create a second telecom database, switch between them, and see the app reflect the active one; list browser checks for me. Don't write code yet.
```

### P1.6 — Vertical-aware import   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 6. In plan mode, propose in-browser .csv/.xlsx import (PapaParse / SheetJS) inside the wizard and from the Customers table: column mapping onto the active profile's entity schema with auto-match + Select overrides, preview, validation, dedupe via findNearMatches; extra sheets map onto related collections. Done = importing a sample telecom CSV creates entities that behave like generated ones; list browser checks for me. Don't write code yet.
```

### P1.2a — Retail, collections, healthcare, customer-service profiles   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 2a. In plan mode, propose full profiles for retail (orders, returns/RMAs, loyalty, payments), collections (debts, payment plans, promises-to-pay, contact attempts), healthcare (appointments, claims, prescriptions, providers), and customer service/tech support (tickets, entitlements, devices, known issues) — terminology, schema, generators with realistic status mixes and showcase records, two scenario scripts each, dispositions, snapshot template, and compliance behaviors (PHI gating, right-party/mini-Miranda, etc.) declared as data for Phase 4 to enforce. Done = each profile generates a database and every screen renders it correctly; list browser checks for me. Don't write code yet.
```

### P1.2b — Thin packs: banking, insurance, travel, utilities   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 2b. Propose and implement thin profiles for banking (accounts, transactions, cards, disputes — with PCI masking declared), insurance (policies, claims, payments), travel/hospitality (bookings, itineraries, loyalty), and utilities (service addresses, meters, outages, bills), following the full profiles' pattern with one scenario script each. Done = each generates and renders.
```

---

## Phase 2 — Realtime chat simulation

Every Phase 2 step follows PLAN.md's **Omnichannel layout** (2026-10-15): sync channels in the main column, async channels in a right-side slide-out from the record header tabs, voice with no content view, assignment-based cards with one row per channel.

### P2.0 — Render performance pass   (Plan: Opus · Implement: Sonnet) — before 2.1
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 0. Known gaps records that the 550–1180ms renders seen on the dev server are dev-mode overhead; the production build is fast, but it still logs occasional slow handlers (~230–270ms) and forced reflows (up to ~120ms). Live chat and voice will deliver events every second or two, so in plan mode, propose how to find which components re-render on a single provider event and why, then the smallest fixes (memoized selectors in the P0.5.0 hooks, React.memo on heavy subtrees, splitting state so one interaction's update doesn't re-render the whole page). The React Profiler can be used on the dev server to find what re-renders, but **all timings, before and after, are measured against a production build**: build with `npx vite build` and run `npm run preview`, not `npm run build`, until the type-check chore in PROGRESS.md is done. No visual changes. Done = a stateChanged or message event causes a render under ~50ms in the production build, measured before and after; list browser checks for me. Don't write code yet.
```

### P2.1 — Console chat view   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 1. In plan mode, propose the console's chat view: thread (lyra chat-message/conversation-message), composer, typing toggle, a canned-lines panel from the active profile's scenarios (P0.7 format), and End chat — all sent as SimCustomerAction messages. Done = typing on the console produces customer messages the agent app receives as message events; list browser checks for me. Don't write code yet.
```

### P2.2 — Agent-side inbound chat   ✋ (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 2. In plan mode, propose rendering inbound chat end to end through the P0.5.0 hooks: incoming offer → accept → messages (useTranscript) in the existing channel-row / interaction-nav flow on both pages; agent replies via sendMessage (appearing only when the message event arrives, with delivery state); setTyping and incoming typing events both ways. Apply PLAN.md's omnichannel layout: a chat row click puts the chat in the main column; a voice row click only moves the voice bar; the record header's channel tabs switch sync channels and open async ones in the slide-out (slide-out shell only; email/SMS content is P-PARKED); from Home, a row click navigates to the assignment and opens that channel. Show a before/after for a card with three channel rows. Done = a full two-way chat works between console and agent app with no page-specific divergence; list browser checks for me. Don't write code yet.
```

### P2.3 — Unknown-contact state   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 3. In plan mode, propose the unknown-contact state for an Interaction with no entityId: Profile card shows "New <entity>" with the address, snapshot says no prior history, and an empty Draft <entity> card (fields from the profile schema) appears in the AI-assist slot with Save disabled. No extraction yet. Done = starting a chat "as unknown caller" from the console shows this state; list browser checks for me. Don't write code yet.
```

### P2.4 — Handoff snapshot card   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 4. In plan mode, propose replacing the Next Best Action card's role with a handoff snapshot: seeded from the handshake's pre-contact context through the profile's snapshot template, static once the agent takes over, collapsible via the existing accordion, with a sensible default for whether it auto-collapses. Keep the accent styling. Done = snapshot renders for known and unknown contacts in chat and voice; list browser checks for me. Don't write code yet.
```

### P2.5 — Utterance events   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 5. Propose and implement onCustomerUtterance / onAgentUtterance hooks in src/provider-context/ derived from message and transcript events (final utterances only, channel-agnostic), with tests. Nothing else listens yet.
```

---

## Phase 3 — Voice call simulation

### P3.1 — SimulatedMediaProvider   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 1. In plan mode, propose SimulatedMediaProvider in src/adapters/sim/ implementing the MediaProvider contract: it subscribes to transcript events itself and plays customer utterances via speechSynthesis (per-persona voice from getVoices on voiceschanged), queued with no overlap, paused while held, stopped when the interaction's state leaves active/held (not on ended); emits audioStateChanged, speaking and wordBoundary; unlock() and setOutputVolume(). Optional continuous SpeechRecognition (Chrome) while active and unmuted publishes agent utterances back over the sim transport so they arrive as transcript events. Done = with the sim set wired, a customer voice line is heard and the events fire; list browser checks for me. Don't write code yet.
```

### P3.2 — Console voice view   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 2. Propose and implement the console's voice view: composer, canned lines, voice/rate/pitch selectors (console-only, not in the MediaProvider contract), Hang up, and a typed-agent-lines fallback box. Done = lines sent from the console arrive as voice transcript events; list browser checks for me.
```

### P3.3 — Inbound ringing + answer   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 3. In plan mode, propose driving the incoming-call UI from the incoming event for voice, with Answer calling accept() and MediaProvider.unlock() in the same click (the audio-unlock gesture), plus decline and timeout paths. Done = starting an inbound call from the console rings the agent app; Answer connects it with audio ready; list browser checks for me. Don't write code yet.
```

### P3.4 — Transcript + playback wiring   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 4. In plan mode, propose rendering voice transcript events (partials and finals) in the transcript component via useTranscript, and confirming playback follows call state: Hold silences, resume continues, end silences immediately even though wrap-up follows. Done = a typed customer line appears in the transcript and is heard, with the hold/end behavior above; list browser checks for me. Don't write code yet.
```

### P3.5 — Word sync + speaking indicator   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 5. Propose and implement word-by-word transcript reveal from MediaProvider wordBoundary events and a "customer speaking" indicator in the voice bar from speaking events, with a graceful fallback when capabilities.wordTimings is false. Done = transcript keeps pace with the audio in Chrome and Safari; list browser checks for me.
```

### P3.6 — Voice unknown-contact + speech normalizers   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 6. Propose and implement the unknown-contact state for voice (same as chat) plus normalizers for spoken emails ("sarah dot chen at gmail dot com") and spelled-out names ("S-A-R-A-H"), as pure functions with tests. Done = both normalizers pass tests; unknown-caller voice shows the Draft card.
```

---

## Phase 4 — AI assist, Tier 1 (deterministic)

### P4.1 — Intent router + SimulatedAssistProvider   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 1. In plan mode, propose SimulatedAssistProvider in src/adapters/sim/ implementing the AssistProvider contract (suggest/extractEntities/cancel; card and extracted events), with a router that loads the active profile's intent pack of { patterns, slotExtractor, collection, query, card } and runs for suggest() calls triggered by utterance events and the ask box, returning a card or nothing and deferring to a stubbed Tier 2 hook when slots can't be filled confidently. The router is a pure function over (utterance, profile, context). Done = unit tests cover match / no-match / defer; an AssistProvider contract suite exists. Don't write code yet.
```

### P4.2 — Generic parameterized handlers   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 2. In plan mode, propose one handler engine over CustomerDataProvider.getCollection(name, { status, limit, sort, since, until, minAmount }) producing "records" cards, plus the profile-named conveniences (payments, cases/tickets/claims, balance, last contact, tags) as helpers over it. Done = "last 5 declined payments" for Marcus Webb returns exactly five declined rows newest-first, proven by a test. Don't write code yet.
```

### P4.3 — Slot extraction   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 3. In plan mode, propose slot extractors for counts, the profile's status vocabulary (declined/failed/bounced/didn't go through/refunded, denied, etc.), recency (last/recent/newest), date phrases (last month, this year, since March), and amounts, with a confidence signal so unfilled slots defer rather than guess. Done = a table-driven test of 20+ phrasings across telecom, retail, and healthcare passes. Don't write code yet.
```

### P4.4 — Record cards   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 4. In plan mode, propose components rendering the AssistCard union ("records", "text", "hint"): title restating the interpreted query, body as a table/list from the schema, provenance line from card.provenance, actions row — built on lyra-ui and the Details-panel Accordion/card treatment, updating as card events upsert (pending → streaming → complete). Done = cards render for payments, cases, balance, and last-contact results; list browser checks for me. Don't write code yet.
```

### P4.4a — Card-type registry and configurable placement   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 4a (PLAN.md Phase 4 §4a). In plan mode, propose: a card-type registry (lyra component + typed content schema per type: account overview, interstitial, records, text, hint, and the types in lyra's AI card set) with AssistCard gaining type and content; the registry picks the renderer, so new lyra types register without page edits; per-profile templates (which fields, order, labels, referencing the profile schema); placement per configured card — pinned (a Contact Details tab/accordion) or auto (the assist slot, on triggers: contact start, intent match, Tier 1 hit, escalation handoff, wrap-up), auto cards dismissible, interstitials holding the slot until acknowledged; a Settings section per profile to enable types, edit templates, set placement and triggers, with preview-as-agent. Lyra components take a typed content object, never fetch, and bubble onAction. Done = the account overview renders pinned in Details and an interstitial appears at call start from config alone; tests cover the registry and placement; list browser checks for me. Don't write code yet.
```

### P4.5 — Compliance gates   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 5. In plan mode, propose adding compliance gating to the AssistCard contract (deferred from P0.2) and enforcing the profiles' declared behaviors: healthcare — PHI-bearing cards render "Verify identity to view" until the agent marks identity verified; collections — right-party verification prompt and a mini-Miranda reminder card at call start, promise-to-pay capture; banking — masked card numbers tied to setMasked / the Mask control. Done = switching databases switches the gates; tests cover each; list browser checks for me. Don't write code yet.
```

### P4.6 — Placement per channel   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 6. In plan mode, propose the card placement: voice — an inline overlay in the main contact container that expands in place on click (reflow allowed; the transcript lives in the Details panel); chat — a composer-adjacent suggestion strip that expands near the compose box and never interleaves into the thread. Both reuse the P4.4 cards. Done = a routed suggestion appears in the right place for each channel and expands/collapses cleanly; list browser checks for me. Don't write code yet.
```

### P4.7 — Card actions   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 7. Propose and implement card actions per the AssistCard action targets: "open-collection" opens the related-records panel (P1.7c) on that collection; "open-record" jumps to it in the Details panel. Done = both work from voice and chat placements; list browser checks for me.
```

### P4.8 — Agent ask box   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 8. In plan mode, propose an agent ask box built on lyra-ui ai-input/ai-panel/ai-process that calls AssistProvider.suggest with trigger kind "ask", so an agent-requested card is identical to an AI-noticed one, placed consistently with P4.6. Done = typing "show me the last 5 declined payments" yields the same card as the customer saying it; list browser checks for me. Don't write code yet.
```

### P4.9 — Progressive entity creation (deterministic)   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 9. In plan mode, propose: Tier 1 extractors (email, phone, ZIP, account/member number, amounts, name heuristics) behind AssistProvider.extractEntities, whose extracted events fill the Draft card live with each field tagged by its sourceId; findNearMatches offering "Link to <existing>?" vs "Create new" before save; save = CustomerDataProvider.create/linkContactMethod + InteractionProvider.associateEntity (AssistProvider never writes); auto-save as provisional if the interaction ends unsaved; on save, Profile/Snapshot/history/Customers table update from entityChanged and stateChanged events; expanded state reusing the existing create form with schema fields. Done = an unknown-caller chat that states a name and email produces a saved entity visible in the Customers table; list browser checks for me. Don't write code yet.
```

### P4.10 — No-match fallback   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 10. Propose and implement the no-match behavior: nothing for voice; a "hint" card for chat listing the active profile's collections. Leave a clearly marked hook where Phase 5 replaces it.
```

### P4.11 — Knowledge base, Tier 1   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 11 (PLAN.md Phase 4 §11). In plan mode, propose a profile-level "knowledge" collection (title, body, tags, product/skill scope, source, last updated) imported from Markdown/HTML/PDF/CSV through the wizard's import path, a KnowledgeProvider contract with a sim and a placeholder (vendor KBs come later under the sync rules), Tier 1 retrieval by tag and keyword surfacing a records card with provenance, article open in the Details panel or the draggable panel, and Settings for which sources are active per skill and whether the AI may quote or only link. Contract test: an imported article is retrievable by tag; a disabled source never surfaces. Done = "how do I void a charge?" surfaces the right article; list browser checks for me. Don't write code yet.
```

---

## Phase 5 — AI assist, Tier 2 (real model with tools)

### P5.1 — Model access   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 1. In plan mode, propose model access inside the AssistProvider adapter with three selectable backends: a ~30-line local proxy holding the API key, direct browser calls to Anthropic behind the explicit opt-in header (localhost only, clearly warned), and Ollama. Keys never land in the repo. Done = a hello-world completion streams through each configured backend into a "text" card. Don't write code yet.
```

### P5.2 — Tools and persona from the profile   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 2. In plan mode, propose tool definitions generated from the active profile's schema (the generic collection query with full parameters, plus propose_entity_fields emitting extracted events under the same confirm-before-save rule) and a system prompt carrying the vertical's persona and compliance rules; the browser executes tool calls against CustomerDataProvider. Done = asking for "last 5 declined payments" through Tier 2 yields a tool call with the correct parameters and a grounded answer. Don't write code yet.
```

### P5.3 — Hybrid rule   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 3. In plan mode, propose enforcing the hybrid rule: retrieval intents stay on the Tier 1 router; the model handles synthesis only (summaries, drafted replies, next steps) with Tier 1 results passed as context; the prompt forbids answering data questions without a tool result; card provenance shows tier 2. Done = tests show a data question never bypasses the router. Don't write code yet.
```

### P5.4 — Streaming + conversation context   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 4. Propose and implement streaming model output as card upserts (status "streaming" → "complete") and assembling the last N utterances/messages plus the handoff snapshot inside the provider for each request (the UI never builds prompts). Done = a synthesis suggestion streams in mid-call and reflects the conversation so far.
```

### P5.5 — Replace the no-match fallback   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 5. Replace Phase 4's no-match hook with a Tier 2 call, keeping the Tier 1 path untouched and falling back to the hint card when no backend is configured.
```

### P5.6 — Knowledge base, Tier 2   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 6 (PLAN.md Phase 5 §6). In plan mode, propose chunking and embedding knowledge articles (in-browser model or the proxy), cited answers under the hybrid rule (the model never answers from its own head; every answer cites the chunks used), and guided flows: an article with steps renders as a checklist card that follows the conversation. Done = a Tier 2 answer cites a chunk; a stepped article walks the agent through it; tests cover both. Don't write code yet.
```

### P5.7 — Setup assistant and configuration templates   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 7 (PLAN.md Phase 5 §7). In plan mode, propose: (1) each vertical profile ships a full configuration bundle (layout preset, Contact Details tabs/fields, AI card templates and placements, dispositions, compliance gates, KB sources, suggested connections), applied when the wizard picks the vertical; (2) a conversational setup assistant on Settings and first run that asks a few questions and proposes a configuration diff over the nearest template, shown item by item for accept/edit/reject, applying nothing without review; (3) safety rails: it emits only the typed configuration schema the hand editors use, can't remove compliance gates, and every applied change is versioned with rollback. Done = answering the assistant's questions for a healthcare center yields a reviewable proposal that, when accepted, changes the Details tabs, cards and gates accordingly; tests cover the schema constraint and rollback. Don't write code yet.
```

---

## Phase 6 — Virtual agent and escalation to a human

Runs after Phase 5: it needs chat (P2.x), voice (P3.x), the handoff snapshot (P2.4), the console (P0.6) and model access (P5.1). Nothing in this phase is scripted — the bot and the simulated customer are both model calls.

### P6.1 — Escalation domain + BotAgentProvider contract   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 6, step 1. In plan mode, propose: (1) domain changes in src/domain — Interaction.origin gains "escalated"; Interaction.escalation { at, reason: "customer-requested" | "out-of-authority" | "sentiment" | "bot-uncertain", summary, intent, sentimentTrend, botAttempts, pendingRequest? }; Message and Utterance gain author "bot" beside customer/agent — the bot segment is the same Interaction's transcript up to escalation.at, same InteractionId and journeyId, never a second contact; (2) a BotAgentProvider contract in src/providers (types only, imports only src/domain, same conventions as P0.2): handle(interactionId), onCustomerTurn(turn), release(interactionId); events botTurn, thinking, escalate, released; ProviderError only; capabilities for channels and canEscalate. The bot converses and asks to escalate — routing stays with the engine; (3) the profile's bot pack in src/profiles — persona, authority limits, escalation policy, tools over getCollection — with the telecom profile filled in; (4) a placeholder adapter for the new provider and a slot for it in ProviderSet; (5) tests: describeInteractionProviderContract gains "an escalated incoming carries escalation and getTranscript returns the bot segment", gated on a new InteractionProvider capability "escalation" so adapters without a virtual agent skip it, and a new describeBotAgentProviderContract (turn ordering, escalate at most once, release cancels in-flight work, not-supported gating). Nothing visible changes. Done = types compile, npm test passes with the new suites against the placeholder and the sim. Don't write code yet.
```

### P6.2 — SimulatedBotAgentProvider + bot-first routing   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 6, step 2. In plan mode, propose SimulatedBotAgentProvider in src/adapters/sim/ on the P5.1 model backends — lift the backend selection into a shared module if it still lives inside the assist adapter, so AssistProvider and BotAgentProvider use the same one. System prompt from the profile's bot pack (persona, authority, compliance); tools = the profile's collection query plus escalate(reason, summary). Add bot-first routing to SimEngine: a console-started contact flagged bot-first is handed to the bot, customer SimCustomerAction messages become onCustomerTurn, botTurn becomes a transcript/message event with author "bot", and escalate moves the contact to the queue and emits incoming with escalation populated and the bot transcript already in place. The engine must honor an explicit request for a person even if the model misses it (a policy guard, not a script). Chat only; a dev-only bot-first flag on the console handshake is enough for now (P6.3 adds the real control). Done = starting a bot-first chat from the console as Marcus Webb and typing an over-limit refund request produces an incoming offer in the agent app carrying escalation and the bot's turns; a test with a stubbed model backend covers the escalate path end to end; the BotAgentProvider contract suite passes against the sim; list browser checks for me. Don't write code yet.
```

### P6.3 — Console AI-customer mode   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 6, step 3. In plan mode, propose a "Play as <entity>" mode on the console beside typed and canned lines: a model-driven customer persona built from the entity record and contact history (via CustomerDataProvider), plus a goal and temperament picked on the console (e.g. refund over the bot's limit, rising frustration, wants a human), with a bot-first toggle on the handshake. It emits ordinary SimCustomerAction messages so the engine can't tell it from a typed customer, and it keeps taking turns against the bot until escalation, then against the human agent. During the bot segment the console voices both parties with its own TTS (no agent is on the contact yet). Done = with no typing at all, a bot-first chat between the AI customer and the bot runs to an escalation and the console shows the thread; list browser checks for me. Don't write code yet.
```

### P6.4 — Agent-side handoff   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 6, step 4. I'm explicitly authorizing a lyra-ui change to the transcript component for this step, backward compatible with a story. In plan mode, propose the human side of the handoff, built once in the shared contact-handling code and consumed by both pages per the parity decision: the incoming tile shows "Escalated from virtual agent" with escalation.reason; accepting loads the transcript with author "bot" turns rendered distinctly and a handoff divider at escalation.at; the P2.4 handoff snapshot is seeded from escalation (summary, intent, sentiment trend, what the bot tried, pending request) through the profile's template and then frozen; AI assist resumes over the full transcript on the next utterance. Accept drops the entire bot segment into the transcript at once, so measure that render against P2.0's budget. Grep page files; targeted edits. Done = the escalated contact looks and behaves identically on AgentWorkspaceAdvancedPage and AgentWorkspace2WithDeskPage apart from layout; accept renders under ~50ms; npm test passes; list browser checks for me. Don't write code yet.
```

### P6.5 — Voice escalation   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 6, step 5. In plan mode, propose extending bot-first routing to voice: during the bot segment the console voices customer and bot in two distinct voices; escalate rings the agent app via the existing P3.3 path with escalation on the offer; on Answer the console stops the bot's voice and SimulatedMediaProvider takes over the customer's voice mid-call on the same Interaction — no re-ring, no second contact, playback rules from P3.4 unchanged. Done = a bot-first voice call plays both voices on the console, escalates, rings the agent, and after Answer the customer's next line is heard in the agent window with the transcript continuous across the divider; list browser checks for me. Don't write code yet.
```

---

## Phase 7 — Work items, schedule, apps and configuration

Runs after Phase 6 (needs P1.4, P1.4a/4b and the settings store). 7.3 can be pulled earlier for demos.

### P7.1 — WorkItem + WorkProvider   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 7, step 1 (PLAN.md Phase 7 §1). In plan mode, propose WorkItem { kind: contact | ticket | coaching | meeting | task } above Interaction (a journey is the contact kind; tickets are the P1.4b records; coaching references a P1.4a interaction and a scorecard; meeting has time/attendees/join link; task has due date/checklist), a WorkProvider contract (listWorkItems, create, update, events) with a sim serving fixtures and a placeholder, a contract suite, and CalendarProvider as a read seam for schedules. No page changes. Done = npm test passes with the new suite; tsc at baseline. Don't write code yet.
```

### P7.2 — Nav cards and main-column views per kind   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 7, step 2. In plan mode, propose non-contact work items in the nav's card shell (kind icon, title, status chip, due/scheduled time; live contacts first, then by time), filter chips (All / Contacts / Tickets / Sessions / Meetings), and main-column views per kind (ticket detail with notes; coaching session with the recorded interaction, transcript and scorecard; meeting agenda; task checklist), through the layout slots. Before/afters for every visual change. Done = an agent's tickets, a coaching session and a meeting show in Assignments on both pages and open their views; list browser checks for me. Don't write code yet.
```

### P7.3 — Calendar wiring   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 7, step 3. Phase 2 already has a calendar view that isn't functional. In plan mode, propose wiring it to WorkProvider (read meetings, coaching sessions, breaks and shift segments; create/edit saves back), persisted locally through the versioned settings-style store until P1.4's IndexedDB takes over, with calendar items being the same work items the nav shows. Phase 1 gets no calendar unless it's shared as a panel. Done = a meeting created on the calendar appears in Assignments at its time; list browser checks for me. Don't write code yet.
```

### P7.4 — Schedule-driven presence   (Sonnet · Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 7, step 4. Propose and implement: a meeting or coaching session starting sets the agent's presence through setAgentState, and ending restores the previous status, with a toast; tests cover start/end and an agent who changes status manually mid-meeting (manual wins). List browser checks for me.
```

### P7.5 — Reporting sink   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 7, step 5. In plan mode, propose a ReportingSink seam that receives interaction and work-item events (offer, accept, hold, resume, end, wrap-up complete with outcome, transfer, merge, hand raise, work-item status changes) with handle/hold/after-call durations, a sim sink that logs locally with a dev panel and JSON/CSV export, a placeholder, and a contract suite. Real sinks (CXone Reporting, Genesys analytics, a warehouse) are adapters later. Done = a full call shows as the right sequence of events in the dev panel; tests cover durations. Don't write code yet.
```

### P7.6 — Embedded apps in the draggable panel   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 7, step 6 (PLAN.md Phase 7 §6). In plan mode, propose an AppProvider seam (listApps, openApp(appId, context), app events; each app declares id, name, icon, URL template, accepted contexts, and an iframe-allowed capability), an "app" content type for the draggable panel (iframe sized to the panel, float/dock, reload, one panel per app, size/position persisted in settings), deep links from the record header's app icons, a "View in <app>" link in Customer Profile, and rules (a case created in wrap-up), postMessage events back ("record saved" refreshes the profile; "click-to-dial" goes through useOutboundDial), a new-window fallback when iframing is blocked, and a sim CRM app in this repo (#/sim-app/crm) proving the round trip plus a placeholder app with an unreachable URL for the error state. Before/afters. Done = opening the sim CRM from the profile, saving there, and seeing the Snapshot update; list browser checks for me. Don't write code yet.
```

### P7.7 — Configurable layout   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 7, step 7 (PLAN.md Phase 7 §7). The layout slots from 5d.2 exist. In plan mode, propose a LayoutConfig type (regions, their contents, the voice bar anchor), Phase 1 and Phase 2 as built-in presets the pages render from, a user diff over the preset in the settings store per tier (Reset drops it), a "Customize layout" editor on Settings using toggles and reorder lists with live preview, a locked flag per region, and the Contact Details configuration layer (per-profile tabs, field visibility/order, accordions, read-only fields; compliance gates not configurable). Behavior, capability gating, hold/wrap-up rules and dialing are never configurable. Done = moving the voice bar anchor, hiding a nav entry and reordering Details tabs are data changes that survive reload; tests cover the diff/merge/reset; list browser checks for me. Don't write code yet.
```

### P7.8 — Connections, sync modes and outbound policy   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 7, step 8 (PLAN.md "Settings and configuration" and "Customer data: the app is the source of truth"). In plan mode, propose: the Connections section (one per seam, endpoint/credentials, Test/Save, status and last-event time, the "Simulated" badge in the chrome, a first-run step after the wizard; secrets go to the proxy, never localStorage); CustomerDataProvider sync modes (manual/interval/realtime) with a CRM adapter interface, saved mappings, write-back queue (idempotent change ids, retries, visible failures), per-field authority (app | crm | newest), conflict notes, never-delete-on-sync, unknown fields preserved, a Sync section listing conflicts and pending/failed writes, and sim "simulate sync" and "simulate conflict" controls; outbound policy (channels, who, reason code) filtering the launcher; address books (Outlook, Google) as a DirectoryProvider source. Contract tests per PLAN.md. Done = a simulated sync conflict shows on the record and resolves from Settings; an agent edit is visible to suggest() before sync; list browser checks for me. Don't write code yet.
```

---

## Later

### P-ADAPTER — Real adapters, in order   (Plan: Opus · Implement: Opus)
One step per adapter, run in this order (PLAN.md "Integration readiness"): **Twilio** (InteractionProvider + MediaProvider; free trial) → **Zendesk** (tickets via WorkProvider, KB via KnowledgeProvider; free sandbox) → **CXone** (InteractionProvider, DirectoryProvider, MessagingProvider; needs a tenant) → **a WFM vendor** (WorkProvider/CalendarProvider) → **an AI-agent vendor** (BotAgentProvider). Each needs the proxy/relay for auth and webhooks.
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're building the <vendor> adapter for <seam(s)> in src/adapters/<vendor>/. In plan mode, propose: the vendor mapping checklist first (each contract method and event against the vendor API, with gaps as capability flags); the adapter; auth/token handling and webhooks through the proxy/relay (the minimal server piece); an honest capabilities map; recorded vendor traffic saved as JSON fixtures and replayed in tests; a Connections entry. It must pass the seam's contract suite with no page changes; point the matching factory entry at it. Don't write code yet.
```

### P-PARKED — Email and SMS   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're picking up the deferred email and SMS simulation. In plan mode, propose, for each: agent-side composer via sendMessage, delivery states in the sim engine (SMS with segment counting), and a console tab where the customer reads and replies via SimCustomerAction — all over the existing contracts. On the agent side both render into the async slide-out from PLAN.md's omnichannel layout, with an "awaiting reply" chip on the nav row. Don't write code yet.
```
