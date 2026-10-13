# Agent Workspace Simulation — Step Prompts

**Target repo:** `~/GitHub-Local/agent-next-gen-demo` — run every session from that directory. lyra-ui (`~/GitHub-Local/lyra-ui`) is consumed through the Vite source alias; steps that touch shared components edit it in place.

How to use: one step per fresh Claude Code session (or `/clear`). Paste the step's prompt in **plan mode** (Shift+Tab) with the "Plan" model, review and accept, then `/model` to the "Implement" model and paste the IMPLEMENT follow-up. Finish every step with the WRAP-UP follow-up. Model names are roles — **Opus = architect (top tier)**, **Sonnet = implementer** — check the current lineup when you start.

Default split: **Plan: Opus · Implement: Sonnet.** Steps marked **Implement: Opus** are the architecture-defining or large-refactor steps where the top tier earns its cost. Escalate any step to Opus if a bug survives two Sonnet attempts.

Execution order below differs slightly from PLAN.md's numbering where it reduces risk (e.g., contract tests before the migration; telecom profile before the other verticals). Step labels reference PLAN.md's numbering.

---

## Universal follow-ups (reuse after every step prompt)

**IMPLEMENT** (after accepting the plan, switch model if needed):
```
Implement the plan exactly as accepted. Keep edits to the files you listed. If you need to touch anything else, stop and tell me why before doing it. Verification scaled to risk: type-check always; run the relevant tests when the step has them; no browser click-through unless the step's done-criteria call for it.
```

**WRAP-UP** (end of every step):
```
Wrap up this step: run the type-check and any relevant tests, update PROGRESS.md (done / deferred / decisions made / known gaps), add any new decisions to the Decisions section of PLAN.md, and commit with the message "Phase <X> step <N>: <one-line summary>".
```

