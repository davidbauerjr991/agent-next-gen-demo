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

- **Type-check baseline: 31 errors** from `npx tsc -b --noEmit` (2026-10-13, after the lyra-ui resolution chore; was 219 while `@nicecxone/lyra-ui` was untyped). All pre-existing; steps verify by filtering tsc output to the files they touch, not by total count. Breakdown:
  - **3 inside lyra-ui itself** (its own baseline): `admin-shell.tsx` ×2 (TS2554), `list-item.tsx` ×1 (TS2430).
  - **1 missing dev dependency**: `src/components/ui/__stories__/Shell.stories.tsx` — `@storybook/react` isn't installed in this app.
  - **27 app-side**, grouped by cause:
    - *lyra-ui API drift (10)* — app code no longer matches lyra-ui's current props:
      - `ContainerHeader` `title` is `string`, app passes `activePanelContent.title` (`ReactNode`) ×6 — `AgentWorkspaceAdvancedPage.tsx` 7723, 7866, 12139; `AgentWorkspace2WithDeskPage.tsx` 6818, 6964, 10665.
      - `CreateNewCustomerRecord` now requires `phones` ×2 — Advanced 2602, Desk 2737.
      - `Badge` has no `color`/`fontSize` props ×1 — `agent-next-gen-lucas-thomas-panels.tsx` 669.
      - Trigger child typed `ReactNode` where lyra expects a `ReactElement` ×1 — `agent-next-gen-customers-table.tsx` 415.
    - *React 19 `useRef` (4)* — `useRef<T>()` with no argument (React 19 types require an initial value): `App.tsx` 180, `ShellPage.tsx` 14, Advanced 4019, Desk 3604.
    - *`string | undefined` (6)* — mostly the optional `Interaction.customerName` passed where a `string` is required: Advanced 2317, 11309, 13381; Desk 2512, 9950, 11334.
    - *App-internal drift (7)* — app types that drifted apart, previously masked by `any` flowing out of lyra: `InteractionTranscript` call sites missing the required `onCurrentStatusChange` ×3 (Advanced 10259, 12590; Desk 8974); unknown `focusTabOverride` property ×1 (Desk 2843); dead `=== "voice"` comparisons on unions already narrowed to exclude voice ×3 (Advanced 10176, 10197, 10285).

## Deferred items

- **Email simulation** — composer, outbox-store, delivery states, console tab (PLAN.md "Parked"; prompt: P-PARKED).
- **SMS simulation** — same shape plus segment counting (PLAN.md "Parked"; prompt: P-PARKED).
