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

### P0.5b — Dial pad and outbound creation onto the provider   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5b. In plan mode, propose routing New Outbound and the dial pad through InteractionProvider.dial(DialRequest) — channel, address, skill from listOutboundSkills(channel), entityId/journeyId when known — in both AgentWorkspace2WithDeskPage and AgentWorkspaceAdvancedPage, with the "connecting → connected" display driven by stateChanged via the P0.5.0 hooks and view-model adapter. Filter channel options by capabilities.interaction.channels.outbound. Grep for the creation sites; targeted edits; both pages share one path. Done = dialing every channel behaves as today, driven entirely by provider events; npm test passes; list browser checks for me. Don't write code yet.
```

### P0.5d — Voice bar, incoming tile and wrap-up onto the provider   ✋ (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5d. In plan mode, propose moving the remaining contact controls onto InteractionProvider via the P0.5.0 hooks: voice bar hold/mute/record/mask/keypad (add controlled muted/onMuteChange to the app's local agent-next-gen-voice-call-controls.tsx per the voice-controls decision; sendDtmf for the keypad), hang up via end(), the incoming tile's Accept/Decline via accept()/decline(), the session status pill via setCaseStatus(), and the Outcome popover / Wrap-up card via completeWrapUp(). Gate each control with IfCapable/useCapability (hide, don't disable). Transfer stays unwired unless trivially mappable to blind transfer. Done = each control behaves as today but state comes from events (no optimistic local state); npm test passes; list browser checks for me, including a customer hang-up via __simCustomer landing in wrap-up. Don't write code yet.
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

### P2.0 — Render performance pass   (Plan: Opus · Implement: Sonnet) — before 2.1
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 0. Known gaps records React render passes of 550–1180ms on the workspace pages (Chrome Violation logs). Live chat and voice will deliver events every second or two, so in plan mode, propose how to measure (React Profiler / a dev render-timing hook) which components re-render on a single provider event and why, then the smallest fixes (memoized selectors in the P0.5.0 hooks, React.memo on heavy subtrees, splitting state so one interaction's update doesn't re-render the whole page). No visual changes. Done = a stateChanged or message event causes a render under ~50ms, measured before and after; list browser checks for me. Don't write code yet.
```

### P2.1 — Console chat view   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 1. In plan mode, propose the console's chat view: thread (lyra chat-message/conversation-message), composer, typing toggle, a canned-lines panel from the active profile's scenarios (P0.7 format), and End chat — all sent as SimCustomerAction messages. Done = typing on the console produces customer messages the agent app receives as message events; list browser checks for me. Don't write code yet.
```

### P2.2 — Agent-side inbound chat   ✋ (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 2. In plan mode, propose rendering inbound chat end to end through the P0.5.0 hooks: incoming offer → accept → messages (useTranscript) in the existing channel-row / interaction-nav flow on both pages; agent replies via sendMessage (appearing only when the message event arrives, with delivery state); setTyping and incoming typing events both ways. Done = a full two-way chat works between console and agent app with no page-specific divergence; list browser checks for me. Don't write code yet.
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

---

## Later

### P-ADAPTER — First real adapter   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're building the first real InteractionProvider adapter in src/adapters/<cxone|twilio>/ for <CXone Agent API | Twilio TaskRouter + Voice>. In plan mode, propose the adapter mapping vendor events and actions onto the domain model and contract, auth/token handling inside the adapter (with the minimal server piece it needs), and an honest capabilities map. It must pass the P0.8 contract suite with no changes to any page; point the matching entry in factories.ts at it. Don't write code yet.
```

### P-PARKED — Email and SMS   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're picking up the deferred email and SMS simulation. In plan mode, propose, for each: agent-side composer via sendMessage, delivery states in the sim engine (SMS with segment counting), and a console tab where the customer reads and replies via SimCustomerAction — all over the existing contracts. Don't write code yet.
```