**BUG LOOP** (if something's broken after implementation):
```
<describe what you see>. Reproduce it first, find the root cause before changing anything, explain the cause in two sentences, then fix it. Don't work around it.
```

---

## Setup

### P-SETUP — Create CLAUDE.md and PROGRESS.md   (Plan: Opus · Implement: Opus)

Before running this: copy PLAN.md and PROMPTS.md to the root of `agent-next-gen-demo` yourself, and start Claude Code from that directory. Nothing gets pasted.

```
I'm starting a multi-week build on this repo (agent-next-gen-demo; lyra-ui is a sibling repo consumed via the Vite alias). PLAN.md (the consolidated plan) and PROMPTS.md (the per-step prompts) are already at the repo root — read both first, then create exactly two more files and change nothing else:

1. CLAUDE.md — the project rules every session must follow:
   - UI components never import the simulation bus, TTS/ASR, the store, or any vendor SDK directly; they consume the provider interfaces via the provider context only.
   - Vendor payloads (Twilio, CXone, anything) never reach components; adapters map them to the app-owned domain model at the edge.
   - Every provider method is async; all state changes arrive as events, even in the simulation. Simulation injects configurable latency.
   - Panels, cards, pickers, and AI handlers render from the active ContactCenterProfile's schema/terminology — never hard-coded entity fields.
   - The AI never writes to the database silently; drafts fill live, the agent confirms.
   - The customer console is sim-only; the agent UI must not know it exists.
   - Verification scales to risk: type-check always; tests when they exist; browser click-through only when a step's done-criteria require it. Git is the backup — no manual .bak copies.
   - Keep steps narrow: in large page files, grep and make targeted edits rather than reading whole files.
   - Before starting any step, read PLAN.md and PROGRESS.md.
2. PROGRESS.md — a table of every phase/step from PLAN.md with status (todo / in progress / done / deferred), in the execution order PROMPTS.md uses, plus sections "Known gaps" and "Deferred items" (seed Deferred with: email and SMS simulation).

Then commit all four files with "Project setup: plan, prompts, rules, progress tracker".
```

---

## Phase 0 — Provider architecture and simulation plumbing

### P0.1 — Domain model   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 1 (domain model). In plan mode, propose the app-owned types — Interaction, Message, Utterance, Entity, RelatedRecord, AgentState — with vendor-agnostic ids and an externalId slot; where they live; and how the current shapes in the code (voice interactions, chat threads, CustomerListRecord, the agent-leg status) map onto them without changing any page yet. Done = types compile, a mapping note in PLAN.md Decisions, zero component changes. Don't write code yet.
```

### P0.2 — Provider interfaces   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 2 (provider interfaces). In plan mode, propose the four interfaces — InteractionProvider (events: incoming, stateChanged, message, transcript, typing, ended; commands: accept, end, hold, mute, transfer, sendMessage, dial, setAgentState, connectAgentLeg; a capabilities map), MediaProvider, CustomerDataProvider (getEntity, search, findNearMatches, create, update, linkContactMethod, getCollection(name, query)), AssistProvider (suggest, extractEntities, streaming). Design them around what this workspace's UI actually shows, not the union of vendor features. All methods async; events for all state changes. Done = interfaces compile with doc comments explaining each member; no implementations yet. Don't write code yet.
```

### P0.3 — Provider context   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 3 (provider context). In plan mode, propose a React context that supplies the active provider set, the active database handle, and the active profile, selected by a ?provider=sim|twilio|cxone URL flag; hooks like useInteractionProvider(); and a pattern for hiding controls a provider's capabilities map doesn't include. Wire it at the App root with placeholder providers so nothing changes visibly. Done = context mounts, hooks return the placeholders, no page behavior changes. Don't write code yet.
```

### P0.4 — SimulatedInteractionProvider + SimTransport   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 4. In plan mode, propose SimulatedInteractionProvider over a BroadcastChannel("agent-sim") bus behind a SimTransport adapter (so WebSocket can replace it later), with a typed message union and configurable injected latency (default 200–800ms). Include cleanup that survives StrictMode's double-mounted effects. Done = provider implements the full interface, a tiny dev page or test can start an interaction and see events fire. Don't write code yet.
```

### P0.8 — Contract test suite (do this before the migration)   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 8 (contract tests), pulled forward before step 5. In plan mode, propose a test suite parameterized by any InteractionProvider implementation that runs: incoming → accept → message → hold → end, asserting events and state transitions, and run it against SimulatedInteractionProvider. Pick the test runner that fits this Vite project. Done = suite passes against the sim provider and is documented in PLAN.md as the bar every future adapter must pass. Don't write code yet.
```

### P0.5a — Migrate the agent leg behind the provider   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5a. In plan mode, propose moving the agent-leg simulation — the setTimeout connect sequence in lyra-ui's AgentProfile and the in-memory agent-next-gen-agent-leg-state module — behind SimulatedInteractionProvider's connectAgentLeg/setAgentState and its stateChanged events, so AgentProfile becomes a controlled display of provider state. Preserve current behavior exactly: connected on fresh load, no toast on load, toast only on real disconnect/reconnect, status carries across tier switches. Grep rather than read the page files whole. Done = behavior identical, contract tests still pass, no setTimeout left in AgentProfile. Don't write code yet.
```

### P0.5b — Migrate dial pad / interaction creation   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5b. In plan mode, propose routing the dial pad's outbound call creation and the "connecting → connected" sequence through InteractionProvider.dial and its events, in both AgentWorkspace2WithDeskPage and AgentWorkspaceAdvancedPage. Grep for the creation sites; make targeted edits. Done = dialing from the dial pad behaves exactly as today, driven entirely by provider events; both pages share the same path. Don't write code yet.
```

### P0.5c — Migrate scripted scenario timers   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 5c. In plan mode, propose moving the Marcus Webb scenario's inline timers into a scenario-player inside the sim provider that emits transcript/message events on schedule, so pages just render events. Keep the scenario content unchanged. Done = Marcus Webb replay looks identical; no scenario setTimeouts remain in page components. Don't write code yet.
```

### P0.6 — Customer console route + handshake   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 6. In plan mode, propose a #/customer-console route in the hash router (same Vite app, lyra-ui styling) that talks only to the sim provider: it lists the agent app's active interactions (agent app broadcasts interaction:list), can attach to one, or can create one — "Start inbound chat/call as <entity>" or "as unknown caller" with free phone/name entry — carrying identifiers (ANI, email, chat handle) and pre-contact context. No chat/voice UI yet, just the shell and handshake. Done = opening the console in a second window shows the active interactions and can start an inbound one that appears as an incoming offer in the agent app. Don't write code yet.
```

### P0.7 — Scenario script format   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 0, step 7. In plan mode, propose a TS/JSON scenario format — canned customer lines per entity per channel, optional timing hints — loadable by both the scenario-player (0.5c) and the console's canned-lines panel, and port the Marcus Webb scenario into it. Done = Marcus Webb loads from the new format and replays identically. Don't write code yet.
```

---

## Phase 1 — Vertical profiles and database management

### P1.1 — ContactCenterProfile type and registry   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 1. In plan mode, propose the ContactCenterProfile type — terminology (entity name and labels), schema (entity fields + related collections with status vocabularies), generators, scenario scripts, intent pack (Tier 1 patterns/slots, Tier 2 tools + system prompt), compliance behaviors, dispositions, handoff-snapshot template — and a registry under verticals/. Stub a single "telecom" profile that describes the data the app uses today. Done = type compiles, registry resolves "telecom", provider context exposes the active profile. Don't write code yet.
```

### P1.3 — Generator engine   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 3. In plan mode, propose a shared deterministic synthetic-data engine (seeded RNG, distributions, date ranges, status mixes, name/address pools) that profiles plug per-collection generators into, with support for "showcase" records that are guaranteed to exist. Implement the telecom generators: entities, payments (mostly succeeded, some declined, occasional refund), lines/plans, outages, interaction history. Done = generating 500 telecom entities with histories is fast and reproducible for a given seed; Marcus Webb exists as a showcase record with at least five declined payments. Don't write code yet.
```

### P1.4 — Named databases on IndexedDB   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 4. In plan mode, propose moving the customer store to IndexedDB (Dexie) with named databases, each tagged with its profile id; SimulatedCustomerDataProvider takes a database handle and implements the full interface including findNearMatches and getCollection(name, query) with status/limit/sort/since/until/minAmount; create, switch, export/import JSON, reset-to-demo. Done = a telecom database generates, persists across reload, and the provider answers queries against it. Don't write code yet.
```

### P1.8 — Route existing screens through provider + profile   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 8. In plan mode, propose routing buildCustomerContextOverviewInfo, contact history, the transactions panel, the dial pad's customer lookup, and the console picker through CustomerDataProvider and the active (telecom) profile, replacing direct reads of CUSTOMER_LIST_RECORDS and friends. Marcus Webb becomes a scenario in the telecom pack keyed by his entity id. Grep the read sites; targeted edits. Done = every screen shows the same data as before, sourced from the database. Don't write code yet.
```

### P1.7a — Schema-driven Customer Profile card   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 7a. In plan mode, propose making the Customer Profile card (lyra-ui CustomerContextOverview) render from the active profile's entity schema — field list, labels, tags, the "View <entity> info" link text — with the telecom profile reproducing today's layout exactly. Keep the shared Accordion styling and the entrance animation. Done = telecom renders pixel-identical; swapping to a stub profile with different fields renders them without code changes. Don't write code yet.
```

### P1.7b — Schema-driven Details-panel accordions   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 7b. In plan mode, propose making DetailsPanelAccordions render the entity card, snapshot, and one accordion per related collection the profile declares (Files stays), driven by schema, keeping the staggered entrance animation ordering. Done = telecom shows today's panel; a stub profile with three collections shows three accordions. Don't write code yet.
```

### P1.7c — Generic related-records panel   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 7c. In plan mode, propose generalizing the Marcus Webb transactions panel into a related-records panel that renders any collection from the profile's schema (columns, status badges, sorting), opened from the Details panel or from an AI card action later. Done = payments render as today for telecom; the same component renders a different collection from a stub profile. Don't write code yet.
```

### P1.5 — Create-database wizard   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 5. In plan mode, propose a Create Database wizard (lyra-ui Modal + form components): pick vertical → name → size and history depth → seed → optional file import (hook only; 1.6 fills it) → generate → connect; plus a database switcher and export/import/reset controls, somewhere sensible in the app chrome. Done = a user can create a second telecom database, switch between them, and see the app reflect the active one. Don't write code yet.
```

### P1.6 — Vertical-aware import   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 6. In plan mode, propose in-browser .csv/.xlsx import (PapaParse / SheetJS) inside the wizard and from the Customers table: column mapping onto the active profile's entity schema with auto-match + Select overrides, preview, validation, dedupe; extra sheets map onto related collections. Done = importing a sample telecom CSV creates entities that behave like generated ones. Don't write code yet.
```

### P1.2a — Retail, collections, healthcare, customer-service profiles   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 2a. In plan mode, propose full profiles for retail (orders, returns/RMAs, loyalty, payments), collections (debts, payment plans, promises-to-pay, contact attempts), healthcare (appointments, claims, prescriptions, providers), and customer service/tech support (tickets, entitlements, devices, known issues) — terminology, schema, generators with realistic status mixes and showcase records, two scenario scripts each, dispositions, snapshot template, and the compliance behaviors each needs (PHI gating, right-party/mini-Miranda, etc.) declared as data for Phase 4 to enforce. Done = each profile generates a database and every screen renders it correctly. Don't write code yet.
```

### P1.2b — Thin packs: banking, insurance, travel, utilities   (Plan: Sonnet · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 1, step 2b. Propose and implement thin profiles for banking (accounts, transactions, cards, disputes — with PCI masking declared), insurance (policies, claims, payments), travel/hospitality (bookings, itineraries, loyalty), and utilities (service addresses, meters, outages, bills), following the pattern of the full profiles with one scenario script each. Done = each generates and renders.
```

---

## Phase 2 — Realtime chat simulation

### P2.1 — Console chat view   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 1. In plan mode, propose the console's chat view: thread using lyra-ui chat-message/conversation-message, composer, a typing toggle, a canned-lines panel from the active profile's scenarios, and End chat — all over the sim provider's transport. Done = typing on the console emits customer:message events the agent app can receive. Don't write code yet.
```

### P2.2 — Agent-side inbound chat   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 2. In plan mode, propose handling the provider's incoming event for chat in both pages via the existing channel-row / interaction-nav flow, appending messages, sending agent replies through sendMessage so the console shows them, and typing indicators both ways. Done = a full two-way chat works between console and agent app with no page-specific divergence. Don't write code yet.
```

### P2.3 — Unknown-contact state   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 3. In plan mode, propose the unknown-contact state: no match on the handshake identifier → Profile card shows "New <entity>" with the handle, snapshot says no prior history, and an empty Draft <entity> card (fields from the profile schema) appears in the AI-assist slot with a disabled Save. No extraction yet. Done = starting a chat "as unknown caller" from the console shows this state. Don't write code yet.
```

### P2.4 — Handoff snapshot card   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 4. In plan mode, propose replacing the Next Best Action card's role with a handoff snapshot: seeded from the handshake's pre-contact context through the profile's snapshot template, static once the agent takes over, collapsible via the existing accordion, with a sensible default for whether it auto-collapses. Keep the accent styling. Done = snapshot renders for known and unknown contacts in chat and voice. Don't write code yet.
```

### P2.5 — Utterance events   (Plan: Sonnet · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 2, step 5. Propose and implement onCustomerUtterance / onAgentUtterance subscriptions exposed from the provider layer (derived from transcript and message events, channel-agnostic), with a dev-only console.log subscriber to prove they fire. Nothing else listens yet.
```

---

## Phase 3 — Voice call simulation

### P3.1 — SimulatedMediaProvider (TTS + optional ASR)   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 1. In plan mode, propose SimulatedMediaProvider: speechSynthesis playback with a per-persona voice (getVoices on voiceschanged), an utterance queue (never overlap), cancel/pause/resume; and optional continuous SpeechRecognition (Chrome) gated on call active + unmuted, emitting interim and final agent utterances. Done = a dev page can speak a queued line and, in Chrome, transcribe the mic. Don't write code yet.
```

### P3.2 — Console voice view   (Plan: Sonnet · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 2. Propose and implement the console's voice view: composer, canned lines, voice/rate/pitch selectors, Hang up, and a typed-agent-lines fallback box. Done = lines sent from the console arrive as voice transcript events.
```

### P3.3 — Inbound ringing + answer   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 3. In plan mode, propose driving the existing incoming-call UI from the provider's incoming event for voice, with Answer calling accept and serving as the audio-unlock gesture, and reject/timeout paths. Done = starting an inbound call from the console rings the agent app; Answer connects it. Don't write code yet.
```

### P3.4 — Playback wired to the transcript   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 4. In plan mode, propose appending transcript events to the transcript component and queuing them to MediaProvider, cancelling on end, pausing/resuming on hold. Done = a typed customer line appears in the transcript and is heard; Hold silences it and Resume continues. Don't write code yet.
```

### P3.5 — Word sync + speaking indicator   (Plan: Sonnet · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 5. Propose and implement word-by-word transcript reveal using onboundary and a "customer speaking" indicator in the voice call controls driven by onstart/onend, with a graceful fallback when onboundary isn't supported. Done = transcript text keeps pace with the audio in Chrome and Safari.
```

### P3.6 — Voice unknown-contact + speech normalizers   (Plan: Sonnet · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 3, step 6. Propose and implement the unknown-contact state for voice (same as chat) plus normalizers for spoken emails ("sarah dot chen at gmail dot com") and spelled-out names ("S-A-R-A-H"), as pure functions with tests. Done = both normalizers pass tests; unknown-caller voice shows the Draft card.
```

---

## Phase 4 — AI assist, Tier 1 (deterministic)

### P4.1 — Intent router   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 1. In plan mode, propose SimulatedAssistProvider's router: loads the active profile's intent pack of { patterns, slotExtractor, collection, query, card }, runs on every utterance event and on agent-initiated asks, returns a suggestion or nothing, and defers to a (stubbed) Tier 2 hook when slots can't be filled confidently. Design for testability — the router is a pure function over (utterance, profile, context). Done = unit tests cover match / no-match / defer. Don't write code yet.
```

### P4.2 — Generic parameterized handlers   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 2. In plan mode, propose one handler engine over CustomerDataProvider.getCollection(name, { status, limit, sort, since, until, minAmount }) with filter/sort in code, plus the named conveniences the profiles need (payments, cases/tickets/claims, balance, last contact, tags). Done = "last 5 declined payments" for Marcus Webb returns exactly five declined rows newest-first, proven by a test. Don't write code yet.
```

### P4.3 — Slot extraction   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 3. In plan mode, propose slot extractors for counts, the profile's status vocabulary (declined/failed/bounced/didn't go through/refunded, denied, etc.), recency (last/recent/newest), date phrases (last month, this year, since March), and amounts, with a confidence signal so unfilled slots defer rather than guess. Done = a table-driven test of 20+ phrasings across telecom, retail, and healthcare passes. Don't write code yet.
```

### P4.4 — Record cards   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 4. In plan mode, propose the AI card components: title restating the interpreted query ("Last 5 declined payments"), body as an actual table/list from the schema, a provenance line naming the collection, and an actions row — built on lyra-ui and the Details-panel Accordion/card treatment. Done = cards render for payments, cases, balance, and last-contact results. Don't write code yet.
```

### P4.5 — Compliance gates   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 5. In plan mode, propose compliance gates declared in profiles and enforced in front of cards: healthcare — PHI-bearing cards render "Verify identity to view" until the agent marks identity verified; collections — right-party verification prompt and a mini-Miranda reminder card at call start, promise-to-pay capture; banking — card numbers masked, tied to the existing Mask control. Done = switching databases switches the gates; tests cover each. Don't write code yet.
```

### P4.6 — Placement per channel   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 6. In plan mode, propose the overlay placement: voice — an inline overlay in the main contact container that expands in place on click, reflow allowed since the transcript lives in the Details panel; chat — a composer-adjacent suggestion strip that expands near the compose box and never interleaves into the thread. Both reuse the record cards. Done = a routed suggestion appears in the right place for each channel and expands/collapses cleanly. Don't write code yet.
```

### P4.7 — Card actions   (Plan: Sonnet · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 7. Propose and implement card actions that map into the app: "View full history" opens the related-records panel on that collection; "Open <record>" jumps to it in the Details panel. Done = both actions work from voice and chat placements.
```

### P4.8 — Agent ask box   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 8. In plan mode, propose an agent-initiated ask box built on lyra-ui ai-input/ai-panel/ai-process, routed through the same router so an agent-requested card is identical to an AI-noticed one, and placed consistently with step 6. Done = typing "show me the last 5 declined payments" in the ask box yields the same card as the customer saying it. Don't write code yet.
```

### P4.9 — Progressive entity creation (deterministic)   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 9. In plan mode, propose: regex extractors (email, phone, ZIP, account/member number, amounts, name heuristics) filling the Draft card live with each field tagged by its source utterance; findNearMatches offering "Link to <existing>?" vs "Create new" before save; one-click Save or edit; auto-save flagged provisional if the interaction ends unsaved; on save, re-associate the interaction and update Profile/Snapshot/history/Customers table live; expanded state reusing the existing create form with schema fields. The AI never writes silently. Done = an unknown-caller chat that states a name and email produces a saved entity visible in the Customers table. Don't write code yet.
```

### P4.10 — No-match fallback   (Plan: Sonnet · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 4, step 10. Propose and implement the no-match behavior: nothing for voice; a quiet "I can look up <the profile's collections>…" hint for chat, generated from the active profile. Leave a clearly marked hook where Phase 5 replaces it.
```

---

## Phase 5 — AI assist, Tier 2 (real model with tools)

### P5.1 — Model access   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 1. In plan mode, propose model access inside AssistProvider with three selectable backends: a ~30-line local proxy holding the API key, direct browser calls to Anthropic behind the explicit opt-in header (localhost only, clearly warned), and Ollama. Keys never land in the repo. Done = a hello-world completion streams through each backend that's configured. Don't write code yet.
```

### P5.2 — Tools and persona from the profile   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 2. In plan mode, propose tool definitions generated from the active profile's schema (the generic collection query with full parameters, plus propose_entity_fields feeding the Draft card under the same confirm-before-save rule) and a system prompt carrying the vertical's persona and compliance rules; the browser executes tool calls against CustomerDataProvider and returns results. Done = asking for "last 5 declined payments" through Tier 2 yields a tool call with the correct parameters and a grounded answer. Don't write code yet.
```

### P5.3 — Hybrid rule   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 3. In plan mode, propose enforcing the hybrid rule: retrieval intents stay on the Tier 1 router; the model handles synthesis only (summaries, drafted replies, next steps) with Tier 1 results passed as context; the prompt forbids answering data questions without a tool result. Done = tests show a data question never bypasses the router. Don't write code yet.
```

### P5.4 — Streaming + conversation context   (Plan: Sonnet · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 4. Propose and implement streaming model output into the record cards and sending the last N utterances plus the handoff snapshot with each request. Done = a synthesis suggestion streams in mid-call and reflects the conversation so far.
```

### P5.5 — Replace the no-match fallback   (Plan: Sonnet · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're on Phase 5, step 5. Replace Phase 4's no-match hook with a Tier 2 call, keeping the Tier 1 path untouched and a graceful fallback when no backend is configured. Done = an unmatched utterance yields a model suggestion when a backend is configured and the Phase 4 hint when not.
```

---

## Later — going real (when you get there)

### P-ADAPTER — First real adapter   (Plan: Opus · Implement: Opus)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're building the first real InteractionProvider adapter for <CXone Agent API | Twilio TaskRouter + Voice>. In plan mode, propose the adapter mapping vendor events and actions onto our domain model and interface, auth/token handling inside the adapter (with the minimal server piece it needs), and a capabilities map. It must pass the Phase 0 contract test suite with no changes to any page. Don't write code yet.
```

### P-PARKED — Email and SMS   (Plan: Opus · Implement: Sonnet)
```
Read CLAUDE.md, PLAN.md and PROGRESS.md. We're picking up the deferred email and SMS simulation. In plan mode, propose, for each: an agent-side composer, an outbox-store, delivery states on timers (SMS with segment counting), and a console tab where the customer reads and replies, all over the existing transport and provider interfaces. Don't write code yet.
```
