# Progress

Status values: `todo` / `in progress` / `done` / `deferred`. Rows follow PROMPTS.md's execution order; step labels use PLAN.md's numbering. Update this file in every step's WRAP-UP.

| Step | Title | Phase | Status | Notes |
|---|---|---|---|---|
| P-SETUP | Create CLAUDE.md and PROGRESS.md | Setup | done | Project rules added as a new section at the top of the existing CLAUDE.md (lyra-ui rules kept). |
| P0.1 | Domain model | 0 | done | Types in `src/domain/`; mapping note in PLAN.md Decisions; type guards in `src/adapters/legacy/type-checks.ts`. |
| P0.2 | Provider interfaces | 0 | todo | |
| P0.3 | Provider context | 0 | todo | |
| P0.4 | SimulatedInteractionProvider + SimTransport | 0 | todo | |
| P0.8 | Contract test suite | 0 | todo | Pulled forward before the 0.5 migrations. |
| P0.5a | Migrate the agent leg behind the provider | 0 | todo | |
| P0.5b | Migrate dial pad / interaction creation | 0 | todo | |
| P0.5c | Migrate scripted scenario timers | 0 | todo | |
| P0.6 | Customer console route + handshake | 0 | todo | |
| P0.7 | Scenario script format | 0 | todo | |
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

- **Type-check baseline: 12 errors** from `npx tsc -b --noEmit` (2026-10-13, after the lyra-ui sync and type-only fixes; was 219 → 31 → 12). Steps verify by filtering tsc output to the files they touch, not by total count. Breakdown:
  - **3 inside lyra-ui itself** (its own baseline): `admin-shell.tsx` ×2 (TS2554), `list-item.tsx` ×1 (TS2430).
  - **1 missing dev dependency**: `src/components/ui/__stories__/Shell.stories.tsx` — `@storybook/react` isn't installed in this app.
  - **8 app-side, being fixed in the follow-up commit** (behavior-touching): `onCurrentStatusChange` not passed to the 3 preview `InteractionTranscript`s (Advanced ×2, Desk ×1); lucas-thomas pill `color="neutral"` (`neutral` isn't a pill color); `customerName` `string | undefined` into `VideoCallWindow`/`VideoCallFullScreen` ×4.
- **Follow-up (rule-zero cleanup): 43 raw `<button` elements in `src/`** (`grep -rn "<button" src --include=*.tsx`) that CLAUDE.md says should be lyra `Button`/`ActionIconButton`/an existing button atom. Pre-existing; not part of any Phase 0 step.
- **Follow-up (voice controls): upstream or keep local.** The local `agent-next-gen-voice-call-controls.tsx` is ahead of lyra's `voice-call-controls.tsx` (see PLAN.md Decisions). Upstreaming it is possible but only on explicit request.

## Deferred items

- **Email simulation** — composer, outbox-store, delivery states, console tab (PLAN.md "Parked"; prompt: P-PARKED).
- **SMS simulation** — same shape plus segment counting (PLAN.md "Parked"; prompt: P-PARKED).
