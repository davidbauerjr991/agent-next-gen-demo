# Agent Workspace Simulation — Consolidated Plan

**Target repo:** `~/GitHub-Local/agent-next-gen-demo` (consumes `~/GitHub-Local/lyra-ui` through the Vite source alias; design-system changes land in lyra-ui, app changes land here).

All client-side. The provider layer keeps a real backend (Twilio, CXone ACD) a swap rather than a rewrite; the profile layer keeps a new vertical a data pack rather than a code fork. Step prompts for executing this plan live in PROMPTS.md.

## Phase 0 — Provider architecture and simulation plumbing

1. **Domain model.** App-owned types — `Interaction`, `Message`, `Utterance`, `Entity` (the vertical's primary record: customer/patient/account holder), `RelatedRecord`, `AgentState` — with vendor-agnostic IDs plus an `externalId` slot. Vendor payloads never reach components.
2. **Four provider interfaces.** `InteractionProvider` (events: `incoming`, `stateChanged`, `message`, `transcript`, `typing`, `ended`; commands: `accept`, `end`, `hold`, `mute`, `transfer`, `sendMessage`, `dial`, `setAgentState`, `connectAgentLeg`; a `capabilities` map). `MediaProvider` (audio in/out). `CustomerDataProvider` (`getEntity`, `search`, `findNearMatches`, `create`, `update`, `linkContactMethod`, and a generic `getCollection(name, query)` behind named convenience methods). `AssistProvider` (`suggest`, `extractEntities`, streaming). All methods async; all state changes arrive as events.
3. **Provider context.** Supplies the active provider set, the active database handle, and the active `ContactCenterProfile`; chosen by `?provider=sim|twilio|cxone`. UI hides controls a provider's `capabilities` doesn't include.
4. **`SimulatedInteractionProvider`.** Wraps a `BroadcastChannel("agent-sim")` bus behind a `SimTransport` adapter (swappable for WebSocket later), with configurable injected latency so the UI is built for a real network from day one.
5. **Migrate existing simulation behind the provider.** The agent-leg `setTimeout` connect sequence, the in-memory leg-state module, the dial pad's local interaction creation, and the Marcus Webb scenario timers. Incremental: new flows first, existing paths after.
6. **Customer console route.** `#/customer-console`, same Vite app, talks only to the sim provider — the agent UI never knows it exists. Handshake: attach to an existing interaction or create one ("Start inbound chat/call as <entity>" or "as unknown caller" with free phone/name entry), carrying identifiers (ANI, email, chat handle) and pre-contact context.
7. **Scenario script format.** TS/JSON canned lines per entity per channel; loaded from the active profile.
8. **Contract test suite.** Incoming → accept → message → hold → end, runnable against any `InteractionProvider`.

## Phase 1 — Vertical profiles and database management

1. **`ContactCenterProfile` type and registry.** Each profile declares terminology (entity name and labels), schema (entity fields + related collections with their status vocabularies), generators, scenario scripts, an intent pack (Tier 1 patterns/slots, Tier 2 tools and system prompt), compliance behaviors, dispositions/reason codes, and a handoff-snapshot template.
2. **Verticals.** Build fully: retail/e-commerce (orders, returns, loyalty, payments), collections (debts, payment plans, promises-to-pay, contact attempts), healthcare (appointments, claims, prescriptions, providers), customer service/tech support (tickets, entitlements, devices, known issues). Thinner packs on the same engine: banking (accounts, transactions, cards, disputes), telecom (lines, plans, devices, outages — the current Marcus Webb data lives here), insurance, travel/hospitality, utilities.
3. **Generator engine.** Shared deterministic synthetic-data engine; per-vertical generators with realistic distributions and status mixes (payments mostly succeeded, some declined, occasional refund; claims with denials; tickets across states), plus showcase records guaranteed to make demo questions land — Marcus Webb gets at least five declined payments.
4. **Named databases on IndexedDB (Dexie).** `SimulatedCustomerDataProvider` takes a database handle; create, switch, export/import as JSON, reset to demo.
5. **Create-database wizard.** Pick vertical → name → size and history depth → seed → optional file import → generate → connect.
6. **Vertical-aware import.** `.csv`/`.xlsx` in-browser (PapaParse / SheetJS), column mapping onto the selected profile's schema, preview, validation, dedupe; extra sheets map onto related collections.
7. **Schema-driven panels** — the real work of this phase. Customer Profile card, Details-panel accordions, and the transactions panel become generic entity + related-collections renderers driven by the profile's schema; the current hard-coded layout survives as the telecom profile's rendering.
8. Route `buildCustomerContextOverviewInfo`, contact history, the dial pad, and the console picker through the provider and profile. Marcus Webb becomes a scenario inside the telecom pack rather than a special case.

## Phase 2 — Realtime chat simulation

1. Console chat view: thread (lyra-ui `chat-message`/`conversation-message`), composer, typing toggle, canned lines from the active profile, "End chat."
2. Agent app: `incoming` event for chat creates an inbound interaction via the existing channel-row / interaction-nav flow; messages append; the agent composer calls `sendMessage`; typing both ways.
3. **Unknown-contact state.** No match on the handshake identifier → Profile card shows "New <entity>" with the handle; handoff snapshot says no prior history; an empty "Draft <entity>" card appears in the AI-assist slot, fields from the profile's schema.
4. Handoff snapshot card (former Next Best Action): seeded from pre-contact context through the profile's template; static once the agent takes over.
5. Expose `onCustomerUtterance` / `onAgentUtterance` from the provider's transcript events. Nothing listens yet.

## Phase 3 — Voice call simulation

1. **`SimulatedMediaProvider`.** TTS via `speechSynthesis` with a voice per persona; optional agent-side `SpeechRecognition` (Chrome) while unmuted, with typed agent lines on the console as fallback.
2. Console voice view: composer, canned lines, voice/rate/pitch, "Hang up."
3. Inbound ringing via the provider's `incoming` event drives the existing incoming-call UI; Answer is the audio-unlock gesture.
4. Playback: `transcript` events append to the transcript and queue TTS (no overlap); cancel on `end`; pause/resume on `hold`.
5. Realism: `onboundary` reveals words in sync with audio; `onstart`/`onend` drive the "customer speaking" indicator in the voice call controls.
6. Same unknown-contact state as chat; speech normalizers for emails ("dot"/"at") and spelled-out names.

## Phase 4 — AI assist, Tier 1: deterministic and grounded

1. **`SimulatedAssistProvider`, router half.** Loads the active profile's intent pack: `{ patterns, slotExtractor, collection, query, card }`; runs on every utterance and on agent-initiated asks.
2. **Generic parameterized handlers.** One engine — `getCollection(name, { status?, limit?, sort?, since?, until?, minAmount? })` — with filter/sort executed in code; vocabulary comes from the profile, so "last 5 declined payments" and "last 3 denied claims" are the same code path.
3. **Slot extraction.** Counts, the profile's status vocabulary, recency, date phrases, amounts. "Show me the last 5 declined payments" → `{ status: "declined", limit: 5, sort: "newest" }`. Unfilled slots defer to Tier 2 rather than guess.
4. **Cards render records, not prose.** Title restates the interpreted query; body is the actual table; a provenance line names the collection.
5. **Compliance gates in front of cards.** Healthcare: nothing PHI-bearing renders until the agent marks identity verified ("Verify identity to view"). Collections: right-party verification and a mini-Miranda reminder card at call start, promise-to-pay capture. Banking: card numbers masked, tying into the existing Mask control.
6. **Placement per channel.** Voice — inline overlay in the main contact container, expands in place. Chat — composer-adjacent suggestion strip, never interleaved into the thread. Expanded state reuses the Details-panel Accordion/card treatment.
7. **Actions map to the app.** "View full history" opens the related-records panel; "Open case/ticket/claim" jumps to it.
8. **Agent ask box** on lyra-ui `ai-input`/`ai-panel`/`ai-process`; same router, same cards.
9. **Progressive entity creation, deterministic half.** Regex extractors for email, phone, ZIP, account/member number, amounts, name heuristics; detected values fill the Draft card live, each tagged with its source utterance. Before save, `findNearMatches` offers "Link to <existing>?" vs "Create new." Agent saves with one click or edits; the AI never writes silently. Interaction ended without saving → auto-save flagged *provisional*. On save, the interaction re-associates and Profile/Snapshot/history/table update live; expanded state reuses the existing create form, fields from the profile's schema.
10. No-match fallback: nothing (voice) or a quiet "I can look up <collections>…" hint (chat), listing what the profile actually has.

## Phase 5 — AI assist, Tier 2: a real model with tools

1. **Model access** inside `AssistProvider`: a ~30-line proxy holding the key, direct browser calls behind Anthropic's explicit opt-in header (localhost only), or a local model via Ollama.
2. **Tools and persona from the profile.** The generic collection query exposed with the profile's schemas; `propose_entity_fields` for conversational addresses, employers, contact preferences, reason-for-contact — feeding the Draft card with the same confirm-before-save rule. System prompt carries the vertical's persona and compliance rules.
3. **Hybrid rule.** Retrieval stays on the Tier 1 router; the model does synthesis only — "summarize why she's frustrated," "draft a reply offering the credit," "what next" — with Tier 1 results as context, never answering a data question from its own head.
4. **Streaming** into cards; **conversation context** (last N utterances + handoff snapshot) per request.
5. Replace Phase 4's no-match fallback with a Tier 2 call.

## Going real later — what each seam swaps to

`InteractionProvider` → CXone Agent API event stream + actions, or Twilio TaskRouter + Voice/Conversations. `MediaProvider` → CXone integrated softphone or Twilio Voice SDK. `CustomerDataProvider` → a CRM or your own API, with the profile's schema as the mapping target — AI grounding and schema-driven panels come along for free. `AssistProvider` → a server-side service or vendor copilot. Auth, tokens, and webhooks live inside the adapter; the browser-side contract doesn't change. Each adapter passes the Phase 0 contract tests before it counts as done. Transfer/consult semantics, ACW/disposition, and WebRTC setup will need adapter-specific work — expected, not a redo.

## Parked — email and SMS

Simulated outbox/inbox flows on the console over the same transport; nothing above closes the door. Each is a composer, an `outbox-store`, and a console tab when you return to them.

## Cross-cutting

- Persistence: IndexedDB for named databases and their records; in-memory for live interactions; export/import JSON for sharing datasets; one "Reset demo data" per database.
- Demo setup: agent app and console side by side, same browser; phone-as-customer is the only thing that would need the WebSocket transport.
- Provenance on every AI card so stakeholders see records, not invention.
- The sim providers and the profile packs are permanent — demo mode, test harness, and the way new verticals get added.

## Effort and order

Rough effort: Phase 0 about 5–6 days, Phase 1 about 6–8 (schema-driven panels and four full verticals), Phase 2 about 2–3, Phase 3 about 3–4, Phase 4 about 4–5, Phase 5 about 2–3 — roughly five weeks of focused work. Phases 0–4 need no key, no cost, no network; Phase 5 is the only one that reaches outside the browser.

Order of attack: Phase 0, then Phase 1 with just the telecom profile (so existing screens keep working while the panels go schema-driven), then Phases 2–4, then the remaining verticals, then Phase 5. PROMPTS.md lists the steps in this execution order.

## Decisions

<!-- Appended as steps are accepted. Format: "- P0.2 — <decision> (<date>)" -->
- P0.1 — Domain model lives in `src/domain/` (types only; imports nothing from components, lyra-ui, React, or vendors). Ids are branded strings (`InteractionId`, `JourneyId`, `EntityId`, …), cast only at the adapter edge; every top-level type carries `externalId?: { system, id }`; timestamps are `EpochMs`. A domain `Interaction` is **one channel contact** (call/chat/email thread); the left-nav card is a UI view model that groups Interactions by `journeyId`. `caseStatus` (profile vocabulary) is separate from connection `state`; `origin` is `routed | agent-initiated | reopened`, orthogonal to `direction`. (2026-10-13)
- P0.1 — Mapping from current shapes (no page changed yet; mappers arrive with P0.5):
  - `Thread` → `Interaction`: `id`/`contactId` → `id`/`externalId`; `type` → `channel`; `value`/`addressLabel` → `address`; `preview` (skill name) → `skill.name`; `startTick` → `startedAt`; `heldByAgent`/`heldSinceTick` → `state:"held"` + `heldSince`; `awaitingResponse` + `lastCustomerMessageTick` → `awaitingAgentSince`; `messageCount` derived; `reopenedContacts[]` → earlier ended Interactions with the same `journeyId`.
  - Card `Interaction`: `interactionId` → `journeyId`; `customerId` → `entityId`; `customerName` → `Entity.displayName`; `closed`/`voiceCallEnded` → `state:"ended"`; `threadStatuses[id]` → `caseStatus`. `id` (nav slot key), `currentThreadId`, `startedFresh`, `liveMessages` stay UI/store state. Voice mute (local `useState` in voice-call-controls) → `Interaction.muted` in P0.5a.
  - Transcript `Contact` → ended `Interaction` (`contactId` → `externalId`, `status` → `caseStatus`); `fingerprint` deferred. `TranscriptMessage` → `Message` (digital) or `Utterance` (voice, e.g. `TOM_LEWIS_CALL_LIVE_LINES`); `initials` derived in UI; `event` → `kind:"event"`; `tags` stay UI; `summary`/`instruction`/`wrapUp` belong to the scenario format (P0.7) and AI cards (Phase 4).
  - `CustomerListRecord` → `Entity`: `contactNumber` → `id`; `originalCustomerId` → `externalId{system:"demo-crm"}`; `firstPhone`/`emailAddress` → `contactMethods`; `channels` derived; remaining columns → `fields.*` under the telecom profile.
  - `MarcusWebbTransaction` → `RelatedRecord{collection:"transactions"}`; `MarcusWebbOrderInfo` → `RelatedRecord{collection:"orders"}`. `ContactHistoryEntry`/`InteractionHistoryRecord` are past Interactions (`statusLabel` → `caseStatus`, disposition/tags → `outcome`), not RelatedRecords.
  - `AgentLegSettledStatus` ⊂ `AgentLegState` (adds `"connecting"`). lyra `AgentStatus` → `presence.code`; category: available→available, working/after-call-work→working, else unavailable.
  - Type-level guards in `src/adapters/legacy/type-checks.ts`. (2026-10-13)
- Chore — tsc resolves `@nicecxone/lyra-ui` the same way Vite does: `tsconfig.json` `paths` mirror the `vite.config.ts` aliases (lyra-ui source, plus the agents/customers data fixtures; the CSS-only `/styles` alias gets an ambient `declare module` in `src/vite-env.d.ts`). Because lyra-ui has its own `node_modules`, `react`/`react-dom` types and `lucide-react` are **pinned to this app's copies for type-checking**, so identical types from two installs match. Consequence: tsc type-checks lyra-ui against the app's versions, so **version drift of those packages between the two repos won't be caught by tsc**. The Vite build is unaffected (it ignores `paths`). (2026-10-13)
