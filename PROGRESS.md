# Progress

Status values: `todo` / `in progress` / `done` / `deferred`. Rows follow PROMPTS.md's execution order; step labels use PLAN.md's numbering. Update this file in every step's WRAP-UP.

| Step | Title | Phase | Status | Notes |
|---|---|---|---|---|
| P-REALIGN | Sync PLAN.md and PROGRESS.md to PROMPTS.md | Setup | done | Docs only. |
| P-SETUP | Create CLAUDE.md and PROGRESS.md | Setup | done | Project rules added as a new section at the top of the existing CLAUDE.md (lyra-ui rules kept). |
| P0.1 | Domain model | 0 | done | Types in `src/domain/`; mapping note in PLAN.md Decisions; type guards in `src/adapters/legacy/type-checks.ts`. |
| P0.2 | Provider interfaces | 0 | done | Types in `src/providers/`; `recording?`/`masked?` added to domain `Interaction`. tsc: no new errors (baseline 4). Decisions in PLAN.md (conventions, `ProviderError`, extra commands, `listOutboundSkills`). No tests exist yet; contracts are exercised by P0.8. |
| P0.3 | Provider context | 0 | done | `src/provider-context/` + placeholders in `src/adapters/placeholder/`; mounted in `main.tsx`. tsc baseline 4, eslint clean on new files. Browser check (one `created`/no `disposed`, `?provider=bogus` fallback, login round-trip keeps the flag) left to the user. Decisions in PLAN.md. |
| P0.4 | SimulatedInteractionProvider + SimTransport | 0 | done | `src/adapters/sim/`; `sim` factory now builds it (other three providers still placeholders). tsc baseline 4, eslint clean. Runtime-checked in Node (real `BroadcastChannel`, esbuild bundle): dial → connecting → active, hold/no-op/resume, mute, end → wrap-up → completeWrapUp → `ended{agent}`; inbound chat via customer client → accept → messages + delivery → customer hang-up → wrap-up → `ended{customer}`; not-supported/invalid-state/not-found/disposed errors. Browser check done by the user (devtools flow, StrictMode lifecycle, HMR). Decisions in PLAN.md. |
| P0.8 | Contract test suite | 0 | done | Vitest; `npm test` runs 111 tests (83 pass, 28 skip by design where a capability is off). Contract in `src/contract-tests/`, run twice against the sim (default capabilities; every optional capability off) over `src/adapters/sim/memory-transport.ts` at zero latency, plus sim-only session-isolation and network-timeout tests and `provider-cache.test.tsx` (jsdom). Mutation-checked: events-before-reply and an ungated customer typing event both turn it red. tsc baseline 4, eslint clean. One sim fix: customer typing is dropped when `capabilities.typing` is off. Decisions in PLAN.md. |
| P0.5.0 | Interaction store + view-model adapter | 0 | done | Store, reducers and hooks in `src/provider-context/` (started by `ProviderRoot`); `buildNavCards`/`tickClock` in `src/adapters/legacy/nav-card-view-model.ts`. No page changes. `npm test`: 130 tests (102 pass, 28 skip by design), 19 of them new (store hydrate/upsert/replay/ended/stop/error; hooks under StrictMode via `ProviderRoot`; view-model grouping, including against the sim). The replay test was mutation-checked. tsc baseline 4, eslint clean. `provider-cache.test.tsx`'s fake provider gained `on`/`getSnapshot`, because `ProviderRoot` now starts the store. Decisions in PLAN.md. |
| P0.5a | Migrate the agent leg behind the provider | 0 | done | lyra `e03125c`: `AgentProfile` controlled leg (`agentLegStatus`/`onAgentLegToggle`/`hideAgentLeg`, stories "Controlled agent leg"/"Hidden agent leg"). Both pages drive it from `useAgentState()` + `connectAgentLeg`/`disconnectAgentLeg`, gated on `capabilities.interaction.agentLeg`. Toasts come from the new `useAgentLegTransitions`. `agent-next-gen-agent-leg-state.ts` deleted. Sim voice `dial` now requires the leg connected. `npm test`: 133 tests (104 pass, 29 skip by design), 2 new (hook; voice-dial contract), both mutation-checked. tsc baseline 4 (lyra 3); eslint clean on new code, page eslint profile unchanged. **Not browser-verified**; checks listed in the step summary. Decisions in PLAN.md. |
| P0.5b | Migrate dial pad / interaction creation | 0 | todo | **Prerequisite (from P0.5.0):** the nav slot key becomes `journeyId`. First inventory every piece of page state keyed by the old card id (`customerId`), including the selected/active card, `threadStatuses`, `currentThreadId`, open panels and session state, and anything persisted, then re-key it all in the same change. |
| P0.5d | Voice bar, incoming tile and wrap-up onto the provider | 0 | todo | |
| P0.6 | Customer console route + handshake | 0 | todo | |
| P0.7 | Scenario script format | 0 | todo | Runs before P0.5c. |
| P0.5c | Migrate scripted scenario timers | 0 | todo | Needs P0.7. |
| P1.1 | ContactCenterProfile type and registry | 1 | todo | Telecom profile (PLAN.md 1.2 thin pack) is stubbed here and filled out across P1.3/P1.8 — it has no 1.2a/1.2b row of its own. |
| P1.3 | Generator engine | 1 | todo | |
| P1.4 | Named databases on IndexedDB | 1 | todo | |
| P1.8 | Route existing screens through provider + profile | 1 | todo | |
| P1.7a | Schema-driven Customer Profile card | 1 | todo | |
| P1.7b | Schema-driven Details-panel accordions | 1 | todo | |
| P1.7c | Generic related-records panel | 1 | todo | |
| P1.5 | Create-database wizard | 1 | todo | |
| P1.6 | Vertical-aware import | 1 | todo | |
| P1.2a | Retail, collections, healthcare, customer-service profiles | 1 | todo | |
| P1.2b | Thin packs: banking, insurance, travel, utilities | 1 | todo | |
| P2.0 | Render performance pass | 2 | todo | Before P2.1; see Known gaps (slow renders). |
| P2.1 | Console chat view | 2 | todo | |
| P2.2 | Agent-side inbound chat | 2 | todo | |
| P2.3 | Unknown-contact state | 2 | todo | |
| P2.4 | Handoff snapshot card | 2 | todo | |
| P2.5 | Utterance events | 2 | todo | |
| P3.1 | SimulatedMediaProvider (TTS + optional ASR) | 3 | todo | |
| P3.2 | Console voice view | 3 | todo | |
| P3.3 | Inbound ringing + answer | 3 | todo | |
| P3.4 | Playback wired to the transcript | 3 | todo | |
| P3.5 | Word sync + speaking indicator | 3 | todo | |
| P3.6 | Voice unknown-contact + speech normalizers | 3 | todo | |
| P4.1 | Intent router | 4 | todo | |
| P4.2 | Generic parameterized handlers | 4 | todo | |
| P4.3 | Slot extraction | 4 | todo | |
| P4.4 | Record cards | 4 | todo | |
| P4.5 | Compliance gates | 4 | todo | |
| P4.6 | Placement per channel | 4 | todo | |
| P4.7 | Card actions | 4 | todo | |
| P4.8 | Agent ask box | 4 | todo | |
| P4.9 | Progressive entity creation (deterministic) | 4 | todo | |
| P4.10 | No-match fallback | 4 | todo | |
| P5.1 | Model access | 5 | todo | |
| P5.2 | Tools and persona from the profile | 5 | todo | |
| P5.3 | Hybrid rule | 5 | todo | |
| P5.4 | Streaming + conversation context | 5 | todo | |
| P5.5 | Replace the no-match fallback | 5 | todo | |
| P-ADAPTER | First real adapter | Later | todo | |
| P-PARKED | Email and SMS | Later | deferred | See Deferred items. |

