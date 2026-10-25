// The agent workspace's module constants (P-EXTRACT C8a, from
// AgentWorkspaceAdvancedPage.tsx).
import type { SelectOption } from "@nicecxone/lyra-ui";
import { ASSIGNMENT_SORT_OPTIONS } from "@/components/agent-next-gen-interaction-dashboard";
import type { SearchPanelTabKey } from "@/components/agent-next-gen-search-panel";
import type { ExtraHeaderApp } from "@/settings";
import { LUCAS_THOMAS_SCRIPT, MAYA_CHEN_SCRIPT, TOM_LEWIS_SCRIPT } from "@/scenarios";

// Per explicit request ("hide the toggle group for now"): the channel
// switching/outcome/history-tab pill row (`ChannelToggleGroup`, its own
// render site further down) is feature-flagged off rather than deleted —
// a named `const` (not a literal `false` at the use site, which trips
// `no-constant-binary-expression`) so it comes back with a one-line flip.
export const SHOW_CHANNEL_TOGGLE_GROUP = false;

/** How long a pointer rests on a header channel icon before its preview opens. */
export const HOVER_PREVIEW_OPEN_DELAY_MS = 250;

// Shared default width for the single app-header panel (Search/Customers/
// Accounts/Tickets/WEM/Screen Pop/Agent Chat/Schedule/Notifications) —
// renamed from `AI_PANEL_DEFAULT_WIDTH` now that Ask AI (its original sole
// occupant, back when each of these was its own independently-sized
// `Draggable`) has been removed from this app.
export const SHARED_PANEL_DEFAULT_WIDTH = 360;

// The true, VISUAL minimum content width the interaction record's own main
// content column (`containerRef`) and the docked shared panel (Notifications/
// AI/Apps/etc., `Draggable`'s own `minWidth`) should both deliver at their
// respective floors — per explicit request, so the two sit at the same
// on-screen size at minimum, not just the same raw CSS number. The two
// consumers read this differently because only ONE of them pays a padding
// tax on the way there (see `INTERACTION_MAIN_CONTENT_MIN_WIDTH`, just below,
// for why): the docked panel's own outer box has no padding of its own, so it
// passes this value straight through as its literal `minWidth` prop; the main
// content column needs to add its own padding back on top (that's exactly
// what `INTERACTION_MAIN_CONTENT_MIN_WIDTH` is for).
export const SHARED_CONTENT_MIN_VISUAL_WIDTH = 362;

// The interaction record's own main content column (record-header tab row +
// transcript + composer, `containerRef`'s div) — never renders narrower
// than this, even with a docked shared panel (Notifications/AI/Apps/etc.)
// open and LeftNav expanded. Below this, the record-header tab's own
// address/name label, the transcript bubbles, and the composer all started
// cramping/wrapping (confirmed live — the exact report that prompted this
// constant). Paired with `dockedPanelRenderWidth`'s own clamp (this docked
// panel's own render block, further down) rather than left as a plain CSS
// `min-w-[…]` floor on its own: a bare CSS floor with nothing else giving up
// space just pushes the WHOLE row past the viewport once every sibling's
// combined width exceeds what's actually available (confirmed live as an
// earlier, simpler attempt's actual failure mode) — the docked panel has to
// be the one that shrinks to make room, since it's the only sibling here
// with a size that's a preference (a drag-resized width) rather than a
// genuine floor of its own.
//
// `containerRef`'s own div is `border-box` sized (Tailwind's preflight
// default), so its `pr-3` (12px) right padding is CARVED OUT of a plain
// `min-w-[350px]` rather than added on top of it, leaving only 338px of
// actual usable content width for the record-header row/transcript/composer
// inside — confirmed live as the reason the row was still measurably
// narrower than intended even though the floor was technically "holding" at
// 350. This is `SHARED_CONTENT_MIN_VISUAL_WIDTH` (the real, usable-content
// target both this column and the docked panel should match) + 12 (this same
// `pr-3`), so the CONTENT area itself — not the padded border-box — never
// drops below `SHARED_CONTENT_MIN_VISUAL_WIDTH`. The docked panel does NOT
// need this same `+ 12` treatment — its own outer box carries no equivalent
// padding, so `SHARED_CONTENT_MIN_VISUAL_WIDTH` alone already lands it at the
// same real visual width as this column's floor.
//
// Two call sites read this: the plain CSS floor itself is a literal
// `min-w-[374px]` on `containerRef`'s own div (Tailwind's arbitrary-value
// classes need a literal string at build time, same reason
// `CUSTOMER_INFO_COLUMN_MINWIDTHS` above pairs each column's own
// `min-w-[…]` string with a plain numeric `minWidthPx` for JS math) — keep
// that literal in sync with this constant by hand if it ever changes.
export const INTERACTION_MAIN_CONTENT_MIN_WIDTH = SHARED_CONTENT_MIN_VISUAL_WIDTH + 12;

