# Layout matrix

Every layout variable in the agent workspace, its values, which built-in profile exercises which value, and the combinations the schema declares invalid or forced.

Hand-written in P-HOME-1n (2026-10-29). P-LAYOUT replaces it with a file generated from the parts and slots registries (`src/layout/`) and the built-in profiles (`src/settings/profiles.ts`) by `npm run docs`. Until then, update it in the same commit as any change to a variable below.

## Variables

| Setting | Values (default **bold**) | Phase 1 | Phase 2 | AI-first | Resolves to |
|---|---|---|---|---|---|
| `home.layout` | **oneColumn**, twoColumn | oneColumn | oneColumn | twoColumn | Home's own layout |
| `home.activityView` | **list**, table | list | list | list | the Activity feed's view |
| `assignments.placement` | **leftNav**, interiorPanel, none | leftNav | leftNav | leftNav | the `assignments` part's slot: `left-nav`, `interior-panel`, `home-top` (`src/layout/parts.ts`) |
| `ai.displayLocation` | **inline**, panel, main | inline | inline | main | where the AI feed and the threads go |
| `ai.canvasLayout` | stacked, **twoColumn** | twoColumn | twoColumn | twoColumn | the reference cards: a column, or stacked above the action area |
| `assignments.legs` | **tabs**, stream | tabs | tabs | tabs | one thread per channel (stream arrives with P-STREAM) |
| `voice.controlsLocation` | **bottom**, top | bottom | bottom | bottom | the voice bar |
| `header.apps.<app>.placement` | tab, leftnav, **header** | all off | customers / accounts / tickets: tab; wem / schedule: header; screenpop: off | as Phase 2 | each app's place |
| `header.agentChat.placement` | leftnav, **header** | header | header | header | the Agent chat drawer's trigger |

Parts that aren't settings yet, each with one slot today:

| Part | Slot | Allowed (P-LAYOUT offers the rest) |
|---|---|---|
| `contactDetails` (with Artifacts) | `reference` | reference, docked-panel |
| `experienceMemory` | `reference` | reference, docked-panel |
| `sessionDetails` | `reference` | reference, docked-panel |

## Values no built-in profile exercises

- `assignments.placement`: `interiorPanel`, `none`
- `ai.displayLocation`: `panel`
- `ai.canvasLayout`: `stacked`
- `home.activityView`: `table`
- `voice.controlsLocation`: `top`
- `assignments.legs`: `stream` (not offered until P-STREAM)
- `header.apps.<app>.placement`: `leftnav`
- `header.agentChat.placement`: `leftnav`

## Forced combinations (`SETTING_CONSTRAINTS`, enforced by the store)

| When | Forces | Reason shown in Settings |
|---|---|---|
| `assignments.placement` = none | `notifications.toasts.enabled` = true | Required while assignments aren't in the left nav |
| `assignments.placement` = none | `notifications.toasts.events.incoming` = true | Required while assignments aren't in the left nav ("On — required while assignments aren't in the left nav") |

A forced value is written even through a profile lock on its section (PLAN Decisions, 2026-10-29).

## Combinations that disable a control (Settings only, not yet declared as constraints)

| When | Disabled | Reason |
|---|---|---|
| `ai.displayLocation` = panel | `ai.canvasLayout` | Not used when AI display is In the Contact Details panel |
| `ai.displayLocation` = panel | `assignments.legs` | Contact Details panel uses tabs |
| `assignments.sort.mode` = custom | `assignments.sort.direction` | Custom uses your dragged order |

P-LAYOUT moves these into the constraint declarations (as `requires` rules) so the generated matrix lists them from data.