## Known gaps

- **Type-check baseline: 4 errors** from `npx tsc -b --noEmit` (2026-10-13; was 219 → 31 → 12 → 4). Steps verify by filtering tsc output to the files they touch, not by total count. All four are outside app code:
  - **3 inside lyra-ui itself** (its own baseline; `npx tsc --noEmit` in `../lyra-ui` reports the same 3): `admin-shell.tsx` ×2 (TS2554), `list-item.tsx` ×1 (TS2430).
  - **1 missing dev dependency**: `src/components/ui/__stories__/Shell.stories.tsx` — `@storybook/react` isn't installed in this app.
- **Browser-verified (titleText chore):** the Search panel header, checked by the user in Premium. Phase 1 doesn't expose Search, so the header isn't checked there.
- **Not browser-verified:** the behavior-touching fixes in the last chore commit — session status now persists from the hover/side-panel preview transcripts (they previously had no `onCurrentStatusChange` and would have thrown), the "Unused" Apple Pay pill is now a gray `slate` pill, and the video windows fall back to "Customer" when an interaction has no name. Checked by tsc only.
- **Not browser-verified (P0.3):** the provider context was checked by tsc and eslint only. Still to confirm by hand: one `[providers] created` and no `disposed` on load (StrictMode), `?provider=bogus` warns and falls back to sim, and the login round-trip keeps `?provider=`.
- **Browser-verified (P0.5.0), by the user:** one `[providers] created` on a normal load, and `?provider=twilio` logs the `[interaction-store] hydrate failed (not-supported)` warning without crashing. No page reads the store yet, so nothing else is browser-checkable until P0.5a/5b.
- **Known gaps (P0.5.0):** no stale-snapshot detection (last write wins on an ordered transport; `Interaction` has no version field). A failed hydrate isn't retried. Earlier ended/reopened contacts aren't folded into `Thread.reopenedContacts` yet, and `Message` → `TranscriptMessage` mapping is deferred to P2.2. Entity display names aren't supplied yet (`displayName` option is unused until CustomerData has a sim).
- **Provider cache:** lifecycle is now tested (P0.8). Still accepted: a render React discards before commit could leave a never-disposed zero-ref set, because the root mounts once.
- **Capability gating so far:** only the agent leg (P0.5a: `AgentProfile`'s `hideAgentLeg`, `IfCapable` around the disconnected toast). Each later control gets `IfCapable`/`useCapability` in the step that moves it onto a real provider.
- **Not browser-verified (P0.5a):** agent leg on Premium and Advanced (fresh load, disconnect/reconnect toasts, toast Connect button, tier switches, reload, welcome-modal deferral, `?provider=twilio` hiding). Checked by tests and tsc only.
- **Agent-leg gaps (P0.5a):** disconnecting the leg doesn't drop an active voice call, and inbound voice offers aren't blocked while it's down. The page has no reaction yet to the new voice-dial `invalid-state` (P0.5b). Before the first snapshot arrives, the leg row is hidden (not shown as connected).
- **Sim gaps, by design (P0.4):** `window.__simCustomer` is set during the provider factory (i.e. during render, once per cache key) and is replaced by the P0.6 console; engine discovery across windows is P0.6; transfer targets aren't validated.
- **Slow React renders on the workspace pages:** Chrome logs `[Violation]` entries for React render passes of roughly 550–1180ms. Profile before Phase 2, since live chat events will re-render these pages much more often.
- **Two existing eslint issues** (neither from recent changes): the unused `_omit` in `agent-next-gen-shared-utils.ts` (`@typescript-eslint/no-unused-vars`), and a `react-refresh/only-export-components` warning in `agent-next-gen-search-panel.tsx`.
- **Only `InteractionProvider` is contract-tested:** Media, CustomerData and Assist are still placeholders, so their shapes (e.g. `AssistCard` kinds, `CollectionQuery`) may get small revisions when their sim providers arrive. Revise there and log it in PLAN.md Decisions.
- **Contract assumes hold works on chat:** the sim allows holding a digital contact; a real vendor may not. If so, split `capabilities.hold` per channel rather than skipping tests.
- **Follow-up (rule-zero cleanup): 43 raw `<button` elements in `src/`** (`grep -rn "<button" src --include=*.tsx`) that CLAUDE.md says should be lyra `Button`/`ActionIconButton`/an existing button atom. Pre-existing; not part of any Phase 0 step.
- **Follow-up (voice controls): upstream or keep local.** The local `agent-next-gen-voice-call-controls.tsx` is ahead of lyra's `voice-call-controls.tsx` (see PLAN.md Decisions). Upstreaming it is possible but only on explicit request.

## Deferred items

- **Real `ContactCenterProfile` and `DatabaseHandle` (P0.3)** — only id/name stubs exist (`src/profiles/`, `src/data/`); P1.1 and P1.4 expand them. The cache key already uses their ids, so switching rebuilds the provider set.

- **Provider-contract scope cuts (P0.2)** — consult merge/cancel flows, directory search for transfer targets, profile-named collection shortcuts (P1 helper over `getCollection`), compliance gates on cards (Phase 4), vendor-only features (barge, whisper, conference, callbacks). See PLAN.md Decisions.
- **Email simulation** — composer, outbox-store, delivery states, console tab (PLAN.md "Parked"; prompt: P-PARKED).
- **SMS simulation** — same shape plus segment counting (PLAN.md "Parked"; prompt: P-PARKED).
