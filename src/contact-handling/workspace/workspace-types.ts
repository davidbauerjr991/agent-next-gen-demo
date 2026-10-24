// The Workspace page's own types (P-EXTRACT): hoisted out of
// AgentWorkspaceAdvancedPage.tsx so the hooks and region components split
// out of it share one definition.
import type { KnowledgeArticleCardData, KnowledgeArticleWebLink } from "@/components/agent-next-gen-knowledge-article-card";
import type {
  LucasThomasMemoryFocus,
  LucasThomasOrderId,
  LucasThomasPanelKey,
  TomLewisCallPanelKey,
} from "@/components/agent-next-gen-lucas-thomas-panels";

// The Marcus Webb action-log detail panel and the "Do Something"
// knowledge-article panel share ONE floating `InteriorPanel` overlay
// (see `selectedDetailPanelContent`'s own doc comment at its render
// site) — this is the union of everything that ONE panel can show.
// `"article-link"` is reached by navigating WITHIN that panel (its own
// `onBack`), not by opening a second, nested one — nesting isn't
// supported anywhere in this app.
export type DetailPanelContent =
  | { kind: "article"; article: KnowledgeArticleCardData }
  | { kind: "article-link"; article: KnowledgeArticleCardData; link: KnowledgeArticleWebLink }
  | { kind: "lucas"; panel: LucasThomasPanelKey }
  | { kind: "lucas-memory"; focus: LucasThomasMemoryFocus }
  // `link`: the row that opened it (its own link, unique per row since P-EXTRACT): which row reads active, and its
  // Artifacts entry. Two rows with the same question and minute are still two results.
  | { kind: "lucas-instruction"; decision: string; text: string; time: string; link?: string }
  | { kind: "copilot-result"; text: string; time: string; link?: string }
  | { kind: "tom-call"; panel: TomLewisCallPanelKey }
  | { kind: "lucas-order"; orderId: LucasThomasOrderId; from?: "memory" | "purchases" }
  // A scripted case's registered panel (slide-over-registry.ts, P-SHRINK): its key, and for a Copilot row its question.
  | { kind: "registry"; caseKey: string; panel: string; text?: string; time?: string; link?: string }
  // AI display "main": a panel thread's Session Details, over the thread in the panel (k6 10).
  | { kind: "session" };

/** A side panel the agent opened on a card, listed in Contact Details' Artifacts card. */
export interface PanelArtifact {
  id: string;
  label: string;
  content: DetailPanelContent;
}

/** One channel's Outcome identity, `${cardId}:${threadKey}` (`outcomeDraftKey`). */
export type OutcomeKey = string;

export type PanelState = "closed" | "open" | "closing";

/* ── Single-container app-header panel ──
   Screen Pop/Agent Chat/Schedule/Notifications/Ask AI used to each be
   an independently open/mounted/positioned/sized `Draggable` (five full
   copies of this state, plus a `dockPanelExclusively` helper enforcing
   "only one of the five may be docked at once"). Per request ("Multiple
   Containers: false" — see lyra-ui's `Draggable.stories.tsx`
   `MultiplePanelsSingleDock` story and its own "Multiple Containers"
   control), there is now only ONE physical container — clicking a
   different button just swaps `activePanelKey` (and therefore which
   content shows) without the container itself resizing, repositioning,
   or replaying its open/close animation. That also makes the old
   "only one may be docked" rule trivially true (there's only ever one
   container to dock) instead of something to actively enforce.

   Notifications' actual content (previously only reachable via the
   standalone `AgentNotifications` component, which bakes its own header
   AND its own `Draggable` wrapper together) now comes from
   `useAgentNotificationsContent` (lyra-ui) — the same hook that
   component calls internally, so this is a second CALLER of that
   content, not a second, drifting copy of it. See lyra-ui's own "Single
   Container - Real Content" Storybook demo (`Draggable.stories.tsx`) for
   this exact pattern in isolation (that demo also includes Ask AI's
   content via `useAiPanelContent` — dropped from this app per request,
   but left in the shared demo since it's still a real, valid caller of
   that hook). */
export type PanelKey =
  | "notif"
  | "conversations"
  | "schedule"
  | "screenpop"
  | "customers"
  | "accounts"
  | "tickets"
  | "wem"
  | "search";