// Screen Pop — external apps an agent can pop the current contact/record
// into. Dummy list; wiring an actual screen-pop integration per app is out
// of scope for now.
export const SCREEN_POP_APPS: SelectOption[] = [
  { value: "salesforce",         label: "Salesforce" },
  { value: "zendesk",            label: "Zendesk" },
  { value: "servicenow",         label: "ServiceNow" },
  { value: "hubspot",            label: "HubSpot" },
  { value: "freshdesk",          label: "Freshdesk" },
  { value: "script",             label: "Script" },
  { value: "launch",             label: "Launch" },
  { value: "custom-workspace",   label: "Custom Workspace" },
];

// Search panel's own sub-tabs (`useSearchPanelContent`, agent-next-gen-
// search-panel.tsx) — all 4 tabs, with "interactions" listed FIRST per
// explicit request (was "customers" first, per an earlier explicit
// request — reverted per this later one, "have Interactions be the first
// tab visible" instead): that hook treats the first entry as both the
// leftmost tab AND its own default active tab. `AgentWorkspace2WithDeskPage.tsx`
// passes its own, shorter list (just Messages/Threads) to the same hook
// instead of this constant — see that file's own call site.
export const SEARCH_PANEL_TABS: SearchPanelTabKey[] = ["interactions", "customers", "messages", "threads"];
export const CUSTOMERS_ONLY: ExtraHeaderApp[] = ["customers"];

// Per explicit request ("remove longest wait and match sorting (ascending/
// descending) to the Phase 1 current menu") — this tier now drops "Longest
// Wait" from the Assignments sort picker too, matching `AgentNextGenPage
// .tsx`'s own `PHASE1_ASSIGNMENT_SORT_OPTIONS` (see that file's own doc
// comment for the fuller "why" this filters the shared list rather than
// touching `ASSIGNMENT_SORT_OPTIONS` itself). Named for this tier rather
// than reusing Phase 1's own constant since it isn't exported.
export const ADVANCED_ASSIGNMENT_SORT_OPTIONS = ASSIGNMENT_SORT_OPTIONS.filter((o) => o.value !== "awaitingLongest");

// `buildOpenChannelTagger` (open channels per contact, for New Outbound and
// "+") moved to src/contact-handling/open-channel-tagger.ts in P0.5b.2,
// shared with Desk and keyed by the card's `entityId`.

// The scripted cases' chips and overviews, from their scripts (P0.7/P0.5c).
export const LUCAS_THOMAS_COPILOT_SUGGESTIONS: string[] = LUCAS_THOMAS_SCRIPT.content.copilot!.suggestions;
export const LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS: Record<string, string> = LUCAS_THOMAS_SCRIPT.content.copilot!.links;
export const LUCAS_THOMAS_COPILOT_SUGGESTION_REPLACEMENTS: Record<string, string> = LUCAS_THOMAS_SCRIPT.content.copilot!.replacements ?? {};
export const LUCAS_THOMAS_OVERVIEW = LUCAS_THOMAS_SCRIPT.content.overview!;
export const TOM_LEWIS_CALL_OVERVIEW = TOM_LEWIS_SCRIPT.content.overview!;
export const TOM_LEWIS_CALL_COPILOT_SUGGESTIONS: string[] = TOM_LEWIS_SCRIPT.content.copilot!.suggestions;
export const TOM_LEWIS_CALL_COPILOT_LINKS: Record<string, string> = TOM_LEWIS_SCRIPT.content.copilot!.links;
export const MAYA_CHEN_CALL_OVERVIEW = MAYA_CHEN_SCRIPT.content.overview!;
export const MAYA_CHEN_CALL_COPILOT_SUGGESTIONS: string[] = MAYA_CHEN_SCRIPT.content.copilot!.suggestions;
export const MAYA_CHEN_CALL_COPILOT_LINKS: Record<string, string> = MAYA_CHEN_SCRIPT.content.copilot!.links;

