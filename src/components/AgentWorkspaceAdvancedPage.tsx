// AgentWorkspaceAdvancedPage — labeled "Agent Workspace 2.0 | Phase 1" in
// the top-left app menu (agent-next-gen-outbound-data.tsx's
// `buildAppMenuGroups`) — was "Agent Workspace 2.0 | Phase 1B" (and, before
// that, "Agent Workspace 2.0 Advanced") until the original "Phase 1" page
// (`AgentNextGenPage.tsx`, the plain `"agent"` page) was removed per
// explicit request ("remove phase 1 for now - it is old ... rename the
// menu item Phase 1B to Phase 1 - completely delete the phase 1 files") —
// only this file's own display strings/app-menu label changed for that;
// its component/file name and internal `"agent-advanced"` page id/route
// (its own route at #/agent-advanced, App.tsx) were deliberately left
// as-is. This file was originally created as a duplicate of
// AgentNextGenPage.tsx (only the exported component's own name + this
// page's own display strings/page id were changed) — a genuinely separate
// file/component so edits to it never affected the original "Phase 1"
// page, and vice versa. That original is now deleted entirely, so this
// file (and AgentWorkspace2WithDeskPage.tsx, "Phase 2" — see that file's
// own top-of-file note, also originally duplicated from it) are the only
// two survivors of that lineage; the two are still NOT kept in sync with
// each other automatically.
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  AppHeader,
  AppNameMenu,
  CXoneLogo,
  Modal,
  useAgentNotificationsContent,
  Draggable,
  ContainerHeader,
  NotificationsBell,
  Avatar,
  AgentProfile,
  Container,
  PageHeader,
  Button,
  InlineNotification,
  getHoldSeverity,
  ActionIconButton,
  KebabMenuButton,
  PanelPinButton,
  useColumnReorder,
  Input,
  LeftNav,
  NavRail,
  useAddChannelButton,
  InteractionNavItem,
  Icon,
  Badge,
  Separator,
  DashboardQueue,
  AgentWelcomeMessage,
  TabList,
  Tab,
  ChannelToggle,
  ChannelToggleGroup,
  PlainToggleTab,
  ToggleGroup,
  Toast,
  ToastContainer,
  useToast,
  AgentLegDisconnectedToast,
  Select,
  Tooltip,
  Popover,
  PanelHeader,
  Tag,
  ProgressBar,
  AccordionHeadless,
  AccordionHeadlessItem,
  AccordionHeadlessContent,
  Spinner,
  type SelectOption,
  type SortDirection,
  type CreateNewOutboundConfig,
  type CreateNewOutboundContact,
  type InteractionChannel,
  type ChannelType,
  type InteractionNavItemProps,
  type ChannelOutcomeConfig,
  type AgentStatus,
  type AgentNotification,
  type DraggableVariant,
  type EmbeddablePanelContent,
  type MenuEntry,
  CHANNEL_TYPE_META,
  InteriorPanel,
  EmptyState,
} from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS, type CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { useScheduleContent } from "@nicecxone/lyra-ui";
import {
  initialsFor,
  generateContactId,
  formatElapsedTime,
  formatWaitTime,
  getAwaitingSeverity,
  CURRENT_AGENT_FIRST_NAME,
  CURRENT_AGENT_LAST_NAME,
  CURRENT_AGENT_ID,
  nextCustomerSortDirection,
  synthesizeChannelAddress,
  SHOW_ADD_CHANNEL_HEADER_BUTTON,
  buildCustomerContextOverviewInfo,
  type CustomerPriorContactInfo,
  type Page,
} from "@/components/agent-next-gen-shared-utils";
import {
  type TranscriptMessage,
  TRANSCRIPT_SESSION_STATUS_OPTIONS,
  OUTCOME_TAG_OPTIONS,
  OUTCOME_DISPOSITION_OPTIONS,
  OUTCOME_DEFAULT_SUMMARY,
  resolveCustomerAutoReply,
  InteractionTranscript,
  InteractionComposer,
  type Contact,
  TRANSCRIPT_SESSIONS,
  TRANSCRIPT_SESSIONS_VOICE,
  TRANSCRIPT_SESSIONS_EMAIL,
} from "@/components/agent-next-gen-transcript";
import {
  buildAppMenuGroups,
  OUTBOUND_TEAMS,
  OUTBOUND_TEAM_MEMBERS,
  OUTBOUND_CONFIG,
  OUTBOUND_AGENTS,
  CONTACT_HISTORY_OUTBOUND_CONTACTS,
  buildContactHistoryOutboundContacts,
} from "@/components/agent-next-gen-outbound-data";
import {
  type Thread,
  type Interaction,
  buildNavItems,
  type AssignmentSortValue,
  type AssignmentSortDirection,
  ASSIGNMENT_SORT_OPTIONS,
  sortAssignments,
  AssignmentsSectionCaption,
  interactionHasBreachedSla,
  INITIAL_NOTIFICATIONS,
  WELCOME_MODAL_LAST_LOGIN,
  INITIAL_QUEUE_SUB_ITEMS,
  LATEST_CONTACTS_STATIC,
  buildLatestContacts,
  PerformanceBreakdownCard,
  PerformanceSummaryCard,
} from "@/components/agent-next-gen-interaction-dashboard";
import { PageClockContext, usePageClock, usePageClockSource, useClockValue } from "@/components/agent-next-gen-page-clock";
import { QueueSimContext, useQueueSimSource } from "@/components/agent-next-gen-queue-sim";
import { ClockTick, QueueSubItems } from "@/components/agent-next-gen-clock-tick";
import {
  type ContactHistoryEntry,
  buildDismissedContactHistoryEntry,
  buildContactHistoryByRange,
  ContactHistoryCard,
  ContactHistoryEntryDetail,
  CONTACT_HISTORY,
} from "@/components/agent-next-gen-contact-history";
import { saveCaseRecord } from "@/components/agent-next-gen-case-database";
import {
  IfCapable,
  useAgentLegTransitions,
  useAgentState,
  useCapability,
  useInteractionProvider,
} from "@/provider-context";
import {
  buildOpenChannelTagger,
  directoryDisplayName,
  NewOutboundLauncher,
  useContactActivation,
  useContactCommands,
  useContactReopen,
  useNavCards,
  useNewAssignments,
  useOutboundDial,
  useOutboundSkills,
  type Activation,
} from "@/contact-handling";
import {
  type CustomerListRecord,
  CUSTOMER_LIST_RECORDS,
  type CustomerColKey,
  type CustomerFilterKey,
  CustomersListView,
} from "@/components/agent-next-gen-customers-table";
import { useSearchPanelContent, type SearchPanelTabKey } from "@/components/agent-next-gen-search-panel";
// `InteractionsListView` reimported directly per the "All Contacts"
// follow-up (`showAllContacts`, below) — the Search panel's own Contacts
// tab still renders it internally too (agent-next-gen-search-panel.tsx, via
// `useSearchPanelContent`), this is a second, independent render of the
// same component. `InteractionHistoryRecord` is still needed here for
// `handleOpenInteractionRow`'s own parameter type.
import {
  InteractionsListView,
  type InteractionHistoryRecord,
  buildContactHistoryEntryFromInteractionRecord,
} from "@/components/agent-next-gen-interactions-table";
import {
  type CustomerHistorySessionEntry,
  HistoryConversationView,
  CustomerInformationSidePanel,
  CustomerRowInfoPanel,
  AGENT_WORKSPACE_CUSTOMER_PANEL_TABS,
  type CustomerPanelTabLabel,
  buildCustomerInfoFields,
  useCustomerRecordDraft,
  findPossibleCustomerMatches,
  filterCustomersByQuery,
  // Feeds the docked `CustomerInformationSidePanel`/hover preview's own
  // `bodyOverride` — that panel's own render site has the fuller "why".
  DetailsPanelAccordions,
  ArtifactsListBody,
  // Feeds the "View customer info" `InteriorPanel` overlay's own content —
  // see `customerInfoOverlayContent`'s own doc comment for the fuller "why".
  useCustomerDetailsInteriorPanel,
  // Feeds the "Session" tab's editable body/footer — see
  // `sessionDetailsTabContent`'s own doc comment for the fuller "why".
  useSessionDetailsTabContent,
} from "@/components/agent-next-gen-customer-info-panel";
// PROTOTYPE — local-only, not in lyra-ui yet. See CollapsedChannelBadge's
// own doc comment for why, and CLAUDE.md's lyra-ui rules for the convention
// this follows (build new things locally, promote to lyra-ui only once
// explicitly asked).
import { CollapsedChannelBadge } from "@/components/CollapsedChannelBadge";
import { AddChannelAdHocButton } from "@/components/agent-next-gen-add-channel-button";
import { VoiceCallControls } from "@/components/agent-next-gen-voice-call-controls";
// Per explicit request ("if I push the L button on the keyboard it
// launches Marcus Webb's contact [in Premium] - do this for both Phase 1
// and 1B"): only this scenario's fixed identity is needed here — see the
// "L" trigger effect (below, right after `agentStatus`) for why this page
// doesn't also import the rest of this module's exports
// (`MarcusWebbScenarioState`, `saveMarcusWebbScenario`, etc.) the way
// `AgentWorkspace2WithDeskPage.tsx` ("Premium") does. Per a later explicit
// follow-up ("update the marcus webb assignment to be voice not chat"),
// this page builds its own voice `Thread`/`Interaction` directly (below)
// rather than importing `buildMarcusWebbInteraction` — that function is
// still chat-only, unchanged, since Premium's own "L" trigger and its
// whole scripted Copilot walkthrough still depend on it being a chat.
import { MARCUS_WEBB_ID, MARCUS_WEBB_CUSTOMER_ID, MARCUS_WEBB_CUSTOMER_NAME } from "@/components/agent-next-gen-marcus-webb-scenario";
import {
  LUCAS_THOMAS_ID,
  LUCAS_THOMAS_CHAT_TRANSCRIPT,
  LUCAS_THOMAS_INITIAL_COUNT,
  LUCAS_THOMAS_REALTIME_STEPS,
  LUCAS_THOMAS_DECISION_FOLLOWUPS,
  LUCAS_THOMAS_COPILOT_SUGGESTIONS,
  LUCAS_THOMAS_SHIPPING_APPROVAL_SUMMARY,
  LUCAS_THOMAS_UPSET_APPROVAL_SUMMARY,
  LUCAS_THOMAS_WRAP_UP,
  LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS,
  LUCAS_THOMAS_COPILOT_SUGGESTION_REPLACEMENTS,
  buildLucasThomasInteraction,
} from "@/components/agent-next-gen-lucas-thomas-scenario";
import {
  TOM_LEWIS_CALL_ID,
  TOM_LEWIS_CALL_LIVE_LINES,
  TOM_LEWIS_CALL_OVERVIEW,
  TOM_LEWIS_CALL_COPILOT_SUGGESTIONS,
  TOM_LEWIS_CALL_COPILOT_LINKS,
  buildTomLewisCallInteraction,
} from "@/components/agent-next-gen-tom-lewis-void-call-scenario";
import {
  MAYA_CHEN_CALL_ID,
  MAYA_CHEN_CALL_LIVE_LINES,
  MAYA_CHEN_CALL_OVERVIEW,
  MAYA_CHEN_CALL_COPILOT_SUGGESTIONS,
  MAYA_CHEN_CALL_COPILOT_LINKS,
  buildMayaChenCallInteraction,
} from "@/components/agent-next-gen-maya-chen-refund-call-scenario";
import {
  MarcusWebbNextBestActionCard,
  MarcusWebbActionDetailPanelBody,
  type MarcusWebbActionLogEntry,
  MarcusWebbOrderDetailPanelBody,
  MARCUS_WEBB_ORDER,
  type MarcusWebbOrderInfo,
  MarcusWebbTransactionsDetailPanelBody,
} from "@/components/agent-next-gen-marcus-webb-next-best-action-card";
import {
  KnowledgeArticleDetailPanelBody,
  KnowledgeArticleLinkDetailBody,
  type KnowledgeArticleCardData,
  type KnowledgeArticleWebLink,
} from "@/components/agent-next-gen-knowledge-article-card";
import {
  LUCAS_THOMAS_PANEL_TITLES,
  LucasThomasProductPanelBody,
  LucasThomasPaymentsPanelBody,
  LucasThomasPaymentLinkPanelBody,
  LucasThomasArticlePanelBody,
  LucasThomasPurchaseHistoryPanelBody,
  LucasThomasMemoryPanelBody,
  LucasThomasOrderPanelBody,
  LucasThomasInstructionPanelBody,
  LucasThomasFraudPanelBody,
  LucasThomasPreferencesPanelBody,
  LucasThomasAiAttemptsPanelBody,
  LucasThomasShippingPanelBody,
  LUCAS_THOMAS_ORDER_DETAILS,
  type LucasThomasOrderId,
  type LucasThomasPanelKey,
  type LucasThomasMemoryFocus,
  MarcusWebbMemoryPanelBody,
  TomLewisCallMemoryPanelBody,
  MayaChenCallMemoryPanelBody,
  TomLewisCallPanelBody,
  TOM_LEWIS_CALL_PANEL_TITLES,
  type TomLewisCallPanelKey,
  MarcusWebbCopilotPanelBody,
} from "@/components/agent-next-gen-lucas-thomas-panels";
import { InContactInteriorPanel } from "@/components/agent-next-gen-in-contact-panel";
import { VideoCallWindow, VideoCallFullScreen } from "@/components/agent-next-gen-video-window";
// The Marcus Webb action-log detail panel and the "Do Something"
// knowledge-article panel share ONE floating `InteriorPanel` overlay
// (see `selectedDetailPanelContent`'s own doc comment at its render
// site) — this is the union of everything that ONE panel can show.
// `"article-link"` is reached by navigating WITHIN that panel (its own
// `onBack`), not by opening a second, nested one — nesting isn't
// supported anywhere in this app.
type DetailPanelContent =
  | { kind: "action-log"; entry: MarcusWebbActionLogEntry }
  | { kind: "article"; article: KnowledgeArticleCardData }
  | { kind: "article-link"; article: KnowledgeArticleCardData; link: KnowledgeArticleWebLink }
  | { kind: "order"; order: MarcusWebbOrderInfo }
  | { kind: "lucas"; panel: LucasThomasPanelKey }
  | { kind: "lucas-memory"; focus: LucasThomasMemoryFocus }
  | { kind: "lucas-instruction"; decision: string; text: string; time: string }
  | { kind: "marcus-copilot"; id: string; text: string; time: string }
  | { kind: "tom-call"; panel: TomLewisCallPanelKey }
  | { kind: "lucas-order"; orderId: LucasThomasOrderId; from?: "memory" | "purchases" }
  | { kind: "transactions"; id: string; note: string; timestamp: string; date: string; showFullTransactions: boolean };
import appIcon from "@/assets/app-icon.svg";
import damagedHeadphonesImg from "@/assets/headphones.jpg";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  CircleDot,
  MinusCircle,
  UserCog,
  LayoutGrid,
  CalendarDays,
  MonitorUp,
  GripVertical,
  Move,
  Users,
  Building2,
  Ticket,
  Search,
  Bell,
  Pin,
  IdCard,
  PanelLeftClose,
  History,
  Maximize2,
  Minimize2,
  PhoneOutgoing,
  RotateCcw,
  Headphones,
  ChevronRight,
  CircleAlert,
  Inbox,
  Check,
  X,
  Phone,
  PhoneOff,
  ChevronDown,
  type LucideIcon,
  ArrowLeft,
} from "lucide-react";

/** Bare digits only — used to match a dialed/SMS'd phone number against
 *  `ContactHistoryEntry.phone` regardless of formatting (parens/dashes/
 *  spaces/country code). Ported from `AgentNextGenPage.tsx` ("Phase 1") for
 *  `findContactHistoryMatch`, below — see that function's own doc comment. */
/** Moves a persistent DOM host (which a React portal renders a stateful card into) into this spot in the layout, so the
 *  card keeps its state and timers while the surrounding column remounts on assignment switches. */
function PersistentHostSlot({ host }: { host: HTMLDivElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.appendChild(host);
    return () => {
      host.remove();
    };
  }, [host]);
  return <div ref={ref} className="contents" />;
}

function digitsOnly(value: string | undefined | null): string {
  return (value || "").replace(/\D/g, "");
}

/** Finds the real `CONTACT_HISTORY` case (agent-next-gen-contact-
 *  history.tsx) matching the active interaction, if any — grounds the
 *  Customer Context Overview's content in the customer's ACTUAL prior case
 *  instead of the generic hashed-pool fallback. Ported verbatim from
 *  `AgentNextGenPage.tsx` ("Phase 1") per explicit request to mirror that
 *  page's Customer Context Overview functionality here. Lives here, not in
 *  agent-next-gen-shared-utils.ts, per that file's own dependency-free rule
 *  (see `buildCustomerContextOverviewInfo`'s `priorContact` doc comment
 *  there).
 *
 *  Matches by phone digits first — `customerName` IS the raw dialed/SMS'd
 *  address itself for an unidentified voice/SMS contact — so this is the
 *  one join key that works across every interaction-launch code path
 *  without a dedicated customer-id thread. Falls back to `customerId`
 *  (when the interaction has a real one) and finally an exact name match,
 *  for a chat contact where `customerName` is an actual name rather than a
 *  phone number. */
function findContactHistoryMatch(
  customerName: string | undefined,
  customerId?: string
): ContactHistoryEntry | undefined {
  if (!customerName) return undefined;
  const dialedDigits = digitsOnly(customerName);
  if (dialedDigits.length >= 7) {
    const byPhone = CONTACT_HISTORY.find((entry) => entry.phone && digitsOnly(entry.phone) === dialedDigits);
    if (byPhone) return byPhone;
  }
  if (customerId) {
    const byId = CONTACT_HISTORY.find((entry) => entry.customerId === customerId);
    if (byId) return byId;
  }
  return CONTACT_HISTORY.find((entry) => entry.name.toLowerCase() === customerName.toLowerCase());
}

/** Extracts the plain fields `buildCustomerContextOverviewInfo` actually
 *  needs (its own `CustomerPriorContactInfo` param) off a matched
 *  `ContactHistoryEntry` — the entry's LAST transcript message (whichever
 *  side spoke last) or, for an email-only case, its `emailBody`, stands in
 *  for `transcriptExcerpt`. Ported verbatim from `AgentNextGenPage.tsx`
 *  ("Phase 1"). */
function extractPriorContactInfo(entry: ContactHistoryEntry | undefined): CustomerPriorContactInfo | undefined {
  if (!entry) return undefined;
  const lastMessage = entry.messages && entry.messages.length > 0 ? entry.messages[entry.messages.length - 1] : undefined;
  return {
    description: entry.description,
    skillName: entry.skillName,
    statusLabel: entry.statusLabel,
    transcriptExcerpt: lastMessage?.text ?? entry.emailBody,
  };
}

// Shared default width for the single app-header panel (Search/Customers/
// Accounts/Tickets/WEM/Screen Pop/Agent Chat/Schedule/Notifications) —
// renamed from `AI_PANEL_DEFAULT_WIDTH` now that Ask AI (its original sole
// occupant, back when each of these was its own independently-sized
// `Draggable`) has been removed from this app.
// ── AgentWorkspaceAdvancedPage ── (see agent-next-gen-shared-utils.ts and sibling
// agent-next-gen-*.ts(x) files for everything this component itself no
// longer declares — split out once this file crossed Babel's 500KB
// code-generator threshold)
// Per explicit request ("hide the toggle group for now"): the channel
// switching/outcome/history-tab pill row (`ChannelToggleGroup`, its own
// render site further down) is feature-flagged off rather than deleted —
// a named `const` (not a literal `false` at the use site, which trips
// `no-constant-binary-expression`) so it comes back with a one-line flip.
const SHOW_CHANNEL_TOGGLE_GROUP = false;
// Per explicit request ("hide the '+' add channel button in the contact
// page header - this will only have inbound/outbound voice capabilities"),
// later broadened by an explicit follow-up ("hide the '+' add icon button
// from the header of the interactionNavItems in phase 1 since we can't add
// new channels"): this deployment of Phase 1 is voice-only, so an agent
// should never be offered an ad-hoc non-voice channel to launch from
// EITHER the record header's own standalone "+" trigger OR the LeftNav
// card's own inline "+" (Add Channel) row on the active card — both read
// off this one flag now (renamed from the original, record-header-only
// `SHOW_RECORD_HEADER_ADD_CHANNEL_BUTTON`, once a second render site
// needed it too). Deliberately still NOT a flip of the shared, app-wide
// `SHOW_ADD_CHANNEL_HEADER_BUTTON` import (agent-next-gen-shared-utils.ts)
// itself — this const only gates the two render sites in THIS file, so a
// future deployment that wants the header trigger back has a single,
// local, one-line flip rather than having to touch the shared default
// every other page using that import also reads. Same "named const, not a
// literal `false` at the use site" reasoning as `SHOW_CHANNEL_TOGGLE_GROUP`
// just above (avoids `no-constant-binary-expression`).
const SHOW_ADD_CHANNEL_HEADER_BUTTONS = false;

// Whether the record header's per-channel icon row renders an icon for a
// VOICE thread. Off in this deployment (voice is the only channel, so the
// icon just duplicates the phone icon already in the record header) — the
// guard used to be a hard-coded `if (c.type === "voice") return null`, which
// also made TypeScript narrow `c.type` to exclude "voice" for the rest of
// that callback and flag the voice special-cases below as dead. They're kept
// on purpose (a future multi-channel deployment needs them again), so the
// restore is now this one-word flip. Annotated `boolean` (not a bare
// `false`) so the guard doesn't narrow on a literal.
const SHOW_VOICE_CHANNEL_HEADER_ICON: boolean = false;

const SHARED_PANEL_DEFAULT_WIDTH = 360;

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
const SHARED_CONTENT_MIN_VISUAL_WIDTH = 362;

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
const INTERACTION_MAIN_CONTENT_MIN_WIDTH = SHARED_CONTENT_MIN_VISUAL_WIDTH + 12;

// Screen Pop — visual mock of an external app's login screen, shown in
// place of a real embed. Real screen-pop targets like Salesforce/Zendesk
// send clickjack-protection headers (X-Frame-Options / CSP frame-ancestors)
// on their login and app pages specifically to refuse cross-origin
// iframing — that protection lives on THEIR side and can't be relaxed from
// a consumer/embedding page no matter how it's built (see
// support.zendesk.com's own "Embedding Zendesk into an iframe is not
// allowed" article, and the equivalent Salesforce clickjack protection on
// login.salesforce.com). So rather than a broken/blank iframe, each app
// gets a hand-rolled, obviously-fake login card instead — every field is
// `disabled` and the button/links are non-interactive, and the badge under
// the card spells out that it's a mock, so it can never be mistaken for a
// real login prompt (or an actual authentication surface asking for real
// credentials).
function MockLoginCard({
  appName,
  accent,
  logo,
  usernameLabel = "Username",
  usernamePlaceholder = "username@company.com",
  buttonLabel = "Log In",
  footerLink = "Forgot Your Password?",
  rememberMe = true,
}: {
  appName: string;
  accent: string;
  logo: React.ReactNode;
  usernameLabel?: string;
  usernamePlaceholder?: string;
  buttonLabel?: string;
  footerLink?: string;
  rememberMe?: boolean;
}) {
  return (
    <div className="overflow-y-auto flex-1 flex flex-col items-center bg-[#f4f6f9] px-4 pt-10 pb-6 gap-4">
      <div className="w-full max-w-[280px] bg-white rounded-lg shadow-md border border-[#e5e5e5] flex flex-col items-center px-7 py-8">
        {logo}
        <div className="flex flex-col gap-1 w-full mb-3 mt-1">
          <label className="text-xs text-[#3e3e3c]">{usernameLabel}</label>
          <input
            type="text"
            disabled
            placeholder={usernamePlaceholder}
            className="border border-[#c9c9c9] rounded px-2.5 py-2 text-sm text-[#3e3e3c] placeholder:text-[#aeaeae] bg-white disabled:opacity-100 disabled:cursor-not-allowed focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1 w-full mb-3">
          <label className="text-xs text-[#3e3e3c]">Password</label>
          <input
            type="password"
            disabled
            placeholder="••••••••"
            className="border border-[#c9c9c9] rounded px-2.5 py-2 text-sm text-[#3e3e3c] bg-white disabled:opacity-100 disabled:cursor-not-allowed focus:outline-none"
          />
        </div>
        {rememberMe && (
          <label className="flex items-center gap-2 text-xs text-[#3e3e3c] w-full mb-4">
            <input type="checkbox" disabled defaultChecked className="disabled:cursor-not-allowed" />
            Remember me
          </label>
        )}
        <button
          type="button"
          disabled
          style={{ backgroundColor: accent }}
          className="w-full text-white text-sm font-medium rounded px-4 py-2 mb-3 disabled:opacity-100 cursor-not-allowed"
        >
          {buttonLabel}
        </button>
        <a className="text-xs pointer-events-none" style={{ color: accent }}>{footerLink}</a>
      </div>
      <span className="lyra-body-xs text-lyra-fg-disabled bg-lyra-bg-surface-container-subtle border border-lyra-border-subtle rounded-full px-2.5 py-1">
        Mock preview — not a live {appName} session
      </span>
    </div>
  );
}

// Wraps a single `InteractionNavItem` (plus its collapsed-rail-only
// `CollapsedChannelBadge` overlay) behind ONE stable top-level element,
// rather than the `.map()` callback below returning two structurally
// different shapes (a bare `InteractionNavItem` when expanded vs. a
// wrapping `<div className="relative">` around it + the badge when
// collapsed) depending on `navOpen`. That structural split is what broke
// `LeftNav`'s own hover-to-expand overlay mode (left-nav.tsx's
// `injectExpanded`) — per explicit bug report/screenshot: hovering the
// collapsed rail open visibly widened it to the full 256px panel (New
// Outbound's full label, "Assignments (N active)"'s full text — both
// plain top-level children of `header`, correctly re-cloned with
// `expanded={hoverOpen}`), but each interaction card stayed stuck as its
// small collapsed avatar tile instead of also switching to the full card.
// `injectExpanded` only clones `expanded` onto `header`'s own TOP-LEVEL
// children — with the collapsed-mode wrapper div in the way, that clone
// landed on a plain `<div>` (which just ignores an unknown `expanded`
// prop) instead of ever reaching the real `InteractionNavItem` nested
// inside it, which was left stuck on whatever `expanded={navOpen}` value
// `AgentNextGenPage` had explicitly hardcoded onto it (the PINNED
// open/closed state, not hover state) — so it never flipped along with
// hovering, no matter how wide the rail visibly got.
//
// This component is the fix: the `.map()` below now always returns ONE
// `<InteractionNavCard>` per card, unconditionally, so `injectExpanded`
// always has a single real element to clone `expanded` onto. Internally,
// THIS component (not the caller) decides whether to render the plain
// expanded card or the collapsed tile + badge, based on whatever
// `expanded` value it actually received — which is exactly the value
// `injectExpanded` just overwrote when hovering open in overlay mode, so
// the decision now correctly follows hover state, not just `navOpen`.
interface InteractionNavCardProps extends InteractionNavItemProps {
  /** This interaction's current channel type — only used for the
   *  collapsed-rail badge (see `showChannelBadge` below); ignored once
   *  `expanded` is true, since the expanded card already shows a per-
   *  channel chip for each open channel. */
  currentChannelType?: ChannelType;
  /** Whether the collapsed-rail badge should render at all — false once a
   *  card has more than one open channel, since `InteractionNavItem`
   *  already renders its own multi-channel count badge in that exact same
   *  corner (see `CollapsedChannelBadge`'s own doc comment for why the two
   *  are mutually exclusive). */
  showChannelBadge: boolean;
  /** Same "success"/"warning"/"critical" SLA tier the expanded card's own
   *  `awaitingSeverity` prop already resolves — passed straight through to
   *  `CollapsedChannelBadge` so the collapsed badge escalates in lockstep
   *  with the rest of the card. */
  badgeSeverity?: "success" | "warning" | "critical";
  /** Per explicit request ("in the interactionNavItem when a call is put
   *  on hold and the panel is collapsed make the channel badge a pause
   *  icon and change the color to warning") — true when this card's live
   *  voice thread is currently held (`c.heldByAgent`, same field the
   *  expanded card's own on-hold timer reads — see that render site's own
   *  doc comment). Passed straight through to `CollapsedChannelBadge`'s own
   *  `onHold` prop. */
  cardOnHold?: boolean;
  /** Hold SLA tier for the collapsed badge (15s warning / 30s critical). */
  cardHoldSeverity?: "success" | "warning" | "critical";
  /** True while the tile animates out (e.g. a declined incoming call). */
  leaving?: boolean;
}
function InteractionNavCard({
  leaving,
  currentChannelType,
  showChannelBadge,
  badgeSeverity,
  cardOnHold,
  cardHoldSeverity,
  expanded,
  ...itemProps
}: InteractionNavCardProps) {
  // The outer wrapper is stable across expanded/collapsed, so the entrance (slight fade in from the left) plays once when
  // the tile first appears and not again when the rail expands or collapses.
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-in ${
        leaving
          ? "pointer-events-none grid-rows-[0fr] -translate-x-4 opacity-0"
          : "animate-in fade-in-0 slide-in-from-left-2 grid-rows-[1fr]"
      }`}
    >
     <div className="min-h-0 overflow-hidden">
      {!expanded ? (
        <div className="relative">
          <InteractionNavItem expanded={expanded} {...itemProps} />
          {currentChannelType && showChannelBadge && (
            <CollapsedChannelBadge type={currentChannelType} severity={badgeSeverity} onHold={cardOnHold} holdSeverity={cardHoldSeverity} />
          )}
        </div>
      ) : (
        <InteractionNavItem expanded={expanded} {...itemProps} />
      )}
     </div>
    </div>
  );
}

// Screen Pop — external apps an agent can pop the current contact/record
// into. Dummy list; wiring an actual screen-pop integration per app is out
// of scope for now.
const SCREEN_POP_APPS: SelectOption[] = [
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
const SEARCH_PANEL_TABS: SearchPanelTabKey[] = ["interactions", "customers", "messages", "threads"];

// Per explicit request ("remove longest wait and match sorting (ascending/
// descending) to the Phase 1 current menu") — this tier now drops "Longest
// Wait" from the Assignments sort picker too, matching `AgentNextGenPage
// .tsx`'s own `PHASE1_ASSIGNMENT_SORT_OPTIONS` (see that file's own doc
// comment for the fuller "why" this filters the shared list rather than
// touching `ASSIGNMENT_SORT_OPTIONS` itself). Named for this tier rather
// than reusing Phase 1's own constant since it isn't exported.
const ADVANCED_ASSIGNMENT_SORT_OPTIONS = ASSIGNMENT_SORT_OPTIONS.filter((o) => o.value !== "awaitingLongest");

// `buildOpenChannelTagger` (open channels per contact, for New Outbound and
// "+") moved to src/contact-handling/open-channel-tagger.ts in P0.5b.2,
// shared with Desk and keyed by the card's `entityId`.

/** The scripted scenario cards — the only cards this page still owns
 *  (P0.5b.2); every other card is a provider contact. Until P0.5c. */
const ADVANCED_SCENARIO_CARD_IDS = new Set<string>([MARCUS_WEBB_ID, LUCAS_THOMAS_ID, TOM_LEWIS_CALL_ID, MAYA_CHEN_CALL_ID]);
const isAdvancedScenarioCardId = (id: string) => ADVANCED_SCENARIO_CARD_IDS.has(id);

/** Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0) per
 *  this codebase's "no shared sync" convention (see BEHAVIOR.md) — used
 *  ONLY for the unknown-contact record-header subtitle (see the
 *  `resolveActiveChannelDateTimeLabel` doc comment below, and the
 *  `PageHeader`'s `subtitle` render call site further down this file). */
function formatCompactDateTime(input: string | Date): string | undefined {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return undefined;
  const datePart = date.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

/** Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0) per
 *  this codebase's "no shared sync" convention — see that file's own doc
 *  comment on this same function for the full priority-order rationale.
 *  Used ONLY for the unknown-contact record-header subtitle (this tier's
 *  real-customer subtitle is untouched by this port). */
function resolveActiveChannelDateTimeLabel(
  channelType: ChannelType | undefined,
  isFreshLaunch: boolean,
  activeChannel: Thread | undefined,
  launchedAt: string | undefined
): string | undefined {
  const reopened = activeChannel?.reopenedContacts?.[activeChannel.reopenedContacts.length - 1];
  if (reopened) {
    return formatCompactDateTime(`${reopened.date} ${reopened.startTime}`);
  }
  if (isFreshLaunch) {
    const isTextChannel = channelType === "chat" || channelType === "sms" || channelType === "whatsapp";
    if (isTextChannel) {
      return launchedAt ? formatCompactDateTime(launchedAt) : "Draft";
    }
    return formatCompactDateTime(new Date());
  }
  const baseSessions =
    channelType === "email"
      ? TRANSCRIPT_SESSIONS_EMAIL
      : channelType === "voice"
        ? TRANSCRIPT_SESSIONS_VOICE
        : channelType === "chat" || channelType === "sms" || channelType === "whatsapp"
          ? TRANSCRIPT_SESSIONS
          : undefined;
  const lastSession = baseSessions?.[baseSessions.length - 1];
  if (!lastSession) return undefined;
  return formatCompactDateTime(`${lastSession.date} ${lastSession.startTime}`);
}

/** Finds the most recent real customer-response timestamp across EVERY
 *  thread on an interaction (not just the active one) and formats it with
 *  `formatCompactDateTime` — feeds the record-header subtitle's
 *  "{N} channels open | Last Customer Response: {date/time}" pattern below,
 *  per explicit follow-up request, shown once 2+ channels are open in place
 *  of the single active channel's own "{icon} {label} | {date}" line (that
 *  line stops meaning much once several channels are live at once — this
 *  answers "when did the customer last actually say something," across
 *  whichever channel that happened on).
 *
 *  Resolution per thread, most authoritative first:
 *  1. `lastCustomerMessageTick` — set the instant a real (or simulated)
 *     customer reply lands on THIS session (`handleSendMessage`'s reply
 *     timeout). It's a `clockTick` value — real elapsed seconds since this
 *     page mounted (the page clock's 1-per-second tick, see `clock`'s doc
 *     comment in the page) — so `pageMountTimeMs + tick * 1000` gives
 *     an exact, real wall-clock `Date`, not a mock string.
 *  2. `reopenedContacts` — a thread reopened from Contact History carries a
 *     real historical date/time of its own even with no live reply yet.
 *  3. A genuinely fresh (`interaction.startedFresh`) thread with neither of
 *     the above has had NO customer response at all — skipped outright,
 *     deliberately NOT falling through to canned session data (that would
 *     surface stale, unrelated mock history for a channel the customer
 *     hasn't touched, the same "isFreshLaunch short-circuits before the
 *     canned branch" reasoning `resolveActiveChannelDateTimeLabel` above
 *     already applies).
 *  4. Otherwise (a pre-existing/real customer channel, no live activity
 *     this session) — that channel type's last canned session's own last
 *     CUSTOMER-sender message timestamp (chat/sms/whatsapp only; Voice/
 *     Email's canned sessions ship an empty `messages: []`, so those fall
 *     back to the session's own `startTime`, same as
 *     `resolveActiveChannelDateTimeLabel`'s own base-session fallback).
 *
 *  Returns `undefined` (not a broken "Last Customer Response: undefined"
 *  string) when NONE of the interaction's threads have any qualifying
 *  response yet — the subtitle then reads just "{N} channels open" with no
 *  trailing clause. */
function resolveInteractionLastCustomerResponseLabel(
  interaction: Interaction,
  pageMountTimeMs: number
): string | undefined {
  let latest: Date | undefined;
  const consider = (candidate: Date | undefined) => {
    if (candidate && !Number.isNaN(candidate.getTime()) && (!latest || candidate.getTime() > latest.getTime())) {
      latest = candidate;
    }
  };
  for (const c of interaction.threads) {
    if (c.lastCustomerMessageTick !== undefined) {
      consider(new Date(pageMountTimeMs + c.lastCustomerMessageTick * 1000));
      continue;
    }
    const reopened = c.reopenedContacts?.[c.reopenedContacts.length - 1];
    if (reopened) {
      consider(new Date(`${reopened.date} ${reopened.startTime}`));
      continue;
    }
    // Per-THREAD, not `interaction.startedFresh` — see `Thread.startedFresh`'s
    // own doc comment. This loop already iterates per-thread (`c`); a
    // genuinely fresh thread (no history to fall back to) skips the canned
    // fallback below regardless of whether the interaction it lives on was
    // itself born fresh or resumed from history.
    if (c.startedFresh) continue;
    const baseSessions =
      c.type === "email"
        ? TRANSCRIPT_SESSIONS_EMAIL
        : c.type === "voice"
          ? TRANSCRIPT_SESSIONS_VOICE
          : c.type === "chat" || c.type === "sms" || c.type === "whatsapp"
            ? TRANSCRIPT_SESSIONS
            : undefined;
    const lastSession = baseSessions?.[baseSessions.length - 1];
    if (!lastSession) continue;
    const lastCustomerMessage = [...lastSession.messages].reverse().find((m) => m.sender === "customer");
    consider(new Date(`${lastSession.date} ${lastCustomerMessage?.timestamp ?? lastSession.startTime}`));
  }
  return latest ? formatCompactDateTime(latest) : undefined;
}

// Per explicit request, hold off on auto-dismissing the Marcus Webb
// assignment once its scripted flow completes, while the agent is
// testing — "hide, don't destroy": `onAssignmentClosed`'s call site
// below stays fully wired, just gated on this flag. Flip back to `true`
// to re-enable.
const MARCUS_WEBB_AUTO_DISMISS_ON_CLOSE = false;

// Per explicit request ("remove the ability to hang up from the
// interactionNavItem overall") — "hide, don't destroy": the left-nav
// channel builder's own `onEndCall` computation stays fully wired, just
// gated off by this flag. Hanging up a call still works from the main
// call-controls bar's own "End Call" button (`VoiceCallControls`'s
// `onHangUp`) regardless of this flag — that's a separate, independent
// code path that isn't affected either way. Flip back to `true` to
// restore the left-nav's own standalone End Call icon.
const SHOW_END_CALL_IN_INTERACTION_NAV_ROWS = false;

/* ── MARCUS_WEBB_CALL_TRANSCRIPT ──
 *  Turn-by-turn transcript for Marcus's voice call, wired into his
 *  `Interaction.liveMessages.voice` (see the "L" keydown handler, below)
 *  so it renders as real message bubbles the moment the contact goes into
 *  review mode — per explicit request ("for reviewed contacts, display the
 *  transcript in the session details panel when the contact goes into
 *  review mode... create a transcript for the marcus webb call between
 *  marcus and the AI Agent"). `onReview` (far below, the notice's own
 *  render site) is what actually flips `customerPanelActiveTab` to
 *  "Transcript" and opens the docked panel so this is visible the instant
 *  review starts, rather than only whenever the agent happens to click
 *  into the Transcript tab themselves.
 *
 *  Dramatizes the exact 2-step scenario from the attached overview image:
 *  a Cognigy virtual agent handles an inbound refund request for a
 *  damaged product, looks up the order and finds it's valued at $200 —
 *  above the $100 refund limit it's authorized to approve on its own — and
 *  escalates by telling the customer it needs supervisor sign-off, then
 *  places them on hold pending human review. That hold is precisely the
 *  moment "L" surfaces the incoming-notice/review flow, so the transcript
 *  ends there rather than resolving the refund itself. */
const MARCUS_WEBB_CALL_TRANSCRIPT: TranscriptMessage[] = [
  {
    id: "mw-t1",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:41 AM",
    text: "Thanks for calling in — I'm the virtual assistant today. Can you tell me a bit about what's going on?",
  },
  {
    id: "mw-t2",
    sender: "customer",
    name: MARCUS_WEBB_CUSTOMER_NAME,
    initials: "MW",
    timestamp: "9:41 AM",
    text: "Hi, yeah — I ordered a pair of noise-cancelling headphones and they showed up with a cracked ear cup. I'd like a refund.",
  },
  {
    id: "mw-t3",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:42 AM",
    text: "I'm sorry to hear that — a damaged item on arrival definitely qualifies for a refund. Let me pull up your order.",
  },
  {
    id: "mw-t4",
    sender: "customer",
    name: MARCUS_WEBB_CUSTOMER_NAME,
    initials: "MW",
    timestamp: "9:42 AM",
    text: "Sure, it's order number 48213, placed last Tuesday.",
  },
  {
    id: "mw-t5",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:43 AM",
    text: "Found it — the headphones on that order are valued at $200. I'm authorized to approve refunds up to $100 on my own, so this one comes in just above what I can approve directly.",
  },
  {
    id: "mw-t6",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:43 AM",
    text: "I'll need to check with a supervisor before I can process it. Would you mind holding for a moment while I flag this for a human agent to review?",
  },
  {
    id: "mw-t7",
    sender: "customer",
    name: MARCUS_WEBB_CUSTOMER_NAME,
    initials: "MW",
    timestamp: "9:44 AM",
    text: "That's fine, I can hold.",
  },
  {
    id: "mw-t8",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:44 AM",
    text: "Thank you for your patience — please hold while I connect with a supervisor for approval on this $200 refund.",
  },
];

/* ── MarcusWebbIncomingCallNotice ──
 *  Per explicit request ("when a new call comes in (clicking the 'L' button
 *  to launch marcus webb) open a popover/toast that displays [a Copilot
 *  case-summary card]... this should animate up from the bottom of the
 *  screen... do not add the assignment to the assignment panel until an
 *  action is taken on the popover toast... use a popover component from
 *  lyra-ui... have it appear in the toast area and animate upward"):
 *  replaces the "L" trigger's old behavior of dropping Marcus straight into
 *  the left nav the instant the key is pressed. Now the trigger only builds
 *  the `Interaction` and holds it (see `marcusWebbPendingInteractionRef`,
 *  below `agentStatus`) — this card is what the agent actually sees, and
 *  `interactions` isn't touched until they click "Review" or "Takeover".
 *
 *  Built from lyra-ui primitives, matching the reference mockup's own
 *  layout: `Container variant="info"` for the case-summary card (same blue
 *  tint `ProgressBar.stories.tsx`'s "AI Confidence" demo already uses for
 *  this exact kind of copy), `Tag variant="critical"` for the "Escalated"
 *  pill (the same variant `agent-next-gen-contact-history.tsx` already
 *  uses for that exact status word), `ProgressBar` for AI Confidence. Per
 *  explicit follow-up requests, the card no longer includes an "Ask
 *  Copilot about this Case" input, nor the `DetailsPanelAccordions`
 *  Customer Profile/Contact Snapshot/Files section — it ends with the
 *  Case Summary container. `contextOverview` is still accepted/computed
 *  by the caller (`marcusWebbContextOverviewInfo`) but is currently unused
 *  by this component now that that section is gone.
 *
 *  The actual "animate upward from the toast area" mechanics are the
 *  CALLER's job, not this component's: the render site wraps this card's
 *  content in a lyra-ui `Popover` (`asAnchor`, `placement="top"`) anchored
 *  to a plain span planted directly inside the same `fixed bottom-4 right-4`
 *  block that already renders every other toast — `placement="top"` is what
 *  gets Popover's own existing `data-[side=top]:slide-in-from-bottom-2` /
 *  `slide-out-to-bottom-1` animate-in/out classes (popover.tsx) for free,
 *  with zero new CSS needed here. This component is purely the card's own
 *  content/copy.
 *
 *  Per a later explicit follow-up request ("hide the contact snapshot and
 *  review/takeover buttons and add a close button to the top right of the
 *  toast. In addition, load the assignment tile in the left nav when the
 *  toast comes in") — this reverses the "don't add the assignment until an
 *  action is taken" behavior described above: the "L" keydown handler now
 *  commits Marcus's interaction (and sets `marcusWebbReviewing`) the
 *  instant the toast opens, not when Review/Takeover is clicked (see that
 *  handler's own doc comment). With the tile already in the left nav, this
 *  card became a lighter notice — Contact Snapshot and Takeover are hidden
 *  behind `SHOW_MARCUS_NOTICE_DETAILS` below ("hide, don't destroy," same
 *  as `SHOW_APPROVE_PROCESSING_STEPS`/`SHOW_DO_SOMETHING_INPUT` elsewhere
 *  in this file), and a real close button was added. Per a further
 *  explicit follow-up ("add the Review button back (dismiss the toast when
 *  review is clicked and navigate to the assignment)"), Review itself is
 *  unconditional again — it's the fast path straight into the
 *  already-loaded tile, while Takeover stays reachable only from inside
 *  the interaction (the "Reviewing this conversation" action bar's own
 *  independent Takeover button, which flips `marcusWebbReviewing` false). */
const SHOW_MARCUS_NOTICE_DETAILS = false;

function MarcusWebbIncomingCallNotice({
  contextOverview,
  onReview,
  onTakeover,
  onClose,
}: {
  /** Same shape `buildCustomerContextOverviewInfo` returns for every other
   *  consumer (`customerContextOverviewInfo`, this page's own docked-panel/
   *  hover-preview memo) — computed once for Marcus specifically
   *  (`marcusWebbContextOverviewInfo`, below `agentStatus`) rather than
   *  recomputed per render, same reasoning as that memo. */
  contextOverview: ReturnType<typeof buildCustomerContextOverviewInfo>;
  // `onReview` drives the always-visible Review button below. `onTakeover`
  // stays wired for whenever `SHOW_MARCUS_NOTICE_DETAILS` (below) is back
  // on — see that flag's own doc comment.
  onReview: () => void;
  onTakeover: () => void;
  /** Per explicit follow-up request ("add a close button to the top right
   *  of the toast") — the one way to dismiss this notice now that Review/
   *  Takeover are hidden by default. Only closes the notice itself; the
   *  interaction is already committed into `interactions` regardless (see
   *  the "L" keydown handler), so this doesn't need to touch anything
   *  else. */
  onClose: () => void;
}) {
  // Live "ringing" timer for the header chip (the "00:16" in the reference
  // mockup). The notice only mounts while it's open, so it counts from the
  // page-clock tick it mounted at: a later open starts from 00:00 again.
  // Only the chip's text re-renders each second (`<ClockTick>` below).
  const clock = usePageClock();
  const [openedAtTick] = useState(() => clock.now());
  // Per explicit follow-up request ("use the attached image as an
  // accordion within the popover toast"), Case Summary is now a genuine
  // collapsible accordion (chevron toggle, matching the reference
  // screenshot's own "Contact Snapshot" accordion styling — bulleted
  // content with the AI Confidence/Recommended Action boxes nested inside)
  // instead of the always-expanded plain `Container` it used to be. Kept
  // as local component state (not the shared `Accordion` component's own
  // `items`/`value` API) since there's exactly one section here and the
  // header row needs this card's own blue-tinted styling rather than
  // `Accordion`'s default row chrome — same externally-driven
  // `AccordionHeadless`/`-Item`/`-Content` building blocks
  // `agent-next-gen-transcript.tsx` already uses for the same reason
  // (a pill/button elsewhere drives `value`, not `AccordionPrimitive
  // .Trigger`). Per a later explicit follow-up request, starts CLOSED now
  // (reversing the reference screenshot's own chevron-up/expanded state).
  const [caseSummaryOpen, setCaseSummaryOpen] = useState(false);
  return (
    <div className="flex w-[400px] flex-col overflow-hidden rounded-lyra-lg border border-lyra-border-soft bg-lyra-bg-surface-overlay shadow-lg">
      {/* Header — avatar/name/status match `TranscriptSessionSeparator`'s
          own session-row conventions, except this bubble's own background
          (see its own doc comment just below) — not a plain text title,
          since this IS an incoming voice call notification. */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Per explicit follow-up request ("make the background of the
            avatar error instead of purple"), then ("use the hard red not
            the soft red, make the phone icon white"): this design system
            calls that severity color "critical", not "error" (see `Tag
            variant="critical"`, the "Escalated" tag right below, and
            `ActionBar`'s own `variant="error"` mapping internally to these
            same `status-critical-*` tokens) — `bg-lyra-status-critical-
            strong` (the "hard"/solid red, was `-subtle`) with `text-lyra-
            fg-on-primary` (white — the same token `Button`'s own
            `destructive` variant already uses for its label on a solid red
            fill) for the `Phone` icon below, rather than that icon reading
            in the critical-strong red itself (illegible against a same-red
            background). */}
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lyra-status-critical-strong text-lyra-fg-on-primary">
          {/* Incoming-call pulse — per explicit follow-up request ("reuse
              the spinner animation in the center of the avatar"): this
              swaps out the bespoke ring keyframes the previous pass added
              here for lyra-ui's own `Spinner` (`variant="circle"`) —
              already built for exactly this "circle growing from center,
              fading as it goes" pulse (spinner.tsx's own `lyra-circle-
              pulse` keyframes), so reused as-is rather than hand-rolling a
              second version of it. `size="lg"` (32px) sits just inside
              this 36px bubble; `absolute inset-0` centers it within the
              bubble without disturbing the `Phone` icon's own centering.
              `color="inverse"` (white) rather than the default `"primary"`
              blue — per explicit follow-up request, just to see how it
              reads against this bubble's own background.
              Rendered before the `Phone` icon so it sits behind it in
              paint order without needing an explicit z-index. */}
          <Spinner variant="circle" size="lg" color="inverse" className="absolute inset-0" />
          <Phone className="relative h-4 w-4" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="lyra-heading-sm text-lyra-fg-default truncate">Marcus Webb</span>
            {/* Per explicit follow-up request ("remove the pink rounded
                rectangle to the right of marcus webb in the toast") — the
                "Escalated" `Tag` that used to sit here is gone. */}
            <span className="shrink-0 rounded-lyra-sm border border-lyra-border-subtle px-1.5 py-0.5 lyra-body-sm text-lyra-fg-secondary tabular-nums">
              {/* Only this text ticks; the notice itself doesn't re-render. */}
              <ClockTick>
                {(clockTick) => {
                  const elapsedSeconds = clockTick - openedAtTick;
                  const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
                  const ss = String(elapsedSeconds % 60).padStart(2, "0");
                  return `${mm}:${ss}`;
                }}
              </ClockTick>
            </span>
          </div>
          <p className="lyra-body-sm text-lyra-fg-secondary mt-0.5 line-clamp-2">
            Voice Call escalation from AI Agent
          </p>
        </div>
        {/* Per explicit follow-up request ("add a close button to the top
            right of the toast") — last flex child of this `items-start`
            row, so it pins to the card's top-right corner for free with no
            extra positioning. `ActionIconButton` + `Tooltip` + lucide `X`,
            same icon-only-action convention this file already uses
            elsewhere (e.g. the docked panel's own "Full Screen" button).
            The render site's own `Popover` still `preventDefault()`s
            Escape/outside-click (see that doc comment) — this button is
            the one deliberate way to dismiss the notice now. */}
        <Tooltip content="Close" placement="top">
          <ActionIconButton
            aria-label="Close"
            size="sm"
            onClick={onClose}
            className="shrink-0 text-lyra-fg-secondary hover:text-lyra-fg-secondary"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </ActionIconButton>
        </Tooltip>
      </div>

      {SHOW_MARCUS_NOTICE_DETAILS && (
      <div className="flex flex-col gap-3 px-4 pb-4 max-h-[70vh] overflow-y-auto">
        <Container variant="info" className="overflow-hidden p-0">
          <AccordionHeadless
            type="single"
            collapsible
            value={caseSummaryOpen ? "case-summary" : ""}
            onValueChange={() => {}}
          >
            <AccordionHeadlessItem value="case-summary">
              {/* Header row IS the trigger — plain button (not
                  `AccordionPrimitive.Trigger`) driving the local
                  `caseSummaryOpen` state above, same externally-driven
                  shape this file's own doc comment on that state
                  describes. Chevron rotate mirrors `accordion.tsx`'s own
                  `Accordion` component chevron exactly (`ChevronDown`,
                  `rotate-180` when open), and so does the hover/active/
                  focus-visible treatment below (`accordion.tsx`'s own
                  `AccordionRow` trigger className) — this isn't that
                  component, but it should still feel like a clickable
                  accordion header, not a static label. */}
              <button
                type="button"
                onClick={() => setCaseSummaryOpen((v) => !v)}
                aria-expanded={caseSummaryOpen}
                className="flex w-full items-center justify-between gap-2 p-4 text-left transition-colors hover:bg-lyra-state-hover active:bg-lyra-state-pressed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus focus-visible:ring-inset"
              >
                {/* Per explicit follow-up request ("case summary should not
                    be all capitals") — `uppercase` dropped, same fix
                    "AI Confidence"/"Recommended Action" already got earlier
                    (see those spans' own doc comments a bit further down):
                    the text itself was already normal/title case, only the
                    CSS transform was still rendering it in all caps. Label
                    itself later changed to "Contact Snapshot" per a further
                    explicit follow-up request — the local `caseSummaryOpen`
                    state/handler name (and every other internal reference
                    to "Case Summary" in this file's own doc comments) are
                    left as-is; only this visible heading text changed.
                    `tracking-wide` (the letter-spacing behind the earlier
                    "not have tracking" report) later dropped too, and the
                    label itself capitalized to "Contact Snapshot" (was
                    lowercase "snapshot") per that same follow-up. Typography
                    changed from `lyra-body-sm-emphasis` to plain
                    `lyra-body-md` per a further follow-up ("make it body
                    copy md to match accordion component") — `accordion.tsx`'s
                    own `AccordionRow` renders every item's title as
                    `lyra-body-md` (no emphasis weight), and this hand-rolled
                    header is deliberately styled to read as an accordion
                    trigger (see this block's own top doc comment), so its
                    title text now matches that component's actual title
                    typography instead of a heavier one it never used. Color
                    (`text-lyra-fg-active-strong`) is unchanged — that's
                    this bar's own accent, not part of the typography match. */}
                <span className="lyra-body-md text-lyra-fg-active-strong">Contact Snapshot</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-lyra-fg-active-strong transition-transform duration-200",
                    caseSummaryOpen && "rotate-180"
                  )}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </button>
              <AccordionHeadlessContent>
                <div className="px-4 pb-4">
                  {/* Bulleted per the reference screenshot's own "Contact
                      Snapshot" accordion content style, replacing the
                      previous single Sparkles-accented paragraph. */}
                  <ul className="list-disc space-y-1 pl-4 lyra-body-md text-lyra-fg-default">
                    <li>Customer called in for a refund on a $200 order</li>
                    <li>Refund exceeds the AI agent's $100 auto-approval limit</li>
                    <li>Customer placed on hold, pending human approval</li>
                  </ul>
                  <div className="mt-3 rounded-lyra-md border border-lyra-border-soft bg-lyra-bg-surface-overlay p-3">
                    <div className="flex items-center justify-between">
                      <span className="lyra-body-sm-emphasis text-lyra-fg-secondary">AI Confidence</span>
                      <span className="lyra-heading-sm text-lyra-status-info-strong">91%</span>
                    </div>
                    <ProgressBar value={91} size="sm" className="mt-2" />
                    <p className="lyra-body-sm text-lyra-fg-secondary mt-2">
                      Straightforward refund request — the only reason for
                      escalation is that $200 is above the AI agent's own
                      approval limit.
                    </p>
                  </div>
                  <div className="mt-3 rounded-lyra-md border border-lyra-border-soft bg-lyra-bg-surface-overlay p-3">
                    <p className="lyra-body-sm-emphasis text-lyra-fg-secondary">Recommended Action</p>
                    <p className="lyra-body-md text-lyra-fg-default mt-1">
                      Approve the $200 refund so the AI agent can complete
                      the request and take the customer off hold.
                    </p>
                  </div>
                </div>
              </AccordionHeadlessContent>
            </AccordionHeadlessItem>
          </AccordionHeadless>
        </Container>
      </div>
      )}

      {/* Per a later explicit follow-up request ("add the Review button
          back (dismiss the toast when review is clicked and navigate to
          the assignment)") — Review is unconditional again, unlike
          Takeover (still gated behind `SHOW_MARCUS_NOTICE_DETAILS`,
          untouched): the agent can jump straight into Marcus's already-
          loaded tile from here, but still takes over via the "Reviewing
          this conversation" action bar's own button once inside, not a
          second toast-level shortcut. */}
      <div className="flex items-center gap-2 border-t border-lyra-border-subtle p-3">
        <Button variant="outline" size="md" className="flex-1" onClick={onReview}>
          Review
        </Button>
        {SHOW_MARCUS_NOTICE_DETAILS && (
          <Button variant="default" size="md" className="flex-1" onClick={onTakeover}>
            Takeover
          </Button>
        )}
      </div>
    </div>
  );
}

export function AgentWorkspaceAdvancedPage({
  showPageHeader = false,
  showPanelToggle = false,
  showInteriorPanel = true,
  onNavigate,
  initialInteraction,
  sidePanelToggleLabel,
}: {
  showPageHeader?: boolean;
  showPanelToggle?: boolean;
  showInteriorPanel?: boolean;
  onNavigate?: (page: Page) => void;
  /**
   * Seeds `interactions`/`activeInteractionId` with an already-active call
   * instead of starting empty — mirrors lyra-ui's `AgentNextGenTemplate`
   * "Active Interaction" story prop of the same name (see that story's own
   * doc comment for the full rationale). Not passed anywhere in this app
   * today — kept as an opt-in capability so this component stays in sync
   * with the canonical template's shape, not to change default behavior.
   */
  initialInteraction?: Interaction;
  /**
   * Overrides the record-header toggle button's visible label for the
   * Customer Information `InteriorPanel` — mirrors lyra-ui's
   * `AgentNextGenTemplate` prop of the same name. Defaults to "Customer
   * Information" here; pass a different string to override it.
   */
  sidePanelToggleLabel?: string;
}) {
  // Open by default on load again — per yet another explicit follow-up
  // request, reverting the previous "default the assignment panel closed
  // when the app launches" change back to open. Not gated on
  // `initialInteraction` either way — the rail's initial state is the same
  // regardless of whether the agent is seeded mid-call. `handleResize`'s
  // narrow-viewport auto-collapse (a few lines down) still applies after
  // that first paint.
  const [navOpen, setNavOpen] = useState(true);
  // No interactions exist until the agent launches one from the CreateNew
  // menu (Start Interaction / quick dial) — see handleStartCall/handleQuick
  // Dial below. Click any resulting InteractionNavItem card to make it the
  // active one. `initialInteraction` (see above) seeds this instead, for
  // callers that want to start already mid-call.
  const [marcusCardHost] = useState(() => {
    const el = document.createElement("div");
    el.style.display = "contents";
    return el;
  });
  // The page clock (agent-next-gen-page-clock.ts) is created here, ahead of
  // the cards, because store cards measure their timers from its anchor.
  // Handlers and timeouts read the current tick with `clock.now()`; only the
  // `<ClockTick>`/`<ClockValue>` wrappers re-render each second.
  const clock = usePageClockSource();
  /** Customer directory records created THIS session via "Create New
   *  Customer" — there's no backend to persist into the static
   *  `CREATE_NEW_CUSTOMERS`, so they live here for the session and are
   *  checked alongside it wherever a real-customer test or the match pool
   *  is built. Declared before the cards, which name linked contacts from it. */
  const [createdCustomerRecords, setCreatedCustomerRecords] = useState<CreateNewCustomerRecord[]>([]);
  const navCardDisplayName = useMemo(
    () =>
      directoryDisplayName(
        (entityId) =>
          createdCustomerRecords.find((c) => c.id === entityId) ?? CREATE_NEW_CUSTOMERS.find((c) => c.id === entityId)
      ),
    [createdCustomerRecords]
  );
  // Left-nav cards (P0.5b.2): provider contacts come from the interaction
  // store (one card per journey, `card.id` = `journeyId`); the scripted
  // scenario cards stay page-local until P0.5c. `setInteractions` keeps the
  // old updater shape — see useNavCards for what it keeps and drops.
  const {
    cards: interactions,
    setCards: setInteractions,
    findOpenCard,
    seedOverlay,
  } = useNavCards({
    anchorMs: clock.anchorMs,
    displayName: navCardDisplayName,
    isScenarioCardId: isAdvancedScenarioCardId,
  });
  // Real "Assignments resolved today" count — previously read by the
  // dashboard header's own `SHOW_RESOLVED_TODAY_CHIP`-gated Badge (see
  // that flag's own doc comment, agent-next-gen-shared-utils.ts, and the
  // `PageHeader` `actions` slot below, now showing the "{N} Active
  // Assignments" chip instead). That Badge was already hidden behind the
  // flag before this change; now nothing reads the value at all, so only
  // the setter is destructured — `handleInteractionStatusChange` below
  // still increments it live on every real Resolved transition, so
  // re-enabling the old badge later only needs this destructure changed
  // back, not the tracking logic itself.
  const [, setResolvedTodayCount] = useState(0);
  // Keeps `agent-next-gen-case-database.ts`'s own local "database" in sync
  // with every live interaction's TRUE current state — see this same
  // effect's own doc comment in AgentNextGenPage.tsx for the full
  // reasoning (mirrored here per this file's own established convention of
  // mirroring bug fixes/behavior changes across all 3 page components).
  useEffect(() => {
    interactions.forEach((interaction) => saveCaseRecord(interaction));
  }, [interactions]);
  // Real "Today" Contact History rows — starts empty (nothing to show on
  // login, there's no backend here to have loaded anything from) and grows
  // as the agent actually dismisses whole assignments (`handleDismissInteraction`
  // below, via `buildDismissedContactHistoryEntry`) — see `ContactHistoryCard`'s
  // own doc comment for the full picture.
  const [dismissedContactHistory, setDismissedContactHistory] = useState<ContactHistoryEntry[]>([]);
  // Toast fired by both `handleDismissInteraction` (whole assignment) and
  // `handleDismissChannel` (one of several open channels) below, via
  // `fireDismissToast` — `useToast` just tracks the list; `<ToastContainer>`
  // actually renders it, near the end of this component's JSX.
  const { toasts, addToast, dismissToast, dismissAllToasts } = useToast();
  // Shared by both dismiss paths so the toast's own shape only lives in one
  // place. `title` is just "Success" — matching `Toast`'s own convention
  // (see toast.tsx's Storybook demos: a short status word as the bold
  // title, the specifics as body copy underneath) — with the
  // "{Name} {Record ID} Successfully Dismissed" text moved into `message`
  // (the body) instead of previously being crammed into `title` itself.
  // `customerName` falls back to "Customer" the same way the main
  // interaction header does (see `mainRegionTabLabel`) — an ad-hoc (typed
  // number/email, no matched customer) interaction still has *some* value
  // here (the raw address itself, see `customerIdentified`'s own doc
  // comment in lyra-ui's interaction-nav-item.tsx), so this fallback is
  // just defensive, not the common case.
  const fireDismissToast = (
    interaction: Pick<Interaction, "customerName" | "customerId">,
    // Per explicit request: a genuine, never-launched draft being deleted
    // (see `handleDismissInteraction`/`handleDismissChannel`'s own
    // `everSentAgentMessage` check) reads as "Draft Deleted" instead of
    // "Successfully Dismissed" — there was never a real assignment to
    // dismiss, just an untouched draft to discard. Default `false` — every
    // existing call site (a real, worked assignment) is unaffected.
    isDraftDelete = false
  ) => {
    addToast({
      variant: "success",
      title: "Success",
      message: isDraftDelete
        ? `${interaction.customerName ?? "Customer"} Draft Deleted`
        : `${interaction.customerName ?? "Customer"} ${interaction.customerId} Successfully Dismissed`,
      duration: 4000,
    });
  };
  // Agent leg (P0.5a): the interaction provider owns it. `AgentProfile`
  // displays the store's `agent.leg` (controlled) and reports clicks through
  // `onAgentLegToggle`; the resulting state arrives back as a `stateChanged`
  // event. The provider set outlives page mounts (ProviderRoot sits above
  // App's router), so the leg carries across tier switches on its own.
  const interactionProvider = useInteractionProvider();
  const agentState = useAgentState();
  const agentLegCapable = useCapability((c) => c.interaction.agentLeg);
  const handleAgentLegToggle = (action: "connect" | "disconnect") => {
    const command = action === "connect" ? interactionProvider.connectAgentLeg() : interactionProvider.disconnectAgentLeg();
    command.catch((error: unknown) => {
      if (import.meta.env.DEV) console.warn(`[agent-leg] ${action} failed`, error);
    });
  };
  // Whether the dedicated `AgentLegDisconnectedToast` (lyra-ui) is currently
  // showing — same "presence controls mounting" idiom `useToast`'s own
  // `toasts` array already uses for every other toast, just a plain
  // boolean since there's only ever one of these at a time (see that
  // component's own top-of-file doc comment). Set `true` on a real
  // "disconnected" event, `false` on a real "connected" event OR the
  // toast's own `onDismiss` (its "×", or its "Connect" button — see
  // `handleConnectAgentLeg` below) — per explicit request: "keep the alert
  // open until the agent connects the agent leg or clicks the close
  // button."
  const [agentLegDisconnectedToastOpen, setAgentLegDisconnectedToastOpen] = useState(false);
  // Fired (via `fireAgentLegStatusToast` below) once the agent leg actually
  // finishes connecting/disconnecting — never for the in-between
  // "connecting" state, and never for the leg's state on load or on a tier
  // switch (see `useAgentLegTransitions`). `success`/`warning` rather than always
  // `success` — landing back on "disconnected" isn't a positive event the
  // way finishing a connect is, same reasoning the SLA banner elsewhere in
  // this file reserves warning/critical for something actually needing
  // attention rather than defaulting every toast to green.
  //
  // "Disconnected" no longer goes through the plain `addToast`/`toasts`
  // list at all — it's the dedicated `AgentLegDisconnectedToast` (lyra-ui)
  // instead, toggled via `agentLegDisconnectedToastOpen` above, since that
  // one needs its own persistent (no-auto-dismiss)/"Connect"-button
  // behavior no other toast in this app has. "Connected" is still a plain,
  // ordinary 4000ms-auto-dismiss toast exactly as before.
  const showAgentLegToast = (agentLegConnectionStatus: "disconnected" | "connected") => {
    if (agentLegConnectionStatus === "disconnected") {
      setAgentLegDisconnectedToastOpen(true);
      return;
    }
    setAgentLegDisconnectedToastOpen(false);
    addToast({
      variant: "success",
      title: "Agent Leg Connected",
      message: "Your agent leg is now connected.",
      duration: 4000,
    });
  };
  // Wired to `AgentLegDisconnectedToast`'s own `onConnect` — starts the
  // real connect. Closing the toast itself is `onDismiss`'s job (wired
  // separately below, right where the component is rendered), not this
  // function's — `AgentLegDisconnectedToast` already calls both in the
  // right order on a "Connect" click (see its own doc comment).
  const handleConnectAgentLeg = () => handleAgentLegToggle("connect");
  // Last agent-leg status that arrived while the welcome modal was still
  // open — a ref (not state) since holding it shouldn't itself trigger a
  // re-render; the effect below is what actually flushes it once the modal
  // closes.
  const pendingAgentLegToastRef = useRef<"disconnected" | "connected" | null>(null);
  // Deferred, not dropped, while the welcome modal (`showWelcomeModal`) is
  // still open, per explicit request — the agent hasn't chosen Available/
  // Start Offline yet at that point, so a toast landing behind (or fighting
  // for attention with) the modal's own forced-choice UI reads as premature.
  // The agent leg's own status still updates normally underneath either way
  // (the store's `agent.leg`) — this just holds the notification about it
  // until right after the modal's been answered, instead of showing it
  // immediately or losing it entirely.
  const fireAgentLegStatusToast = (agentLegConnectionStatus: "disconnected" | "connected") => {
    if (showWelcomeModal) {
      pendingAgentLegToastRef.current = agentLegConnectionStatus;
      return;
    }
    showAgentLegToast(agentLegConnectionStatus);
  };
  useAgentLegTransitions(fireAgentLegStatusToast);
  // "Outcome" popover (`ChannelRow`'s own `outcome` prop, channel-row.tsx) —
  // logs Resolution/Tags/Disposition code/Summary for whichever channel's
  // Outcome button was clicked. Only one can be open across the entire left
  // nav at a time, same "one popover at a time" convention the session-
  // status popover already uses (`statusMenuOpenId`) — identified by
  // `${interactionId}:${channelKey}` since a channel's own `id`/`type` alone
  // isn't unique across DIFFERENT interactions, only within one card.
  // Note: no `resolution` field here — unlike Tags/Disposition/Summary
  // (which really are per-draft scratch state with no backend to persist
  // to), Resolution now reads/writes that specific channel's own entry in
  // `interaction.channelStatuses` directly (see `channels` below), the same
  // already-lifted piece of state the session-status pill itself reads/
  // writes via `handleInteractionStatusChange` — so there's nothing left
  // for a local draft to own for that field.
  const [outcomeDraftKey, setOutcomeDraftKey] = useState<string | null>(null);
  // Which of the three triggers actually opened the popover currently named
  // by `outcomeDraftKey` — the LeftNav `ChannelRow` Outcome button, the
  // transcript's own `TranscriptSessionSeparator` Outcome button, and the
  // record-header `ChannelTab`'s kebab "Outcome" entry all key off the exact
  // same `${interactionId}:${channelKey}` value for a given channel (so all
  // three stay in sync on the same shared draft), but that meant clicking
  // any one satisfied every `outcomeDraftKey === key` check and popped open
  // more than one popover at once (reported via screenshot, back when there
  // were only two triggers). Each trigger's own `open` now additionally
  // requires this to match its own source, so only the one actually clicked
  // shows as open — the underlying draft (tags/disposition/summary) still
  // stays the same shared state either way.
  // Per explicit request/follow-up: a fourth possible source, `"header"`,
  // for the record header's own top-right icon-button cluster — only
  // rendered while `showChannelTabRow` reads `false` for the active
  // interaction (see that const's own doc comment). Mirrors Agent Workspace
  // 2.0's identical `outcomeDraftSource` union (AgentNextGenPage.tsx).
  const [outcomeDraftSource, setOutcomeDraftSource] = useState<"leftnav" | "transcript" | "tab" | "header" | null>(null);
  // Per explicit request ("tags should also persist if selected, just
  // don't have tags selected when the outcome is first opened on a new
  // contact" / "if the agent selects a disposition code that code should
  // be populated if they click end call or if they go back to the
  // outcome"): neither Tags nor Disposition code auto-select anymore
  // (`OUTCOME_DISPOSITION_OPTIONS[0].value`/`["Technical", "Account"]` are
  // gone), but once the agent actually picks either for a given channel,
  // that pick now survives reopening the popover (from either the LeftNav
  // `ChannelRow` or the transcript's own session row — see `outcomeKey`/
  // `activeChannelOutcomeKey`'s shared `${interactionId}:${channelKey}`
  // scheme) or ending the call (`onHangUp`'s own
  // `handleOutcomeOpenChange(..., "transcript")` reopen, below). Keyed the
  // same way those two already are, so `buildDefaultOutcomeDraft` just
  // looks up whatever's already there for this exact channel instead of
  // starting fresh every time. One combined entry per channel (not two
  // separate maps) since both fields are "what's been decided so far for
  // this channel's outcome" — `summary` stays OUT of this; it's still
  // unconditionally reset to `OUTCOME_DEFAULT_SUMMARY` below, unaffected
  // by this. Same never-cleaned-up, "no real backend" convention this
  // file already uses for other ephemeral per-channel maps
  // (`threadLaunchTimestamps`, `customerTyping`) — EXCEPT a fresh redial
  // (`handleQuickDial`/`handleRedial`/`handleRedialActiveInteraction`)
  // explicitly clears this channel's own entry, per explicit follow-up
  // request — a brand-new call to the same contact shouldn't inherit the
  // previous call's already-decided tags/disposition just because voice
  // threads all reuse the same literal `"voice"` channel id.
  const [channelOutcomeSelections, setChannelOutcomeSelections] = useState<
    Record<string, { tags: string[]; dispositionCode: string }>
  >({});
  const buildDefaultOutcomeDraft = (key: string = "") => {
    const persisted = channelOutcomeSelections[key];
    return {
      tags: persisted?.tags ?? [],
      dispositionCode: persisted?.dispositionCode ?? "",
      summary: OUTCOME_DEFAULT_SUMMARY,
    };
  };
  const [outcomeDraft, setOutcomeDraft] = useState(() => buildDefaultOutcomeDraft());
  // Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0) per
  // this codebase's "no shared sync" convention — records, per
  // `${interactionId}:${channelKey}`, the real wall-clock moment a
  // brand-new text-channel thread's first-ever LIVE agent message actually
  // went out (captured once inside `handleSendMessage`, below). Used only
  // by `resolveActiveChannelDateTimeLabel` (above) so a fresh outbound
  // chat/SMS/WhatsApp thread's unknown-contact subtitle shows the literal
  // string "Draft" until that first message is sent, then freezes on the
  // real send time instead of ticking with `new Date()` forever.
  const [threadLaunchTimestamps, setThreadLaunchTimestamps] = useState<Record<string, string>>({});
  /** Per explicit request ("add a customer typing animation when a customer
   *  is responding to a sms/chat/whatsapp") — duplicated verbatim from
   *  AgentNextGenPage.tsx per this codebase's "no shared sync" convention:
   *  `true` while a simulated customer reply is in flight on a given
   *  channel, keyed `${interactionId}:${channelKey}`. */
  const [customerTyping, setCustomerTyping] = useState<Record<string, boolean>>({});
  const [aiTyping, setAiTyping] = useState<Record<string, boolean>>({});
  /* ── Unknown-contact customer matching (per explicit request) ──
     When the docked Customer Information panel is showing an unknown-
     contact interaction (`!activeInteractionIsRealCustomer`, below), it now
     runs a simulated "does this look like anyone in the directory" check
     instead of just a blank Detail-tab form — these three pieces of state
     back that flow. See `handleLinkCustomerRecord`/`handleCreateNewCustomer`
     (below `handleOutcomeOpenChange`) for what actually consumes them, and
     `findPossibleCustomerMatches`/`CustomerMatchSearchBody`'s own doc
     comments (agent-next-gen-customer-info-panel.tsx) for the check itself. */
  /** Which step of the flow is showing — "search" (possible matches / 0
   *  matches / manual search) or "create" (the "Create New Customer"
   *  form). Reset to "search" whenever a DIFFERENT interaction becomes
   *  active (see the reset effect a bit further down, once
   *  `activeInteraction` itself is in scope) — an agent shouldn't land
   *  back on the create form for interaction B just because they'd
   *  clicked into it for interaction A. */
  const [customerMatchStep, setCustomerMatchStep] = useState<"search" | "create">("search");
  /** The "Search Customers" box's own typed value — reset alongside
   *  `customerMatchStep` for the same reason. */
  const [customerMatchQuery, setCustomerMatchQuery] = useState("");
  const handleOutcomeOpenChange = (key: string, open: boolean, source: "leftnav" | "transcript" | "tab" | "header") => {
    if (open) {
      // Per explicit request: no longer a flat reset to the same example
      // every time — `buildDefaultOutcomeDraft(key)` looks up whatever
      // tags/disposition were already picked for THIS channel
      // (`channelOutcomeSelections`, its own doc comment above), falling
      // back to empty only the first time this channel's popover is ever
      // opened. `summary` still has no real backend to load from, so it
      // stays the same plausible example every time, unaffected.
      setOutcomeDraft(buildDefaultOutcomeDraft(key));
      setOutcomeDraftKey(key);
      setOutcomeDraftSource(source);
    } else if (outcomeDraftKey === key && outcomeDraftSource === source) {
      setOutcomeDraftKey(null);
      setOutcomeDraftSource(null);
    }
  };
  // Shared `onTagsChange`/`onDispositionChange` handlers — replaces what
  // used to be a near-identical inline closure duplicated at each of the
  // two live Outcome triggers (LeftNav `ChannelRow`, the transcript's own
  // session row). Each updates the live `outcomeDraft` (so the popover
  // reflects the change immediately) AND persists the FULL pair into
  // `channelOutcomeSelections` under whichever channel's popover is
  // currently open (`outcomeDraftKey`, guaranteed to already equal it
  // while either of these can fire) — reading the OTHER, unchanged field
  // off the current `outcomeDraft` so neither handler clobbers what the
  // other already persisted.
  const handleOutcomeTagsChange = (tags: string[]) => {
    setOutcomeDraft((d) => ({ ...d, tags }));
    if (outcomeDraftKey) {
      setChannelOutcomeSelections((prev) => ({
        ...prev,
        [outcomeDraftKey]: { tags, dispositionCode: outcomeDraft.dispositionCode },
      }));
    }
  };
  const handleOutcomeDispositionChange = (value: string) => {
    setOutcomeDraft((d) => ({ ...d, dispositionCode: value }));
    if (outcomeDraftKey) {
      setChannelOutcomeSelections((prev) => ({
        ...prev,
        [outcomeDraftKey]: { tags: outcomeDraft.tags, dispositionCode: value },
      }));
    }
  };
  // "Approve & Save"/"Cancel" both just close the popover — there's no real
  // backend here to persist an outcome to, same no-op placeholder state
  // every other not-yet-wired action in this file starts from (e.g. Consult
  // / Transfer — see rule #30's own note in CLAUDE.md).
  const handleOutcomeSave = () => {
    setOutcomeDraftKey(null);
    setOutcomeDraftSource(null);
  };
  const handleOutcomeCancel = () => {
    setOutcomeDraftKey(null);
    setOutcomeDraftSource(null);
  };
  // "Save & Redial"/"Save & Dismiss" — the Outcome popover's own footer
  // once `callEnded` is true (`ChannelOutcomeConfig`, outcome-panel.tsx).
  // Per explicit request: ending a call folds "wrap this call up" entirely
  // into this popover instead of leaving it split across a separate
  // standalone Unassign & Dismiss icon (now hidden once a call ends — see
  // `showDismissButton`/`onDismissChannel` below). "Save & Dismiss" is a
  // FULL dismiss — same as clicking that icon used to be (removes the
  // card, logs Contact History via the existing `handleDismissInteraction`).
  const handleOutcomeSaveAndDismiss = (interactionId: string) => {
    setOutcomeDraftKey(null);
    setOutcomeDraftSource(null);
    handleDismissInteraction(interactionId);
  };
  // "Save & Redial" opens the exact same "Redial Contact" dial-pad popover
  // Contact History's own Redial button uses (`handleRedialButtonClick`) —
  // reusing the same `dialpadRequest` mechanism rather than a second,
  // hand-rolled popover. `redialActiveInteraction` (below) is what lets
  // `handleDialpadSubmit` recognize a matching submission as "finish
  // redialing THIS interaction" rather than an unrelated new quick dial.
  const handleOutcomeSaveAndRedial = (interactionId: string, phoneNumber: string, anchorEl: HTMLElement | null) => {
    setOutcomeDraftKey(null);
    setOutcomeDraftSource(null);
    outboundDial.openCardRedialPad(interactionId, phoneNumber, anchorEl);
  };
  // Formerly drove the record header's own icon-button-cluster Outcome
  // popover and status chip (Consult/Transfer, Outcome, kebab, status
  // chip) — that header cluster no longer exists (see the channel-
  // controls-always-in-session-row change); dead state/handlers removed
  // rather than left unused. `InteractionTranscript`'s own session-row
  // status popover (`statusMenuOpenId`/`statusMenuView`) is the only copy
  // of this left.
  // Per explicit request ("hide all non-voice contacts from the contact
  // history - this will only have inbound/outbound voice capabilities"):
  // filters EVERY range `buildContactHistoryByRange` returns down to
  // `channelType === "voice"` — that builder also mixes in the shared
  // static mock fixtures (`CONTACT_HISTORY`/`EXTENDED_CONTACT_HISTORY`/
  // `CONTACT_HISTORY_STRESS_BATCH`, agent-next-gen-contact-history.tsx) for
  // the "Last 48/72 Hours" ranges, not just this file's own
  // `dismissedContactHistory`, so filtering `dismissedContactHistory`
  // itself before calling in wouldn't have caught those. Filtered here,
  // at this one Phase 1 call site, rather than inside the shared builder
  // itself — that function (and its mock fixtures) is reused elsewhere
  // (Agent Workspace 2.0/Phase 2), neither of which this voice-only
  // request applies to.
  const contactHistoryByRange = useMemo(() => {
    const byRange = buildContactHistoryByRange(dismissedContactHistory);
    return {
      today: byRange.today.filter((entry) => entry.channelType === "voice"),
      last48h: byRange.last48h.filter((entry) => entry.channelType === "voice"),
      last72h: byRange.last72h.filter((entry) => entry.channelType === "voice"),
    };
  }, [dismissedContactHistory]);
  // Drives `AssignmentsSortButton`'s `RadioGroup` — "Last Updated" (default,
  // matching a typical inbox's own default order) or "Create Date". Actual
  // ordering happens where the cards render (`sortAssignments`), leaving
  // `interactions` itself in insertion order for everything else that reads
  // it (`activeInteraction`, dismiss/redial handlers, etc.).
  const [assignmentSort, setAssignmentSort] = useState<AssignmentSortValue>("lastUpdated");
  // Per explicit request ("match sorting (ascending/descending) to the
  // Phase 1 current menu") — the ascending/descending toggle rendered
  // alongside `assignmentSort` above in the same popover
  // (`AssignmentsSortButton`'s own `direction` prop), mirroring
  // `AgentNextGenPage.tsx`'s identical state (see that file's own doc
  // comment for the fuller "why"). "desc" (newest first) matches this
  // tier's pre-existing default for both "Last Updated"/"Create Date" — the
  // only two fields this tier now exposes (see
  // `ADVANCED_ASSIGNMENT_SORT_OPTIONS`) — so this control starts out
  // reproducing the exact same order as before it existed.
  const [assignmentSortDirection, setAssignmentSortDirection] = useState<AssignmentSortDirection>("desc");
  // Drives `AssignmentsExpandCollapseAllButton` — see that component's own
  // doc comment for why this is a one-shot "which direction does the NEXT
  // click bulk-apply" toggle (`channelsAllExpanded`) plus a version nonce
  // (`channelsExpandedOverrideVersion`, bumped on every click) rather than
  // a plain controlled boolean threaded straight into every card: each
  // `InteractionNavItem`'s own channel list still needs to keep toggling
  // independently after a bulk action, not stay permanently locked to this
  // one shared value. Both passed down as one `channelsExpandedOverride`
  // object (interaction-nav-item.tsx) at each card's own call site below.
  const [channelsAllExpanded, setChannelsAllExpanded] = useState(true);
  const [channelsExpandedOverrideVersion, setChannelsExpandedOverrideVersion] = useState(0);
  const handleToggleAllChannelsExpanded = () => {
    setChannelsAllExpanded((v) => !v);
    setChannelsExpandedOverrideVersion((v) => v + 1);
  };
  // Each card's own current channel-list expanded/collapsed state, reported
  // via `InteractionNavItem`'s `onChannelsExpandedChange` (its own doc
  // comment explains why — the card owns that state internally, this is
  // just a read-only mirror of it). Keyed by `interaction.id`, NOT reset or
  // pruned when a card unmounts — a stale entry for a since-dismissed
  // interaction is harmless (the "every card agrees" check below only ever
  // looks up ids that are still in `interactions`).
  const [channelsExpandedById, setChannelsExpandedById] = useState<Record<string, boolean>>({});
  // Per explicit request: if the agent manually toggles individual cards'
  // chevrons by hand until every one happens to already agree with one
  // direction, `AssignmentsExpandCollapseAllButton`'s own `allExpanded`
  // should catch up to match — e.g. hand-expanding the one remaining
  // collapsed card should flip the button to "Collapse all" on its own,
  // without waiting for another bulk click. Deliberately does NOT bump
  // `channelsExpandedOverrideVersion` — this only updates the button's own
  // label/icon to reflect reality, it never re-applies an override onto
  // cards that already got there by hand.
  useEffect(() => {
    if (interactions.length === 0) return;
    const states = interactions.map((i) => channelsExpandedById[i.id]);
    if (states.some((s) => s === undefined)) return;
    if (states.every((s) => s === true) && !channelsAllExpanded) {
      setChannelsAllExpanded(true);
    } else if (states.every((s) => s === false) && channelsAllExpanded) {
      setChannelsAllExpanded(false);
    }
  }, [channelsExpandedById, interactions, channelsAllExpanded]);
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(
    () => initialInteraction?.id ?? null
  );
  /** Per explicit request ("add the new badge to any unread assignments
   *  (assignments that haven't been clicked on yet)"): a card is "New" until
   *  it has become the active one by any path (a card click, the Marcus
   *  Webb toast's Review/Takeover, a launched call landing on itself, ...).
   *  Shared with Desk since P0.5b.2 (`useNewAssignments`). */
  const isNewAssignment = useNewAssignments(activeInteractionId);
  // Customers table's "+ Filter" state, lifted up here (not local to
  // `CustomersListView`) — that component sits inside the Desk dashboard's
  // own branch of the `showSettings ? ... : activeInteraction ? ... : (
  // dashboard )` conditional a few thousand lines down, which unmounts the
  // WHOLE dashboard (including `CustomersListView`) the moment the agent
  // starts/opens an interaction or Settings, not just when switching desk
  // tabs. Keeping `CustomersListView` mounted-but-hidden across desk-tab
  // switches (see its own render call site) only covers THAT narrower case;
  // it still unmounts for real here, which would reset any state that
  // lived in its own `useState`. Living up here instead, on a component
  // that's never unmounted for the lifetime of this page, is what actually
  // makes the filters survive navigating away to an interaction/Settings
  // and back to Customers, not just switching between desk tabs.
  const [customerAddedFilterKeys, setCustomerAddedFilterKeys] = useState<string[]>([]);
  const [customerFilterValues, setCustomerFilterValues] = useState<Record<string, string[]>>({});
  // Which Customers-table row (if any) has its Customer Information panel
  // open — also lifted up here rather than local to `CustomersListView`,
  // since `CustomerRowInfoPanel` (the panel itself) renders as a SIBLING of
  // `CustomersListView`, docked to its right, not nested inside it; two
  // sibling components can only share state through a common parent. Not
  // reset to `null` on unmount either way, for the same "survives
  // navigating to an interaction/Settings and back" reason the filter
  // state above lives here — though `CustomerRowInfoPanel` itself is only
  // ever rendered while the Customers tab is active, so in practice this
  // only matters for the "still open on that row" case, not the panel
  // literally staying visible over other tabs.
  const [selectedCustomerRow, setSelectedCustomerRow] = useState<CustomerListRecord | null>(null);
  // Search/sort — also lifted up here, alongside the filter state above,
  // for a second reason beyond survival-across-unmount: `CustomerRowInfoPanel`'s
  // next/back chevrons (`handleCustomerRowNav` below) need to step through
  // the *exact same* filtered+sorted order the table itself is currently
  // showing, not the raw `CUSTOMER_LIST_RECORDS` order — and since that
  // panel is a sibling of `CustomersListView`, not a child of it, the only
  // way both can agree on "the current order" is computing it once here
  // (`customerSortedRows` below) and having `CustomersListView` render
  // *that*, instead of each independently deriving its own possibly-
  // different-by-a-render-cycle copy.
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  // Per explicit follow-up request ("keep the latest search results after
  // a search is run if navigated away from the search panel") — lifted
  // alongside `customerSearchQuery` above for the same reason (see
  // `searchSubmitted`'s own doc comment, agent-next-gen-search-panel.tsx):
  // `SimpleCustomerSearchBody`'s results-visibility flag used to be a local
  // `useState` there, which reset every time the Search panel itself was
  // unmounted/remounted by navigating away and back.
  const [customerSearchSubmitted, setCustomerSearchSubmitted] = useState(false);
  const [customerSortKey, setCustomerSortKey] = useState<CustomerColKey | null>(null);
  const [customerSortDir, setCustomerSortDir] = useState<SortDirection>(null);
  const handleCustomerSort = (key: CustomerColKey) => {
    if (customerSortKey === key) {
      const next = nextCustomerSortDirection(customerSortDir);
      setCustomerSortDir(next);
      if (next === null) setCustomerSortKey(null);
    } else {
      setCustomerSortKey(key);
      setCustomerSortDir("asc");
    }
  };
  // Same filter/search/sort logic `CustomersListView` used to compute this
  // itself locally — moved up here so `CustomerRowInfoPanel`'s chevrons and
  // `CustomersListView`'s own render both read the one shared result.
  const customerSortedRows = useMemo(() => {
    const filtered = CUSTOMER_LIST_RECORDS.filter((row) => {
      if (customerSearchQuery) {
        const q = customerSearchQuery.toLowerCase();
        const haystack = `${row.firstName} ${row.lastName} ${row.contactNumber} ${row.emailAddress}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      for (const key of customerAddedFilterKeys) {
        const selected = customerFilterValues[key];
        if (selected?.length && !selected.includes(row[key as CustomerFilterKey])) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (!customerSortKey || !customerSortDir) return 0;
      const aVal = String(a[customerSortKey]).toLowerCase();
      const bVal = String(b[customerSortKey]).toLowerCase();
      if (aVal < bVal) return customerSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return customerSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [customerSearchQuery, customerAddedFilterKeys, customerFilterValues, customerSortKey, customerSortDir]);
  // Index of the row currently open in `CustomerRowInfoPanel`, within that
  // same shared order — `-1` (nothing selected, or the selected row got
  // filtered out from under the panel by a search/filter change) disables
  // both chevrons via `hasPrevious`/`hasNext` below rather than throwing.
  const selectedCustomerIndex = selectedCustomerRow
    ? customerSortedRows.findIndex((r) => r.contactNumber === selectedCustomerRow.contactNumber)
    : -1;
  const handleCustomerRowNav = (direction: 1 | -1) => {
    if (selectedCustomerIndex === -1) return;
    const nextIndex = selectedCustomerIndex + direction;
    if (nextIndex < 0 || nextIndex >= customerSortedRows.length) return;
    setSelectedCustomerRow(customerSortedRows[nextIndex]);
  };
  // Drives the main content area: whenever an interaction is active, the
  // Desk dashboard is replaced by that interaction's blank detail page (see
  // the PageHeader "record header" mode below) — starting/quick-dialing/
  // redialing a new assignment always sets this, so the screen switches
  // over automatically the moment one is added.
  const activeInteraction = interactions.find((i) => i.id === activeInteractionId) ?? null;

  // Single, shared Customer Overview/Detail/Directory draft for whichever
  // interaction is currently active — owned HERE (not inside
  // `CustomerInformationSidePanel`/`CustomerInfoHoverPreview` themselves,
  // which used to each build their own independent instance) per explicit
  // request: an agent who starts an edit, then hovers off the record
  // header's hover preview (which unmounts its content every time the mouse
  // leaves — Radix `Popover.Content` has no `forceMount`) or toggles the
  // docked panel closed and back open, should still see that exact same
  // pending edit rather than a freshly reset one. Passing this ONE instance
  // to both consumers below also means an edit started in one shows up in
  // the other, since they're now genuinely the same state rather than two
  // disconnected copies of "the same customer's" data.
  //
  // `useCustomerRecordDraft` already resets itself whenever `recordId`
  // changes (see that hook's own effect) — switching to a genuinely
  // different active interaction (or having none at all) naturally starts a
  // fresh draft, and dismissing an assignment removes it from `interactions`
  // entirely, which is exactly the ONE thing per explicit request that
  // should actually discard pending edits — not merely closing the panel or
  // hovering away from it.
  const activeCustomerFields = useMemo(
    () =>
      activeInteraction
        ? buildCustomerInfoFields(activeInteraction.customerName, activeInteraction.customerId, activeInteraction.threads)
        : [],
    [activeInteraction?.customerName, activeInteraction?.customerId, activeInteraction?.threads]
  );
  const activeCustomerRecordDraft = useCustomerRecordDraft(
    activeCustomerFields,
    activeInteraction?.customerName,
    activeInteraction?.customerId
  );
  // Same lift as `activeCustomerRecordDraft` above, for the identical
  // reason — see that state's own doc comment.
  const [activeCustomerOverviewEditing, setActiveCustomerOverviewEditing] = useState(false);
  useEffect(() => {
    setActiveCustomerOverviewEditing(false);
  }, [activeInteraction?.customerId]);
  // Keyed on `activeInteraction?.id` (the left-nav slot key — this flips
  // the instant `handleLinkCustomerRecord`/`handleCreateNewCustomer`
  // succeed too, since both reassign it), not `customerId` like the effect
  // above: switching to a genuinely DIFFERENT card should always land back
  // on the search step, but resolving THIS SAME card's own unknown-contact
  // flow (which also changes `id`) should too — the panel stops rendering
  // this UI at all the instant `activeInteractionIsRealCustomer` flips
  // true, so there's nothing wrong with also quietly resetting `step` back
  // to "search" under it as this fires.
  useEffect(() => {
    setCustomerMatchStep("search");
    setCustomerMatchQuery("");
  }, [activeInteraction?.id]);
  /** Per explicit request ("contact details panel for unmatched customers
   *  should match the hover popover. add a button above auto summary that
   *  says link to existing customer and then when that is clicked slide in
   *  a panel with the search customer / create new customer panel
   *  content") — the docked Customer Information panel now shows the same
   *  `DetailsPanelAccordions` content the hover popover always shows
   *  (`bodyOverride`, unconditionally) instead of jumping straight to the
   *  `matchState` search/create flow for an unmatched customer; this flag
   *  is what that flow now gates on instead (see the docked panel's own
   *  `matchState`/`onLinkCustomer` render-site doc comments further down).
   *  Reset alongside `customerMatchStep`/`customerMatchQuery` above, same
   *  "genuinely different card, or this same card's own flow just
   *  resolved" reasoning as that effect's own doc comment. */
  const [linkCustomerPanelOpen, setLinkCustomerPanelOpen] = useState(false);
  useEffect(() => {
    setLinkCustomerPanelOpen(false);
  }, [activeInteraction?.id]);

  /* A past session's conversation opened as a TAB in the interaction space
     (record header), via the Customer Information panel's Overview "Open
     Conversation" deep link. One at a time; opening another replaces it.
     `active` mirrors the channel tabs' selection model: clicking a channel
     tab deactivates this tab (but keeps it in the strip); clicking it
     re-activates it; its kebab's "Close Tab" removes it. Cleared when
     switching to a DIFFERENT interaction (see `switchActiveInteraction`). */
  const [historyConversationTab, setHistoryConversationTab] = useState<{
    interactionId: string;
    entry: CustomerHistorySessionEntry;
    active: boolean;
  } | null>(null);
  const historyConversationForActive =
    activeInteraction && historyConversationTab && historyConversationTab.interactionId === activeInteraction.id
      ? historyConversationTab
      : null;
  const isHistoryConversationView = Boolean(historyConversationForActive?.active);
  // Which channel type `InteractionTranscript` (below) should render content
  // for — the same "current" channel the record header's own
  // `ChannelToggleGroup` highlights (see its `active={... === key}` a few
  // hundred lines down) and `InteractionNavItem`'s `currentChannelKey` both
  // derive from, recomputed here rather than threading a shared value down
  // from either of those since neither is an ancestor of
  // `InteractionTranscript` in the tree. Falls back to the most recently
  // added channel when nothing's been explicitly selected yet, same as
  // everywhere else this "current channel" concept appears.
  const activeChannel = activeInteraction
    ? activeInteraction.threads.find(
        (c) =>
          (c.id ?? c.type) ===
          (activeInteraction.currentThreadId ?? activeInteraction.threads[activeInteraction.threads.length - 1]?.id)
      )
    : undefined;
  const activeChannelType = activeChannel?.type;
  // The voice thread whose Transcript tab the Contact Details panel offers: the active channel when it's voice, or (Lucas) a live call
  // John placed from the escalation card while the chat stays on screen.
  const panelVoiceThread: Thread | undefined =
    activeChannelType === "voice"
      ? activeChannel
      : activeInteraction?.id === LUCAS_THOMAS_ID && !activeInteraction.closed && !activeInteraction.voiceCallEnded
        ? activeInteraction.threads.find((t) => t.type === "voice")
        : undefined;
  // Per explicit follow-up request ("leave the active badge visible if the
  // agent switches between chat/other channels"): whether the interaction
  // has a chat thread open ANYWHERE among its threads, not just whether the
  // currently-selected tab (`activeChannelType`) happens to be it — see the
  // record-header `badge` call site's own doc comment further down for the
  // full reasoning. `false` (not `undefined`) while there's no active
  // interaction at all, matching every other boolean derived here.
  const hasOpenChatThread = !!activeInteraction?.threads.some((c) => c.type === "chat");
  // The bare channel-key half of `activeChannelOutcomeKey` below — used on
  // its own to resolve this channel's own entry out of
  // `Interaction.liveMessages` (see that field's own doc comment for
  // why it's keyed per-channel) at the `InteractionTranscript` render call
  // site further down, so a freshly opened/different channel never shows
  // another channel's own live messages.
  const activeChannelKey = activeChannel?.id ?? activeChannel?.type ?? "channel";
  // Same `${interactionId}:${channelKey}` scheme the LeftNav's own
  // `ChannelRow` Outcome button keys `outcomeDraftKey` with (a few hundred
  // lines down) — computed here too so `InteractionTranscript`'s current-
  // session Outcome popover (`TranscriptSessionSeparator`) reads/writes the
  // exact same shared draft for this channel, not a second, disconnected
  // one. `activeInteraction`-less renders (Desk dashboard) never actually
  // use this — it's just always in scope for the JSX below.
  const activeChannelOutcomeKey = activeInteraction
    ? `${activeInteraction.id}:${activeChannel?.id ?? activeChannel?.type ?? "channel"}`
    : undefined;
  // This active channel's own status (see `Interaction.channelStatuses`'s
  // doc comment for why status has to be tracked per-channel rather than as
  // one flat interaction-wide value) — undefined until the agent actually
  // assigns one for THIS channel specifically. Drives both the transcript's
  // status pill/Outcome "Resolution" field and whether the composer shows
  // (hidden once this specific channel reads "Closed" — see the render call
  // site below) without touching any sibling channel's own status.
  const activeChannelStatus = activeChannel ? activeInteraction?.threadStatuses?.[activeChannel.id] : undefined;
  // Resolves an interaction's own live (not hung-up) voice thread —
  // deliberately NOT scoped to `activeInteraction`/`activeChannel` above,
  // which only ever resolve whichever interaction/tab the agent happens to
  // be LOOKING at right now. Mirrors `AgentNextGenPage.tsx`'s own identical
  // helper (see that file's doc comment on it for the fuller history —
  // it's what lets Phase 1's LeftNav show an "On Hold" badge on a card for
  // a live call the agent has switched away from, via `isOnHold`-style
  // checks not yet ported here). Added to THIS file per later explicit
  // follow-up request ("move the call controls below the main container so
  // if a user navigates to home/settings while on a call the controls of
  // the current call stay visible"): finding a live voice thread by
  // scanning `interactions` directly (not `activeInteraction`) is what lets
  // `liveVoiceCallInteraction`/`liveVoiceCallThread` below keep resolving
  // to the right call even after `switchActiveInteraction(null)` clears
  // `activeInteractionId` entirely (every Home/Settings nav click does
  // this — see that helper's own doc comment). `undefined` once the
  // interaction is closed, has no voice thread, or the agent has already
  // hung up (`voiceCallEnded`).
  // Tom Lewis's cold incoming call rings in the left nav (Accept / Decline on his tile) until the agent answers; a ringing call has no
  // live-call UI and doesn't count as the agent being on a call.
  const [tomLewisCallRinging, setTomLewisCallRinging] = useState(false);
  // Cold inbound calls with no AI agent (Tom rings and needs Accept; Maya is answered automatically).
  const isColdCallId = (id: string | undefined) => id === TOM_LEWIS_CALL_ID || id === MAYA_CHEN_CALL_ID;
  const findLiveVoiceThread = (interaction: Interaction) => {
    if (interaction.closed || interaction.voiceCallEnded) return undefined;
    if (interaction.id === TOM_LEWIS_CALL_ID && tomLewisCallRinging) return undefined;
    return interaction.threads.find((c) => c.type === "voice");
  };
  // Per explicit follow-up request ("when the agent clicks review from the
  // toast display an action bar component in place of the call controls"):
  // this is the split the toast's own `onReview`/`onTakeover` doc comment
  // (below, at their render site) already anticipated — "Review" and
  // "Takeover" both commit Marcus's interaction and navigate to it, but only
  // "Review" leaves the agent in a reduced, review-only mode. While this is
  // true, the live-call bar (gated on `liveVoiceCallInteraction` just below)
  // renders lyra-ui's `ActionBar` ("Reviewing this conversation" + Guide
  // Conversation/Transfer/Takeover) instead of `VoiceCallControls` — this
  // action bar's own "Takeover" button flips it back to `false`, which is
  // the only way out of review mode (mirrors the toast's "Review"/"Takeover"
  // pair one level down the flow). Reset to `false` on hang-up too (see
  // `onHangUp` below) so a call that's ended never leaves this stuck `true`.
  // Moved up from its original spot right after the "New Contact" toast's
  // own auto-close effect (see git history) to right here, because
  // `liveVoiceCallInteraction` immediately below now needs to read it —
  // see that const's own doc comment for why.
  const [marcusWebbReviewing, setMarcusWebbReviewing] = useState(false);
  // The single call this page currently has any UI for. Used to be a
  // plain `.find()` first match with no Marcus-awareness — per explicit
  // bug report ("when I launched Marcus Webb's inbound but didn't go to
  // the interaction and dialed a new outbound, the call controls didn't
  // appear in the new outbound and the new outbound button didn't become
  // disabled" + "when I went to the Marcus Webb interaction the takeover
  // button was not disabled - it should be if the agent is on another
  // active call"): Marcus's own scripted call is deliberately allowed to
  // stay "live" (a real voice thread, not ended) at the same time as a
  // genuinely new agent-dialed call — that's the whole point of
  // `agentOnActiveVoiceCall` below not treating Marcus-under-review alone
  // as "the agent is on a call," so the agent CAN dial a new outbound
  // while Marcus is still just being reviewed. But once they actually do,
  // plain `.find()` still returned Marcus's thread every time (his was
  // created first) — never the new call. Every consumer downstream reads
  // THIS const (`agentOnActiveVoiceCall` just below, the live-call bar's
  // `VoiceCallControls` vs. "Reviewing" `ActionBar` switch, and that
  // "Reviewing" bar's own "Takeover" `disabled` check, both further down),
  // so that one wrong pick cascaded into all three symptoms reported at
  // once — none of them were separately broken, they were all trusting
  // the same wrong answer.
  //
  // Fixed by preferring any OTHER live voice thread over Marcus's own
  // while `marcusWebbReviewing` is still true: Marcus's thread being
  // "live" was never the same thing as the AGENT being on a call (exactly
  // what `agentOnActiveVoiceCall` already established), so once a real
  // second call exists it's always the right pick; falls back to Marcus's
  // own thread only when it's genuinely the sole live call — or once the
  // agent actually clicks "Takeover", at which point `marcusWebbReviewing`
  // is `false` and this reduces back to a plain `.find()`. If more than
  // one NON-Marcus interaction ever has a live voice thread at once, which
  // one wins is still just a plain "for now" `.find()` pick — this fix
  // only teaches it about the one specific always-live-alongside-a-real-
  // call case (Marcus's own scripted thread) the app can actually put it
  // in; the general "auto hold and call display when multiple calls are
  // visible" redesign remains the separate, explicitly deferred project
  // this comment originally called out.
  const liveVoiceCallInteraction =
    interactions.find((i) => !!findLiveVoiceThread(i) && !(marcusWebbReviewing && i.id === MARCUS_WEBB_ID)) ??
    interactions.find((i) => !!findLiveVoiceThread(i)) ??
    null;
  const liveVoiceCallThread = liveVoiceCallInteraction ? findLiveVoiceThread(liveVoiceCallInteraction) : undefined;
  /** Same "real, matched customer vs. a raw unidentified address" gate
   *  `activeInteractionIsRealCustomer` (above) already establishes, scoped
   *  to `liveVoiceCallInteraction` instead of `activeInteraction` since a
   *  live call and the page's currently-viewed interaction can be two
   *  different interactions (see this call's own `VoiceCallControls` doc
   *  comment below). Feeds `customerInitials` there — per explicit request
   *  ("avatars within the contact and call details should be the initials
   *  of the customer OR a customer avatar if no customer name is known"),
   *  the same `hasCustomerName ? initials : <User />` split
   *  `interaction-nav-item.tsx`'s own collapsed-tile avatar already uses. */
  const liveVoiceCallInteractionIsRealCustomer = liveVoiceCallInteraction
    ? CREATE_NEW_CUSTOMERS.some((c) => c.id === liveVoiceCallInteraction.entityId) ||
      createdCustomerRecords.some((c) => c.id === liveVoiceCallInteraction.entityId) ||
      !!liveVoiceCallInteraction.entityId?.startsWith("history:")
    : false;
  // Whether the call-controls bar below is showing for whichever
  // interaction is ALSO the one currently on screen — `onToggleTranscript`/
  // `onToggleVideo` below only make sense against that one interaction's
  // own `sidePanelOpen`/video-window state, both of which are page-level UI
  // tied to whatever `activeInteractionId` currently is, not to
  // `liveVoiceCallInteraction` itself. Neither button is wired at all
  // (`undefined` — hides them, same pattern every other optional callback
  // on this shared component already follows) once the agent has navigated
  // away from that interaction, rather than silently doing nothing or
  // acting on the wrong interaction's panel.
  const isViewingLiveVoiceCallInteraction =
    !!liveVoiceCallInteraction && liveVoiceCallInteraction.id === activeInteractionId;
  // Per explicit request/follow-up clarification: true for a brand-new
  // AGENT-INITIATED OUTBOUND active channel — the active Thread's OWN
  // `startedFresh` (see that field's own doc comment on why this reads
  // per-Thread now, not `activeInteraction.startedFresh`) AND-ed with "the
  // customer hasn't replied yet" (`lastCustomerMessageTick`), same compound
  // check `isNewOutboundThread` uses at the LeftNav card / record-header tab
  // loops (their own doc comments have the full reasoning) — reused here
  // for `InteractionTranscript`'s own `isNewThread` prop (the session row).
  // Per explicit request ("voice calls should never be drafts"): a voice
  // channel never reads as a fresh/draft outbound thread here, regardless
  // of `startedFresh`/`lastCustomerMessageTick` — there's no real per-
  // message model for voice for a customer "response" to ever set
  // `lastCustomerMessageTick` on, so without this exclusion an outbound
  // call would stay permanently stuck in the draft state for its entire
  // life. Voice should show its real "Open" status and the full Consult/
  // Transfer/Outcome/Unassign & Dismiss cluster immediately once launched.
  const activeChannelIsNewOutboundThread =
    activeChannel?.type !== "voice" &&
    !!activeChannel?.startedFresh &&
    activeChannel?.lastCustomerMessageTick === undefined;
  // Per explicit request: true when the active interaction's own `id` is
  // one of `OUTBOUND_AGENTS`'s ids — i.e. this is an agent-to-agent voice
  // call, not a customer interaction (an agent's own outbound "Chat" pick
  // never reaches this state at all — `handleStartCall`'s own agent+chat
  // branch, below, returns early before ever creating one). Gates BOTH
  // Customer Information (the docked panel + its header toggle/hover-
  // preview — an agent-to-agent call has no real customer record behind it
  // any more meaningfully than the existing "unknown contact" case does,
  // but per explicit follow-up request this hides it outright rather than
  // falling back to the Detail-only tab set that case still gets) AND the
  // header's own status chip (`ChannelStatusTag`, further down — an agent
  // call has no real Open/Pending/Resolved/Closed disposition to log
  // against a colleague the way a genuine customer contact does).
  const activeInteractionIsAgentCall = !!activeInteraction && OUTBOUND_AGENTS.some((a: CreateNewOutboundContact) => a.id === activeInteraction.entityId);
  // Per explicit request: true when the active interaction is genuinely
  // backed by a real `CREATE_NEW_CUSTOMERS` directory record — every
  // creation path either reuses that real `customer-N` id verbatim
  // (`handleStartCall`'s directory pick, `handleOpenAssignmentFromNotification`,
  // `handleOpenInteractionRow`, a `handleRedial` with a real
  // `entry.customerId`) or falls back to a synthetic, namespaced one with
  // no backing record (`quickdial:`, a `redial:` with no real customerId,
  // lyra-ui's `adhoc:` "Continue with" flow, a hand-authored Contact
  // History-only entry) — so this membership check is the precise,
  // general "is this a real customer" signal, not just a prefix check on
  // one specific synthetic namespace. `true` when there's no active
  // interaction at all — harmless default, nothing reads it in that case.
  // ALSO true when `id` matches a `createdCustomerRecords` entry (above) —
  // per explicit request, an interaction the agent just ran "Create New
  // Customer" or "Link To Record" on (`handleCreateNewCustomer`/
  // `handleLinkCustomerRecord`, below) must immediately read as a real
  // customer too, promoting it straight into every OTHER tier of this same
  // "real customer" treatment (full channel tab row, full Customer
  // Information tab set, plain customer-ID subtitle — see
  // `showChannelTabRow` right below) the instant either action resolves,
  // not just at the customer directory's own static, build-time contents.
  // Per explicit follow-up bug report — see AgentWorkspace2WithDeskPage.tsx's
  // identical fix for the full reasoning: a Contact History entry with no
  // `customerId` of its own reopens under a synthetic `history:${entry.id}`
  // id (`handleReopenContactHistoryEntry`, below); that id used to read as
  // NOT a real customer here, wrongly hiding Contact Overview for a
  // genuine past contact. `startsWith("history:")` covers only that case,
  // not the genuinely-unknown `adhoc:`/`quickdial:`/`redial:` ones.
  const activeInteractionIsRealCustomer = activeInteraction
    ? CREATE_NEW_CUSTOMERS.some((c) => c.id === activeInteraction.entityId) ||
      createdCustomerRecords.some((c) => c.id === activeInteraction.entityId) ||
      !!activeInteraction.entityId?.startsWith("history:") ||
      // Lucas Thomas arrives already linked to an existing customer.
      activeInteraction.id === LUCAS_THOMAS_ID ||
      isColdCallId(activeInteraction.id)
    : true;
  // Feeds the Customer Context Overview accordion (`customerContextOverview`
  // prop, below) that now renders in place of the old plain `ContactOverview`
  // block — per explicit request to mirror `AgentNextGenPage.tsx`'s ("Phase
  // 1") Customer Context Overview functionality here. `buildCustomerContext
  // OverviewInfo` (agent-next-gen-shared-utils.ts) is fully deterministic/
  // hash-seeded — no real LLM call is involved anywhere in this app for this
  // feature (see that function's own doc comment) — so "tie the content to
  // an LLM... or use the customer database information, whichever's
  // easiest" resolves to the database-grounded path Phase 1 already uses:
  // `findContactHistoryMatch`/`extractPriorContactInfo` (top of this file)
  // ground it in the customer's real Contact History case when one matches.
  //
  // Reuses this same `activeInteractionIsRealCustomer` for BOTH the
  // `isKnownCustomer` and `identified` arguments — Advanced (unlike Phase 1)
  // has no separate chat-only "identified" nuance; this is already the one
  // signal this file uses elsewhere (e.g. `customerIdentified`, below) to
  // distinguish a real customer from an unknown one.
  const customerContextOverviewInfo = useMemo(() => {
    if (!activeInteraction) return undefined;
    const base = buildCustomerContextOverviewInfo(
      activeInteraction.id,
      activeInteraction.customerName,
      activeInteractionIsRealCustomer,
      activeInteractionIsRealCustomer,
      extractPriorContactInfo(
        findContactHistoryMatch(activeInteraction.customerName, activeInteraction.customerId)
      )
    );
    // Marcus Webb's own scripted refund scenario (see
    // `MarcusWebbIncomingCallNotice`'s top-of-file doc comment) — per
    // explicit request, only Contact Snapshot/Next Best Action are
    // overridden here with copy grounded in THIS call's own refund story
    // (matching the incoming-call notice's own Case Summary), so the two
    // don't disagree once the agent navigates in via Review/Takeover.
    // `customerCard`/`detailedSummary` are deliberately left as `base`
    // computed them (the generic hashed "Customer Profile" card) — per
    // explicit follow-up correction, that section stays untouched; only
    // the accordion CONTENT below it changes.
    if (activeInteraction.id === MARCUS_WEBB_ID) {
      return {
        ...base,
        snapshot: [
          "Calling about a refund on a $200 order.",
          "Order for [noise-cancelling headphones](order) placed last Tuesday arrived with a cracked ear cup.",
          "Refund exceeds the AI agent's $100 auto-approval limit — escalated for human approval.",
        ],
        realTimeSummary:
          "Marcus is on hold while the Cognigy AI Agent waits for sign-off on a $200 refund for order #48213 (noise-cancelling headphones, cracked ear cup). The refund qualifies but exceeds the AI agent's $100 auto-approval limit. Approve or reject the refund, or give the AI agent another instruction.",
        nextBestAction:
          "Review the order and approve the $200 refund so the AI agent can complete the request and take the customer off hold.",
      };
    }
    if (activeInteraction.id === MAYA_CHEN_CALL_ID) {
      return {
        ...base,
        customerCard: {
          ...base.customerCard,
          avatarInitials: "MC",
          subtitle: MAYA_CHEN_CALL_OVERVIEW.subtitle,
          tags: MAYA_CHEN_CALL_OVERVIEW.tags,
          sentiment: { value: "Disappointed" },
        },
        detailedSummary: MAYA_CHEN_CALL_OVERVIEW.detailedSummary,
        realTimeSummary: MAYA_CHEN_CALL_OVERVIEW.realTimeSummary,
        snapshot: MAYA_CHEN_CALL_OVERVIEW.snapshot,
        nextBestAction: MAYA_CHEN_CALL_OVERVIEW.nextBestAction,
      };
    }
    if (activeInteraction.id === TOM_LEWIS_CALL_ID) {
      return {
        ...base,
        customerCard: {
          ...base.customerCard,
          avatarInitials: "TL",
          subtitle: TOM_LEWIS_CALL_OVERVIEW.subtitle,
          tags: TOM_LEWIS_CALL_OVERVIEW.tags,
          sentiment: { value: "Annoyed" },
        },
        detailedSummary: TOM_LEWIS_CALL_OVERVIEW.detailedSummary,
        realTimeSummary: TOM_LEWIS_CALL_OVERVIEW.realTimeSummary,
        snapshot: TOM_LEWIS_CALL_OVERVIEW.snapshot,
        nextBestAction: TOM_LEWIS_CALL_OVERVIEW.nextBestAction,
      };
    }
    if (activeInteraction.id === LUCAS_THOMAS_ID) {
      return {
        ...base,
        // Customer card + summaries reflect Lucas's own assignment (CASE-30418), not the generic hashed profile.
        customerCard: {
          ...base.customerCard,
          avatarInitials: "LT",
          subtitle: "Insider since 2023 · 14 orders",
          tags: ["Insider", "Launch edition pre-orders", "Prefers text"],
          sentiment: { value: "Frustrated" },
        },
        detailedSummary: [
          "Insider member since 2023 with 14 orders. Pre-orders launch editions and prefers text for updates. Paid by PayPal on 3 of his last 5 orders.",
          "Today he tried to buy the Aurora X2 launch edition at $189.00. Card checkout failed twice during payment incident INC-2207, and the pay-another-way link failed too.",
        ],
        realTimeSummary:
          "Aurora X2 launch order NR-11056 failed twice during payment incident INC-2207: the card was declined and the pay-another-way link also failed. Checkout AI Agent hit its authorization limit and is requesting an exception. The $189.00 launch price and his unit are held for 24 h. Lucas is frustrated.",
        snapshot: [
          "[Aurora X2 launch](product) order NR-11056 not placed — [card declined twice](payments) during payment incident INC-2207.",
          "Launch price ($189.00) and unit held for 24 h; [pay-another-way](payment-link) link sent and also failed.",
          "Checkout AI Agent hit its authorization limit and is requesting an exception.",
        ],
        nextBestAction:
          "Review the approval request and approve placing order NR-11056 with another payment method at the held launch price.",
      };
    }
    return base;
  }, [activeInteraction?.id, activeInteraction?.customerName, activeInteraction?.customerId, activeInteractionIsRealCustomer]);
  // Per explicit follow-up request (superseding the customer-identity
  // version this used to be — see git history for that prior condition):
  // now keyed purely on how many channels/threads this interaction
  // actually has open, for EVERY customer interaction, real or unknown.
  // With only one channel open there's nothing for a tab row to
  // disambiguate between, so this tier collapses to the same compact,
  // no-tab-row header treatment Agent Workspace 2.0 always uses (that
  // file's own `showChannelTabRow` doc comment) — this only affects the
  // tab row itself now. Per explicit follow-up request ("let's update the
  // channel controls to always be in the session row..."), the record-
  // header's own former action cluster (Consult/Transfer, Outcome, kebab,
  // status chip, Unassign & Dismiss/Delete Draft) no longer exists at
  // all — that cluster lives permanently in `TranscriptSessionSeparator`'s
  // own session-row cluster now (`showSessionActionCluster`, unconditional
  // at the `<InteractionTranscript>` call site below), regardless of
  // channel count.
  // `activeInteractionIsRealCustomer` (above) is now a fully independent
  // signal — it no longer feeds this at all, and continues to gate ONLY
  // Customer Information's own tab set / customer-matching UI, per
  // explicit request.
  // Was `!activeInteraction || activeInteraction.threads.length >= 2` —
  // hid this row outright for a single-channel interaction. Per explicit
  // follow-up request ("if only one interaction tab is open, display the
  // tab instead of removing it"), now always shows whenever there's a real
  // active interaction — a single open channel renders as its own one-tab
  // row instead of disappearing. Safe to widen this far: the ONLY other
  // consumer this constant used to also gate, `showSessionActionCluster`
  // at the `<InteractionTranscript>` call site below, is already
  // unconditional regardless of channel count (see the comment right
  // above this one) — it no longer reads this constant at all.
  const showChannelTabRow = !!activeInteraction;
  // Per explicit request ("hide the subhead from the interaction header
  // under the user's name for now - I may bring it back") — mirrors Agent
  // Workspace 2.0's identical flag (AgentNextGenPage.tsx, see that file's
  // own doc comment for the full reasoning): gates the record-header
  // `PageHeader`'s own `subtitle` prop, below. The underlying derivation is
  // left completely untouched — flipping this back to `true` restores the
  // exact same subtitle with no other changes needed.
  const SHOW_RECORD_HEADER_SUBTITLE = false;
  // Per explicit request ("hide the guide conversation and transfer
  // buttons for now") — gates the two inert placeholder buttons on the
  // "Reviewing this conversation" `ActionBar`, below. "Takeover" (the only
  // wired action there) is unaffected. Flip back to `true` to restore both
  // exactly as they were, no other changes needed.
  const SHOW_MARCUS_REVIEW_GUIDE_AND_TRANSFER = false;
  // Captured once, this component's real mount instant — lets
  // `resolveInteractionLastCustomerResponseLabel` (below) convert a
  // `lastCustomerMessageTick` value (real elapsed seconds since mount,
  // since the page clock (`clock`, declared further down) ticks once per
  // real second — see its own doc comment) back into an exact real `Date`,
  // rather than a mock/relative string. Declared here (ahead of `clock`
  // itself) purely so it's available before `lastCustomerResponseLabel`
  // reads it a few lines below — it doesn't actually depend on the clock.
  const pageMountTimeRef = useRef(Date.now());
  // Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0) per
  // this codebase's "no shared sync" convention — the launch timestamp
  // (see `threadLaunchTimestamps`'s own doc comment above) for THIS active
  // channel specifically, and the resolved date/time (or "Draft") label
  // built from it. Used ONLY by the unknown-contact `PageHeader` subtitle
  // further down this file — a real-customer interaction's plain
  // customer-ID subtitle never reads either of these.
  const activeChannelLaunchedAt = activeInteraction
    ? threadLaunchTimestamps[`${activeInteraction.id}:${activeChannel?.id ?? activeChannel?.type ?? ""}`]
    : undefined;
  const activeChannelDateTime = resolveActiveChannelDateTimeLabel(
    activeChannelType,
    // Per-Thread, same reasoning as `activeChannelIsNewOutboundThread` above
    // — see `Thread.startedFresh`'s own doc comment.
    !!activeChannel?.startedFresh,
    activeChannel,
    activeChannelLaunchedAt
  );
  // Per explicit follow-up request: once 2+ channels are open
  // (`showChannelTabRow`), the record-header subtitle switches from the
  // single active channel's own "{icon} {label} | {date}" line (still used
  // for the 1-channel case above) to "{N} channels open | Last Customer
  // Response: {date/time}" instead — see
  // `resolveInteractionLastCustomerResponseLabel`'s own doc comment for the
  // full per-thread resolution order.
  const lastCustomerResponseLabel = activeInteraction
    ? resolveInteractionLastCustomerResponseLabel(activeInteraction, pageMountTimeRef.current)
    : undefined;
  // The full pool the unknown-contact matching flow (below) checks against
  // — the static directory plus anything `createdCustomerRecords` has
  // added this session (see that state's own doc comment for why a
  // created customer belongs in the pool too).
  const customerDirectoryPool = useMemo(
    () => [...CREATE_NEW_CUSTOMERS, ...createdCustomerRecords],
    [createdCustomerRecords]
  );
  // The raw dialed/typed identifier this unknown channel was reached on —
  // `Thread.value` (e.g. `handleQuickDial`'s own dialed `phoneNumber`) when
  // set, falling back to its own display label, then to whatever this
  // interaction's own card is titled, then its id — there's always SOME
  // stable string by the last fallback, which is all
  // `findPossibleCustomerMatches` actually needs (see that function's own
  // doc comment for why the exact string barely matters — it's a
  // deterministic seed, not something the check parses for meaning).
  const activeUnknownContactIdentifier =
    activeChannel?.value ?? activeChannel?.addressLabel ?? activeInteraction?.customerName ?? activeInteraction?.id;
  // Per explicit request: the automatic "does this look like anyone in the
  // directory" check for the active unknown-contact interaction — see
  // `findPossibleCustomerMatches`'s own doc comment
  // (agent-next-gen-customer-info-panel.tsx) for what it actually does.
  // Computed unconditionally (harmless for a real-customer interaction —
  // nothing reads it in that case, since the panel never sets `matchState`
  // for one) rather than gated behind `!activeInteractionIsRealCustomer`
  // here, so the `useMemo` dependency list stays simple.
  const possibleCustomerMatches = useMemo(
    () => findPossibleCustomerMatches(activeUnknownContactIdentifier, customerDirectoryPool),
    [activeUnknownContactIdentifier, customerDirectoryPool]
  );
  // The "Search Customers" box's own manual results — see
  // `filterCustomersByQuery`'s own doc comment. Empty (and therefore never
  // shown — see `CustomerInformationSidePanel`'s own `matchState` render
  // branch) until the agent actually types something.
  const customerSearchResults = useMemo(
    () => filterCustomersByQuery(customerMatchQuery, customerDirectoryPool),
    [customerMatchQuery, customerDirectoryPool]
  );
  /** Per explicit request: promotes the active unknown-contact interaction
   *  to a REAL customer by pointing it at an EXISTING directory record the
   *  agent picked from the "Possible Matches"/search list (`onLinkRecord`,
   *  wired into `CustomerMatchSearchBody`'s own "Link To Record" button —
   *  see that component's doc comment). Reassigns this interaction's own
   *  identity fields to the matched record's — `id` (so
   *  `activeInteractionIsRealCustomer` above reads `true` from the very
   *  next render, cascading into every other "real customer" surface:
   *  `showChannelTabRow`, the full Customer Information tab set, the plain
   *  customer-ID subtitle — see each of those consts' own doc comments),
   *  `customerId`, and `customerName`. Changing `customerId` also resets
   *  `activeCustomerRecordDraft` (that hook's own reset-on-recordId-change
   *  effect — see `useCustomerRecordDraft`'s own doc comment) to a FRESH
   *  draft synthesized from the matched record, discarding whatever was
   *  pending in the unknown-contact Detail form — correct here, since this
   *  interaction is now a totally different, already-real customer, not a
   *  continuation of the blank one. Deliberately updates `interactions`/
   *  `activeInteractionId` directly rather than going through
   *  `switchActiveInteraction` — this isn't switching to a DIFFERENT card,
   *  it's the same card being recognized as someone real, so none of that
   *  helper's "leaving one assignment for another" side-panel bookkeeping
   *  applies. */
  const handleLinkCustomerRecord = (customer: CreateNewCustomerRecord) => {
    if (!activeInteraction) return;
    const cardId = activeInteraction.id;
    // P0.5b.2: the card's contacts join the record through the provider
    // (`associateEntity`); the card keeps its journey id, and its name comes
    // from the directory (`directoryDisplayName`). `customerId` — the record
    // id Customer Information looks up — is page overlay state.
    const linked = contactCommands.linkEntity(activeInteraction, customer.id);
    setInteractions((prev) =>
      prev.map((interaction) =>
        interaction.id === cardId
          ? { ...interaction, customerId: customer.customerId, ...(linked ? {} : { customerName: customer.name }) }
          : interaction
      )
    );
    addToast({
      variant: "success",
      title: "Linked to record",
      message: `Linked to ${customer.name}'s customer record`,
      duration: 4000,
    });
  };
  /** Advances the unknown-contact matching flow to its "Create New
   *  Customer" step (`CustomerMatchSearchBody`'s footer button) — see
   *  `customerMatchStep`'s own doc comment. */
  const handleStartCreateCustomer = () => setCustomerMatchStep("create");
  /** Returns to the search step WITHOUT discarding anything — the header's
   *  own back-arrow button (`CustomerInformationSidePanel`'s
   *  `matchState.onBackToSearch`) uses this directly; the create step's
   *  own Cancel button calls `activeCustomerRecordDraft.cancel()` first,
   *  THEN this — see that render call site. */
  const handleBackToCustomerSearch = () => setCustomerMatchStep("search");
  /** Per explicit request: promotes the active unknown-contact interaction
   *  to a real customer by minting a brand-new directory record from
   *  whatever the agent typed into the "Create New Customer" form
   *  (`activeCustomerRecordDraft.draft` — the SAME Detail-tab draft this
   *  panel already showed for this interaction; see
   *  `CustomerInformationSidePanel`'s own `matchState` body branch for why
   *  no separate draft/hook is needed for this step). Deliberately does
   *  NOT reassign `customerId` (unlike `handleLinkCustomerRecord` above) —
   *  keeping the interaction's own existing case number means
   *  `activeCustomerRecordDraft` never resets (its own reset effect is
   *  keyed on `customerId`, unchanged here), so every field the agent just
   *  typed stays showing, unbroken, the instant this flips the panel over
   *  to the full "known customer" Detail tab — genuinely "the new customer
   *  information populated," per the request, not a fresh resynthesis.
   *  Only `id` (so `activeInteractionIsRealCustomer` flips true) and
   *  `customerName` (built from the typed name, so the record header's
   *  title updates too) change. */
  const handleSaveNewCustomer = () => {
    if (!activeInteraction) return;
    const firstName = activeCustomerRecordDraft.draft.firstName.trim();
    const lastName = activeCustomerRecordDraft.draft.lastName.trim();
    const name = [firstName, lastName].filter(Boolean).join(" ") || activeInteraction.customerName || "New Customer";
    const newId = `created-customer:${activeInteraction.id}`;
    const newCustomerFirstPhone = activeChannelType === "voice" ? (activeChannel?.value ?? "") : "";
    const newRecord: CreateNewCustomerRecord = {
      id: newId,
      name,
      customerId: activeInteraction.customerId,
      channels: activeChannelType ? [activeChannelType] : [],
      avatarClassName: "bg-lyra-accent-blue-soft text-lyra-accent-blue-strong",
      firstName: firstName || name,
      lastName,
      group: activeCustomerRecordDraft.draft.group || "Standard",
      firstPhone: newCustomerFirstPhone,
      // lyra's `phones[0].value` must equal `firstPhone` (create-new-customers-data.ts).
      phones: newCustomerFirstPhone ? [{ label: "Mobile", value: newCustomerFirstPhone }] : [],
      emailAddress: activeChannelType === "email" ? (activeChannel?.value ?? "") : "",
      address1: "",
      city: "",
      state: "",
      postalCode: "",
      originalCustomerId: activeCustomerRecordDraft.draft.originalContactNumber || activeInteraction.customerId,
      dateOfBirth: "",
      agent: `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`,
      agentTeam: "",
      paymentBalance: activeCustomerRecordDraft.draft.balanceDue || "$0.00",
    };
    const cardId = activeInteraction.id;
    setCreatedCustomerRecords((prev) => [...prev, newRecord]);
    // Same as linking (P0.5b.2): the card's contacts join the new record.
    const linked = contactCommands.linkEntity(activeInteraction, newId);
    if (!linked) {
      setInteractions((prev) =>
        prev.map((interaction) => (interaction.id === cardId ? { ...interaction, customerName: name } : interaction))
      );
    }
    addToast({
      variant: "success",
      title: "Customer created",
      message: `${name} added to the customer directory`,
      duration: 4000,
    });
  };
  // Shared clock powering every open channel's live "MM:SS since it
  // started" elapsed display, and the agent's status timer
  // (`statusSinceTick` below). Not page state: a tick re-renders only the
  // `<ClockTick>`/`<ClockValue>` wrappers that show a live time, so the page
  // itself doesn't re-render every second (agent-next-gen-page-clock.ts).
  // Handlers and timeouts read the current tick with `clock.now()`. (The
  // clock itself is created up with the cards.)
  // Same idea for the home tab's live queue widgets (4s random walk):
  // only `<QueueSubItems>` readers re-render (agent-next-gen-queue-sim.ts).
  const queueSim = useQueueSimSource();
  // Per explicit request ("replace the autosummary card in the contact
  // details with the content depicted in the screenshot of the real time
  // summary card") — the "Real-Time Summary" container's own "Updated X
  // ago" caption (`DetailsPanelAccordions`'/`CustomerContextOverview`'s
  // own `realTimeSummaryUpdatedLabel` prop) needs a reference point to
  // measure elapsed time FROM. Captured once per contact (reset whenever
  // `activeInteractionId` changes, in the effect right below) rather than
  // tracking every individual fact change that actually feeds the summary
  // — this is a "freshness since you opened this contact's Details" clock,
  // the same practical signal the reference screenshot's own ticking
  // seconds counter conveys, not a literal per-field last-write timestamp
  // (this app has no such timestamp to read for any of `snapshot`'s
  // underlying facts). The page clock (just above) is what actually ticks
  // every real second; this only stores WHICH tick to measure from.
  // `DetailsPanelAccordions` turns it into the "Updated 8 seconds ago"
  // caption itself (`formatRealTimeSummaryUpdatedLabel`, inside a
  // `<ClockValue>`), so only that card re-renders as it ticks.
  const [realTimeSummaryUpdatedAtTick, setRealTimeSummaryUpdatedAtTick] = useState(0);
  useEffect(() => {
    setRealTimeSummaryUpdatedAtTick(clock.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInteractionId]);
  // Whether ANY assignment in the whole Personal Queue has a channel that's
  // actually breached SLA (red/"critical", not just "warning") — drives the
  // home header's "Personal Queue" chip color per explicit request ("make
  // the personal queue chip success when empty and warn when there are
  // assignments, make it red when an sla is breached in an assignment and
  // add a ! icon"). See `interactionHasBreachedSla`'s own doc comment
  // (agent-next-gen-interaction-dashboard.tsx) for why this re-derives the
  // same per-channel severity check each LeftNav card's own render loop
  // already applies, rather than importing that inline logic directly.
  // A boolean via `useClockValue`, so the page re-renders only when it flips.
  const hasBreachedSlaAssignment = useClockValue(clock, (clockTick) =>
    interactions.some((i) => interactionHasBreachedSla(i, clockTick))
  );
  // Same "how urgently is this channel awaiting a reply" signal the record-
  // header tab bar's own `<ChannelTab awaitingSeverity=...>` call site
  // computes per-channel (render return, further down) — resolved once
  // more, here, for the ACTIVE channel specifically so the "nearing SLA
  // breach"/"breached SLA" `InlineNotification` banner (also in the render
  // return, directly above the transcript) reflects the exact same tier as
  // that channel's own tab, rather than re-deriving it a third time at the
  // banner's own JSX. `undefined` whenever the active channel isn't
  // awaiting at all (mirrors `awaitingSeverity` being omitted for that case
  // everywhere else) — that's what tells the banner to render nothing.
  // Read through `useClockValue`, so the page re-renders only when the tier
  // changes, not every second.
  const activeChannelAwaitingSeverity: "success" | "warning" | "critical" | undefined = useClockValue(clock, (clockTick) =>
    activeChannel?.awaitingResponse
      ? getAwaitingSeverity(clockTick - (activeChannel.lastCustomerMessageTick ?? activeChannel.startTick))
      : undefined
  );
  // Hold SLA for the ACTIVE voice channel: a held call escalates to "warning"
  // at 15s and "critical" at 30s (lyra-ui's `getHoldSeverity`, same
  // thresholds as every hold-time badge). Drives the inline alert banner
  // below, same style as the chat awaiting-SLA banner. `undefined` unless
  // the active channel is a voice call currently on hold.
  const activeChannelHoldSeverity: "success" | "warning" | "critical" | undefined = useClockValue(clock, (clockTick) =>
    activeChannel?.type === "voice" && activeChannel.heldByAgent && activeChannel.heldSinceTick !== undefined
      ? getHoldSeverity(clockTick - activeChannel.heldSinceTick)
      : undefined
  );
  // "interactions" removed from this page's own tab set — that content
  // moved to the Search right panel instead (see `searchContent`'s own
  // doc comment above). `DeskTabKey`/`DESK_TAB_LABELS` (shared,
  // agent-next-gen-interaction-dashboard.tsx) still include `"interactions"`
  // — untouched, since `AgentWorkspace2WithDeskPage.tsx` still uses it.
  //
  // The Home/Customers/Accounts/Tickets/WEM `TabList` row itself was
  // removed from this page's dashboard entirely per a follow-up explicit
  // request ("remove all of the tabs from the home page") — WEM moved to
  // its own top-right app-header icon instead (see `PANEL_KEY_METADATA.wem`
  // above), Customers already has its Search-panel Customers tab as a real
  // alternative, and Accounts/Tickets never had real content built. With no
  // `TabList` left to switch it, `activeDeskTab` can now only ever be
  // "home" — a plain constant, not `useState`, since nothing sets it
  // anymore (its own `setActiveDeskTab` setter, and the whole `deskTabOrder`
  // reorder-state this file used to also need for that row's drag-to-
  // reorder, are both gone for the same reason). The now-orphaned Customers/
  // Accounts/Tickets/WEM per-tab render branches further down this file
  // (the desk's own — separate from the Search panel's — `CustomersListView`
  // instance, and the Accounts/Tickets/WEM "Coming soon" placeholder) are
  // deliberately left in place rather than deleted, same "hide it, don't
  // destroy it" convention `HIDDEN_FROM_APPS_MENU`/`OUTBOUND_GROUPS`'s own
  // "Dial Pad" entry already follow elsewhere in this file — they simply
  // can never be reached anymore now that `activeDeskTab` is pinned to
  // "home".
  //
  // Still a `useState` (setter just never called/destructured anymore),
  // NOT a plain `const activeDeskTab: SomeUnion = "home"` — TypeScript
  // narrows a `const`'s later reads to its own literal initializer's type
  // even under an explicit wider annotation (confirmed live: that version
  // hit real `tsc` "no overlap" errors at every `activeDeskTab ===
  // "customers"`-style comparison below). `useState<T>(initial)`'s return
  // is typed as the explicit generic `T` itself, not narrowed from
  // `initial`'s own literal type, which is what keeps those comparisons
  // (and the "orphaned but not deleted" branches they gate) type-checking
  // correctly with no runtime behavior change.
  const [activeDeskTab] = useState<"home" | "customers" | "accounts" | "tickets" | "wem">("home");
  /* Settings — a third top-level view alongside Desk/interaction-record,
     shown in place of both in the content column when the Settings rail
     item is clicked. Mutually exclusive with an active interaction: opening
     one closes the other. Interaction → Settings is enforced below via an
     effect (selecting/starting any interaction always takes over the
     content column, same "one primary view at a time" rule Desk already
     follows per `buildNavItems`'s `active: !hasActiveInteraction`); Settings
     → interaction is enforced the other way, directly in the `LeftNav`
     `onSettingsClick` handler, since there's only that one call site
     (unlike `setActiveInteractionId`, which has several). */
  const [showSettings, setShowSettings] = useState(false);

  // Per explicit follow-up request ("detach the contacts table from the
  // search panel and have it exist on its own") — a fourth top-level view
  // alongside Desk/interaction-record/Settings, shown in place of all
  // three when the Home dashboard's "All Contacts" button (`ContactHistoryCard`'s
  // own `headerTitleBadge`) is clicked. Previously this button opened the
  // shared right-docked Search panel's own "Contacts" tab, maximized to
  // full screen (see BEHAVIOR.md §134) — that panel-based approach is
  // superseded here; `InteractionsListView` now also renders directly in
  // the content column below, completely independent of `Draggable`/
  // `ContainerHeader`/`activePanelKey`/`panelFullScreen`. Mutually
  // exclusive with Settings/an active interaction the same way those two
  // already are with each other while they're showing — enforced by the
  // ternary's own `showAllContacts && !activeInteraction` condition further
  // down (not by resetting this flag).
  //
  // Per a further explicit follow-up ("if the agent has all contacts open
  // and navigates away from home, keep home page (all contacts) at the
  // last state before navigating away") — this flag is NO LONGER cleared
  // just because Settings opens or an interaction starts; it only gets
  // cleared by the All Contacts view's own breadcrumb ("Dashboard" →
  // explicitly leaving All Contacts for the plain dashboard). Once Settings
  // closes or the interaction ends, whichever of them was active before
  // (plain dashboard vs. All Contacts) is exactly what reappears.
  // `selectedAllContactsRecord` (this view's own selected-row summary
  // panel, below) is preserved the same way, for the same reason — the
  // whole point is that "Home" always resumes right where the agent left
  // it.
  const [showAllContacts, setShowAllContacts] = useState(false);

  /* Which row (if any) is selected in the standalone "All Contacts" view's
     own `InteractionsListView` — per explicit follow-up request ("in the
     dashboard / contacts table - when one of the rows is clicked, open an
     interior panel like the ones in My Contact History"), clicking a row
     there opens a summary panel of its own (a second, independent
     `InteriorPanel`/`selectedContactHistoryEntry`-style pair, NOT the
     dashboard's shared one further down — the "All Contacts" view is a
     fully standalone view with no dashboard content mounted alongside it
     to share that docked slot with), instead of immediately opening the
     row as a live assignment the way it used to (`handleOpenInteractionRow`,
     still what the panel's own "Re-open"/"Redial" footer button calls).
     `InteractionHistoryRecord` has no `ContactHistoryEntry`-shaped summary
     of its own — `buildContactHistoryEntryFromInteractionRecord` (agent-
     next-gen-interactions-table.tsx) adapts one on the fly so this reuses
     `ContactHistoryEntryDetail` unchanged, same "Duration"/"Chat Summary"/
     "Conversation" layout the My Contact History card's own row-click panel
     already renders. */
  const [selectedAllContactsRecord, setSelectedAllContactsRecord] = useState<InteractionHistoryRecord | null>(null);

  // Per explicit follow-up request ("below the dashboard / all contacts
  // page header at tabs for Contacts (Active), Messages and Threads") — a
  // "(Active)" was dropped from the tab label per a follow-up ("Remove
  // (Active) from the contacts tab") — the tab is just "Contacts" now.
  // `TabList` row inside the All Contacts view itself, below its
  // `PageHeader`, same `TabList`/`Tab`/`activeTab`-string pattern already
  // used elsewhere in this app (e.g. the Customer Information panel's own
  // `CUSTOMER_PANEL_TABS`). Only "Contacts" has real content (the
  // existing `InteractionsListView` table + its own `InteriorPanel`,
  // below) — "Messages" and "Threads" are placeholders for now (same empty
  // `<div className="flex-1 overflow-y-auto" />` the Settings view already
  // uses as its own placeholder body), pending a real data model for
  // per-message/per-thread rows.
  const ALL_CONTACTS_TABS = ["Contacts", "Messages", "Threads"] as const;
  const [allContactsTab, setAllContactsTab] = useState<(typeof ALL_CONTACTS_TABS)[number]>("Contacts");

  // Effect rather than touching every `setActiveInteractionId` call site
  // individually. Only closes Settings — does NOT touch `showAllContacts`/
  // `selectedAllContactsRecord` (see that state's own doc comment above for
  // why): an active interaction still visually pre-empts All Contacts via
  // the content-column ternary's own `!activeInteraction` guard, without
  // discarding All Contacts' own state for when the interaction ends.
  useEffect(() => {
    if (activeInteractionId) {
      setShowSettings(false);
    }
  }, [activeInteractionId]);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("unavailable");
  // Per explicit request ("if I push the L button on the keyboard it
  // launches Marcus Webb's contact [in Premium] - do this for both Phase 1
  // and 1B"): mirrors `AgentWorkspace2WithDeskPage.tsx`'s ("Premium") own
  // "L" trigger — fires the instant the agent presses "L", any time
  // they're "available" and this page hasn't already fired it this load.
  // Per explicit follow-up ("if it's easier for now - just launch the
  // assignment - I have a new case I want to wire to it"): only the launch
  // itself is ported here, not Premium's scripted Copilot walkthrough
  // (`MarcusWebbCopilotCard`/the reset-password flow) — this just gets
  // Marcus's interaction into the left nav, exactly like a real inbound
  // assignment, ready for a real case to be wired to it later. A plain
  // local `useState` gate (not Premium's shared, localStorage-persisted
  // `marcusWebbState`) since none of that scenario's own step-tracking is
  // needed without the Copilot card — this only ever needs to know "has
  // this page's own load already fired it."
  //
  // Same "ignore L while the agent is actually typing" guard as Premium's
  // own listener — a real, printable letter the agent needs to type into
  // the composer/search/etc. constantly, so only a "bare L" press outside
  // any text field counts as the demo shortcut. Has to live here (after
  // `agentStatus` itself), same reasoning as Premium's own copy of this
  // effect — the dependency array is evaluated as part of this call, so
  // referencing a not-yet-declared `const` would be a hard TDZ error.
  const [marcusWebbTriggered, setMarcusWebbTriggered] = useState(false);
  // Builds Marcus's `Interaction` and holds it here before opening
  // `MarcusWebbIncomingCallNotice` (this file's own top-of-file component —
  // see its doc comment for the full "why"). Per a later explicit
  // follow-up request ("load the assignment tile in the left nav when the
  // toast comes in"), the "L" handler now commits this into `interactions`
  // immediately (`commitMarcusWebbInteraction`, below) rather than waiting
  // for "Review"/"Takeover" — this ref still exists as the one shared
  // source `commitMarcusWebbInteraction` reads from no matter which caller
  // fires it, and stays a plain ref (not state) since holding it never
  // needs to trigger a re-render on its own (only `marcusWebbNoticeOpen`
  // toggling does that).
  const marcusWebbPendingInteractionRef = useRef<Interaction | null>(null);
  const [marcusWebbNoticeOpen, setMarcusWebbNoticeOpen] = useState(false);
  // Per explicit request ("on new contact toasts, if the agent goes to the
  // assignment in the left nav, close the toast automatically"): the toast
  // (`MarcusWebbIncomingCallNotice`, its own render site far below) used to
  // only close via its own "Close"/"Review"/"Takeover" buttons — an agent
  // who instead just clicked Marcus's tile directly in the LeftNav (it's
  // already visible there the instant the toast opens, per
  // `commitMarcusWebbInteraction`'s own doc comment) landed on his
  // interaction with the toast still sitting open on top of it, since
  // nothing about `switchActiveInteraction`/clicking a tile ever touched
  // `marcusWebbNoticeOpen`. This effect closes it the moment Marcus
  // actually becomes the active interaction by ANY path — the LeftNav
  // tile click included — not just the toast's own two buttons, which
  // still work exactly as before (they set this directly, so this effect
  // is a harmless no-op right behind them in that case).
  useEffect(() => {
    if (activeInteractionId === MARCUS_WEBB_ID) setMarcusWebbNoticeOpen(false);
  }, [activeInteractionId]);
  // Whether the agent themself is genuinely "on a call" right now, for the
  // purposes of the "we cannot have 2+ calls at once" restrictions below
  // (disabling "New Outbound" and Contact History's "Redial" button) — per
  // explicit follow-up bug report ("marcus webb new outbound shouldn't be
  // disabled until takeover is clicked since the agent is not on the call
  // yet. Same with the redial from the contact history - only disable when
  // the agent is on an active call"): `liveVoiceCallInteraction` alone
  // (a live voice THREAD exists somewhere) isn't the right signal for
  // this — Marcus's own scripted call is already "live" the moment it's
  // triggered, well before the agent ever picks up (the AI agent handles
  // it solo, then the agent can just "Review" without taking over at all),
  // so gating on `liveVoiceCallInteraction` alone incorrectly treated the
  // agent as mid-call the instant Marcus was triggered. Reuses the exact
  // same "is this actually a call the agent is on" exclusion the live-call
  // controls bar itself already applies (`!(marcusWebbReviewing &&
  // liveVoiceCallInteraction.id === MARCUS_WEBB_ID)`, see that render
  // site's own doc comment below) — Marcus's call only counts once the
  // agent has actually clicked "Takeover" (`marcusWebbReviewing` flips to
  // `false`), matching the same moment the call-controls bar itself
  // switches from the "Reviewing this conversation" `ActionBar` over to
  // real `VoiceCallControls`. Since `liveVoiceCallInteraction` itself now
  // also skips Marcus's own thread whenever a real second call exists
  // (see its own doc comment/bug-fix note above), this exclusion is only
  // ever load-bearing for the single-Marcus-only-live case (nothing else
  // to fall back to there); once a real second call is dialed,
  // `liveVoiceCallInteraction` already points at THAT call, so this line
  // needs no further change to correctly flip `true`.
  const agentOnActiveVoiceCall =
    !!liveVoiceCallInteraction && !(marcusWebbReviewing && liveVoiceCallInteraction.id === MARCUS_WEBB_ID);
  // Whether the Reject flow's customer-provided photo (rendered inline in
  // `MarcusWebbNextBestActionCard`, never in the transcript — see that
  // file's own top doc comment) is taking over the MAIN interaction
  // column, the same "takes over" mechanic `voiceVideoFullScreen`/
  // `VideoCallFullScreen` already uses below. Reset whenever the active
  // interaction changes away from Marcus (see the effect right below) so a
  // stale overlay can't bleed into a different interaction after switching
  // away and back.
  const [marcusWebbPhotoExpanded, setMarcusWebbPhotoExpanded] = useState(false);
  useEffect(() => {
    if (activeInteractionId !== MARCUS_WEBB_ID) setMarcusWebbPhotoExpanded(false);
  }, [activeInteractionId]);
  // Feeds `MarcusWebbIncomingCallNotice`'s own Customer Profile/Contact
  // Snapshot content (`DetailsPanelAccordions`, via that card's
  // `contextOverview` prop — currently unused while `SHOW_MARCUS_NOTICE_
  // DETAILS` is off) — same `buildCustomerContextOverviewInfo` call
  // `customerContextOverviewInfo` (above) makes for whichever interaction
  // is actually active, just for Marcus specifically and computed once up
  // front, since this card needs to show that content BEFORE he's ever
  // `activeInteraction` (added to `interactions` the instant the toast
  // opens now, but not selected/active until the agent clicks his tile —
  // see `marcusWebbPendingInteractionRef` above).
  // `isKnownCustomer=false` — Marcus is deliberately NOT a
  // `CREATE_NEW_CUSTOMERS` record (agent-next-gen-marcus-webb-scenario.ts's
  // own top-of-file comment), so this renders the exact same "no prior
  // contact history on file" content his real docked panel would once
  // he's actually opened, not a fabricated profile invented just for this
  // notice.
  const marcusWebbContextOverviewInfo = useMemo(
    () =>
      buildCustomerContextOverviewInfo(
        MARCUS_WEBB_ID,
        MARCUS_WEBB_CUSTOMER_NAME,
        false,
        true,
        extractPriorContactInfo(findContactHistoryMatch(MARCUS_WEBB_CUSTOMER_NAME, MARCUS_WEBB_CUSTOMER_ID))
      ),
    []
  );
  // Adds Marcus's held interaction into `interactions` — called from the
  // "L" keydown handler itself now (per later explicit follow-up request,
  // immediately when the toast opens, not gated behind a button click),
  // and still from "Review"/"Takeover" too (see the notice's own render
  // site) for when those are ever un-hidden — the dedup-by-id guard below
  // makes calling this more than once harmless.
  const commitMarcusWebbInteraction = () => {
    const interaction = marcusWebbPendingInteractionRef.current;
    if (!interaction) return;
    setInteractions((prev) => (prev.some((i) => i.id === MARCUS_WEBB_ID) ? prev : [...prev, interaction]));
    marcusWebbPendingInteractionRef.current = null;
  };
  useEffect(() => {
    // Per bug report ("pushing L when I have an active call is not
    // launching the marcus elevation"): `agentStatus` auto-flips to
    // `"working"` the instant the agent is on ANY live voice call (see
    // `isOnVoiceCall`'s own effect above) — a status this gate didn't
    // originally account for, so once a call was already in progress this
    // whole effect returned early and never attached the "L" listener at
    // all. `"working"` is exactly the state this trigger needs to fire
    // FROM (escalating a second, unrelated call in while already on one),
    // so it's allowed alongside `"available"` here — everything else
    // (`"unavailable"`, every specific reason code) still blocks it, same
    // as before.
    if ((agentStatus !== "available" && agentStatus !== "working") || marcusWebbTriggered) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "l" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      // Per explicit follow-up request ("update the marcus webb assignment
      // to be voice not chat"): a voice `Thread` instead of the shared
      // scenario module's own chat one — same "already-existing, unprompted
      // inbound arrival" shape as `handleOpenAssignmentFromNotification`'s
      // own Thread (`direction: "inbound"`, no `startedFresh`), just this
      // scenario's own fixed identity instead of a real notification's.
      // No `messageCount` — voice threads don't surface a badge count the
      // way chat/sms/whatsapp do (see `Thread.messageCount`'s own doc
      // comment). `liveMessages` IS populated below, though: per explicit
      // request ("create a transcript for the marcus webb call between
      // marcus and the AI Agent"), `MARCUS_WEBB_CALL_TRANSCRIPT` (defined
      // above) is wired in under the `"voice"` key so it renders as real
      // message bubbles — `activeChannelKey` resolves to `channel.id`
      // ("voice") for this thread, which is exactly what every
      // `InteractionTranscript` render site's `liveMessages={
      // activeInteraction.liveMessages?.[activeChannelKey] ?? []}` lookup
      // keys off of.
      const channel: Thread = {
        id: "voice",
        type: "voice",
        startTick: clock.now(),
        contactId: `MW-CONTACT-${Date.now()}`,
        preview: "AI Review",
        direction: "inbound",
      };
      const interaction: Interaction = {
        id: MARCUS_WEBB_ID,
        interactionId: `MW-INTERACTION-${Date.now()}`,
        customerName: MARCUS_WEBB_CUSTOMER_NAME,
        customerId: MARCUS_WEBB_CUSTOMER_ID,
        threads: [channel],
        currentThreadId: channel.id,
        liveMessages: { voice: MARCUS_WEBB_CALL_TRANSCRIPT },
        // Without this, the session-status chip falls back to
        // `TRANSCRIPT_SESSIONS_VOICE`'s own generic hardcoded "Resolved"
        // default (rule #27's "every channel shows session info" fixture)
        // — reading as already-resolved the instant this freshly-loaded,
        // still-in-progress call opens. A brand-new incoming call is Open,
        // not Resolved. Keyed by channel id, same as `threadStatuses`'
        // every other write (`handleInteractionStatusChange`).
        threadStatuses: { voice: "Open" },
      };
      // Per explicit follow-up request ("load the assignment tile in the
      // left nav when the toast comes in"): committed immediately now,
      // rather than held until Review/Takeover is clicked — reuses
      // `commitMarcusWebbInteraction` unchanged (its own dedup-by-id guard
      // makes it harmless if Review/Takeover ever call it again too, see
      // that function's own doc comment). `setMarcusWebbReviewing(true)`
      // right alongside it, so the tile's own Marcus-specific
      // `controlsDisabled`/locked-kebab-and-outcome treatment is correct
      // the instant it appears, not just after a click — same value
      // `onReview` used to set. Deliberately NOT setting
      // `activeInteractionId` here: the tile should just show up in the
      // left nav, the agent still clicks it themselves to open it.
      marcusWebbPendingInteractionRef.current = interaction;
      // The incoming-call toast is no longer shown on launch: the assignment tile just appears in the left nav.
      setMarcusWebbTriggered(true);
      commitMarcusWebbInteraction();
      setMarcusWebbReviewing(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // `commitMarcusWebbInteraction` only reads a ref and the stable
    // `setInteractions` (useNavCards' `setCards`), so re-subscribing the
    // hotkey on every render for it would change nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentStatus, marcusWebbTriggered, clock]);
  // Per explicit request ("use the case content for lucas thomas and open the
  // assignment when the user presses 'a' on the keyboard"): "A" adds the
  // Lucas Thomas webchat assignment (CASE-30418, from the Agentic Workspace
  // demo) to the left nav and opens it. Once per page load, like "L", and
  // ignored while typing in a field.
  const [lucasThomasTriggered, setLucasThomasTriggered] = useState(false);
  // Lucas's AI-led chat is only REVIEWED until the agent clicks Takeover:
  // chat hidden, review ActionBar shown (same flow as Marcus Webb).
  const [lucasThomasReviewing, setLucasThomasReviewing] = useState(false);
  // "Hide AI Actions" switch in the composer: transcript shows only chat bubbles.
  const [hideAiActions, setHideAiActions] = useState(false);
  // True while the review banner animates out after "Complete wrap-up" (the banner stays mounted for the exit animation).
  const [lucasThomasBannerExiting, setLucasThomasBannerExiting] = useState(false);
  // The review banner is dismissed by "Complete wrap-up" without a takeover: reviewing stays true (no composer, outcome locked).
  const [lucasThomasBannerHidden, setLucasThomasBannerHidden] = useState(false);
  // Set once the agent clicks Takeover: a wrap-up card that hasn't been completed is withdrawn and never appears.
  const lucasTakenOverRef = useRef(false);
  // Always points at the latest `handleDismissInteraction` so delayed (timeout) callers don't use a stale closure.
  const dismissInteractionRef = useRef<((id: string) => void) | null>(null);
  // Anything the agent asks Copilot is logged in the chat as the same "AI agent finished performing this." + clickable
  // instruction row used for approval decisions; the row reopens the question in the side panel.
  const handleCopilotAsk = (interactionId: string, threadKey: string, text: string) => {
    // Asking Copilot produces an AI action row, so reveal AI actions if they were hidden.
    setHideAiActions(false);
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const message: TranscriptMessage = {
      id: `copilot-ask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: "agent",
      name: "John Smith",
      initials: "JS",
      timestamp: time,
      text,
      instruction: {
        title: text,
        by: "John Smith",
        // Lookup chips reopen the exact same panel the chip opens (so both entry points show identical content);
        // free-form questions open the instruction/result panel.
        link:
          (interactionId === LUCAS_THOMAS_ID ? LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS[text] : undefined) ??
          (interactionId === TOM_LEWIS_CALL_ID ? TOM_LEWIS_CALL_COPILOT_LINKS[text] : undefined) ??
          (interactionId === MAYA_CHEN_CALL_ID ? MAYA_CHEN_CALL_COPILOT_LINKS[text] : undefined) ??
          `instruction:copilot:${encodeURIComponent(text)}:${encodeURIComponent(time)}`,
      },
    };
    setInteractions((prev) =>
      prev.map((i) =>
        i.id === interactionId
          ? { ...i, liveMessages: { ...i.liveMessages, [threadKey]: [...(i.liveMessages?.[threadKey] ?? []), message] } }
          : i
      )
    );    // Free-form questions automatically open their result in the side panel once Copilot "finishes" (lookup chips open
    // their own panel after their spinner, so only the instruction panel needs this).
    if ((interactionId === LUCAS_THOMAS_ID || isColdCallId(interactionId)) && message.instruction && message.instruction.link.startsWith("instruction:")) {
      window.setTimeout(() => {
        setDetailPanelByInteraction((prev) => ({
          ...prev,
          [interactionId]: { kind: "lucas-instruction", decision: "copilot", text, time },
        }));
      }, 1800);
    }
  };
  // Plays out the chat follow-up (events + AI replying to the customer) after the agent decides on Lucas's approval card.
  // Distinct id per run so a repeated "Something else" instruction never reuses a message id.
  const [marcusCopilotRequests, setMarcusCopilotRequests] = useState<{ id: string; text: string; time: string }[]>([]);
  const marcusCopilotRequestsRef = useRef<{ id: string; text: string; time: string }[]>([]);
  const handleMarcusCopilotAsk = (text: string, openAfterMs?: number) => {
    // Asking Copilot produces an AI action row, so reveal AI actions if they were hidden.
    setHideAiActions(false);
    const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const req = { id: `marcus-copilot-${Date.now()}`, text, time };
    marcusCopilotRequestsRef.current = [...marcusCopilotRequestsRef.current, req];
    setMarcusCopilotRequests((prev) => [...prev, req]);
    // Free-form questions open their result once Copilot "finishes"; chips open their own panel after their spinner.
    if (openAfterMs !== undefined) {
      window.setTimeout(
        () => setDetailPanelByInteraction((prev) => ({ ...prev, [MARCUS_WEBB_ID]: { kind: "marcus-copilot", ...req } })),
        openAfterMs
      );
    }
  };
  const lucasFollowupRunRef = useRef(0);
  // "Call now" on Lucas's escalation card: opens the outbound popover on the button; `confirm` marks the card decided once launched.
  const lucasCallConfirmRef = useRef<(() => void) | null>(null);
  const LUCAS_THOMAS_PHONE = "(415) 555-0142";
  const handleLucasCallRequest = (req: { value: string; anchorEl: HTMLElement; confirm: () => void }) => {
    lucasCallConfirmRef.current = req.confirm;
    outboundDial.requestDialpad({ phoneNumber: LUCAS_THOMAS_PHONE, anchorEl: req.anchorEl, customerName: "Call Lucas Thomas" });
  };
  const launchLucasCall = (phoneNumber: string, skillId: string) => {
    const confirm = lucasCallConfirmRef.current;
    lucasCallConfirmRef.current = null;
    confirm?.();
    // Launching the call hands the chat off to John: Takeover Chat goes away.
    handleLucasTakeover(true);
    // `confirm()` above submits the card, whose `onDecide` already plays the `upset-call` steps (calling event, AI heads-up, connected).
    const skillLabel = OUTBOUND_CONFIG.skillOptions.find((o: { value: string; label: string }) => o.value === skillId)?.label ?? OUTBOUND_CONFIG.skillOptions[0]?.label;
    // The call connects a few seconds after launch — only then does a live voice thread exist, which is what brings up the call controls.
    window.setTimeout(() => {
      const voice: Thread = {
        id: `voice:${phoneNumber}`,
        type: "voice",
        startTick: clock.now(),
        value: phoneNumber,
        addressLabel: phoneNumber,
        contactId: generateContactId(),
        preview: skillLabel,
        startedFresh: true,
        direction: "outbound",
      };
      setInteractions((prev) =>
        prev.map((i) =>
          i.id === LUCAS_THOMAS_ID && !i.threads.some((t) => t.id === voice.id)
            ? { ...i, threads: [...i.threads, voice], voiceCallEnded: undefined }
            : i
        )
      );
    }, 4200);
  };
  const handleLucasApprovalDecision = (value: string, note: string) => {
    const run = (lucasFollowupRunRef.current += 1);
    // "Something else" instructions are internal: the AI only talks to the customer when the agent's instruction
    // is a command to say something to them (tell / say / let them know / ask / inform / notify ...).
    const isSomethingElse = value === "other" || value === "ship-other" || value === "upset-other";
    // Only an instruction that names the customer as the recipient counts ("tell Lucas ...", "let him know ...");
    // instructions to the AI itself ("tell me ...", "show ...", "how old is ...") never get a customer reply.
    const asksAiToSpeak =
      !/^\s*(please\s+)?(tell|show|give|ask)\s+me\b/i.test(note) &&
      /\b(tell|say to|say|let|inform|notify|message|reply to|respond to|ask|apologi[sz]e to|thank|update|confirm with|offer|follow(?:\s|-)?up with|get back to|reach out to|check in with|contact|advise|reassure|explain to)\b[^.?!]{0,40}\b(the customer|customer|lucas|him|her|them|the client|client)\b/i.test(
        note
      );
    const steps = (LUCAS_THOMAS_DECISION_FOLLOWUPS[value] ?? []).filter(
      (st) =>
        !(isSomethingElse && st.kind === "ai" && !asksAiToSpeak) &&
        // Wrapping up without ever taking over auto-dismisses the assignment; if the agent did take over, they remove it themselves.
        !(value === "ship-wrapup" && st.kind === "dismiss" && lucasTakenOverRef.current)
    );
    const typingKey = `${LUCAS_THOMAS_ID}:chat`;
    steps.forEach((step, idx) => {
      const setTyping = step.kind === "customer" ? setCustomerTyping : setAiTyping;
      if (step.typingStartMs !== undefined) {
        window.setTimeout(() => setTyping((prev) => ({ ...prev, [typingKey]: true })), step.typingStartMs);
      }
      window.setTimeout(() => {
        if (step.kind === "wrapup") {
          if (lucasTakenOverRef.current) return;
          const wrap: TranscriptMessage = {
            id: "lt-wrap-up",
            sender: "agent",
            name: "AI agent · Checkout",
            initials: "AI",
            timestamp: step.timestamp ?? "",
            text: "",
            wrapUp: LUCAS_THOMAS_WRAP_UP,
          };
          setInteractions((prev) =>
            prev.map((i) =>
              i.id === LUCAS_THOMAS_ID
                ? { ...i, liveMessages: { ...i.liveMessages, chat: [...(i.liveMessages?.chat ?? []), wrap] } }
                : i
            )
          );
          return;
        }
        if (step.kind === "approval") {
          // A second approval request card from the AI agent (waive the priority shipping fee).
          const approval: TranscriptMessage = {
            id: step.approvalKey === "upset" ? "lt-upset-approval" : "lt-shipping-approval",
            sender: "agent",
            name: "AI agent · Checkout",
            initials: "AI",
            timestamp: step.timestamp ?? "",
            text: "",
            summary: step.approvalKey === "upset" ? LUCAS_THOMAS_UPSET_APPROVAL_SUMMARY : LUCAS_THOMAS_SHIPPING_APPROVAL_SUMMARY,
          };
          setInteractions((prev) =>
            prev.map((i) =>
              i.id === LUCAS_THOMAS_ID
                ? { ...i, liveMessages: { ...i.liveMessages, chat: [...(i.liveMessages?.chat ?? []), approval] } }
                : i
            )
          );
          return;
        }
        if (step.kind === "close") {
          // Simulated disposition + unassign: the chat flips to Closed (read-only).
          setInteractions((prev) =>
            prev.map((i) =>
              i.id === LUCAS_THOMAS_ID ? { ...i, threadStatuses: { ...i.threadStatuses, chat: "Closed" } } : i
            )
          );
          return;
        }
        if (step.kind === "dismiss") {
          // Finally removes the assignment from the left nav (same path as Save & Dismiss).
          dismissInteractionRef.current?.(LUCAS_THOMAS_ID);
          return;
        }
        if (step.kind === "ai") setAiTyping((prev) => ({ ...prev, [typingKey]: false }));
        if (step.kind === "customer") setCustomerTyping((prev) => ({ ...prev, [typingKey]: false }));
        const isCustomer = step.kind === "customer";
        const instructionText = (step.text ?? "").replace("{note}", note);
        const message: TranscriptMessage = {
          id: `lt-followup-${value}-${run}-${idx}`,
          sender: isCustomer ? "customer" : "agent",
          name: isCustomer ? "Lucas Thomas" : "AI agent · Checkout",
          initials: isCustomer ? "LT" : "AI",
          timestamp: step.timestamp ?? "",
          text: (step.text ?? "").replace("{note}", note),
          ...(step.kind === "event" ? { event: true } : {}),
          ...(step.kind === "instruction"
            ? {
                instruction: {
                  title: instructionText,
                  by: step.by ?? "John Smith",
                  link:
                    step.link ??
                    `instruction:${value}:${encodeURIComponent(instructionText)}:${encodeURIComponent(step.timestamp ?? "")}`,
                },
              }
            : {}),
        };
        setInteractions((prev) =>
          prev.map((i) =>
            i.id === LUCAS_THOMAS_ID
              ? { ...i, liveMessages: { ...i.liveMessages, chat: [...(i.liveMessages?.chat ?? []), message] } }
              : i
          )
        );
      }, step.appearMs);
    });
  };
  useEffect(() => {
    if ((agentStatus !== "available" && agentStatus !== "working") || lucasThomasTriggered) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "a" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      setInteractions((prev) =>
        prev.some((i) => i.id === LUCAS_THOMAS_ID) ? prev : [...prev, buildLucasThomasInteraction(clock.now())]
      );
      setLucasThomasTriggered(true);
      setLucasThomasReviewing(true);
      // Messages after the initial setup play out live; the customer's line
      // is preceded by the "customer is typing" indicator.
      const typingKey = `${LUCAS_THOMAS_ID}:chat`;
      LUCAS_THOMAS_CHAT_TRANSCRIPT.slice(LUCAS_THOMAS_INITIAL_COUNT).forEach((message, idx) => {
        const step = LUCAS_THOMAS_REALTIME_STEPS[idx];
        if (!step) return;
        const setTyping = step.typing === "ai" ? setAiTyping : setCustomerTyping;
        if (step.typingStartMs !== undefined) {
          window.setTimeout(() => setTyping((prev) => ({ ...prev, [typingKey]: true })), step.typingStartMs);
        }
        window.setTimeout(() => {
          setTyping((prev) => ({ ...prev, [typingKey]: false }));
          setInteractions((prev) =>
            prev.map((i) =>
              i.id === LUCAS_THOMAS_ID
                ? { ...i, liveMessages: { ...i.liveMessages, chat: [...(i.liveMessages?.chat ?? []), message] } }
                : i
            )
          );
        }, step.appearMs);
      });
      // Deliberately NOT switching to Lucas: the assignment card just appears in the left nav; the agent opens it when ready.
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [agentStatus, lucasThomasTriggered, clock, setInteractions]);
  // "C" rings a cold incoming call from Tom Lewis (CASE-30409 from the Agentic Workspace demo, no AI agent): Accept adds the
  // assignment, opens it and starts the live call; Decline just dismisses the notice. Ignored while typing in a field.
  const [tomLewisCallTriggered, setTomLewisCallTriggered] = useState(false);
  useEffect(() => {
    if ((agentStatus !== "available" && agentStatus !== "working") || tomLewisCallTriggered || tomLewisCallRinging) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "c" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      // The call rings as a new tile in the left nav (opened if it was closed), with Accept / Decline on the tile.
      setInteractions((prev) =>
        prev.some((i) => i.id === TOM_LEWIS_CALL_ID) ? prev : [...prev, buildTomLewisCallInteraction(clock.now())]
      );
      setNavOpen(true);
      setTomLewisCallRinging(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [agentStatus, tomLewisCallTriggered, tomLewisCallRinging, clock, setInteractions]);
  // "B" brings in a cold incoming call from Maya Chen (CASE-30402 from the Agentic Workspace demo, no AI agent) that is answered
  // automatically: no Accept/Decline, the call controls load straight away and the conversation plays out in the transcript.
  const [mayaChenCallTriggered, setMayaChenCallTriggered] = useState(false);
  const startMayaChenCall = () => {
    setMayaChenCallTriggered(true);
    setInteractions((prev) =>
      prev.some((i) => i.id === MAYA_CHEN_CALL_ID) ? prev : [...prev, buildMayaChenCallInteraction(clock.now())]
    );
    setNavOpen(true);
    switchActiveInteraction(MAYA_CHEN_CALL_ID);
    setSidePanelOpen(false);
    MAYA_CHEN_CALL_LIVE_LINES.forEach(({ appearMs, message }) => {
      window.setTimeout(() => {
        setInteractions((prev) =>
          prev.map((i) =>
            i.id === MAYA_CHEN_CALL_ID
              ? { ...i, liveMessages: { ...i.liveMessages, voice: [...(i.liveMessages?.voice ?? []), message] } }
              : i
          )
        );
      }, appearMs);
    });
  };
  useEffect(() => {
    if ((agentStatus !== "available" && agentStatus !== "working") || mayaChenCallTriggered) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      startMayaChenCall();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentStatus, mayaChenCallTriggered]);
  // Escape closes the open side panel: the slide-out detail panel first (article, order, Copilot answer...), otherwise the docked
  // Contact Details panel. Skipped while another overlay (popover, menu, dialog) is open so Escape still closes that first.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"], [role="menu"], [role="listbox"]')) return;
      if (selectedDetailPanelContent) {
        setSelectedDetailPanelContent(null);
      } else if (sidePanelOpen) {
        setSidePanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  });
  const handleAcceptTomLewisCall = () => {
    setTomLewisCallRinging(false);
    setTomLewisCallTriggered(true);
    // The call timer starts when it is answered.
    setInteractions((prev) =>
      prev.map((i) =>
        i.id === TOM_LEWIS_CALL_ID
          ? { ...i, threads: i.threads.map((t) => (t.type === "voice" ? { ...t, startTick: clock.now() } : t)) }
          : i
      )
    );
    switchActiveInteraction(TOM_LEWIS_CALL_ID);
    setSidePanelOpen(false);
    // The conversation plays out in the live voice transcript.
    TOM_LEWIS_CALL_LIVE_LINES.forEach(({ appearMs, message }) => {
      window.setTimeout(() => {
        setInteractions((prev) =>
          prev.map((i) =>
            i.id === TOM_LEWIS_CALL_ID
              ? { ...i, liveMessages: { ...i.liveMessages, voice: [...(i.liveMessages?.voice ?? []), message] } }
              : i
          )
        );
      }, appearMs);
    });
  };
  const [tomLewisCallLeaving, setTomLewisCallLeaving] = useState(false);
  const handleDeclineTomLewisCall = () => {
    if (tomLewisCallLeaving) return;
    addToast({ variant: "info", title: "Call declined", message: "Tom Lewis call declined", duration: 4000 });
    setTomLewisCallLeaving(true);
    // Let the tile animate out before removing it.
    window.setTimeout(() => {
      setTomLewisCallRinging(false);
      setInteractions((prev) => prev.filter((i) => i.id !== TOM_LEWIS_CALL_ID));
      setTomLewisCallLeaving(false);
    }, 350);
  };
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  // Flushes whatever `fireAgentLegStatusToast` deferred (further up this
  // component) the moment the welcome modal actually closes (Go Available /
  // Start Offline), so the agent still sees that toast — just after, not
  // during, the modal. Has to live down here, after `showWelcomeModal`
  // itself is declared — `useEffect`'s dependency array is evaluated
  // immediately as part of this call (unlike a plain function body, which
  // only reads `showWelcomeModal` once actually invoked later), so putting
  // this up near `fireAgentLegStatusToast` referenced `showWelcomeModal`
  // before its own `const` had run, which crashed the whole page on every
  // render (temporal dead zone) — that's why the welcome modal stopped
  // opening at all just now. Deliberately keyed only on `showWelcomeModal`
  // — `showAgentLegToast` is a plain function redefined every render (not
  // memoized), so including it would rerun this on every render instead of
  // only on the open→closed transition this is meant to catch.
  useEffect(() => {
    if (!showWelcomeModal && pendingAgentLegToastRef.current) {
      showAgentLegToast(pendingAgentLegToastRef.current);
      pendingAgentLegToastRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWelcomeModal]);
  // Page-clock tick the agent's current status started at. The header's
  // HH:MM:SS status timer is the page clock minus this, ticking inside
  // `<ClockTick>` around `AgentProfile` only; a status change resets it.
  const [statusSinceTick, setStatusSinceTick] = useState(0);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark"
  );

  const handleDarkModeToggle = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
      return next;
    });
  };

  const appMenuGroups = buildAppMenuGroups((page) => {
    setAppMenuOpen(false);
    onNavigate?.(page);
  }, "agent-advanced");

  /* Panel animation state machine — see AgentNextGenTemplate.stories.tsx for full comment */
  type PanelState = "closed" | "open" | "closing";

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
  type PanelKey =
    | "notif"
    | "conversations"
    | "schedule"
    | "screenpop"
    | "customers"
    | "accounts"
    | "tickets"
    | "wem"
    | "search";

  const [panelOpen,      setPanelOpen]      = useState(false);
  // Per explicit request ("go back to auto-closing the app panels when a
  // new interaction is launched") — see AgentNextGenPage.tsx's identical
  // effect (same `[activeInteractionId]` dependency, mirroring the
  // `setShowSettings(false)` effect above) for the full rationale.
  useEffect(() => {
    if (activeInteractionId) {
      setPanelOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInteractionId]);
  // Floating video window — see AgentNextGenPage.tsx's identical state for
  // the full rationale.
  const [voiceVideoWindowOpen, setVoiceVideoWindowOpen] = useState(false);
  // Whether the video window is currently the full-screen variant vs. the
  // small floating one — see AgentNextGenPage.tsx's identical state for
  // the full rationale.
  const [voiceVideoFullScreen, setVoiceVideoFullScreen] = useState(false);
  // Which tab the docked `CustomerInformationSidePanel` below is showing —
  // per later explicit request ("put the transcript and session tabs into
  // the new customer information side panel and rename the side panel
  // Session Details"): this panel used to ONLY show the Customer Profile/
  // Contact Snapshot/Files accordions (`bodyOverride`, see that panel's own
  // render site's doc comment); Transcript (voice only) and Session
  // Details moved INTO it from what used to be a totally separate
  // "Session Details" `InteriorPanel` overlay (removed — see this state's
  // own render site for what replaced it). One shared tab state now,
  // regardless of channel type, since there's only ONE panel left to have
  // a tab at all — `headerTabsOverride` (that panel's own render site)
  // simply offers fewer tabs (no "Transcript") for a non-voice interaction
  // rather than needing a second, parallel piece of state. Reset to
  // "Details" whenever the panel closes or the active interaction changes,
  // same as the two separate pieces of state this replaced used to reset.
  // "Customer Info" — a 4th value, per explicit request ("move the
  // customer information content back to the side panel"): not a normal
  // tab the agent picks from the header's own tab row (that row is
  // entirely replaced by a back arrow + the drill-in's own content while
  // this is active — see the `CustomerInformationSidePanel` render site's
  // own overrides further down) — only reached via `focusCustomerPanelTab`
  // (its own doc comment) and left via that same back arrow, which lands
  // back on "Details".
  const [customerPanelActiveTab, setCustomerPanelActiveTab] = useState<
    "Details" | "Transcript" | "Session Details" | "Customer Info" | "Artifacts" | "Experience Memory"
  >("Details");
  // Per explicit request ("when the agent confirms navigating away to view
  // the transcript, it should display the Transcript tab once it
  // transitions to the contact"): the interaction-switch effect just below
  // unconditionally resets `customerPanelActiveTab` back to "Details" on
  // EVERY `activeInteractionId` change, including the one
  // `onConfirmViewTranscript` triggers via `switchActiveInteraction` — that
  // reset is a `useEffect`, so it always runs AFTER this handler's own
  // synchronous `setCustomerPanelActiveTab("Transcript")` call, silently
  // clobbering it back to "Details" a render later. A plain ref (not
  // state) that the reset effect itself checks and clears: set right
  // before calling `switchActiveInteraction`, so it survives until that
  // effect actually runs, without needing to touch every other existing
  // "switch interaction" call site that's fine with the normal "Details"
  // reset.
  const restoredCustomerPanelTabRef = useRef<typeof customerPanelActiveTab | null>(null);
  const pendingCustomerPanelTabRef = useRef<"Transcript" | null>(null);
  // The Marcus Webb action-log detail panel and the "Do Something"
  // knowledge-article panel used to be two SEPARATE floating
  // `InteriorPanel` overlays with two separate pieces of state — per
  // explicit follow-up request ("toggling between refund approved and
  // tablet warranty coverage should change the content of the container
  // — like how the home page works"), they're now ONE shared overlay
  // (own render site further down) showing exactly one of three "views"
  // at a time. `DetailPanelContent` is that union; `article-link` is the
  // "drilled into one of an article's web links" view — reached by
  // navigating WITHIN this one panel (via its new `onBack`, see
  // `interior-panel.tsx`) rather than opening a second, nested panel
  // (nesting isn't supported anywhere in this app).
  // Panel content is native to each customer/interaction: it only shows while
  // that interaction is active, is hidden when switching to another one, and
  // comes back when returning to it.
  const [detailPanelByInteraction, setDetailPanelByInteraction] = useState<Record<string, DetailPanelContent | null>>({});
  const selectedDetailPanelContent: DetailPanelContent | null = activeInteractionId
    ? detailPanelByInteraction[activeInteractionId] ?? null
    : null;
  const setSelectedDetailPanelContent = (
    updater: DetailPanelContent | null | ((current: DetailPanelContent | null) => DetailPanelContent | null)
  ) => {
    if (!activeInteractionId) return;
    setDetailPanelByInteraction((prev) => {
      const current = prev[activeInteractionId] ?? null;
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [activeInteractionId]: next };
    });
  };
  // Every side panel the agent opens on an interaction is remembered here and
  // listed as a link in the Contact Details "Artifacts" card; clicking one
  // re-opens it (not a toggle).
  const detailPanelArtifactKey = (c: DetailPanelContent): string => {
    switch (c.kind) {
      case "action-log": return `action-log:${c.entry.id}`;
      case "article": return `article:${c.article.id}`;
      case "article-link": return `article-link:${c.article.id}:${c.link.copyValue}`;
      case "order": return `order:${c.order.orderId}`;
      case "lucas": return `lucas:${c.panel}`;
      case "lucas-memory": return "lucas-memory";
      case "lucas-instruction": return `lucas-instruction:${c.text}`;
      case "marcus-copilot": return `marcus-copilot:${c.id}`;
      case "tom-call": return `tom-call:${c.panel}`;
      case "lucas-order": return `lucas-order:${c.orderId}`;
      case "transactions": return `transactions:${c.id}`;
    }
  };
  const detailPanelArtifactLabel = (c: DetailPanelContent): string => {
    switch (c.kind) {
      case "action-log": return c.entry.title;
      case "article": return c.article.title;
      case "article-link": return c.link.title;
      case "order": return `Order ${c.order.orderId} · ${c.order.itemName}`;
      case "lucas": return LUCAS_THOMAS_PANEL_TITLES[c.panel].title;
      case "lucas-memory": return "Experience Memory";
      case "lucas-instruction": return c.text;
      case "marcus-copilot": return c.text;
      case "tom-call": return TOM_LEWIS_CALL_PANEL_TITLES[c.panel].title;
      case "lucas-order": return `Order ${LUCAS_THOMAS_ORDER_DETAILS[c.orderId].item}`;
      case "transactions": return "Transactions";
    }
  };
  const [panelArtifactsByInteraction, setPanelArtifactsByInteraction] = useState<
    Record<string, { id: string; label: string; content: DetailPanelContent }[]>
  >({});
  useEffect(() => {
    if (!activeInteractionId || !selectedDetailPanelContent) return;
    // Experience Memory lives in the docked side panel, so it is never listed as an artifact.
    if (selectedDetailPanelContent.kind === "lucas-memory") return;
    const content = selectedDetailPanelContent;
    const id = detailPanelArtifactKey(content);
    setPanelArtifactsByInteraction((prev) => {
      const list = prev[activeInteractionId] ?? [];
      const entry = { id, label: detailPanelArtifactLabel(content), content };
      const idx = list.findIndex((a) => a.id === id);
      const nextList = idx === -1 ? [...list, entry] : list.map((a, i) => (i === idx ? entry : a));
      return { ...prev, [activeInteractionId]: nextList };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDetailPanelContent, activeInteractionId]);
  const lucasActiveLinkKey: string | undefined =
    selectedDetailPanelContent?.kind === "lucas"
      ? selectedDetailPanelContent.panel
      : selectedDetailPanelContent?.kind === "lucas-instruction"
      ? `instruction:${selectedDetailPanelContent.decision}:${encodeURIComponent(selectedDetailPanelContent.text)}:${encodeURIComponent(selectedDetailPanelContent.time)}`
      : selectedDetailPanelContent?.kind === "tom-call"
      ? selectedDetailPanelContent.panel
      : undefined;
  const panelArtifacts = activeInteractionId ? panelArtifactsByInteraction[activeInteractionId] ?? [] : [];
  const reopenPanelArtifact = (id: string) => {
    const found = panelArtifacts.find((a) => a.id === id);
    if (found) setSelectedDetailPanelContent(found.content);
  };
  // Mirrors `selectedDetailPanelContent` but never resets to `null` — per
  // explicit bug report (on the original single-purpose version of this
  // panel), it used to go blank the instant it started closing (content
  // was driven directly off the nullable selection state). This keeps
  // showing the last real content throughout the close animation; `open`
  // itself still tracks `selectedDetailPanelContent` directly.
  const [lastDetailPanelContent, setLastDetailPanelContent] = useState<DetailPanelContent | null>(null);
  useEffect(() => {
    if (selectedDetailPanelContent) setLastDetailPanelContent(selectedDetailPanelContent);
  }, [selectedDetailPanelContent]);
  // Per explicit request ("when a new interaction is added, instead of
  // changing the main content ... add an icon representing the channel
  // ... and open a side panel (like contact details) with the channel
  // content"), refined by a later explicit follow-up ("put the content of
  // the channels IN the side panel (where the contact details content is
  // now)" / "so a chat opens in that side panel"): which non-active
  // Thread (by its own `id ?? type` key, same scheme every other
  // per-channel lookup in this file uses) is currently taking over the
  // docked Contact Details panel's own content — `null` when nothing's
  // being previewed, in which case that panel (if open) shows its normal
  // Overview/Session tabs as usual. Set on add (`handleAddAdHocChannel`/
  // `handleStartCall`, above) for anything but voice, and toggled by the
  // header icon row (own render site) the rest of the time.
  const [channelPreviewThreadKey, setChannelPreviewThreadKey] = useState<string | null>(null);
  // Looked up once here (rather than inline at the
  // `CustomerInformationSidePanel` render call site) since it now feeds
  // several of that single docked panel's own override props — see each
  // prop's own doc comment at that render site for how each one branches
  // on it. Looks the key back up fresh every render (rather than storing
  // the whole `Thread` in state) so its content — `liveMessages`,
  // `awaitingResponse`, etc. — always reflects the live `interactions`
  // array, same reasoning `activeChannel`'s own derivation (above)
  // already follows.
  const channelPreviewThread = activeInteraction?.threads.find(
    (c) => (c.id ?? c.type) === channelPreviewThreadKey
  );
  const channelPreviewThreadStableKey = channelPreviewThread
    ? channelPreviewThread.id ?? channelPreviewThread.type
    : null;
  const channelPreviewMeta = channelPreviewThread ? CHANNEL_TYPE_META[channelPreviewThread.type] : undefined;
  // Toggle-open: clicking whatever's ALREADY showing closes the panel
  // (same semantics `selectedActionLogEntryId`'s own doc comment already
  // established); clicking something else just swaps this one panel's
  // content, per the "like the home page" request above.
  const openDetailPanelContent = (next: DetailPanelContent) => {
    setSelectedDetailPanelContent((current) => {
      if (!current) return next;
      if (current.kind === "action-log" && next.kind === "action-log" && current.entry.id === next.entry.id) {
        return null;
      }
      if (current.kind === "article" && next.kind === "article" && current.article.id === next.article.id) {
        return null;
      }
      // Per explicit request ("clicking Marcus Webb when Marcus Webb is
      // open should close the panel — same with the order link"), this
      // gets the same toggle-off treatment as action-log/article above.
      // ("customer" used to be handled here too, until a later explicit
      // request moved it off this shared floating panel entirely onto the
      // docked `CustomerInformationSidePanel` instead — see
      // `focusCustomerPanelTab`'s own doc comment.)
      if (current.kind === "order" && next.kind === "order" && current.order.orderId === next.order.orderId) {
        return null;
      }
      if (current.kind === "transactions" && next.kind === "transactions" && current.id === next.id) {
        return null;
      }
      if (current.kind === "marcus-copilot" && next.kind === "marcus-copilot" && current.id === next.id) {
        return null;
      }
      // Any link whose panel is already open closes it (toggle), whatever the panel kind.
      if (detailPanelArtifactKey(current) === detailPanelArtifactKey(next)) return null;
      return next;
    });
  };
  // The DOM node the Next Best Action card's currently-active question
  // portals into (see `MarcusWebbNextBestActionCard`'s own
  // `questionSlotElement` doc comment) — fixed to the bottom of the
  // interaction column, per explicit request, instead of scrolling with
  // the rest of the transcript. A callback ref (not a plain `useRef`) so
  // it's guaranteed set by the first render that needs to portal into it.
  const [marcusQuestionSlotEl, setMarcusQuestionSlotEl] = useState<HTMLDivElement | null>(null);
  // "View Details"'s target session — voice and every other channel each
  // get their own single-purpose state (`selectedVoiceDetailsSession`/
  // `selectedSessionDetails`, kept separate rather than unified — the two
  // channel families never show at the same time, since only one channel
  // is ever active). Both also fall back to whichever session is CURRENTLY
  // live when nothing's been explicitly clicked yet (`currentVoiceSession`/
  // `currentSessionDetails` below) — per explicit bug report, the "Session"
  // tab showed a bare "Select 'View Details' on a session..." placeholder
  // if the agent switched straight to it without ever clicking "View
  // Details" first, even though there's always exactly one real current
  // session to show. This fallback was originally wired for voice only;
  // extended to every channel per a later explicit request ("the session
  // tab should display the details when it is active always").
  const [selectedVoiceDetailsSession, setSelectedVoiceDetailsSession] = useState<Contact | null>(null);
  // Fallback for the Session tab when no session has been explicitly
  // clicked yet — see the state declaration's own doc comment just above.
  const [currentVoiceSession, setCurrentVoiceSession] = useState<Contact | null>(null);
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<Contact | null>(null);
  // Non-voice counterpart to `currentVoiceSession` — see that state's own
  // doc comment above.
  const [currentSessionDetails, setCurrentSessionDetails] = useState<Contact | null>(null);
  useEffect(() => {
    if (activeInteractionId) {
      setVoiceVideoWindowOpen(false);
      setVoiceVideoFullScreen(false);
      // Per a LATER explicit follow-up request ("Marcus Webb shouldn't
      // default to Transcript on first open, show the Overview tab like
      // other contacts") — this reverses the earlier "the transcript
      // should be open when the contact moves to review" decision: `onReview`
      // (the incoming-call notice's own render site, far below) no longer
      // calls `setCustomerPanelActiveTab("Transcript")` at all, so this
      // effect's own unconditional reset below now applies to Marcus
      // exactly like every other interaction switch — no special-case
      // guard needed any more. (The reset itself displays as the
      // "Overview" tab — see this file's own
      // `label === "Details" ? "Overview" : label` render sites.) Per a
      // later explicit request, `pendingCustomerPanelTabRef` (own doc
      // comment above) overrides this default just once, for the one case
      // that needs to land on a specific tab instead — the "View
      // Transcript?" confirm's own navigate-then-show-Transcript flow.
      if (pendingCustomerPanelTabRef.current) {
        setCustomerPanelActiveTab(pendingCustomerPanelTabRef.current);
        pendingCustomerPanelTabRef.current = null;
      } else if (restoredCustomerPanelTabRef.current) {
        setCustomerPanelActiveTab(restoredCustomerPanelTabRef.current);
        restoredCustomerPanelTabRef.current = null;
      } else {
        setCustomerPanelActiveTab("Details");
      }
      setSelectedVoiceDetailsSession(null);
      setCurrentVoiceSession(null);
      setSelectedSessionDetails(null);
      setCurrentSessionDetails(null);
      // Backstop reset for the restored hover-preview (`customerInfoPreview
      // Open`, see that state's own doc comment) — same "clear it on every
      // interaction switch" reset `AgentNextGenPage.tsx`'s own copy of this
      // state uses, so a preview left open (hovered, not yet dismissed) on
      // the outgoing interaction never carries over onto the incoming one.
      setCustomerInfoPreviewOpen(false);
    }
  }, [activeInteractionId]);
  const [panelMounted,   setPanelMounted]   = useState(false);
  const [panelState,     setPanelState]     = useState<PanelState>("closed");
  const [activePanelKey, setActivePanelKey] = useState<PanelKey | null>(null);
  // Defaults to "float" per explicit follow-up request — see 2.0's own
  // copy of this comment (AgentNextGenPage.tsx) for the full writeup on
  // reverting the earlier "docked" default and why no separate
  // remembered-preference flag is needed for "if docked then closed,
  // keep it docked on next open" — `panelVariant` itself already
  // persists across a close/reopen, `handlePanelButtonClick` just no
  // longer overwrites it.
  const [panelVariant,    setPanelVariant]    = useState<DraggableVariant>("float");
  const [panelWidth,      setPanelWidth]      = useState(SHARED_PANEL_DEFAULT_WIDTH);
  const [panelHeight,     setPanelHeight]     = useState(860);
  const [panelIsResizing, setPanelIsResizing] = useState(false);
  // Fullscreen toggle for the shared panel (AI/Notifications/Apps/
  // Calendar/etc.) — distinct from `panelVariant`'s "float"/"docked" (which
  // is `Draggable`'s own concept and stays within/beside the interaction
  // container). This instead expands the panel to fill the ENTIRE main
  // content container (`containerRef` — everything right of LeftNav, below
  // AppHeader; the same box the Customer Information panel/main interaction
  // `Container` live in), covering that area only — LeftNav and AppHeader
  // stay visible, unlike a real page-covering modal. Implemented as a
  // separate `position: absolute; inset: 0` overlay (`sharedPanelFullScreenOverlay`
  // below), positioned against `containerRef` (which is already `relative`)
  // rather than the viewport, reusing the same header/body content but
  // rendered independently of `Draggable` entirely — `Draggable` has no
  // fullscreen concept of its own (only float/docked), and coercing its
  // "float" variant into spanning the container would mean fighting its
  // internal width/height/offset state and its own
  // `clampOffsetIntoViewport` containment logic (viewport-based, not
  // container-based, and not easily repurposed). Whichever of
  // `panelVariant`'s two states was active before entering fullscreen is
  // preserved (untouched) and simply resumes when fullscreen exits.
  const [panelFullScreen, setPanelFullScreen] = useState(false);
  // Keeps `sharedPanelFullScreenOverlay` mounted for a beat after
  // `panelFullScreen` flips back to false, so the exit transition (see
  // that overlay's own doc comment, and `fullScreenAnimTimer` below) can
  // actually play instead of the overlay disappearing instantly — same
  // "state machine outlives the boolean it's animating" shape as
  // `panelState`/`panelOpen` above, just scoped to fullscreen alone
  // rather than the whole panel's mount lifecycle.
  const [fullScreenRendered, setFullScreenRendered] = useState(false);
  // The actual opacity/scale target for the fullscreen overlay's CSS
  // transition — deliberately a SEPARATE flag from `panelFullScreen`
  // itself. A freshly-mounted DOM node that starts life with `opacity: 1`
  // has no earlier frame at `opacity: 0` for the browser to transition
  // FROM, so it would just pop in instantly with no visible animation.
  // Mounting at the "hidden" values first, then flipping this to `true`
  // one frame later (`requestAnimationFrame`, see the effect below) gives
  // the browser a real prior frame to interpolate from. Exiting doesn't
  // need this two-step dance — it's already mounted/visible, so setting
  // this straight to `false` immediately starts the fade/scale-out.
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  // Which team is picked in the "New Outbound" Teams group's own "Choose
  // team" sub-picker (see `outboundConfig` below, and `OUTBOUND_TEAM_
  // MEMBERS`/`CreateNewOutboundGroup.subFilter`'s own doc comments) — ""
  // means no team picked yet. Lives here (not inside create-new.tsx) since
  // that component has no concept of "team," only of a generic per-group
  // `subFilter` control it renders and reports picks from.
  const [selectedOutboundTeamId, setSelectedOutboundTeamId] = useState("");
  // Exit the shared panel's fullscreen whenever the agent navigates away
  // from the current main-content context — clicking a different
  // assignment card, Home, or Settings (and starting/selecting any new
  // interaction, e.g. via CreateNew/Outbound) all funnel through
  // `activeInteractionId`/`showSettings` changing, so one effect here
  // covers every one of those call sites instead of threading
  // `setPanelFullScreen(false)` through each of them individually — same
  // "effect rather than touching every call site" approach `showSettings`'s
  // own reset (right above, near `activeInteractionId`'s own declaration)
  // already uses. `panelVariant` itself is untouched, so the panel simply
  // resumes whichever of "docked"/"float" it was in before fullscreen,
  // exactly like exiting via the toggle button itself. NOTE: this alone
  // doesn't cover clicking the card that's ALREADY the active one — that
  // sets the same `activeInteractionId`, no value change, so this effect
  // doesn't fire — see the assignment card's own `onClick` (further down),
  // which calls `setPanelFullScreen(false)` directly for that reason.
  useEffect(() => {
    setPanelFullScreen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInteractionId, showSettings]);
  // `containerRef` is the CONTENT container — everything to the right of
  // LeftNav (its own JSX comment further down calls it "Content area"),
  // also used elsewhere for AI/Notifications float positioning. This is
  // the real, scoped "interaction container" a container query should
  // react to — NOT the whole page/viewport: measuring the full "Body:
  // LeftNav + Content" row (an earlier version of this guard did, via a
  // since-removed `bodyContainerRef`) is indistinguishable from a plain
  // page-width media query, since that row spans edge-to-edge with
  // nothing else constraining it. `containerRef`'s own width, by
  // contrast, genuinely shrinks/grows independently of the page (e.g. as
  // LeftNav's own rail width changes between its 52px/256px states) —
  // per explicit follow-up request, the Customer Information panel's own
  // narrow guard below (`isSidePanelContainerNarrow`) reads THIS
  // measurement, not a page-wide one. Safe from feedback loops: this div
  // is a flex-1 item sized by ITS OWN PARENT (the Body row), not by its
  // children — so whether the docked panel INSIDE it is pinned or
  // floating doesn't change this box's own measured width.
  const containerRef  = useRef<HTMLDivElement>(null);
  const [sidePanelContainerWidth, setSidePanelContainerWidth] = useState(9999);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setSidePanelContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setSidePanelContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The "Body: LeftNav + Content" row (both the nav and everything to its
  // right sit inside this one div, see its own JSX comment further down) —
  // measured via ResizeObserver so `isNavNarrow` below reacts to this row's
  // own box width, a real container query, rather than the whole browser
  // viewport (`window.innerWidth`), which it used before this was pointed
  // out as a mismatch. Deliberately NOT `containerRef` above — the side
  // nav's own auto-collapse/overlay decision needs a measurement that
  // doesn't depend on the nav's own current rail width (52px vs 256px),
  // which `containerRef` (content area, i.e. "everything right of
  // LeftNav") does; this row includes LeftNav itself, so its width is
  // unaffected by the nav's own open/collapsed state.
  const bodyContainerRef = useRef<HTMLDivElement>(null);
  const [bodyContainerWidth, setBodyContainerWidth] = useState(9999);
  useEffect(() => {
    const el = bodyContainerRef.current;
    if (!el) return;
    setBodyContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setBodyContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Record header's own measured width — drives the Add Channel/Customer
  // Information buttons' icon-only collapse (`recordHeaderWidth < 768`,
  // render site further down). Used to just reuse `sidePanelContainerWidth`
  // (`containerRef` above) instead of a dedicated measurement here — see
  // that old reasoning in git history — but that only held up while the
  // Customer Information toggle button was gated to the panel being
  // CLOSED (`showPanelToggle`), so `containerRef` (the docked panel's own
  // sibling) never had the panel competing with it for width whenever the
  // button was actually on screen. Once the button moved into `PageHeader`
  // and started rendering unconditionally (open or closed, per explicit
  // request), that assumption broke: `containerRef` spans BOTH the main
  // content column and the docked panel, so dragging the panel wider
  // visibly squeezes this header (and its buttons) while
  // `sidePanelContainerWidth` — measuring the pair's combined width, which
  // the drag doesn't change — stays flat, letting the buttons run out of
  // real room well before the (never-firing) breakpoint. Confirmed live:
  // resizing the docked panel wider shifted the header's own buttons left
  // with no icon-collapse ever kicking in. A dedicated measurement of just
  // the header itself (via `PageHeader`'s own forwarded ref, no extra
  // wrapper div needed) reacts to the ACTUAL space this row has, docked
  // panel or not. Safe to measure directly now, unlike the row this button
  // used to live in (see that old attempt's own note about a nested
  // `TabList`'s `container-type: inline-size` interfering) — the channel
  // tabs live in their own separate row below `PageHeader` now, so this
  // one has no such nested container query to fight.
  // A callback ref (not `useRef` + a mount-once `useEffect`, like
  // `containerRef`/`bodyContainerRef` above) — this is deliberate, not a
  // stylistic swap: those two both measure elements that exist for the
  // entire lifetime of this component, so a `[]`-deps effect reading
  // `.current` once on mount always finds them already attached.
  // `PageHeader` itself only exists conditionally (`showPageHeader &&
  // activeInteraction && ...`, several branches deep) — on any render
  // where it isn't mounted yet (e.g. the agent's on the Desk dashboard
  // when this component first mounts), that same mount-once effect would
  // find `recordHeaderRef.current` still `null`, bail out via its own
  // early return, and never run again (empty deps array), permanently
  // leaving `recordHeaderWidth` stuck at its initial `9999` — confirmed
  // live as exactly this: the buttons never collapsed at all, no matter
  // how narrow the header actually got, because the `ResizeObserver` never
  // got attached to the real element in the first place. A callback ref
  // fires on every actual mount/unmount of the node it's attached to,
  // however many times that happens over this component's lifetime, so
  // the observer below gets (re)attached correctly the moment `PageHeader`
  // itself first mounts, not just once at this component's own mount.
  const [recordHeaderNode, setRecordHeaderNode] = useState<HTMLDivElement | null>(null);
  const recordHeaderRef = useCallback((node: HTMLDivElement | null) => {
    setRecordHeaderNode(node);
  }, []);
  const [recordHeaderWidth, setRecordHeaderWidth] = useState(9999);
  useEffect(() => {
    const el = recordHeaderNode;
    if (!el) return;
    setRecordHeaderWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setRecordHeaderWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [recordHeaderNode]);
  const panelFloatLeft = useRef<number | null>(null);
  const panelFloatTop  = useRef<number | null>(null);
  const panelRef       = useRef<HTMLDivElement>(null);
  const panelAnimTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fullScreenAnimTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Defaults to "salesforce" (per explicit request) rather than starting
  // unselected — Screen Pop should open straight into the mocked
  // Salesforce login instead of an empty picker the agent has to act on
  // first.
  const [screenPopApp, setScreenPopApp] = useState("salesforce");
  // "View All Apps" kebab menu — lists every app-header panel button
  // regardless of pinned state, with a `PanelPinButton` per row so any app
  // can be pinned/unpinned right from the menu. All nine start pinned
  // (matching today's always-visible header row); unpinning one just hides
  // its persistent header icon — the app's still reachable by clicking its
  // row in this menu, which opens the shared panel exactly like the header
  // icon would.
  // Default pinned set — header shows (right to left) Notifications,
  // Agent Chat, Search; Schedule/Customers/Accounts/Tickets/WEM/Screen Pop
  // start unpinned. Customers/Accounts/Tickets are also filtered out of the
  // "View All Apps" menu itself (see `HIDDEN_FROM_APPS_MENU` below), making
  // them fully unreachable from the app header; Schedule/Screen Pop/WEM
  // aren't in that list, so unpinning them just hides their header icon —
  // all three stay reachable via "View All Apps". WEM starts unpinned again
  // per a follow-up explicit request ("unpin WEM when the app loads") —
  // still dropped from `HIDDEN_FROM_APPS_MENU` (unlike Customers/Accounts/
  // Tickets), so it's a real, clickable row in "View All Apps" (with its
  // own `PanelPinButton` to re-pin it) rather than fully unreachable like
  // those three; it just no longer shows a persistent header icon BY
  // DEFAULT on load — an agent can still pin it back from that menu, which
  // then persists for the rest of the session same as any other app.
  const [pinnedKeys, setPinnedKeys] = useState<Record<PanelKey, boolean>>({
    // Notifications re-pinned per explicit follow-up request ("pin
    // notifications in 2.0 only", then "make notifications pinned in
    // premium and advanced too") — Notifications is back to a persistent
    // header icon on load across all 3 tiers now. Schedule's own pinned
    // state (from the earlier swap) is untouched — still `true` — so this
    // tier now shows both as persistent header icons, same as 2.0.
    notif: true,
    conversations: true,
    schedule: true,
    screenpop: false,
    customers: false,
    accounts: false,
    tickets: false,
    wem: false,
    search: true,
  });
  const [appsMenuOpen, setAppsMenuOpen] = useState(false);

  /* Interior panel (right) */
  const [interiorPanelOpen, setInteriorPanelOpen] = useState(false);
  /* Which home-tab queue widget (if any) is selected — reuses the same
     interior panel slot as Case Details, swapping its content instead of
     stacking a second right-docked panel. */
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  /* Which Contact History row (if any) is selected — a THIRD job for that
     same shared interior panel slot, per explicit request: clicking a row
     now opens its summary here (Duration + Call Notes, via
     `ContactHistoryEntryDetail`) with Redial/Re-open buttons, instead of
     reopening the contact directly. See the panel's own `open`/
     `headerTitle`/content wiring further down for how the three jobs
     (Case Details default, Queue drill-down, this) take priority over one
     another. */
  const [selectedContactHistoryEntry, setSelectedContactHistoryEntry] = useState<ContactHistoryEntry | null>(null);

  // The Dial Pad request (Redial, Save & Redial, the Lucas call confirm) and
  // the pending redial it completes live in the shared `useOutboundDial`
  // (P0.5b.2): `outboundDial.dialpadRequest`, `openRedialPad`,
  // `openCardRedialPad`, `requestDialpad`. Redial pre-fills the customer's
  // name and a picker of their numbers on file, as Desk always did — this
  // page used to keep a plain single-number pad; the picker is kept here
  // by the row 16 parity ruling (confirmed 2026-10-14).

  /* Home tab's queue widget row. The live counts come from the queue
     simulation (`queueSim`, agent-next-gen-queue-sim.ts) and the wait times
     from the page clock; both are merged in by `buildLatestContacts` inside
     `<QueueSubItems>` + `<ClockTick>` at the `DashboardQueue` call site, so
     only the queue cards re-render.
     Per explicit request ("remove the digital and work item cards in the
     queue row") — the "Digital" and "Work Item" queue widgets are dropped
     from this tier's home tab. Filtered by name rather than by
     `LATEST_CONTACTS_STATIC`'s own `id`s, which stay meaningful (matching
     the queue simulation/`AGENTS_COUNT_BY_QUEUE`/`QUEUE_WAIT_BASE_SECONDS`,
     all still keyed by the full original id set) — only the rendered
     widget row itself shrinks. */
  const homeQueueBases = LATEST_CONTACTS_STATIC.filter((base) => base.name !== "Digital" && base.name !== "Work Item");

  /* Customer Information panel — a left-docked `SidePanel` (per explicit
     request to move this content into a left side panel, matching a
     reference screenshot), built via the local `CustomerInformationSide-
     Panel` wrapper. State/wiring below mirrors `AgentNextGenTemplate
     .stories.tsx`'s own `CustomerInformationPanel` usage — the current
     reference for a left-docked side panel in this exact spot — rather
     than the plain open/closed boolean the right-docked `InteriorPanel`
     version this replaces got away with: a `SidePanel` needs pinned vs.
     hover-preview state and its own narrow-container guard, since (unlike
     `InteriorPanel`) it has no such handling built in. */
  // Closed by default again (per yet another explicit follow-up request —
  // "start every conversation with the contact details panel closed" —
  // reversing the "open by default, even Marcus Webb" decision this
  // comment used to describe, which itself had reversed an earlier
  // "closed by default"/"I changed my mind" decision before that). A fresh
  // interaction's Customer Information panel now starts CLOSED once more;
  // every `isNewInteraction`-gated launch-path call site that had been
  // flipped to `setSidePanelOpen(true)` is back to `setSidePanelOpen(false)`
  // — including Marcus Webb's own "Review"/"Takeover" handlers — see each
  // of those call sites' own doc comments for the fuller "why" history of
  // this flip-flopping back and forth. Manual/derived toggles (the hover-
  // preview timer, the panel's own close button, the session row's panel-
  // toggle icon, the per-assignment state restore, the Session tab's
  // "Edit" button, the "View Details"/live-call-transcript collapse-if-
  // already-showing toggles) are deliberately untouched — this only
  // governs what a NEW/reopened interaction starts at, not any of those
  // user-initiated actions.
  const [sidePanelOpen,     setSidePanelOpen]     = useState(false);
  // Drives the "Open Details Panel" toggle's own hover-preview `Popover` —
  // this button (and this state) has moved around this file's history a
  // few times: record header `actions` → session row
  // (`TranscriptSessionSeparator`'s own `onToggleDetailsPanel`) → back to
  // the record header `actions` again (per the latest explicit request,
  // "move the details side panel toggle to above the session row..." —
  // see that `actions` block's own doc comment). The state/handlers
  // themselves were never tied to any one of those locations — only the
  // JSX rendering the button+`Popover` moved. Same "parent owns the hover
  // timer, the trigger just reports hover in/out" split `AgentNextGenPage
  // .tsx`'s still-live `CustomerInfoHoverPreview` call site uses.
  const [customerInfoPreviewOpen, setCustomerInfoPreviewOpen] = useState(false);
  const customerInfoPreviewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Per explicit follow-up request ("on hover for the voice, chat, sms,
  // email channel icons in the top right, display the content of the
  // panel like you do for contact details"): the SAME hover-preview
  // pattern as `customerInfoPreviewOpen` just above, generalized to a key
  // (rather than a bool) since it's shared across every channel icon in
  // the row (own render site further down) — only one can be
  // hover-previewed at a time, so a single slot is enough. `null` means
  // no channel is currently being hover-previewed.
  const [channelHoverPreviewKey, setChannelHoverPreviewKey] = useState<string | null>(null);
  const channelHoverPreviewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Backstop for `customerInfoPreviewOpen` — per explicit bug report ("when
  // the session details panel is closed the hover panel is displayed even
  // if I don't hover on the panel icon... doesn't go away until I hover
  // back over the panel icon"). The toggle button (and the `Popover` around
  // it, currently rendered in the record header's own `actions` block) only
  // exists in the DOM while `!sidePanelOpen` — see that render site's own
  // gate. Opening the real panel unmounts it without ever running a
  // `mouseleave`/`blur` on the trigger, so `customerInfoPreviewOpen` was
  // left stuck at whatever it was the instant before (often `true`,
  // mid-hover) — invisible while `sidePanelOpen` is true (the `open=
  // {customerInfoPreviewOpen && !sidePanelOpen}` multiply at the render
  // site zeroes it out), but the raw state itself never actually got
  // reset, so the moment the panel closes again the preview pops back
  // open with no fresh hover to have caused it — and since it never really
  // "opened" via a hover this time, there's no matching hover-out to
  // schedule its close either, until the agent happens to hover the icon
  // and leave again. Mirrors `AgentNextGenPage.tsx`'s own identical
  // backstop (`[activeInteraction?.id, sidePanelOpen]` effect) exactly,
  // just against this page's own `activeInteractionId`. (Has to live here,
  // after `sidePanelOpen` is declared above — a copy of this effect placed
  // earlier in the file, before that declaration, is a TDZ error:
  // `sidePanelOpen` used in a dependency array before its own `useState`
  // line runs.)
  useEffect(() => {
    setCustomerInfoPreviewOpen(false);
  }, [activeInteractionId, sidePanelOpen]);
  // Same backstop as `customerInfoPreviewOpen`'s own, just above, for the
  // channel icons' hover preview — also cleared whenever a channel
  // preview actually opens (clicking an icon, or the "Contact Details"
  // button switching away from one), so a lingering hover-preview never
  // shows stale on top of the real panel now genuinely showing that
  // content.
  useEffect(() => {
    setChannelHoverPreviewKey(null);
  }, [activeInteractionId, sidePanelOpen, channelPreviewThreadKey]);
  // Drives `CustomerInformationSidePanel`'s own `focusTabOverride` prop —
  // see that prop's doc comment (agent-next-gen-customer-info-panel.tsx).
  // Fed by the Contact Overview's own "View customer info" link
  // (`focusCustomerPanelTab` below) via `InteractionTranscript`'s
  // `onViewCustomerInfo`.
  const [customerPanelFocusTab, setCustomerPanelFocusTab] = useState<
    { tab: CustomerPanelTabLabel; version: number } | undefined
  >(undefined);
  const customerPanelFocusTabVersionRef = useRef(0);
  // Per a later explicit request ("move the customer information content
  // back to the side panel"): "View customer info" (from the main
  // transcript's Contact Overview, the docked panel/hover preview's own
  // embedded accordion, or Marcus Webb's clickable name link) now opens/
  // focuses the DOCKED `CustomerInformationSidePanel` itself, switching it
  // into the "Customer Info" drill-in view (`customerPanelActiveTab`),
  // rather than the separate floating `InteriorPanel` overlay this used to
  // open (removed — see git history/this state's own former doc comment).
  // Still bumps `customerPanelFocusTabVersionRef`/`customerPanelFocusTab`
  // for `focusTabOverride` (see that prop's own doc comment, agent-next-
  // gen-customer-info-panel.tsx) — harmless, since `bodyOverride`/
  // `headerTabsOverride` already bypass the docked panel's internal tab
  // system entirely; kept rather than removed for the same minimal-
  // footprint reasoning documented elsewhere in this file. No longer
  // takes a `tab` argument — every call site always wants "Overview" (the
  // only tab `useCustomerDetailsInteriorPanel`'s own `activeTab` resets to
  // per new `recordId`), so there's nothing left to vary.
  // Which Experience Memory event the docked "Experience Memory" view opens expanded (set by the approval card's checklist links).
  const [marcusMemoryFocus, setMarcusMemoryFocus] = useState<string>("refund-escalated");
  const [experienceMemoryFocus, setExperienceMemoryFocus] = useState<LucasThomasMemoryFocus>("card-declined");
  const openExperienceMemoryInSidePanel = (focus: LucasThomasMemoryFocus = "card-declined") => {
    setExperienceMemoryFocus(focus);
    setCustomerPanelActiveTab("Experience Memory");
    setSidePanelOpen(true);
    clearTimeout(customerInfoPreviewTimer.current);
    setCustomerInfoPreviewOpen(false);
  };
  const focusCustomerPanelTab = () => {
    customerPanelFocusTabVersionRef.current += 1;
    setCustomerPanelFocusTab({ tab: "Overview", version: customerPanelFocusTabVersionRef.current });
    setCustomerPanelActiveTab("Customer Info");
    setSidePanelOpen(true);
    // Per explicit request ("if an interior panel is opened from a hover
    // popover, close the hover when the panel opens so they don't
    // overlap") — this handler's own doc comment above already notes
    // "View customer info" can be clicked from inside the "Contact
    // Details" hover preview's own body (`customerInfoPreviewOpen`,
    // `openCustomerInfoPreview`'s own doc comment). That popover doesn't
    // auto-close on click — only on mouse-leave — so without this, the
    // freshly-focused docked panel could render right on top of (or
    // behind) the still-open hover popover for as long as the pointer
    // stays over either one. `clearTimeout` guards against a close
    // already scheduled by a mouse-leave racing this same click (harmless
    // either way, since both just want it closed, but avoids a redundant
    // pending timer). Immediate, not the same 150ms debounce
    // `scheduleCloseCustomerInfoPreview` uses elsewhere — a panel opening
    // is a definite, deliberate close, not a "might the pointer come
    // back" hover case.
    clearTimeout(customerInfoPreviewTimer.current);
    setCustomerInfoPreviewOpen(false);
  };
  // No setter — always pinned. `onPinToggle` is deliberately left unset on
  // the real `SidePanel` below (see its own doc comment), so there's no
  // path that ever actually unpins this; kept as `useState` rather than a
  // plain `const` only so a future unpin path can be wired back in without
  // re-threading every `sidePanelPinned` read site.
  const [sidePanelPinned] = useState(true);
  const [sidePanelResizing, setSidePanelResizing] = useState(false);
  // 340 — explicit starting width for the SidePanel version (was 425,
  // matching the old InteriorPanel's `maxWidth` default) — per explicit
  // request.
  const [sidePanelWidth, setSidePanelWidth] = useState(340);
  // Full-screen toggle (per explicit request) — see
  // `CustomerInformationSidePanel`'s own doc comment for how this actually
  // renders (an unpinned overlay sized to the parent Container's own
  // measured width, `sidePanelContainerWidth`, rather than the normal
  // drag-resized `sidePanelWidth`). Reset to `false` whenever the panel is
  // explicitly closed (`handleSidePanelClose` below) — a freshly reopened
  // panel shouldn't silently reopen full-screen from a previous session.
  const [sidePanelFullScreen, setSidePanelFullScreen] = useState(false);
  const sidePanelHoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Per the MOST RECENT explicit follow-up request ("start every
  // conversation with the contact details panel closed") — reverses yet
  // again. The immediately prior request ("every interaction should open
  // the contact details when loaded and display the overview tab, even
  // Marcus Webb") had hardcoded `setSidePanelOpen(true)` on every "new
  // interaction" launch path below; that in turn had reversed a request
  // before that ("have session details closed for new interactions - I
  // changed my mind"), which had itself reversed an even earlier request
  // ("let's have the session details open when interactions launch"),
  // which had reversed a request before THAT ("keep the customer
  // information panel closed when a new assignment is opened"), which
  // itself had reversed the original feature (every freshly started/
  // quick-dialed/redialed/reopened interaction's panel open in whichever
  // state the agent last picked — see this file's own git history for that
  // version's `lastSidePanelOpenChoice` ref, removed along with every call
  // site that read it, back when that earliest reversal landed). Every
  // "new interaction" launch path below now hardcodes
  // `setSidePanelOpen(false)` again instead — a brand-new assignment's
  // Customer Information/"Session Details" panel always starts CLOSED,
  // full stop, regardless of what the agent did on any other assignment
  // (this is a plain hardcoded value again, not a revival of the old
  // `lastSidePanelOpenChoice` "remember last choice" mechanism). Switching
  // between two ALREADY-active assignments is a separate mechanism
  // (`sidePanelStateByAssignmentId`, just below) and is
  // untouched by this — an assignment the agent already closed the panel on
  // still shows it closed again when switched back to.

  // Container-width pin guard — `SidePanel` has no built-in "too narrow,
  // force an overlay" handling of its own (unlike `InteriorPanel`), so this
  // reproduces it: reads `sidePanelContainerWidth` (`containerRef` — the
  // real content-area container, see its own doc comment above) to force
  // the panel unpinned below 768px of THAT container's width, so it
  // renders as a floating overlay instead of pushing the main content
  // column over. Deliberately a real container query on the content area,
  // not on the whole page/viewport — see `containerRef`'s own doc comment
  // for why that distinction matters.
  //
  // Per explicit request, this no longer force-CLOSES the panel when the
  // container narrows (it used to: `setSidePanelOpen(false)`) — an agent
  // who had it open keeps it open, just as a floating overlay instead of
  // docked, once `effectiveSidePanelPinned` below goes false. Only
  // `sidePanelPinned`'s effective value changes here; `sidePanelOpen` is
  // untouched by width and only ever changes via an explicit agent action
  // (the panel's own close button, the header icon toggle, or a new
  // interaction launching — which always starts it CLOSED now, per the doc
  // comment a few lines above).
  const isSidePanelContainerNarrow = sidePanelContainerWidth < 768;
  const effectiveSidePanelPinned = isSidePanelContainerNarrow ? false : sidePanelPinned;

  // Auto full-screen — per explicit request, an OPEN panel automatically
  // goes full-screen once the container narrows down to 425px (the
  // panel's own normal max width — see `CustomerInformationSidePanel`'s
  // `maxWidth`), rather than staying docked/overlaid at a width that no
  // longer comfortably fits its own content next to the interaction
  // column. Only forces full-screen ON when this crosses that threshold
  // (or when the panel opens while already at/under it) — does NOT force
  // it back OFF on its own when the container widens back out past 425,
  // and does nothing at all if the agent has already manually exited
  // full-screen since the last such crossing (the effect only re-fires
  // when one of its own two dependencies actually changes value, not on
  // every render), so a manual "Exit Full Screen" click while still
  // narrow isn't immediately fought and re-applied. (The narrower 350px
  // threshold below DOES force it back off, but only on its own specific
  // crossing — see that effect's own doc comment.)
  const isSidePanelAtMaxWidthBreakpoint = sidePanelContainerWidth <= 425;
  useEffect(() => {
    if (isSidePanelAtMaxWidthBreakpoint && sidePanelOpen) {
      setSidePanelFullScreen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSidePanelAtMaxWidthBreakpoint, sidePanelOpen]);

  // Below 350px of the same container width, per explicit follow-up
  // request: hide the full-screen toggle button entirely (see
  // `onToggleFullScreen` at the render call site below — passing
  // `undefined` there hides it, same "no prop, no button" pattern
  // `onClose` already uses) rather than leaving a control on-screen with
  // no room left to usefully act on. Crossing back up over 350px both
  // restores that button AND explicitly exits full-screen — unlike the
  // 425px threshold above (which never forces an exit on its own), this
  // one always does, since the button being hidden below 350px means the
  // agent had no way to have manually exited full-screen in the meantime
  // anyway, so there's nothing to preserve/avoid fighting here. Only
  // fires on the actual crossing (dependency array), not continuously.
  const isSidePanelAtMinimalThreshold = sidePanelContainerWidth <= 350;
  useEffect(() => {
    if (!isSidePanelAtMinimalThreshold) {
      setSidePanelFullScreen(false);
    }
  }, [isSidePanelAtMinimalThreshold]);

  // Used to force-close (and reset pinned) whenever the agent left the
  // interaction view entirely (dismissing it, or navigating to Desk/
  // Settings/another tab) — removed per explicit request: the panel now
  // just keeps whatever open/closed state the agent last left it in for
  // an EXISTING assignment (a NEW one always starts closed regardless —
  // see the "keep the customer information panel closed when a new
  // assignment is opened" doc comment above), rather than being force-
  // closed by navigating away and force-reopened for every new one. Only
  // an explicit close (the
  // panel's own close button, or the header icon toggle while pinned)
  // changes it now.

  // Hover-preview handlers — guarded on `sidePanelPinned` (not the
  // narrow-adjusted `effectiveSidePanelPinned`): once pinned, hover does
  // nothing at all in either direction, open/closed is controlled solely by
  // the click toggle while pinned, same as every other `SidePanel` consumer.
  const onSidePanelHoverStart = () => {
    if (sidePanelPinned) return;
    clearTimeout(sidePanelHoverTimer.current);
    setSidePanelOpen(true);
  };
  const onSidePanelHoverEnd = () => {
    if (sidePanelPinned) return;
    sidePanelHoverTimer.current = setTimeout(() => setSidePanelOpen(false), 300);
  };
  // Fired by the panel's own header button (a `PanelPinButton` wearing a
  // `PanelLeftClose` icon instead of the default `Pin` glyph, per explicit
  // request) — just hides the panel, per explicit follow-up request;
  // leaves `sidePanelPinned` untouched (still pinned if it was), so the
  // session row's own "Open Details Panel" toggle
  // (`handleSidePanelIconToggle`, wired via `onToggleDetailsPanel` — see
  // that call site) still reopens it in the same pinned state rather than
  // this having quietly unpinned it first.
  const handleSidePanelClose = () => {
    setSidePanelOpen(false);
    setSidePanelFullScreen(false);
    // Per explicit follow-up request ("put the content of the channels IN
    // the side panel"): a channel preview now lives INSIDE this same
    // panel (see `channelPreviewThreadKey`'s own doc comment), so closing
    // the panel itself must clear it too — otherwise the next open would
    // silently land back on whatever channel was showing instead of the
    // normal Overview tab.
    setChannelPreviewThreadKey(null);
    // Per later explicit request ("put the transcript and session tabs
    // into the new customer information side panel"): a closed-then-
    // reopened panel always lands back on "Details" (the accordions),
    // same as a freshly switched-to interaction — see
    // `customerPanelActiveTab`'s own doc comment.
    setCustomerPanelActiveTab("Details");
  };

  /* Per-assignment memory for the Customer Information panel's full-screen
     state only — per explicit request: switching between two already-
     active assignments (e.g. clicking a different LeftNav assignment card)
     must not let one assignment's full-screen choice leak onto another.
     Leaving the panel full-screen on assignment B, then switching to A,
     should show A's panel at its normal (non-full-screen) width — not
     full-screen just because that's wherever the shared
     `sidePanelFullScreen` state happened to land last.

     `sidePanelOpen` itself is deliberately NOT remembered per-assignment
     anymore — per later explicit bug report ("when I launch marcus webb
     then launch another interaction, when I go back to marcus and the
     other interaction the voice transcript side panel is open - it should
     not be"): every switch now closes the panel unconditionally (see the
     plain `setSidePanelOpen(false)` below, no `saved.open` branch), same
     as a genuinely first-ever open already did. An assignment whose panel
     the agent had open (say, the live call's own "Transcript" toggle) goes
     back to closed the moment they navigate away — reopening it again is
     always a fresh, deliberate action on return, never something this
     page silently restores on their behalf.

     Deliberately a small helper called from every place `activeInteractionId`
     changes, rather than a `useEffect` keyed on it (the "effect instead of
     touching every call site" pattern this file otherwise prefers — see
     `panelFullScreen`'s own reset effect above). An effect can't do this
     correctly here: several of the switch call sites below also set
     `sidePanelOpen` themselves (their own `isNewInteraction` branches) in
     the SAME batch as `setActiveInteractionId`. React applies every
     setState in that batch together in one render, so by the time any
     effect watching `activeInteractionId` could run, `sidePanelOpen`
     already reflects the NEW assignment's value — there's no render left
     in which the OUTGOING assignment's actual value is still visible to
     read. This helper instead reads `sidePanelOpen`/`sidePanelFullScreen`
     synchronously, via plain closure, at the moment it's called — BEFORE
     any state update from this switch has been applied — which is exactly
     the outgoing assignment's real last value every time.

     Only covers open/full-screen, per explicit request — `sidePanelPinned`/
     `sidePanelWidth` stay shared across assignments (read more like a
     general layout preference than something tied to one specific
     assignment, and weren't asked for); extend the same way if that's ever
     requested too.

     A never-before-seen assignment id (no snapshot yet) always gets
     `fullScreen: false` — a fresh assignment should never silently inherit
     full-screen from whatever was active before.

     Restoring a different assignment's own full-screen value here
     used to still visibly play `SidePanel`'s own width/opacity transitions
     (side-panel.tsx — `transition: "width 250ms cubic-bezier(...)"` on
     open/close, `"opacity 150ms ease 30ms"` on its inner content) exactly
     as if the agent had just clicked the toggle themselves — switching TO
     an assignment whose panel happens to be closed (or full-screen)
     visibly slid the panel shut (or expanded it) on every single switch,
     read as "disorienting" per explicit report, since none of that was an
     actual open/close ACTION, just this assignment's panel already having
     been left that way. A first attempt suppressed that transition
     outright (a `!important` CSS class toggled on briefly via this
     helper), which fixed the sliding but traded it for a different
     problem, also reported live: the panel then just snapped into view
     with no animation at all, while the content column beside it (see
     `key={`interaction-${activeInteraction.id}`}` below) was still doing
     its own soft `animate-in fade-in-0` — the panel read as "not fading,
     just appearing," out of sync with everything else on the same switch.

     Fixed properly at the render site instead (not here): the panel is
     now wrapped in a `key`ed div using `activeInteraction.id`, the exact
     same "force a full remount on every genuine switch" technique the
     content column already uses for its own fade-in — see that div's own
     doc comment further down for why this solves BOTH problems at once
     without any transition-suppression trickery. This helper's own job
     stays exactly what it says above: decide WHAT `sidePanelFullScreen`
     should be for the incoming assignment (`sidePanelOpen` is now always
     just closed — see this helper's own top doc comment), not HOW that
     change gets animated. */
  const sidePanelStateByAssignmentId = useRef(new Map<string, { open: boolean; fullScreen: boolean; tab: typeof customerPanelActiveTab }>());
  const switchActiveInteraction = (nextId: string | null) => {
    const outgoingId = activeInteractionId;
    if (outgoingId !== nextId) setHistoryConversationTab(null);
    if (outgoingId && outgoingId !== nextId) {
      sidePanelStateByAssignmentId.current.set(outgoingId, {
        open: sidePanelOpen,
        fullScreen: sidePanelFullScreen,
        tab: customerPanelActiveTab,
      });
    }
    setActiveInteractionId(nextId);
    if (nextId && nextId !== outgoingId) {
      const saved = sidePanelStateByAssignmentId.current.get(nextId);
      // Per explicit bug report ("when I go back to marcus and the other
      // interaction the voice transcript side panel is open - it should
      // not be"): `sidePanelOpen` is always force-closed on every switch
      // now, whether or not a saved entry exists — only `sidePanelFullScreen`
      // still reads from `saved` (see this helper's own top doc comment for
      // the full "why"). Every "new interaction" launch path's own
      // hardcoded `setSidePanelOpen(false)` right after calling this is
      // now redundant with this line, but harmless alongside it.
      // Per latest request: the docked panel's open state AND the last view visited (Customer Info,
      // Experience Memory, Artifacts…) are remembered per assignment and restored when the agent returns.
      setSidePanelOpen(saved ? saved.open : false);
      setSidePanelFullScreen(saved ? saved.fullScreen : false);
      restoredCustomerPanelTabRef.current = saved ? saved.tab : null;
    }
  };

  // Agent takes over the AI-led Lucas chat (formerly the "Takeover" banner button; now the composer's "Take over chat" button).
  const handleLucasTakeover = (quiet = false) => {
                                    setLucasThomasReviewing(false);
                                    // Taking over instead of wrapping up withdraws the wrap-up card (fade out, then remove) and
                                    // keeps a not-yet-shown one from ever appearing.
                                    lucasTakenOverRef.current = true;
                                    setInteractions((prev) =>
                                      prev.map((i) =>
                                        i.id === LUCAS_THOMAS_ID
                                          ? {
                                              ...i,
                                              liveMessages: {
                                                ...i.liveMessages,
                                                chat: (i.liveMessages?.chat ?? []).map((m) =>
                                                  m.wrapUp ? { ...m, wrapUp: { ...m.wrapUp, exiting: true } } : m
                                                ),
                                              },
                                            }
                                          : i
                                      )
                                    );
                                    window.setTimeout(() => {
                                      setInteractions((prev) =>
                                        prev.map((i) =>
                                          i.id === LUCAS_THOMAS_ID
                                            ? {
                                                ...i,
                                                liveMessages: {
                                                  ...i.liveMessages,
                                                  chat: (i.liveMessages?.chat ?? []).filter((m) => !m.wrapUp),
                                                },
                                              }
                                            : i
                                        )
                                      );
                                    }, 350);
                                    // Quiet handoff (call launched): the call itself is the handoff, so no chat messages or SLA clock.
                                    if (quiet) return;
                                    // Warm handoff: the AI agent tells Lucas he's being transferred to John Smith (with typing indicator first).
                                    const handoffTypingKey = `${LUCAS_THOMAS_ID}:chat`;
                                    window.setTimeout(
                                      () => setAiTyping((prev) => ({ ...prev, [handoffTypingKey]: true })),
                                      500
                                    );
                                    window.setTimeout(() => {
                                      setAiTyping((prev) => ({ ...prev, [handoffTypingKey]: false }));
                                      const handoff: TranscriptMessage = {
                                        id: "lt-warm-handoff",
                                        sender: "agent",
                                        name: "AI agent · Checkout",
                                        initials: "AI",
                                        timestamp: "2:11 PM",
                                        text: "Thanks for your patience, Lucas. I'm going to transfer you to John Smith, one of our team members, who will take it from here. I've shared everything we've covered so he can help with your Aurora X2 order right away.",
                                      };
                                      setInteractions((prev) =>
                                        prev.map((i) =>
                                          i.id === LUCAS_THOMAS_ID
                                            ? { ...i, liveMessages: { ...i.liveMessages, chat: [...(i.liveMessages?.chat ?? []), handoff] } }
                                            : i
                                        )
                                      );
                                    }, 2300);
                                    // Lucas acknowledges the transfer (customer typing indicator first).
                                    window.setTimeout(
                                      () => setCustomerTyping((prev) => ({ ...prev, [handoffTypingKey]: true })),
                                      3300
                                    );
                                    window.setTimeout(() => {
                                      setCustomerTyping((prev) => ({ ...prev, [handoffTypingKey]: false }));
                                      const reply: TranscriptMessage = {
                                        id: "lt-handoff-reply",
                                        sender: "customer",
                                        name: "Lucas Thomas",
                                        initials: "LT",
                                        timestamp: "2:11 PM",
                                        text: "Ok, sounds good",
                                      };
                                      setInteractions((prev) =>
                                        prev.map((i) =>
                                          i.id === LUCAS_THOMAS_ID
                                            ? { ...i, liveMessages: { ...i.liveMessages, chat: [...(i.liveMessages?.chat ?? []), reply] } }
                                            : i
                                        )
                                      );
                                    }, 5300);
                                    // SLA clock starts on takeover: the customer has been waiting since before the agent took over.
                                    setInteractions((prev) =>
                                      prev.map((i) =>
                                        i.id === LUCAS_THOMAS_ID
                                          ? {
                                              ...i,
                                              threads: i.threads.map((t) =>
                                                t.type === "chat"
                                                  ? { ...t, awaitingResponse: true, lastCustomerMessageTick: clock.now() - 251 }
                                                  : t
                                              ),
                                            }
                                          : i
                                      )
                                    );
  };
  // Toggles the Customer Information/"Session Details" panel — this
  // button's location has moved a few times across this file's history
  // (record header `actions` → `TranscriptSessionSeparator`'s own session
  // row → back to the record header `actions` again, per the latest
  // explicit request "move the details side panel toggle to above the
  // session row to the right of the voice + button group" — see that
  // `actions` block's own doc comment for the full history/reasoning).
  // This function's click half has stayed the same throughout every move.
  const handleSidePanelIconToggle = () => {
    // Per explicit follow-up request ("toggle between the channels and
    // contact details when they are clicked - don't allow multiple to be
    // active at the same time"): while a channel preview is showing, this
    // button always SWITCHES to actual Contact Details (open, channel
    // cleared) rather than toggling `sidePanelOpen` — which may already
    // be `true` underneath an active channel preview, so a plain toggle
    // would close the whole panel instead of just switching its content.
    // Only when NO channel preview is active does this fall back to the
    // original open/closed toggle.
    if (channelPreviewThreadKey) {
      setSidePanelOpen(true);
    } else {
      setSidePanelOpen((v) => !v);
    }
    setChannelPreviewThreadKey(null);
    // Clicking this button always OPENS the real panel from here (it only
    // renders while closed — see the render site's own comment), which
    // unmounts the hover-preview `Popover` right along with it. Explicitly
    // closing the preview's own state too, same as `AgentNextGenPage.tsx`'s
    // identical click handler, so it doesn't reopen stale the next time
    // this icon happens to render again (see the `[activeInteractionId,
    // sidePanelOpen]` backstop effect above for the full "why" — this just
    // avoids waiting a render for that effect to catch it).
    clearTimeout(customerInfoPreviewTimer.current);
    setCustomerInfoPreviewOpen(false);
  };
  // Per explicit request ("the link to existing customer button should
  // also appear in the popover of the contact details - you should use
  // the same content for both the popover and the panel") — the hover
  // popover's own "Link to existing customer" button (same
  // `DetailsPanelAccordions`/`onLinkCustomer` the docked panel already
  // uses, per that prop's own doc comment) can't open the on-demand
  // search/create overlay INSIDE itself the way the docked panel does —
  // it's a transient hover preview, not the real panel — so this instead
  // does what `handleSidePanelIconToggle` does to force the real panel
  // open (minus its toggle branch: always open here, never close) and
  // then arms `linkCustomerPanelOpen` the same way the docked panel's own
  // button does, so the agent lands on the real, docked overlay.
  const handleLinkCustomerFromPreview = () => {
    setSidePanelOpen(true);
    setChannelPreviewThreadKey(null);
    clearTimeout(customerInfoPreviewTimer.current);
    setCustomerInfoPreviewOpen(false);
    setLinkCustomerPanelOpen(true);
  };
  // Opens the restored hover-preview (`customerInfoPreviewOpen`, see that
  // state's own doc comment) — mirrors `AgentNextGenPage.tsx`'s own
  // still-live `openCustomerInfoPreview` exactly, including the same guard:
  // never preview while the REAL panel is already open (nothing to peek at
  // that isn't already fully visible — and the button/Popover this feeds
  // doesn't even render then, per `TranscriptSessionSeparator`'s own
  // `!detailsPanelOpen` gate, so this is mostly a belt-and-suspenders
  // check).
  const openCustomerInfoPreview = () => {
    // Per explicit follow-up request ("if a panel is open the inactive
    // channel icon and contact details should retain their hover actions
    // so agents can preview other channels while on a current channel"):
    // only suppressed when Contact Details itself is what's already
    // showing in the docked panel (`sidePanelOpen && !channelPreviewThreadKey`)
    // - nothing to peek at there that isn't already fully visible. While a
    // CHANNEL's preview is open instead (`channelPreviewThreadKey` set),
    // Contact Details is not the visible content, so hovering it should
    // still offer its own peek.
    if (sidePanelOpen && !channelPreviewThreadKey) return;
    clearTimeout(customerInfoPreviewTimer.current);
    setCustomerInfoPreviewOpen(true);
  };
  // Schedules the preview closed on a short delay — same 150ms
  // hover-intent grace period `AgentNextGenPage.tsx`'s own
  // `scheduleCloseCustomerInfoPreview` uses, so the pointer can cross from
  // the trigger button into the popover's own (portaled) content without
  // it flickering shut, and the same `data-radix-popper-content-wrapper`
  // guard so leaving the trigger for the preview's own nested overflow menu
  // (its tab list, if it ever grows one) doesn't close it either.
  const scheduleCloseCustomerInfoPreview = (e?: React.MouseEvent<Element> | React.FocusEvent<Element>) => {
    const related = e?.relatedTarget as Element | null | undefined;
    if (related?.closest?.("[data-radix-popper-content-wrapper]")) return;
    clearTimeout(customerInfoPreviewTimer.current);
    customerInfoPreviewTimer.current = setTimeout(() => setCustomerInfoPreviewOpen(false), 150);
  };
  // Same pair, generalized to a key, for the channel icons' own hover
  // preview (own render site further down) — see
  // `channelHoverPreviewKey`'s own doc comment above for the full "why".
  // Same guard as `openCustomerInfoPreview`: never preview while the real
  // panel is already open, whether showing Contact Details or another
  // channel's own preview — nothing to peek at that isn't already fully
  // visible.
  const openChannelHoverPreview = (key: string) => {
    // Suppressed in two cases now: (1) the ONE icon whose own content is
    // already the docked panel's visible content right now (unchanged from
    // before); and (2) per explicit follow-up request ("the chat should
    // only be displaying in the chat panel - not the main content area
    // anymore"), the channel that's already THIS interaction's main
    // content (`activeChannelKey`/`currentThreadId`) - hovering that one's
    // own icon would otherwise pop open a floating preview showing the
    // exact same transcript that's already sitting right behind it in the
    // main column, which is pure visual duplication, not an actual peek at
    // something new. Every other icon (and Contact Details, guarded
    // separately by `openCustomerInfoPreview`) still offers its own hover
    // peek regardless of whether some other channel or Contact Details
    // happens to be open already.
    if (channelPreviewThreadKey === key || key === activeChannelKey) return;
    clearTimeout(channelHoverPreviewTimer.current);
    setChannelHoverPreviewKey(key);
  };
  const scheduleCloseChannelHoverPreview = (e?: React.MouseEvent<Element> | React.FocusEvent<Element>) => {
    const related = e?.relatedTarget as Element | null | undefined;
    if (related?.closest?.("[data-radix-popper-content-wrapper]")) return;
    clearTimeout(channelHoverPreviewTimer.current);
    channelHoverPreviewTimer.current = setTimeout(() => setChannelHoverPreviewKey(null), 150);
  };

  // Track window width — still drives `isCompactHeader` below.
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Nav overlay breakpoint — `bodyContainerWidth` (see `bodyContainerRef`'s
  // own doc comment up by `containerRef`), not the browser viewport.
  const isNavNarrow = bodyContainerWidth < 768;
  const isCompactHeader = windowWidth < 760;

  // Auto-collapse the expanded nav when the container drops below 768px
  useEffect(() => {
    if (isNavNarrow && navOpen) setNavOpen(false);
  }, [isNavNarrow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Below 768px, a DOCKED panel no longer forces itself to float+closed —
  // it now combines with the main container into a single container with
  // two tabs instead (see `isCombinedPanelMode` below, computed once
  // `activePanelContent` exists further down). Floating panels are
  // untouched by this breakpoint; they still float exactly as before.
  // `narrowActiveRegion` is which of those two tabs is currently showing —
  // reset back to "main" whenever the combined layout isn't actually in
  // play (wide viewport, or nothing open), so it can't be left stuck on
  // "panel" from a previous narrow session with nothing to show for it.
  const [narrowActiveRegion, setNarrowActiveRegion] = useState<"main" | "panel">("main");
  useEffect(() => {
    if (!isNavNarrow || !panelOpen) setNarrowActiveRegion("main");
  }, [isNavNarrow, panelOpen]);

  const MAX_PANEL_HEIGHT = 860;
  const BOTTOM_PADDING   = 8;
  // Matches `Draggable`'s own default `maxWidth` (draggable.tsx) — made
  // explicit here (and passed as an explicit prop below) rather than left
  // as an implicit default, since `handleFullScreenToDragMode` below also
  // needs this exact value to size the panel at its true maximum.
  const SHARED_PANEL_MAX_WIDTH = 1024;

  const computePanelHeight = () => {
    if (!containerRef.current) return MAX_PANEL_HEIGHT;
    const top = containerRef.current.getBoundingClientRect().top;
    return Math.min(window.innerHeight - top - BOTTOM_PADDING, MAX_PANEL_HEIGHT);
  };

  const handleStatusChange = (status: AgentStatus) => {
    setAgentStatus(status);
    setStatusSinceTick(clock.now());
  };

  // Auto "Working" status while on a live voice call, per explicit request
  // ("when an agent is in a call the status should change to 'working'").
  // `"working"` (lyra-ui's `AgentStatus`, agent-profile.tsx) is deliberately
  // NOT in that component's own `allStatuses` picker list — an agent never
  // selects it by hand, only this effect ever sets it, exactly the way the
  // request specified ("do not add this as a selectable status").
  // `isOnVoiceCall` — true whenever ANY still-open (`!closed`) interaction
  // has a voice `Thread` whose own `threadStatuses` entry isn't `"Closed"`
  // — not just the interaction currently being VIEWED, so switching over to
  // check on a different customer's chat mid-call doesn't incorrectly clear
  // "Working" the instant the voice call scrolls out of view.
  // `preCallStatusRef` remembers whatever status was active the moment the
  // call started, so hanging up restores it (Available/Unavailable/a
  // specific reason code) instead of always falling back to one hardcoded
  // default — same "restore what was there before" pattern
  // `connectAgentLegSignal`'s own effect (agent-profile.tsx) already uses
  // for a comparable "external signal drives an internal transition"
  // shape. Deliberately keyed only on `isOnVoiceCall` (not `agentStatus`
  // too) — this is an edge-triggered effect reacting to the call actually
  // starting/ending, not something that should re-fire just because
  // `agentStatus` itself changed for some unrelated reason.
  // `!i.voiceCallEnded` (was `i.threadStatuses?.[t.id] !== "Closed"`) — per
  // explicit request, hanging up no longer sets the voice channel's status
  // to "Closed" at all (see `Interaction.voiceCallEnded`'s own doc comment,
  // agent-next-gen-interaction-dashboard.tsx), so the old status check
  // would otherwise have kept reading as "still on a call" forever after
  // hanging up, never letting the agent's auto-"Working" status revert.
  const isOnVoiceCall = interactions.some(
    (i) => !i.closed && !i.voiceCallEnded && !(i.id === TOM_LEWIS_CALL_ID && tomLewisCallRinging) && i.threads.some((t) => t.type === "voice")
  );
  const preCallStatusRef = useRef<AgentStatus | null>(null);
  useEffect(() => {
    if (isOnVoiceCall) {
      if (agentStatus !== "working") {
        preCallStatusRef.current = agentStatus;
        setAgentStatus("working");
        setStatusSinceTick(clock.now());
      }
    } else if (agentStatus === "working") {
      setAgentStatus(preCallStatusRef.current ?? "unavailable");
      preCallStatusRef.current = null;
      setStatusSinceTick(clock.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnVoiceCall]);

  /* ── Launching interactions from CreateNew ──
     Overrides OUTBOUND_CONFIG's default onStartCall/onQuickDial (which just
     console.log) so this page actually surfaces what gets launched as
     InteractionNavItem cards in the left nav. Used to also force the nav
     open (`setNavOpen(true)`) whenever a new assignment launched — dropped
     per explicit request: starting/reopening an assignment no longer
     expands a collapsed rail on its own. */
  const handleStartCall = (selection: {
    contact: CreateNewOutboundContact;
    channel: ChannelType;
    phone: string;
    skillId: string;
  }) => {
    // Per explicit request: picking "Chat" for an agent contact doesn't
    // start a normal interaction at all — it just opens the existing
    // "Agent Chat" docked panel, exactly like the "New Agent Chat"
    // notification's own `onNotificationClick` handler already does
    // elsewhere in this file (no interaction/card side effects, generic —
    // not wired to which agent was picked, confirmed via follow-up
    // clarification). `OUTBOUND_AGENTS` is the only group whose contacts
    // ever carry `"chat"` among their own `channels`, so this can only ever
    // fire for a real agent pick. Voice for an agent falls through to the
    // normal flow below unchanged — see `activeInteractionIsAgentCall`
    // further up this component for how that resulting interaction then
    // hides Customer Information + the status Select.
    if (selection.channel === "chat" && OUTBOUND_AGENTS.some((a: CreateNewOutboundContact) => a.id === selection.contact.id)) {
      handlePanelButtonClick("conversations")();
      return;
    }
    // P0.5b.2: placed through the provider (useOutboundDial). A new contact
    // gets its own card; one with a card open joins its journey, and the new
    // channel opens in the docked channel preview (handleContactActivated) —
    // the main column stays on the active contact.
    outboundDial.startCall(selection);
    // Closes `CustomerRowInfoPanel` (the Customers table's row flyout, which
    // the persistent Search panel can leave open over the new interaction).
    setSelectedCustomerRow(null);
  };

  // Where a launched contact lands once the provider has it (P0.5b.2,
  // useContactActivation). "focus" (a new card, a redial, a reopen, a
  // notification) makes its card active with that thread in the main column;
  // "added" (a channel added to an open card) opens it in the docked channel
  // preview and leaves the main column on the active contact (rows 12/13).
  const handleContactActivated = ({ journeyId, threadKey, mode, isNewCard }: Activation) => {
    switchActiveInteraction(journeyId);
    if (mode === "added") {
      setChannelPreviewThreadKey(threadKey);
      return;
    }
    setInteractions((prev) =>
      prev.map((i) => (i.id === journeyId && i.currentThreadId !== threadKey ? { ...i, currentThreadId: threadKey } : i))
    );
    // A restarted call starts with an empty Outcome (row 19).
    if (threadKey.startsWith("voice")) {
      setChannelOutcomeSelections((prev) => {
        const key = `${journeyId}:${threadKey}`;
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    // A new card starts with Customer Information closed; an existing one
    // keeps the panel as the agent left it.
    if (isNewCard) setSidePanelOpen(false);
  };
  const { activateWhenReady } = useContactActivation(handleContactActivated, seedOverlay);
  const { allOptions: allOutboundSkills, idForName: skillIdForName } = useOutboundSkills();
  const outboundDial = useOutboundDial({
    findOpenCard,
    findCustomer: (entityId) =>
      createdCustomerRecords.find((c) => c.id === entityId) ?? CREATE_NEW_CUSTOMERS.find((c) => c.id === entityId),
    activateWhenReady,
    onLegDisconnected: () => setAgentLegDisconnectedToastOpen(true),
    // A redial from the Home tab's Contact History panel closes that panel,
    // so it isn't still open when the agent goes back.
    onRedial: () => setSelectedContactHistoryEntry(null),
    // One call at a time on this page, on every launch path (New Outbound
    // is also disabled during a call; Redial, Save & Redial and a voice "+"
    // are refused here). A scripted scenario call counts too.
    secondVoiceCall: "refuse",
    isOnScenarioCall: () => agentOnActiveVoiceCall,
    onVoiceCallRefused: () =>
      addToast({ variant: "info", title: "Call in progress", message: "A call is already in progress", duration: 4000 }),
    // Save & Redial: the ended call's wrap-up completes with its saved
    // outcome once the new call is placed, so the card never empties.
    onCardRedialPlaced: (card) => void contactCommands.completeEndedCalls(card, outcomeFor(card.id)),
  });
  const contactReopen = useContactReopen({ findOpenCard, activateWhenReady, skillIdForName });

  // Per explicit follow-up request ("the content should be the Contact
  // Info stuff (Overview, Details, Notes)"): the "View customer info"
  // overlay (`customerInfoOverlayOpen`, its own render site further down)
  // shows this SAME tabbed Overview/Detail/Notes content
  // `CustomerInformationSidePanel` itself renders — not the
  // `DetailsPanelAccordions` peek the docked "Session Details" panel's own
  // "Details" tab shows — via the same `useCustomerDetailsInteriorPanel`
  // hook AgentNextGenPage.tsx already uses for its own equivalent
  // "Details" `InteriorPanel`. Shares the same lifted
  // `activeCustomerRecordDraft`/`activeCustomerOverviewEditing` as the
  // docked panel (and the record-header hover preview) so an edit made in
  // any of them shows up consistently in the others. Called
  // unconditionally, same as `activeCustomerRecordDraft` itself — its
  // returned pieces are only actually read at the docked
  // `CustomerInformationSidePanel`'s own render site while
  // `customerPanelActiveTab === "Customer Info"` (see that render site's
  // own `headerTitleOverride`/`headerIconOverride`/`headerSubheadOverride`/
  // `headerTabsOverride`/`footerOverride`/`bodyOverride`). No `matchState`
  // passed: "View customer info" only ever renders (and so can only ever
  // open this) for a real-customer interaction
  // (`activeInteractionIsRealCustomer` gates the link itself, at every
  // call site) — the unknown-contact search/create flow can never reach
  // this drill-in, so there's nothing for it to branch on here. `tabs` is
  // likewise the plain full set, not the real-customer-conditional
  // ternary the docked panel's own `tabs` prop needs, for the same
  // reason. No `focusTabOverride` either — that's `CustomerInformationSide
  // Panel`'s own prop, which this hook doesn't take; this drill-in always
  // opens on its default "Overview" tab.
  const customerInfoOverlayContent = useCustomerDetailsInteriorPanel({
    customerName: activeInteraction?.customerName,
    recordId: activeInteraction?.customerId ?? "",
    channels: activeInteraction?.threads ?? [],
    tabs: AGENT_WORKSPACE_CUSTOMER_PANEL_TABS,
    recordDraft: activeCustomerRecordDraft,
    overviewEditing: activeCustomerOverviewEditing,
    onOverviewEditingChange: setActiveCustomerOverviewEditing,
    onAddToast: addToast,
    onStartInteraction: (contact, channel, phone, skillId) =>
      handleStartCall({ contact, channel, phone, skillId }),
    onOpenHistoryConversation: (entry) =>
      activeInteraction &&
      setHistoryConversationTab({ interactionId: activeInteraction.id, entry, active: true }),
    // Per explicit request ("move the customer information content back
    // to the side panel... have a back arrow next to the Customer's name
    // that takes the agent back to the Contact Details"): this drill-in's
    // back arrow (`headerIcon` above) now returns to the docked panel's
    // own normal "Details"/Overview tab instead of closing a separate
    // overlay.
    onBack: () => setCustomerPanelActiveTab("Details"),
  });

  // Feeds the "Session" tab's body/footer at BOTH of this page's own render
  // sites for it — the docked panel and the hover-preview popover (see each
  // one's own render site further down) — via this ONE shared hook call, so
  // they always agree on the same edit-in-progress state rather than each
  // tracking it independently. `sessionContact` is the same voice/non-voice
  // fallback ternary both render sites already used before this hook
  // existed here. `onEditClick` makes sure the DOCKED panel is open
  // whenever "Edit" is clicked — a no-op if it's already open, but if
  // clicked from the hover-preview popover instead, this opens the docked
  // panel and (since the preview's own `detailsPanelPreviewOpen` is gated
  // on `!sidePanelOpen`) closes the preview in that same update, so the
  // agent lands on the real panel already in edit mode rather than seeing
  // an editable form appear inside the transient, mouse-driven popover.
  const sessionDetailsTabContent = useSessionDetailsTabContent({
    sessionContact:
      activeChannelType === "voice"
        ? selectedVoiceDetailsSession ?? currentVoiceSession
        : selectedSessionDetails ?? currentSessionDetails,
    onEditClick: () => setSidePanelOpen(true),
  });

  // App-local only (per "changes to components should only happen locally
  // unless specified") — lyra-ui's shared `CreateNew` intentionally keeps
  // focus on its own trigger button on a normal click-to-open (see that
  // component's own doc comment on `openedViaLaunchRequestRef`), which is
  // the right default for every other app using it. Rather than changing
  // that shared behavior (or adding an opt-in prop to the library, or even
  // wrapping `<CreateNew>` in an extra element — `LeftNav`'s `injectExpanded`
  // clones `pinnedHeader`'s own DIRECT child to push in the hover-driven
  // `expanded` prop in overlay/narrow-nav mode, so a wrapper div here would
  // silently break that and leave the trigger stuck at whatever `expanded`
  // value this file passes instead of expanding on hover), this listens
  // for the trigger's own click at the document level instead, matched by
  // its stable `aria-label` (`title`, i.e. "New Outbound") — no JSX
  // wrapper, `CreateNew` stays `pinnedHeader`'s sole direct child. Once the
  // popover's open transition has settled, it finds the outbound search
  // field by its stable `id` (`#new-outbound-search`, set on lyra-ui's own
  // `CreateNew` — see that component's own doc comment on why it's a fixed
  // id rather than the field's default auto-generated one), suppresses the
  // browser's own autofill suggestions on it (see inline comment), and
  // focuses it directly. A closing click just fails the query harmlessly
  // (nothing to focus once the content's unmounted).
  useEffect(() => {
    const CREATE_NEW_TRIGGER_LABEL = "New Outbound";
    const onDocumentClick = (e: MouseEvent) => {
      const trigger = (e.target as HTMLElement).closest?.(
        `button[aria-label="${CREATE_NEW_TRIGGER_LABEL}"]`
      );
      if (!trigger) return;
      requestAnimationFrame(() => {
        setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>("#new-outbound-search");
          if (!input) return;
          // The field's own label text contains "email" (part of
          // OUTBOUND_CONFIG.searchLabel's own copy, "Enter phone, email or
          // search term" — rendered as a real `<label>`, not placeholder
          // text, but still read by the same autofill heuristics), which
          // is enough for some browsers' autofill heuristics to treat this
          // as a saved-address field and show a suggestions dropdown the
          // moment it's focused. Chrome
          // ignores this plain autocomplete="off" for that category (a
          // stronger readonly-at-focus workaround was tried and reverted —
          // not worth the added complexity), but it's kept because Safari
          // does respect it. Set before `.focus()` (same synchronous tick).
          input.setAttribute("autocomplete", "off");
          input.focus();
        }, 50);
      });
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, []);

  // Every dial and redial below goes through the shared `useOutboundDial`
  // (P0.5b.2), identical on both pages: skills from the provider, voice
  // needs the agent leg, Contact History redial matches any of the
  // customer's numbers (row 16). The card appears once the provider's
  // contact reaches the store (handleContactActivated).
  // Contact History's Redial button: opens the Dial Pad pre-filled with the
  // customer's numbers; `handleDialpadSubmit` finishes the redial once a
  // skill is picked (useOutboundDial, row 16).
  const handleRedialButtonClick = (entry: ContactHistoryEntry, anchorEl: HTMLElement | null) =>
    outboundDial.openRedialPad(entry, anchorEl);

  // The single `onQuickDial` handler for New Outbound's dial pad. The Lucas
  // Thomas call-confirm is scenario behavior (P0.5c moves it); everything
  // else is the shared dial-pad submit (pending redial → any of the
  // customer's numbers; Save & Redial → that card; otherwise a quick dial).
  const handleDialpadSubmit = (phoneNumber: string, skillId: string) => {
    if (lucasCallConfirmRef.current) {
      const digits = (raw: string) => raw.replace(/\D/g, "").slice(-10);
      if (digits(phoneNumber) === digits(LUCAS_THOMAS_PHONE)) {
        launchLucasCall(phoneNumber, skillId);
        return;
      }
      lucasCallConfirmRef.current = null;
    }
    outboundDial.dialpadSubmit(phoneNumber, skillId, (id) => interactions.find((i) => i.id === id));
  };

  // Record header's "+" Add Channel fallback (`AddChannelAdHocButton`,
  // agent-next-gen-add-channel-button.tsx) — per explicit follow-up request
  // ("add the '+' to the unknown interactions in premium and advanced"),
  // covers the interactions `getHeaderAction` (below) still can't: it looks
  // up the interaction's own id in the combined `outboundConfig.groups` +
  // `contact-history` group (see `getHeaderAction`'s own call site's doc
  // comment), and returns `null` — no button at all — for any id that isn't
  // registered in EITHER of those (a genuinely ad-hoc/unknown interaction,
  // same "no real customer database" gap Agent Workspace 2.0 has for every
  // single one of its interactions). This is the exact same ad-hoc-only
  // component AND the exact same handler shape 2.0's own copy uses
  // (AgentNextGenPage.tsx) — adds a brand-new, unknown channel directly onto
  // the interaction that's CURRENTLY open, unlike `handleStartCall`, which
  // is keyed by CONTACT id and would start a whole separate new card for a
  // typed address with no real contact record behind it. This builds the
  // simplest correct `Thread` directly — same shape `handleStartCall`'s own
  // `newChannel` builds, minus the fields that only exist because THAT flow
  // goes through a real `CreateNew` contact pick (`reopenedContacts`).
  //
  // `skillId` — per explicit follow-up request ("make sure to include a
  // skill when adding a new channel to non-connected customers"): this
  // ad-hoc flow now resolves an "Outbound Skill" too (see
  // `AddChannelAdHocButton`'s own `skillId` doc comment), so `preview` is
  // set to that skill's label here, same as `handleStartCall`'s own
  // `skillLabel` lookup/assignment above — this is what makes an ad-hoc-
  // added channel's skill actually show up anywhere `Thread.preview` is
  // read, instead of silently staying blank the way it did before this
  // ad-hoc flow had a skill picker of its own at all.
  const handleAddAdHocChannel = (query: string, channel: ChannelType, skillId: string) => {
    if (!activeInteraction) return;
    // Joins the active card's journey through the provider; the new channel
    // opens in the docked channel preview (handleContactActivated, "added").
    outboundDial.addAdHocChannel(activeInteraction, query, channel, skillId);
  };

  /** Fired by the "Re-open" button on a Contact History entry's summary
   *  panel (the shared interior panel's `selectedContactHistoryEntry`
   *  branch, further down) — distinct from that same panel's "Redial"
   *  button, which still starts a fresh voice call via `handleRedial`
   *  above; this one reopens THIS past interaction to view/continue it.
   *  Used to fire directly off the Contact History row's own click, before
   *  that row started opening the summary panel first per explicit
   *  request — see `ContactHistoryCard`'s own doc comment. Builds a single
   *  channel matching `entry.channelType` — "voice"/"chat"/
   *  "email" are already valid `ChannelType` values (Contact History's own
   *  narrower grouping is a subset, not a separate vocabulary needing
   *  translation). `startedFresh` is deliberately left unset either way —
   *  reopening should show the existing (shared mock) conversation, not an
   *  empty "just launched" slate.
   *
   *  MERGES into an already-open Thread of this exact channel type on this
   *  same customer's card, per explicit request — mirrors `handleStartCall`'s
   *  own "same contact already has an interaction open" merge branch
   *  (`existingChannel`/`isReopenOfClosedChannel`/`reopenedContacts` above)
   *  almost exactly, rather than the wholesale `threads: [newChannel]`
   *  replace this used to do. Concretely: a customer with, say, an SMS
   *  thread already open (whether live or itself sitting Closed) who gets
   *  Re-opened from a DIFFERENT SMS-channel Contact History row doesn't get
   *  that whole card blown away and rebuilt from scratch — the reopened
   *  Contact stacks onto the SAME Thread via `reopenedContacts` (a fresh
   *  Contact id, prior messages preserved dimmed under their own session,
   *  same as any other channel reopen), and any OTHER already-open channel
   *  on that same card (an unrelated live Email/WhatsApp thread, say) is
   *  left completely untouched — `threads`/`threadStatuses`/`liveMessages`
   *  all merge in rather than replace wholesale. Only genuinely builds a
   *  brand-new Thread (no `reopenedContacts`, fresh `contactId`) when no
   *  Thread of this channel type is already on the card at all.
   *
   *  `entry.statusLabel` is carried onto `Interaction.threadStatuses`
   *  (keyed by the freshly-built channel's own id, merged alongside
   *  whatever this card's other channels already have) — per explicit
   *  request, reopening a row should pick its current session back up AT
   *  the status it was last logged with (whatever
   *  `buildDismissedContactHistoryEntry` captured, or whatever a
   *  hand-authored `CONTACT_HISTORY`/`EXTENDED_CONTACT_HISTORY` row already
   *  says), not reset to `TRANSCRIPT_SESSIONS`/`_VOICE`/`_EMAIL`'s own
   *  hardcoded default status for that session. Per explicit request,
   *  "Re-open" always hands the agent back a normal, fully reply-able
   *  assignment showing its last known state, never a locked read-only
   *  view: `Interaction.closed` (the flag that would otherwise drive a
   *  "viewing a closed interaction" banner, hidden composer, and hidden
   *  kebabs) is deliberately left unset here, regardless of `entry.closed`.
   *  If the status this reopens at happens to be literally "Closed", the
   *  normal per-channel mechanism already handles that same as it would
   *  for any other channel that closes mid-session: the status pill locks
   *  (a closed session can't be un-closed in place) and the "This channel
   *  is closed. Click Add Channel..." banner points the agent at the one
   *  real way to restart it — clicking that channel's own Add Channel
   *  button merges in a fresh, fully editable session (`reopenedContacts`)
   *  right on top, the exact same mechanism this handler itself now uses.
   *  Either way, the agent decides what to do next AFTER seeing the
   *  reopened card, not before. */
  const handleReopenContactHistoryEntry = (entry: ContactHistoryEntry) => {
    // P0.5b.2: through the provider's `reopen` (useContactReopen). A stored
    // case comes back thread by thread with its live messages; otherwise the
    // row's channel reopens at the row's status, folding into the open
    // card's thread of that channel if there is one (row 18: fresh timers,
    // no stale awaiting state, the clicked channel selected).
    void contactReopen.reopenHistoryEntry(entry);
  };

  /* "Unassign & Dismiss" — `InteractionNavItem` itself decides which of
     these two applies (based on how many channels the card has open when
     it's clicked), so these just need to implement each half:
     `onDismiss` (whole card, only called when just one channel was open —
     nothing would be left of the card otherwise) removes the interaction
     entirely, clearing `activeInteractionId` too if it was the active one so
     the side panel/content area doesn't keep pointing at a card that no
     longer exists. `onDismissChannel` (only called when more than one
     channel was open) drops just that one channel, leaving the rest of the
     card and its other channels open. The `ChannelToggle` bar's own kebab
     wires to the same two handlers (see the `activeInteraction` block
     below), so dismissing from a toggle behaves identically to dismissing
     from the card. */
  const handleDismissInteraction = (id: string) => {
    // Logs this assignment to Contact History before it's gone — an open
    // assignment being unassigned/dismissed is exactly the "completed
    // contact" event this demo has to log one from (see
    // `buildDismissedContactHistoryEntry`'s own doc comment). Looked up
    // from `interactions` (not `remaining` below) since that's the one
    // place the about-to-be-removed interaction's data still exists.
    // Deliberately does NOT change or invent this assignment's status —
    // logged as a normal "Resolved" row (see `buildDismissedContactHistoryEntry`),
    // never a forced "Closed"/read-only one: leaving an assignment (a
    // LeftNav/UI action) must not itself decide or change that
    // assignment's own status. `handleDismissChannel` (ending just one
    // channel of a card that's still otherwise open) does NOT call this —
    // the interaction as a whole isn't actually over yet, so there's
    // nothing to log.
    const dismissed = interactions.find((interaction) => interaction.id === id);
    if (dismissed) {
      // Per explicit request: skip ALL of this logging when the agent
      // never actually sent a message on any channel of this assignment —
      // a genuine, never-launched draft (the exact case the LeftNav card/
      // session row/record header's own red trash "Delete Draft" button
      // now renders for, see `removeVariant`/`isNewThread` at their own
      // call sites). There was never a real customer contact here to log;
      // logging one anyway would leave a phantom "Resolved" row for a
      // conversation the customer never even saw. A dismissed assignment
      // the agent actually worked (even just one message, even if the
      // customer never got a chance to reply yet) still logs normally,
      // same as before this check existed — this only ever suppresses the
      // brand-new, untouched case.
      //
      // Per confirmed bug report ("the contact history doesn't appear to be
      // updating after contacts are closed"): this `liveMessages`-only
      // check was ALSO silently swallowing every closed VOICE contact
      // (quick dial, redial, a fresh outbound/inbound call) — voice has no
      // typed-message flow at all, so `dismissed.liveMessages` never gains
      // an "agent" entry for a voice `Thread` no matter how real the call
      // was, and dismissing it logged nothing. Unlike a chat/email draft, a
      // voice `Thread` only ever exists once the agent has actually
      // dialed/answered — there's no "typed but never sent" equivalent for
      // a call — so any interaction with a voice Thread on it always counts
      // as real, regardless of `liveMessages`. `AgentWorkspace2WithDeskPage
      // .tsx`'s own identical check already carries this exact fix (see
      // that file's own copy of this comment for the fuller history) — this
      // page's copy just never received it.
      const everSentAgentMessage =
        Object.values(dismissed.liveMessages ?? {}).some((messages) => messages.some((m) => m.sender === "agent")) ||
        dismissed.threads.some((t) => t.type === "voice");
      if (everSentAgentMessage) {
        // Explicit save, redundant with the continuous `useEffect` sync above
        // — see that effect's own doc comment in AgentNextGenPage.tsx for why
        // this exact moment can't rely on the effect alone.
        saveCaseRecord(dismissed);
        const entry = buildDismissedContactHistoryEntry(dismissed, clock.now(), channelOutcomeSelections);
        // Upsert by `caseId`, not a plain prepend — per explicit bug report:
        // reopening a dismissed case (from Contact History or otherwise),
        // touching it, and dismissing it again used to log a SECOND row for
        // the exact same case, so a customer bounced open/closed a few times
        // piled up one near-duplicate "Contact History" entry per cycle
        // instead of reading as one case whose status just changed. `caseId`
        // (== `Interaction.customerId`) is the right identity to match on —
        // it's stable across the whole life of a card, carried straight
        // through on every reopen (`handleReopenContactHistoryEntry`'s own
        // `customerId: entry.caseId`), unlike this entry's own synthetic
        // `id` (`dismissed-${interaction.id}-${Date.now()}`), which is
        // deliberately unique per dismiss and would never match anything.
        // Only ever collapses entries within `dismissedContactHistory`
        // itself (today's real, agent-generated rows) — the separate
        // hand-authored `CONTACT_HISTORY`/`EXTENDED_CONTACT_HISTORY` fixture
        // rows `buildContactHistoryByRange` layers in for "Last 48/72 Hours"
        // are untouched, different (fictional) cases entirely.
        setDismissedContactHistory((prev) => [entry, ...prev.filter((e) => e.caseId !== entry.caseId)]);
      }
      // A provider card is closed through the provider (P0.5b.2): every
      // contact ended and its wrap-up completed with that channel's saved
      // outcome; the card then leaves the nav (and stays gone after a tier
      // switch). The toast waits until the provider accepted it. A scripted
      // scenario card is removed locally, as before.
      if (dismissed.threads.some((t) => t.providerInteractionId)) {
        void contactCommands.dismissCard(dismissed, outcomeFor(id)).then((ok) => {
          if (ok) fireDismissToast(dismissed, !everSentAgentMessage);
        });
      } else {
        setInteractions((prev) => prev.filter((interaction) => interaction.id !== id));
        fireDismissToast(dismissed, !everSentAgentMessage);
      }
    }
    // Dismissing the active assignment shouldn't strand the agent on an
    // empty dashboard when there's other open work waiting — hand "active"
    // to whichever assignment now sits at the top of the LeftNav list
    // (`interactions` renders top-down, see the `header` block below)
    // instead of clearing to `null`. Only clears to `null` (back to the
    // dashboard) once every assignment is gone.
    const remaining = interactions.filter((interaction) => interaction.id !== id);
    // The dismissed id no longer belongs to any real assignment — drop its
    // Customer Information panel snapshot too (see `switchActiveInteraction`
    // above), so it can't resurface stale open/full-screen values if some
    // future assignment ever happened to reuse the same id.
    sidePanelStateByAssignmentId.current.delete(id);
    // Plain closure read (not a functional updater) — safe here since
    // nothing else in this same handler changes `activeInteractionId`
    // first, and `switchActiveInteraction` itself already needs a real,
    // synchronous "outgoing id" read rather than a queued updater (see its
    // own doc comment for why).
    if (activeInteractionId === id) {
      switchActiveInteraction(remaining[0]?.id ?? null);
    }
  };
  dismissInteractionRef.current = handleDismissInteraction;

  const handleDismissChannel = (id: string, channel: Pick<InteractionChannel, "id" | "type">) => {
    // Match on `id` (falling back to `type`, same as InteractionNavItem's
    // own `channelKey` convention) rather than `type` alone — two open
    // channels can share a `type` (e.g. two SMS threads on different
    // numbers), and filtering by `type` would drop *both* instead of just
    // the one the agent actually dismissed.
    const dismissedKey = channel.id ?? channel.type;
    // Fires the same success toast `handleDismissInteraction` does — every
    // dismissed channel gets its own confirmation, not just the one that
    // happens to empty the card out entirely. Looked up from `interactions`
    // (not `remaining`/the updater below) for the same reason
    // `handleDismissInteraction` does: that's the one place this
    // assignment's current `customerName`/`recordId` still exist before the
    // state update below removes just this one channel from it.
    const interaction = interactions.find((i) => i.id === id);
    if (!interaction) return;
    // Same "genuine, never-launched draft" check `handleDismissInteraction`
    // runs, scoped to just THIS channel — see that handler's own doc
    // comment for the full reasoning. Only affects the toast's wording
    // here (`fireDismissToast`'s own `isDraftDelete` doc comment) — this
    // handler never logs Contact History either way (dismissing one
    // channel of a still-open, multi-channel card was never a "the whole
    // assignment is over" event to log in the first place).
    const everSentAgentMessage = (interaction.liveMessages?.[dismissedKey] ?? []).some(
      (m) => m.sender === "agent"
    );
    // A provider thread is closed through the provider (P0.5b.2) and leaves
    // the card once it has; the toast waits for that. If it was the main
    // column, the card's newest remaining thread takes over.
    const dismissedThread = interaction.threads.find((c) => c.id === dismissedKey);
    if (dismissedThread?.providerInteractionId) {
      void contactCommands.dismissThread(interaction, dismissedKey, outcomeFor(id)(dismissedKey)).then((ok) => {
        if (!ok) return;
        fireDismissToast(interaction, !everSentAgentMessage);
        setInteractions((prev) =>
          prev.map((i) => {
            if (i.id !== id || i.currentThreadId !== dismissedKey) return i;
            const others = i.threads.filter((c) => c.id !== dismissedKey);
            return { ...i, currentThreadId: others[others.length - 1]?.id };
          })
        );
      });
      return;
    }
    fireDismissToast(interaction, !everSentAgentMessage);
    setInteractions((prev) =>
      prev.map((interaction) => {
        if (interaction.id !== id) return interaction;
        const channels = interaction.threads.filter((c) => (c.id ?? c.type) !== dismissedKey);
        // Dismissing the currently-selected channel needs to hand "current"
        // to another remaining one (the new last channel, same fallback
        // InteractionNavItem itself uses) — otherwise the card/tab bar would
        // keep pointing at a channel that no longer exists.
        const currentThreadId = interaction.currentThreadId === dismissedKey
          ? channels[channels.length - 1]?.id
          : interaction.currentThreadId;
        return { ...interaction, threads: channels, currentThreadId };
      })
    );
  };

  /** Fired by a card row's `onCurrentChannelChange` or a (currently
   *  hidden) `ChannelToggle`'s `onClick`. Per explicit follow-up request
   *  ("toggle between channels [on the left-nav card] - it should stay the
   *  same [main column]"), generalizing the same "no channel switch ever
   *  changes main content" rule already applied to adding/restarting a
   *  channel (`handleStartCall`/`handleAddAdHocChannel`) and to the header's
   *  own channel-preview icons: this NO LONGER writes `currentThreadId` at
   *  all. Selecting a channel on the ACTIVE card instead just opens/toggles
   *  that channel's preview in the shared docked side panel, exactly like
   *  clicking its header icon does (see `channelPreviewThreadKey`) - the
   *  card's own `currentChannelKey` prop is driven by that same state for
   *  the active card (see that render site's own doc comment) so its
   *  highlighted channel still tracks what's showing. Selecting a channel
   *  on a NON-active card switches to that interaction first (mirroring
   *  `handleStartCall`'s own `switchActiveInteraction` call), then opens
   *  that channel's preview the same way.
   *
   *  Per explicit follow-up bug report ("when I launch marcus webb then
   *  launch another interaction, when I go back to marcus and the other
   *  interaction the voice transcript side panel is open - it should not
   *  be"): the actual repro was clicking a card's own channel ROW (this
   *  handler, via `onCurrentChannelChange`) rather than the card header —
   *  every card in this voice-only deployment has exactly one row, its
   *  voice channel, so simply switching between cards by clicking their
   *  channel rows was silently opening/toggling that channel's preview
   *  every time, exactly like clicking any other channel row would. Voice
   *  is now guarded out of the "open/toggle a preview" behavior entirely —
   *  same "always active, never a side-panel toggle" rule the record
   *  header's own voice icon button already follows (its own render site's
   *  `isVoiceChannel` doc comment) — while still switching cards normally
   *  for a click on a non-active card's voice row. */
  const handleChannelSelect = (interactionId: string, channelKey: string) => {
    const channel = interactions
      .find((i) => i.id === interactionId)
      ?.threads.find((c) => (c.id ?? c.type) === channelKey);
    // Voice and Lucas Thomas's chat both live in the main column only — never open a side-panel preview for them.
    const isVoiceChannel = channel?.type === "voice" || interactionId === LUCAS_THOMAS_ID;
    if (interactionId === activeInteractionId) {
      if (isVoiceChannel) return;
      setChannelPreviewThreadKey((prev) => (prev === channelKey ? null : channelKey));
      return;
    }
    switchActiveInteraction(interactionId);
    if (!isVoiceChannel) setChannelPreviewThreadKey(channelKey);
  };

  /** Fired by `MarcusWebbNextBestActionCard`'s own `onComplete` — per
   *  explicit bug report ("the transcript doesn't appear to have
   *  updated"), appends the AI agent's follow-up line (reflecting whatever
   *  the reviewing agent decided) straight onto Marcus's voice
   *  `liveMessages`, the same array `MARCUS_WEBB_CALL_TRANSCRIPT` seeded at
   *  launch (line ~2426) — so the transcript actually shows the call being
   *  wrapped up instead of staying frozen on "please hold." Deliberately a
   *  small, dedicated handler rather than reusing `handleSendMessage`
   *  below: this message is from the AI AGENT continuing the call, not the
   *  reviewing human agent, and voice has none of that handler's
   *  composer-specific machinery (typing indicators, awaiting-response
   *  badges, a simulated customer reply) to reuse anyway. Hardcoded to the
   *  `"voice"` key/`MARCUS_WEBB_ID` — matches how this interaction's
   *  `liveMessages` was seeded, not a general-purpose append. */
  const handleMarcusWebbOutcomeMessage = (text: string) => {
    const message: TranscriptMessage = {
      id: `live-${Date.now()}-marcus-outcome`,
      sender: "agent",
      name: "Cognigy AI Agent",
      initials: "AI",
      timestamp: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      text,
    };
    setInteractions((prev) =>
      prev.map((interaction) =>
        interaction.id === MARCUS_WEBB_ID
          ? {
              ...interaction,
              liveMessages: {
                ...interaction.liveMessages,
                voice: [...(interaction.liveMessages?.voice ?? []), message],
              },
            }
          : interaction
      )
    );
  };

  /** Fired by `MarcusWebbNextBestActionCard`'s Approve flow, step 2
   *  ("Waiting for customer response") — same idea/shape as
   *  `handleMarcusWebbOutcomeMessage` just above, but `sender: "customer"`
   *  (Marcus himself "replying") instead of the AI agent. Kept as its own
   *  tiny handler rather than a `sender` param on that one, since the two
   *  are conceptually different messages fired from different steps of the
   *  Approve flow, not interchangeable calls to the same thing. */
  const handleMarcusWebbCustomerReply = (text: string) => {
    const message: TranscriptMessage = {
      id: `live-${Date.now()}-marcus-customer-reply`,
      sender: "customer",
      name: MARCUS_WEBB_CUSTOMER_NAME,
      initials: "MW",
      timestamp: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      text,
    };
    setInteractions((prev) =>
      prev.map((interaction) =>
        interaction.id === MARCUS_WEBB_ID
          ? {
              ...interaction,
              liveMessages: {
                ...interaction.liveMessages,
                voice: [...(interaction.liveMessages?.voice ?? []), message],
              },
            }
          : interaction
      )
    );
  };

  /** Fired by `MarcusWebbNextBestActionCard`'s Takeover flow
   *  (`onTakeoverGreeting`/`onCustomerRespondedToTakeover`'s reply/
   *  `onRemedyIssued`) — the human agent's OWN voice on the call, as
   *  opposed to the AI's (`handleMarcusWebbOutcomeMessage`) or the
   *  customer's (`handleMarcusWebbCustomerReply` just above). Reuses the
   *  exact same name/initials the page header's own `AgentProfile` already
   *  shows for the current logged-in agent (`name="John Smith"
   *  initials="JS"`, this file's own header render) rather than inventing
   *  a different one. */
  const handleMarcusWebbHumanAgentMessage = (text: string) => {
    const message: TranscriptMessage = {
      id: `live-${Date.now()}-marcus-human-agent`,
      sender: "agent",
      name: "John Smith",
      initials: "JS",
      timestamp: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      text,
    };
    setInteractions((prev) =>
      prev.map((interaction) =>
        interaction.id === MARCUS_WEBB_ID
          ? {
              ...interaction,
              liveMessages: {
                ...interaction.liveMessages,
                voice: [...(interaction.liveMessages?.voice ?? []), message],
              },
            }
          : interaction
      )
    );
  };

  /** Fired by `MarcusWebbNextBestActionCard`'s Approve flow, step 3
   *  ("Disposition updated to 'Exception Approved'") — per explicit
   *  decision this is REAL, not just narrative text, but per an explicit
   *  correction it's two separate real effects, not one: the session-
   *  status CHIP updates to "Resolved" (an approved-and-completed refund
   *  request is a resolved case, same as any other) via the exact same
   *  `handleInteractionStatusChange` the status chip's own popover already
   *  calls; separately, the Outcome popover's own disposition field is set
   *  to "Exception Approved" (added to `OUTCOME_DISPOSITION_OPTIONS`,
   *  agent-next-gen-transcript.tsx) via the same shared `outcomeDraft`
   *  state its own field already reads/writes — an earlier pass
   *  conflated the two, driving the status chip to a one-off "Exception
   *  Approved" status instead. Channel key derived the same way
   *  `handleSendMessage` below already does for its own `channelKeyAtSend`
   *  — Marcus's interaction only ever has the one voice channel, but this
   *  stays robust rather than hardcoding `"voice"` here too. */
  const handleMarcusWebbResolved = () => {
    const interaction = interactions.find((i) => i.id === MARCUS_WEBB_ID);
    const channelKey =
      interaction?.currentThreadId ??
      (interaction?.threads[interaction.threads.length - 1]
        ? interaction.threads[interaction.threads.length - 1].id ?? interaction.threads[interaction.threads.length - 1].type
        : undefined) ??
      "channel";
    handleInteractionStatusChange(MARCUS_WEBB_ID, channelKey, "Resolved");
    setOutcomeDraft((d) => ({ ...d, dispositionCode: "Exception Approved" }));
  };

  /** Fired by `MarcusWebbNextBestActionCard`'s post-photo "flag for review"
   *  flow, step 2 ("Updating status to 'Escalated'") — same mechanism as
   *  `handleMarcusWebbExceptionApproved` just above (a real status change
   *  via the shared `handleInteractionStatusChange`), just landing on
   *  "Escalated" instead — already one of `TRANSCRIPT_SESSION_STATUS_
   *  OPTIONS`' own selectable rows, so no new status-color entry was
   *  needed for this one. */
  const handleMarcusWebbEscalated = () => {
    const interaction = interactions.find((i) => i.id === MARCUS_WEBB_ID);
    const channelKey =
      interaction?.currentThreadId ??
      (interaction?.threads[interaction.threads.length - 1]
        ? interaction.threads[interaction.threads.length - 1].id ?? interaction.threads[interaction.threads.length - 1].type
        : undefined) ??
      "channel";
    handleInteractionStatusChange(MARCUS_WEBB_ID, channelKey, "Escalated");
  };

  /** Fired by `InteractionComposer`'s Send button — appends the agent's
   *  typed message to this interaction's `liveMessages` (see that field's
   *  own doc comment), clears the awaiting-response flag on whichever
   *  channel is currently open (the agent just replied), then — since
   *  there's no real backend here for an actual customer to respond from —
   *  simulates one coming back a couple seconds later: appends a canned
   *  customer reply and flips that same channel's `awaitingResponse` back
   *  on. That flag is what feeds `InteractionNavItem.awaitingResponse`
   *  (both the card-level prop and each channel row's own), so the customer
   *  "replying" is what puts the red badge on this interaction's nav item —
   *  exactly the treatment `InteractionNavItem.stories.tsx`'s "Active,
   *  Awaiting Response" story already documents, not a new visual invented
   *  for this feature. */
  const handleSendMessage = (interactionId: string, text: string, channelKeyOverride?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const agentMessage: TranscriptMessage = {
      id: `live-${Date.now()}-agent`,
      sender: "agent",
      name: `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`,
      initials: initialsFor(`${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`),
      timestamp: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      text: trimmed,
    };

    // Captured once, here, from whichever channel is current on THIS
    // interaction right now — `InteractionComposer` (which fired this) is
    // always scoped to the currently active channel, so this is genuinely
    // "the channel this message was sent on." NOT recomputed separately
    // inside `applyToChannel` at both the immediate-send and delayed-reply
    // moments below: the agent is free to switch to a different channel tab
    // (or away and back) during the 2.5s before the simulated customer
    // reply lands, and re-deriving "current" at that later point would
    // misattribute the reply (and the `liveMessages` entry it's appended
    // to) to whatever channel happens to be active THEN instead of the one
    // this whole exchange actually started on.
    const interactionAtSend = interactions.find((i) => i.id === interactionId);
    // `channelKeyOverride` — per explicit request ("add an icon ... and
    // open a side panel ... with the channel content"): the new channel-
    // preview panel's own `InteractionComposer` (its own render site
    // further down) sends on a SPECIFIC, possibly non-active thread, not
    // whichever one happens to be `currentThreadId` right now — every
    // other caller (the main composer, always scoped to the active
    // channel) omits this and keeps the original derivation.
    const channelKeyAtSend =
      channelKeyOverride ??
      interactionAtSend?.currentThreadId ??
      (interactionAtSend?.threads[interactionAtSend.threads.length - 1]
        ? interactionAtSend.threads[interactionAtSend.threads.length - 1].id ??
          interactionAtSend.threads[interactionAtSend.threads.length - 1].type
        : undefined) ??
      "channel";
    // Same key `applyToChannel`/`customerTyping` below share — see
    // `customerTyping`'s own doc comment. Only chat/SMS/WhatsApp ever gets a
    // "customer is typing" bubble (`InteractionTranscript`'s own
    // `isTextChannel` render gate covers this too, but resolving the type
    // here as well avoids ever setting the flag for voice/email in the
    // first place).
    const channelTypeAtSend = interactionAtSend?.threads.find((c) => (c.id ?? c.type) === channelKeyAtSend)?.type;
    const isTextChannelAtSend =
      channelTypeAtSend === "chat" || channelTypeAtSend === "sms" || channelTypeAtSend === "whatsapp";
    const typingKey = `${interactionId}:${channelKeyAtSend}`;

    // Duplicated verbatim from AgentNextGenPage.tsx (Agent Workspace 2.0)
    // per this codebase's "no shared sync" convention — captures the real
    // send time of a brand-new thread's first-ever LIVE agent message
    // (guarded on no prior `liveMessages` for this channel key), once, into
    // `threadLaunchTimestamps` (see that state's own doc comment above).
    if (!interactionAtSend?.liveMessages?.[channelKeyAtSend]?.length) {
      const launchKey = `${interactionId}:${channelKeyAtSend}`;
      setThreadLaunchTimestamps((prev) => (prev[launchKey] ? prev : { ...prev, [launchKey]: new Date().toISOString() }));
    }

    const applyToChannel = (
      interaction: Interaction,
      message: TranscriptMessage,
      awaitingResponse: boolean,
      // Only ever passed on the customer-reply branch below — the moment
      // that reply actually lands is exactly what `lastCustomerMessageTick`
      // needs to record (see that field's own doc comment). Omitted (not
      // just `undefined`-valued) on the agent-send branch so it doesn't
      // overwrite the channel's existing value with `undefined` there.
      lastCustomerMessageTick?: number
    ): Interaction => ({
      ...interaction,
      // Keyed by `channelKeyAtSend` — see `Interaction.liveMessages`'s
      // own doc comment for why this can't be one flat array shared across
      // every channel on the card.
      liveMessages: {
        ...interaction.liveMessages,
        [channelKeyAtSend]: [...(interaction.liveMessages?.[channelKeyAtSend] ?? []), message],
      },
      threads: interaction.threads.map((c) =>
        (c.id ?? c.type) === channelKeyAtSend
          ? { ...c, awaitingResponse, ...(lastCustomerMessageTick !== undefined ? { lastCustomerMessageTick } : {}) }
          : c
      ),
    });

    setInteractions((prev) =>
      prev.map((interaction) =>
        interaction.id === interactionId ? applyToChannel(interaction, agentMessage, false) : interaction
      )
    );

    // "Customer is typing" — see `customerTyping`'s own doc comment. Per
    // explicit follow-up request ("do not display the typing indicator
    // until 2s after the agent message is sent"), no longer set the
    // instant the agent's own message goes out — behind its own 2000ms
    // `window.setTimeout` instead, so the bubble only appears starting 2s
    // after the agent sends a message, not immediately. Still cleared (and
    // the actual reply lands) at the original 2500ms mark below — this
    // narrows the indicator's own visible window to the LAST 500ms before
    // the reply lands, rather than changing the total reply delay itself
    // (a separate, unrelated earlier misreading of this same request —
    // reverted).
    if (isTextChannelAtSend) {
      window.setTimeout(() => {
        setCustomerTyping((prev) => ({ ...prev, [typingKey]: true }));
      }, 2000);
    }

    // Simulated customer reply — canned text, not a real conversation
    // engine. "Customer"/"C" here are placeholders: `InteractionTranscript`
    // already swaps every customer-sender message's name/initials for this
    // interaction's real customer at render time (see its own doc comment),
    // so this reads correctly without needing the real name threaded
    // through here too.
    window.setTimeout(() => {
      if (isTextChannelAtSend) {
        setCustomerTyping((prev) => ({ ...prev, [typingKey]: false }));
      }
      const customerMessage: TranscriptMessage = {
        id: `live-${Date.now()}-customer`,
        sender: "customer",
        name: "Customer",
        initials: "C",
        timestamp: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
        text: resolveCustomerAutoReply(trimmed),
      };
      setInteractions((prev) =>
        prev.map((interaction) =>
          interaction.id === interactionId
            // `clock.now()` reads the tick at the moment this callback
            // fires (2.5s after `handleSendMessage` was called), not the
            // tick from when it was scheduled.
            ? applyToChannel(interaction, customerMessage, true, clock.now())
            : interaction
        )
      );
    }, 2500);
  };

  /** Fired by `InteractionTranscript`'s `onCurrentStatusChange` (for the
   *  active channel) and the LeftNav `ChannelRow` Outcome popover's own
   *  Resolution field (for any channel) — the agent changed a specific
   *  channel's status via the status popover (a plain pick, or confirming
   *  "Close"). Writes it onto that one channel's own entry in
   *  `Interaction.channelStatuses` (see that field's own doc comment
   *  for why status has to be tracked per-channel, and why it has to live
   *  here rather than purely in `InteractionTranscript`'s own state) —
   *  leaving every sibling channel's own status untouched. Read back by
   *  `buildDismissedContactHistoryEntry` when this interaction is later
   *  dismissed, so the logged Contact History row reflects whatever status
   *  was actually last assigned instead of always "Resolved". */
  // Per explicit follow-up request, no longer fires a toast on every status
  // change — the confirming toast (added per an earlier request) turned out
  // to be more noise than signal once every status-pill/Outcome-Resolution
  // trigger for the current channel started funneling through here (see
  // this function's own three real call sites) — a toast firing on nearly
  // every status click read as excessive rather than helpful.
  // Scenario cards keep their status locally; a store card's goes through
  // `setCaseStatus` (useContactCommands, P0.5b.2) and comes back as an event.
  const setLocalThreadStatus = (interactionId: string, channelId: string, status: string) => {
    setInteractions((prev) =>
      prev.map((interaction) =>
        interaction.id === interactionId
          ? { ...interaction, threadStatuses: { ...interaction.threadStatuses, [channelId]: status } }
          : interaction
      )
    );
  };
  const contactCommands = useContactCommands({ cards: interactions, setLocalStatus: setLocalThreadStatus });
  /** The outcome a channel's wrap-up completes with: the tags and
   *  disposition the agent saved for it in Outcome (row 19). */
  const outcomeFor = (cardId: string) => (threadKey: string) => {
    const saved = channelOutcomeSelections[`${cardId}:${threadKey}`];
    return saved ? { tags: saved.tags, ...(saved.dispositionCode ? { dispositionCode: saved.dispositionCode } : {}) } : {};
  };
  const handleInteractionStatusChange = (interactionId: string, channelId: string, status: string) => {
    // Live "Assignments resolved today" count — increments only on the actual
    // whatever→Resolved transition, not on re-selecting Resolved.
    const current = interactions.find((i) => i.id === interactionId)?.threadStatuses?.[channelId];
    if (status === "Resolved" && current !== "Resolved") setResolvedTodayCount((n) => n + 1);
    contactCommands.setStatus(interactionId, channelId, status);
  };

  /* ── Preventing duplicate channels from the CreateNew picker ──
     A contact already reachable via a currently-open channel (e.g. Jamie
     Torres has an SMS interaction open on a specific number) still shows
     that channel in "Select Channel" and every address in the detail
     screen's second field ("Select Phone"/"Select Email Address"/"Select
     WhatsApp Handle") — except whichever exact address(es) are already in
     use, which are disabled so starting another interaction on one of them
     wouldn't just duplicate the one already running (a different outbound
     line for the same channel — or a second, still-unused one, even when
     one SMS number is already open — stays selectable). Voice is the one
     exception to "disable by address, not by channel" — see
     `openChannelTypes`/`isChannelBlockedForContact`'s own doc comments
     (create-new.tsx) for why a call has no per-address concept to key off
     of at all.
     `CreateNewOutboundContact.openChannelAddresses`/`openChannelTypes` are
     exactly the mechanisms `CreateNew` exposes for this (see each one's own
     doc comment), so rather than adding new disabling logic to that shared
     component, this derives a per-render copy of OUTBOUND_CONFIG that tags
     each contact with every address in use (`openChannelAddresses`) AND
     every channel *type* currently open regardless of address
     (`openChannelTypes`) for whichever channels they already have open in
     `interactions` (read off each `Thread.type`/`.value`, set at
     start-call time — a contact can have more than one channel of the same
     type open at once, e.g. two SMS threads on different numbers, so
     addresses are a list per channel type, not a single value), across
     every group (Agents/Teams/Skills/Customers — Favorites is derived from
     these same records, so it inherits the tagging automatically).
     Recomputed whenever `interactions` changes so an address/channel
     re-enables the moment its interaction is dismissed. */
  const outboundConfig = useMemo<CreateNewOutboundConfig>(() => {
    const tagOpenChannels = buildOpenChannelTagger(interactions);
    // Skills come from the provider (`listOutboundSkills`, P0.5b.2); the
    // static list only fills in until they load.
    const providerSkills = allOutboundSkills();
    return {
      ...OUTBOUND_CONFIG,
      skillOptions: providerSkills.length > 0 ? providerSkills : OUTBOUND_CONFIG.skillOptions,
      groups: OUTBOUND_CONFIG.groups.map((group) => {
        // Teams' own "Choose team" sub-picker — per explicit request,
        // picking a team here swaps this group's `contacts` from the
        // (now-unused-as-a-list) team records over to that team's real
        // member agents (`OUTBOUND_TEAM_MEMBERS`), so the existing search
        // box then filters those members exactly like it already does for
        // every other group — `contactMatchesSearch`/`activeGroupContacts`
        // (create-new.tsx) need no changes for this. With no team picked
        // yet, `contacts` is empty and `emptyMessage` prompts the agent to
        // pick one above instead of showing "No favorited teams yet",
        // which would be misleading before any team is even chosen.
        if (group.id === "teams") {
          const members = selectedOutboundTeamId ? OUTBOUND_TEAM_MEMBERS[selectedOutboundTeamId] ?? [] : [];
          return {
            ...group,
            contacts: members.map(tagOpenChannels),
            emptyMessage: selectedOutboundTeamId
              ? "No favorited agents in this team yet"
              : "Choose a team above to see its agents",
            subFilter: {
              ariaLabel: "Choose team",
              placeholder: "Choose a team",
              value: selectedOutboundTeamId,
              options: OUTBOUND_TEAMS.map((team) => ({ value: team.id, label: team.name })),
              onChange: setSelectedOutboundTeamId,
            },
          };
        }
        if (!group.contacts) return group;
        return {
          ...group,
          contacts: group.contacts.map(tagOpenChannels),
        };
      }),
    };
  }, [interactions, selectedOutboundTeamId, allOutboundSkills]);

  // `CONTACT_HISTORY_OUTBOUND_CONTACTS` (the 5 hand-authored rows) PLUS a
  // live-rebuilt contact for every row in `dismissedContactHistory` (see
  // `buildContactHistoryOutboundContacts`'s own doc comment for why the
  // latter needs the exact same treatment — a freshly dismissed interaction
  // logs its own brand-new `ContactHistoryEntry` with a fresh id, so it hits
  // the identical "nothing registered under this synthetic id" gap the 5
  // original rows had), all run through the exact same `buildOpenChannelTagger`
  // as every group inside `outboundConfig` above — see that function's own
  // doc comment for why these can't just be folded into `outboundConfig.groups`
  // directly. Recomputed off `interactions`/`dismissedContactHistory` so a
  // reopened/redialed Contact History card's already-open channels disable
  // themselves the same way a real customer's would, re-enable the moment
  // that interaction is dismissed, and a newly-dismissed customer's own
  // card gets a working "+" (Add Channel) row the very next time it's
  // reopened, not just the 5 rows that happened to be hand-authored ahead
  // of time.
  const contactHistoryOutboundContacts = useMemo(
    () =>
      [...CONTACT_HISTORY_OUTBOUND_CONTACTS, ...buildContactHistoryOutboundContacts(dismissedContactHistory)].map(
        buildOpenChannelTagger(interactions)
      ),
    [interactions, dismissedContactHistory]
  );

  // Every "Agent Next Gen" consumer (this app, AgentNextGenTemplate.
  // stories.tsx, LeftNav.stories.tsx's "Agent Next Gen Left Nav" story,
  // InteractionNavItem.stories.tsx) wants the exact same "+" behavior on
  // each InteractionNavItem card — look up that interaction's underlying
  // outbound contact and scope the flyout to whatever channels it actually
  // supports. That's `useAddChannelButton` (lyra-ui) — a single shared
  // implementation instead of hand-copied ones that could (and did) quietly
  // drift out of sync.
  //
  // No more `launchRequest`/`onLaunchRequestHandled` here — `AddChannelButton`
  // is fully self-contained now (per explicit request: adding a channel from
  // an already-open interaction's own "+" was popping the detail form up
  // next to the LeftNav's separate "New Outbound" trigger instead of right
  // where the "+" was clicked). The picked channel's whole detail form
  // (Select Channel/Select Address/Outbound Skill/Start Interaction) now
  // renders in that same small popover, and `onStartCall` fires directly —
  // no hand-off to the LeftNav's own `CreateNew` instance for this flow.
  //
  // `onStartCall: handleStartCall` override is required here, same as the
  // LeftNav's own `<CreateNew outbound={{...outboundConfig, onStartCall:
  // handleStartCall, ...}}>` wiring below — `outboundConfig` itself still
  // carries `OUTBOUND_CONFIG`'s placeholder `onStartCall` (just a
  // console.log, see its own definition), not the real handler. Passing
  // the bare `outboundConfig` here was a real, shipped bug: pressing
  // "Start Interaction" from this button silently logged instead of
  // actually opening a card, since `useAddChannelButton`'s `getHeaderAction`
  // calls `outboundConfig.onStartCall?.(selection)` directly (create-new.tsx).
  //
  // `groups` gets one extra entry here, ON TOP OF `outboundConfig.groups` —
  // `contactHistoryOutboundContacts` (tagged copy of
  // `CONTACT_HISTORY_OUTBOUND_CONTACTS`, agent-next-gen-outbound-data.tsx,
  // computed above), keyed under the exact synthetic `history:${id}`/
  // `redial:${id}` ids `handleReopenContactHistoryEntry`/`handleRedial` fall
  // back to for the 5 hand-authored `CONTACT_HISTORY` rows with no real
  // `CREATE_NEW_CUSTOMERS` record behind them. Per explicit request:
  // reopening/redialing one of those rows used to leave the record header's
  // own "+" (Add Channel) row completely empty — `useAddChannelButton`'s
  // `contactsById` had nothing to find under either synthetic id, so
  // `getAvailableChannels` always came back `[]` even for a customer with
  // other channels genuinely on file (`ContactHistoryEntry.channels`).
  // Deliberately appended ONLY here, not folded into `outboundConfig`
  // itself — `outboundConfig` is the exact same object the LeftNav's own
  // `<CreateNew outbound={{...outboundConfig, ...}}>` picker below reads for
  // its "Choose group" dropdown AND its typed-search results
  // (`hideContactList` only suppresses the idle browse list, not a real
  // search match — see that prop's own doc comment, create-new.tsx), so
  // adding it there would make these fictional, non-real "customers"
  // wrongly searchable/dialable from New Outbound. This hook's own
  // `contactsById`, by contrast, is never rendered as a browsable/searchable
  // list anywhere — it only ever resolves ONE already-known interaction id
  // at a time (`getAvailableChannels(activeInteraction.id)`/
  // `getHeaderAction(interaction.id)`), so there's nothing for this extra
  // group to leak into. Per explicit follow-up request, this group's own
  // contacts still need the exact same already-open-channel disabling as
  // every other group gets — that's why `contactHistoryOutboundContacts`
  // (run through `buildOpenChannelTagger`, same as `outboundConfig`'s own
  // groups above) is used here instead of the raw, untagged
  // `CONTACT_HISTORY_OUTBOUND_CONTACTS` constant.
  const { getHeaderAction } = useAddChannelButton({
    ...outboundConfig,
    groups: [
      ...outboundConfig.groups,
      { id: "contact-history", label: "Contact History", contacts: contactHistoryOutboundContacts },
    ],
    onStartCall: handleStartCall,
  });

  /* Welcome modal — shown once on page load; "Go Available" flips the agent
     to Available, "Start Offline" (button label — see the AgentWelcomeMessage
     call site's own doc comment for why the label reads "Offline" while this
     handler is still named/keyed "Unavailable") keeps them Unavailable (the
     default state). lyra-ui's `AgentStatus` dropped "offline" (just
     Available/Unavailable now), so this no longer keeps the agent
     "Offline" as a real status — Unavailable is the closest equivalent
     starting state; the button's own label was renamed back to "Start
     Offline" per explicit request, but the underlying status is still
     "unavailable". */
  const handleGoAvailable = () => {
    handleStatusChange("available");
    setShowWelcomeModal(false);
  };
  const handleStartUnavailable = () => {
    handleStatusChange("unavailable");
    setShowWelcomeModal(false);
  };

  // Open/close animation state machine for the single shared panel — mounts
  // on open, transitions through the shared fade/slide animation on close,
  // then unmounts. Previously a generic `usePanelOpenEffect` factory called
  // once per panel (five times); with only one physical container now,
  // there's only one caller, so it's inlined rather than kept as a
  // factory-of-one.
  useEffect(() => {
    clearTimeout(panelAnimTimer.current);
    if (panelOpen) {
      if (containerRef.current && panelFloatLeft.current === null) {
        const r = containerRef.current.getBoundingClientRect();
        panelFloatLeft.current = r.left + containerRef.current.offsetWidth - panelWidth - 16;
      }
      setPanelHeight(computePanelHeight());
      setPanelMounted(true);
      setPanelState("open");
    } else {
      setPanelState("closing");
      setPanelFullScreen(false);
      panelAnimTimer.current = setTimeout(() => setPanelState("closed"), 150);
    }
    return () => clearTimeout(panelAnimTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  // Shrink panel height with viewport when open
  useEffect(() => {
    if (!panelOpen) return;
    const onResize = () => setPanelHeight(computePanelHeight());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

  // Same "outlive the boolean so the exit transition can play" shape as
  // the `panelOpen`/`panelState` effect above, scoped to fullscreen alone
  // — per explicit request for an animation on the fullscreen
  // expand/collapse toggle. Entering: mount immediately (still at the
  // "hidden" style, `fullScreenVisible` starts false) then flip
  // `fullScreenVisible` true one frame later, so the fade/scale-in CSS
  // transition (`sharedPanelFullScreenOverlay`'s own styles, below) has a
  // real prior frame to animate from — see `fullScreenVisible`'s own doc
  // comment for why that two-step is needed. Exiting: flip
  // `fullScreenVisible` false right away (starts the fade/scale-out
  // immediately) and only unmount (`fullScreenRendered` false) 180ms
  // later, once that transition has actually finished playing.
  useEffect(() => {
    if (panelFullScreen) {
      clearTimeout(fullScreenAnimTimer.current);
      setFullScreenRendered(true);
      // Double rAF, not a single one — the classic gotcha here is that a
      // single `requestAnimationFrame` callback can still land in the SAME
      // frame as the commit that mounted the "hidden" style (browsers run
      // due rAF callbacks before that frame's own layout/paint), so the
      // "hidden" style never actually gets painted and there's nothing
      // for the transition to visibly animate from — the element just
      // pops straight to visible instead. Waiting for a second frame
      // guarantees the first one (with `fullScreenVisible` still false)
      // has genuinely been painted before flipping it to true.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setFullScreenVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setFullScreenVisible(false);
    clearTimeout(fullScreenAnimTimer.current);
    fullScreenAnimTimer.current = setTimeout(() => setFullScreenRendered(false), 180);
    return () => clearTimeout(fullScreenAnimTimer.current);
  }, [panelFullScreen]);

  // When docking: capture actual rendered position (includes CSS transform
  // drag offset) before the float wrapper unmounts — restored when
  // undocking. The old "only one of five may be docked" exclusivity check
  // (`dockPanelExclusively`) is gone — with a single shared container
  // there's only ever one panel to dock in the first place.
  //
  // Width works the other direction: docking (float -> docked) always
  // resets to `SHARED_PANEL_DEFAULT_WIDTH`, full stop — per explicit
  // request, re-docking should land on the panel's true starting width
  // "regardless of how wide they've been dragged." An earlier version of
  // this only reset to whatever width the panel had at the MOMENT it was
  // last undocked (captured in a `panelDockedWidthBeforeUndock` ref) — that
  // covered a resize while floating, but not a resize that happened while
  // DOCKED: `Draggable`'s own `onWidthChange` (wired to `setPanelWidth`
  // below, near `sharedPanel`) fires the same way regardless of variant, so
  // dragging the panel's edge while it's already docked also changes
  // `panelWidth` directly — and that resized value would then get
  // snapshotted as the "restore to" target on the NEXT undock, quietly
  // leaking a docked-resize into a later re-dock. Hardcoding the true
  // default here instead of snapshotting "whatever it was" closes that gap
  // — there's no state left to leak from either direction.
  const handlePanelVariantChange = (v: DraggableVariant) => {
    if (v === "docked") {
      if (panelRef.current) {
        const r = panelRef.current.getBoundingClientRect();
        panelFloatLeft.current = r.left;
        panelFloatTop.current  = r.top;
      }
      setPanelWidth(SHARED_PANEL_DEFAULT_WIDTH);
    }
    setPanelVariant(v);
  };

  // The fullscreen overlay's own "drag mode" toggle (see
  // `sharedPanelFullScreenOverlay` below) — fullscreen bypasses `Draggable`
  // entirely, so it never receives `Draggable`'s own built-in dock button;
  // this is the equivalent action for getting from fullscreen straight into
  // float, at its MAXIMUM size (`SHARED_PANEL_MAX_WIDTH`/`computePanelHeight()`
  // — already "as tall as the viewport allows, capped at `MAX_PANEL_HEIGHT`")
  // rather than resuming whatever size the panel happened to be before
  // entering fullscreen, per explicit request. Safe to just set
  // `panelWidth`/`panelHeight` directly (unlike a live prop update to an
  // already-mounted `Draggable`, which wouldn't actually resize it — see
  // `SHARED_PANEL_MAX_WIDTH`'s own doc comment on `Draggable` never
  // resyncing its internal `width` from `defaultWidth` after mount): the
  // docked/float wrapper blocks below are both gated on `!panelFullScreen`,
  // so `Draggable` is always fully unmounted while fullscreen is active —
  // switching out of it always mounts a FRESH instance, which reads these
  // as its own `defaultWidth`/`defaultHeight` at that fresh mount. Toggling
  // back out of float from here works exactly like any other float panel —
  // `Draggable`'s own built-in dock button re-docks it to the side, same as
  // always (`handlePanelVariantChange`, above), which now always resets to
  // `SHARED_PANEL_DEFAULT_WIDTH` on its own — nothing needs capturing here
  // first, unlike before.
  const handleFullScreenToDragMode = () => {
    setPanelWidth(SHARED_PANEL_MAX_WIDTH);
    setPanelHeight(computePanelHeight());
    setPanelFullScreen(false);
    setPanelVariant("float");
  };

  // Float position — absolute viewport coordinates, anchored via
  // `panelFloatLeft`/`panelFloatTop` once set. No more per-panel z-index
  // "bring to front" competition (`topPanel`) — there's only ever one
  // floating panel now, so it's always topmost.
  const getPanelFloatStyle = (): React.CSSProperties => {
    const rect = containerRef.current?.getBoundingClientRect();
    const left = panelFloatLeft.current !== null
      ? panelFloatLeft.current
      : containerRef.current
        ? (rect?.left ?? 0) + containerRef.current.offsetWidth - panelWidth - 16
        : 0;
    const top = panelFloatTop.current !== null
      ? panelFloatTop.current
      : (rect?.top ?? 0);
    // Below the app-header menus' own `z-[9999]` (the "View All Apps" kebab
    // dropdown, menu-radix.tsx; the app-switcher popover a few hundred
    // lines up) — this used to be `10000`, one higher, so a floated panel
    // rendered ON TOP of either menu instead of under it (confirmed via
    // screenshot: the Customers panel covering the open kebab dropdown).
    // Still comfortably above the rest of the page's own z-index tiers
    // (AppHeader/Draggable's internal chrome top out around `z-20`).
    return { position: "fixed", top, left, zIndex: 40 };
  };

  // ── Content for each button ──
  /* "New Assignment"/"Escalation" notification click — opens (or re-focuses)
     a real assignment card in the LeftNav, same merge-by-id + "expand the
     nav, open the Customer Information panel" pattern `handleQuickDial`/
     `handleRedial` already use. Channel comes from `NOTIFICATION_CHANNEL`
     (falling back to "email" for any id not listed there) — see that map's
     own doc comment for why this stays a small app-local lookup rather
     than a field on `AgentNotification` itself.

     Keyed by a REAL `CREATE_NEW_CUSTOMERS` id — deterministically picked
     from the notification's own id (`Number(notification.id) % ...length`,
     not random, so re-clicking the same notification always resolves to the
     same card) — rather than a synthetic `notif:${id}` one. This is the
     exact same case `handleRedial`'s own doc comment above describes:
     `useAddChannelButton`'s `getHeaderAction` looks up an interaction's id
     in `outboundConfig.groups` to resolve its "+" Add Channel button — a
     synthetic id never matches, so `getHeaderAction` returns no button at
     all for it. Using a real customer id here means notification-opened
     assignments get a working Add Channel button just like any other
     assignment, while still displaying the notification's own name
     (`customerName` below), since the merge branch further down never
     overwrites an existing card's `customerName`. */
  const handleOpenAssignmentFromNotification = (notification: AgentNotification) => {
    // P0.5b.2: the notification stands for a provider contact
    // (NOTIFICATION_INTERACTION_ID): a waiting offer is accepted, a live one
    // is switched to, a dismissed one is reopened (useContactReopen). The
    // card opens with Customer Information closed (handleContactActivated).
    void contactReopen.openNotification(notification).then((isNewCard) => {
      // A new inbound arrival expands the left nav if it's collapsed (row
      // 21; agent-initiated launches deliberately don't).
      if (isNewCard) setNavOpen(true);
    });
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
  };

  // Wired to the Search panel's Interactions tab (`InteractionsListView`'s
  // own `onOpenInteraction`, via `useSearchPanelContent` below) — per
  // explicit request, clicking a row there opens it as a real, active
  // assignment in the left nav, same shape `handleOpenAssignmentFromNotification`
  // just above already builds from a notification click: NOT `startedFresh`
  // (a row in this table represents an already-existing, already-routed
  // conversation with real prior history, not a blank-slate outbound
  // interaction the agent is originating), wholesale-replaces `channels`/
  // clears `liveMessages` when the same contact already has a card open
  // (same reasoning as that handler's own comment on that branch). The
  // matching `CreateNewOutboundContact`/customer record is looked up by
  // `record.caseId`, which `buildInteractionHistory` (this file — actually
  // agent-next-gen-interactions-table.tsx) sets to that customer's own
  // `customerId` in the first place, so this reliably finds the same
  // record every row was built from without a second, parallel id scheme.
  const handleOpenInteractionRow = (record: InteractionHistoryRecord) => {
    // P0.5b.2: a provider `reopen` of the row's case (useContactReopen),
    // joining the customer's open card if there is one.
    void contactReopen.reopenSearchRow(record);
  };

  // Notifications' real content — same `useAgentNotificationsContent`
  // hook `AgentNotifications` calls internally (agent-notifications.tsx
  // in lyra-ui) — so this app gets its actual body, not a reimplemented
  // copy. Called unconditionally every render (Rules of Hooks) regardless
  // of whether that content is the one currently showing.
  const notifContent = useAgentNotificationsContent({
    notifications,
    onMarkAllRead: () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    onClearAll: () => setNotifications([]),
    onDismiss: (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id)),
    // "New Assignment" (`type: "new-case"`) and "Escalation" notifications
    // both open a real assignment. "New Agent Chat" (`type:
    // "new-agent-chat"`, e.g. Sarah Miller) is different from either —
    // per explicit request, clicking it doesn't open an assignment card at
    // all, it switches the shared header panel straight from Notifications
    // to Agent Chat (the renamed "Conversations" panel — see
    // `PANEL_KEY_METADATA.conversations`), since an agent-to-agent chat
    // lives there, not in the interaction list. The rest (New Chat/Missed
    // Call) keep the original "just mark it read" behavior, since they
    // don't represent anything this app actually models opening.
    onNotificationClick: (n: AgentNotification) => {
      if (n.type === "new-case" || n.type === "escalation") {
        handleOpenAssignmentFromNotification(n);
        return;
      }
      if (n.type === "new-agent-chat") {
        handlePanelButtonClick("conversations")();
        setNotifications((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i));
        return;
      }
      setNotifications((prev) => prev.map((i) => i.id === n.id ? { ...i, read: true } : i));
    },
  });
  // Schedule — basic Day/Week calendar shell (lyra-ui schedule-panel, new this
  // session, app-only — not added to lyra-ui). Called unconditionally here
  // (a real hook, own local view/anchorDate state), same as any other
  // panel-content builder in this block.
  const scheduleContent = useScheduleContent();
  // Agent Chat — no bespoke component (same blank empty-state
  // `DraggablePanel` itself defaults to when given no children).
  const blankPanelContent = (title: string): EmbeddablePanelContent => ({
    title,
    body: (
      <div className="overflow-y-auto flex-1 flex items-center justify-center p-4">
        <p className="lyra-body-md text-lyra-fg-disabled text-center">Nothing here yet.</p>
      </div>
    ),
  });
  // Screen Pop — same blank body, plus a Select (which external app to pop
  // the current contact/record into) in `headerContent` (fixed above the
  // divider, alongside the title row) rather than the scrollable body, so
  // it stays put — no `label` since the field sits in the header, not a
  // body form, where a label would be redundant.
  const screenPopContent: EmbeddablePanelContent = {
    title: "Screen Pop",
    headerContent: (
      <Select
        placeholder="Select an app..."
        options={SCREEN_POP_APPS}
        value={screenPopApp}
        onValueChange={setScreenPopApp}
      />
    ),
    // "Salesforce"/"Zendesk" are mocked in place, not actually embedded —
    // see `MockLoginCard`'s own doc comment (near `SCREEN_POP_APPS`) for
    // why a real iframe of either login page isn't possible.
    body:
      screenPopApp === "salesforce" ? (
        <MockLoginCard
          appName="Salesforce"
          accent="#0176d3"
          logo={
            <svg viewBox="0 0 48 30" className="w-24 h-auto mb-4" aria-hidden="true">
              <path
                fill="#00A1E0"
                d="M19.5 6.6c1.5-1.6 3.6-2.6 6-2.6 3.1 0 5.8 1.7 7.3 4.3.9-.4 1.9-.6 3-.6 3.9 0 7.1 3.2 7.1 7.1s-3.2 7.1-7.1 7.1c-.5 0-.9 0-1.4-.1-.9 1.6-2.6 2.7-4.5 2.7-.8 0-1.6-.2-2.3-.5-.9 2.1-3 3.6-5.5 3.6-2.6 0-4.8-1.6-5.7-3.9-.4.1-.8.1-1.2.1-3.3 0-6-2.7-6-6 0-2.2 1.2-4.2 3-5.2-.1-.4-.1-.8-.1-1.2 0-3.6 2.9-6.5 6.5-6.5 1.4 0 2.7.4 3.9 1.2"
              />
            </svg>
          }
        />
      ) : screenPopApp === "zendesk" ? (
        <MockLoginCard
          appName="Zendesk"
          accent="#03363d"
          usernameLabel="Email"
          usernamePlaceholder="you@company.com"
          buttonLabel="Sign in"
          footerLink="Forgot my password"
          logo={
            <div className="flex flex-col items-center gap-2 mb-5">
              <svg viewBox="0 0 40 40" className="w-10 h-10" aria-hidden="true">
                <rect x="4" y="4" width="14" height="14" rx="3" fill="#03363D" />
                <circle cx="29" cy="11" r="7" fill="#03363D" />
                <rect x="4" y="22" width="14" height="14" rx="7" fill="#03363D" />
                <rect x="22" y="22" width="14" height="14" rx="3" fill="#03363D" />
              </svg>
              <span className="text-lg font-bold text-[#03363D] tracking-tight lowercase">Zendesk</span>
            </div>
          }
        />
      ) : (
        <div className="overflow-y-auto flex-1 flex items-center justify-center p-4">
          <p className="lyra-body-md text-lyra-fg-disabled text-center">Nothing here yet.</p>
        </div>
      ),
  };
  // Search — per explicit request, the Interactions table (previously its
  // own top-level desk tab, `InteractionsListView`, agent-next-gen-
  // interactions-table.tsx) has been MOVED here as this panel's body,
  // replacing the old blank "Nothing here yet" placeholder — not
  // duplicated; the desk tab itself is gone (see `deskTabOrder`'s own
  // initial array and the `activeDeskTab` render branch further down,
  // both of which no longer include `"interactions"`).
  //
  // Built via the shared `useSearchPanelContent` hook (agent-next-gen-
  // search-panel.tsx) — per a follow-up explicit request, this Search
  // panel's tab/content system is now shared with
  // `AgentWorkspace2WithDeskPage.tsx` too. `tabs: SEARCH_PANEL_TABS` below
  // is now dead/unused — per the latest explicit request ("in advanced
  // and premium, clear the search panel of content and just have a
  // search bar...") this call site passes `simpleCustomerSearch: true`
  // instead, which makes the hook ignore `tabs` entirely (see that
  // option's own doc comment) — kept only because the hook's own internal
  // `activeTab` state still needs a non-empty array to seed its
  // (unreachable-in-this-mode) `useState` initializer.
  //
  // Customers' body reuses the EXACT SAME lifted state the desk
  // dashboard's own "Customers" tab already uses (`customerSortedRows`,
  // `customerAddedFilterKeys`, `selectedCustomerRow`, etc. — all declared
  // once, near this component's top, alongside that tab's own
  // `<CustomersListView>` render call further down) rather than a second,
  // independent copy — it's conceptually the SAME customer list/filters/
  // sort/selection either way, just reachable from two different places
  // in the UI, so both should always agree rather than silently drifting
  // apart. `CustomersListView` itself is a fully controlled component (no
  // internal state of its own — every prop is lifted, see its own props
  // doc comments), so mounting a second instance of it here (inside the
  // hook) with those same props/handlers is safe: both instances just
  // render synced views of that one shared state, and acting on either
  // updates it for both.
  //
  // The headerContent wrapper these 3 panel-render call sites already put
  // around EVERY panel's `headerContent` (docked/fullscreen/combined-mode,
  // all `<div className="shrink-0 px-4 pb-3 border-b ...">`) draws its own
  // `border-b` right underneath regardless, so a `TabList` here — which
  // already has its own `border-b` right under the tab row itself — showed
  // two stacked horizontal lines: the tab row's own bottom border (the
  // "tab separator", flush under the labels/active-indicator) AND that
  // wrapper's (the "heading separator", a few pixels further down, below
  // the wrapper's own `pb-3` padding). Per explicit request, it's the
  // WRAPPER's border that's suppressed here (not the TabList's own) — see
  // each of those 3 call sites' own `activePanelKey === "search"` check —
  // so the single remaining divider is the tab row's own, flush underline,
  // not the lower one.
  const searchContent = useSearchPanelContent({
    tabs: SEARCH_PANEL_TABS,
    onAddToast: addToast,
    onOpenInteraction: handleOpenInteractionRow,
    simpleCustomerSearch: true,
    customers: {
      onStartInteraction: (contact, channel, phone, skillId) =>
        handleStartCall({ contact, channel, phone, skillId }),
      addedFilterKeys: customerAddedFilterKeys,
      onAddedFilterKeysChange: setCustomerAddedFilterKeys,
      filterValues: customerFilterValues,
      onFilterValuesChange: setCustomerFilterValues,
      // Per a later explicit follow-up request ("have the customer info
      // panel open in the right panel when the rows are clicked (like in
      // premium)"), this no longer no-ops — clicking a row here now opens
      // `CustomerRowInfoPanel` again, toggle-open/close on the same row
      // (mirroring Premium's own desk-tab Customers table `onRowClick`
      // pattern). The desk-tab Customers table's own `onRowClick` just
      // above stays a no-op — this change is scoped to the Search panel's
      // Customers sub-tab specifically, per that request's own wording.
      // The panel's pop-out/full-screen toggle is suppressed separately —
      // see `hideFullScreenToggle` at this branch's `CustomerRowInfoPanel`
      // call site (agent-next-gen-search-panel.tsx).
      onRowClick: (row) =>
        setSelectedCustomerRow((prev) => (prev?.contactNumber === row.contactNumber ? null : row)),
      searchQuery: customerSearchQuery,
      onSearchChange: setCustomerSearchQuery,
      searchSubmitted: customerSearchSubmitted,
      onSearchSubmittedChange: setCustomerSearchSubmitted,
      sortKey: customerSortKey,
      sortDir: customerSortDir,
      onSort: handleCustomerSort,
      sortedRows: customerSortedRows,
      selectedRow: selectedCustomerRow,
      onCloseRow: () => setSelectedCustomerRow(null),
      onPreviousRow: () => handleCustomerRowNav(-1),
      onNextRow: () => handleCustomerRowNav(1),
      hasPreviousRow: selectedCustomerIndex > 0,
      hasNextRow: selectedCustomerIndex !== -1 && selectedCustomerIndex < customerSortedRows.length - 1,
      // Per explicit follow-up ("you didn't add the icon to advanced") —
      // the Search panel's own Customers sub-tab only ever renders from
      // this page (see its own `leadingChannelStack` doc comment), so it
      // gets the same eye-icon "is this customer open" check the main
      // Desk-tab table below already uses (no `openCustomerTabs` concept
      // on this tier, same as that call site).
      isRowOpen: (row) => interactions.some((i) => i.customerId === row.contactNumber),
      // Matches this tier's own main desk-tab Customers view's own
      // `CustomerRowInfoPanel` call site (`tabs={AGENT_WORKSPACE_CUSTOMER_
      // PANEL_TABS}`, below) — see `panelTabs`'s own doc comment (agent-
      // next-gen-search-panel.tsx) for why this is now threaded through
      // explicitly instead of hard-coded inside the hook.
      panelTabs: AGENT_WORKSPACE_CUSTOMER_PANEL_TABS,
    },
  });
  const contentByPanelKey: Record<PanelKey, EmbeddablePanelContent> = {
    notif: notifContent,
    conversations: blankPanelContent("Agent Chat"),
    schedule: scheduleContent,
    screenpop: screenPopContent,
    customers: blankPanelContent("Customers"),
    accounts: blankPanelContent("Accounts"),
    tickets: blankPanelContent("Tickets"),
    // WEM = Workforce Engagement Management
    wem: blankPanelContent("WEM"),
    search: searchContent,
  };
  const activePanelContent = activePanelKey ? contentByPanelKey[activePanelKey] : null;

  // Below 768px, a DOCKED (not floating) open panel combines with the main
  // container into a single container with two tabs — one for whatever the
  // main view currently is (Settings/an active interaction/Home), one for
  // the panel — instead of sitting docked beside it. `panelOpen` is
  // required (not just `activePanelContent`, which stays non-null after
  // closing — `handlePanelButtonClick` never clears `activePanelKey`, only
  // `panelOpen`) so this doesn't stay "true" for a panel that's actually
  // closed.
  const isCombinedPanelMode = isNavNarrow && panelOpen && panelVariant === "docked" && !!activePanelContent;
  // `showAllContacts` alone isn't enough once it stops being cleared on
  // interaction start (see that state's own doc comment) — `!activeInteraction`
  // keeps this label matching the ternary branch actually rendered below.
  const mainRegionTabLabel = showSettings
    ? "Settings"
    : showAllContacts && !activeInteraction
      ? "All Contacts"
      : activeInteraction
        ? `${activeInteraction.customerName ?? "Customer"} (${activeInteraction.customerId})`
        : "Home";

  // Clicking a button: re-clicking the CURRENTLY showing one closes the
  // shared container outright. Otherwise, if it's closed, open it in
  // whatever `panelVariant` already is (see that state's own doc comment
  // above); if it's already open showing a DIFFERENT key, only
  // `activePanelKey` changes — the container itself never resizes,
  // repositions, or re-animates open+close, only its title/body content
  // does.
  const handlePanelButtonClick = (key: PanelKey) => () => {
    if (panelOpen && activePanelKey === key) {
      setPanelOpen(false);
      return;
    }
    if (!panelOpen) {
      setPanelOpen(true);
    }
    setActivePanelKey(key);
    // Below 768px, opening a panel switches straight to its tab — otherwise
    // clicking a header icon while narrow would silently open the panel
    // behind whatever the main tab currently shows, with no visible change.
    if (isNavNarrow) setNarrowActiveRegion("panel");
  };

  // Per explicit follow-up request ("detach the contacts table from the
  // search panel and have it exist on its own") — wired to
  // `ContactHistoryCard`'s own `onOpenAllContacts` prop below. The original
  // version of this handler opened the shared right-docked Search panel's
  // own "Contacts" tab, maximized to full screen (see BEHAVIOR.md §134);
  // this follow-up replaces that entirely with the new `showAllContacts`
  // top-level view (declared next to `showSettings` above) — no panel
  // involved at all anymore. Reaches the Contacts table, not "Customers"
  // (the separate customer-database tab this tier alone also has).
  const handleOpenAllContacts = () => {
    setShowAllContacts(true);
  };

  // "Selected" treatment for whichever AppHeader icon button currently owns
  // the shared panel — same `bg-lyra-bg-active-moderate`/`text-lyra-fg-
  // active-strong` "active" idiom `PanelPinButton`/`LeftNav`/`Tabs` already
  // use elsewhere in the design system (also now `NotificationsBell`'s own
  // open state, notifications-bell.tsx), not a plain hover tint. Matches
  // lyra-ui's own "Multiple Containers" Storybook demos (`Draggable.
  // stories.tsx`), which use this exact class for the same purpose.
  const PANEL_BUTTON_SELECTED_CLASS = "bg-lyra-bg-active-moderate text-lyra-fg-active-strong hover:bg-lyra-bg-active-moderate";

  // Per-key label/icon used to build the "View All Apps" menu rows below —
  // same labels/icons as the header buttons' own `title`/child-icon pairs
  // above, just centralized so the menu doesn't hand-duplicate them.
  // "notif" uses `Bell` here (a plain menu row), unlike the header itself,
  // which keeps using the specialized `NotificationsBell` component (badge
  // count, its own portal, etc.) for that one button.
  const PANEL_KEY_METADATA: Record<PanelKey, { label: string; icon: LucideIcon }> = {
    notif: { label: "Notifications", icon: Bell },
    conversations: { label: "Agent Chat", icon: MessageSquare },
    schedule: { label: "Schedule", icon: CalendarDays },
    screenpop: { label: "Screen Pop", icon: MonitorUp },
    customers: { label: "Customers", icon: Users },
    accounts: { label: "Accounts", icon: Building2 },
    tickets: { label: "Tickets", icon: Ticket },
    wem: { label: "WEM", icon: UserCog },
    search: { label: "Search", icon: Search },
  };
  const PANEL_KEY_INITIAL_ORDER: PanelKey[] = [
    "search", "customers", "accounts", "tickets", "wem",
    "screenpop", "conversations", "schedule", "notif",
  ];
  // Live, user-reorderable order for both the header icon row AND the "View
  // All Apps" menu — ONE shared hook instance/state so dragging either
  // surface updates the exact same array the other one reads, rather than
  // two independently-drifting copies. `useColumnReorder` (lyra-ui,
  // table.tsx) already implements exactly this — a generic `K extends
  // string`-keyed array plus native HTML5 drag handlers — for
  // `SortableTableHead`'s column reordering; reused as-is here rather than
  // hand-rolling a second copy of the same splice/dataTransfer logic.
  const {
    columnOrder: panelOrder,
    dragOverKey: panelDragOverKey,
    dragHandlers: panelDragHandlers,
  } = useColumnReorder<PanelKey>(PANEL_KEY_INITIAL_ORDER);
  // Each row: clicking it opens that app in the shared panel (same handler
  // the header icon uses) and closes the menu; the trailing `PanelPinButton`
  // toggles `pinnedKeys` without triggering that — Radix closes the menu on
  // any click inside an item by default, so the pin button's own click is
  // wrapped in a `stopPropagation` span to both keep the menu open and avoid
  // also firing the row's `onClick` (which would open that app's panel too).
  // `draggable`/`onDragStart`/etc. wire this row into the exact same
  // `panelDragHandlers` the header icon buttons below use — dragging a row
  // here to reorder it moves the same underlying `panelOrder` array the
  // header reads, and vice versa.
  //
  // Customers/Accounts/Tickets are hidden from this menu specifically (per
  // explicit request) — `panelOrder`/`pinnedKeys` themselves are untouched,
  // so Accounts/Tickets (unpinned) simply have no way to open them anymore,
  // since this menu was their only entry point; Customers (also unpinned)
  // is the same, but has its Search-panel Customers tab as a real
  // alternative entry point. WEM is deliberately NOT in this list (dropped
  // per a follow-up explicit request, "Add WEM to the top right app area")
  // — it's now pinned (see `pinnedKeys` above) AND listed here, a fully
  // reachable, discoverable app like Notifications/Agent Chat/etc.
  const HIDDEN_FROM_APPS_MENU: PanelKey[] = ["customers", "accounts", "tickets"];
  const appsMenuItems: MenuEntry[] = panelOrder.filter((key: PanelKey) => !HIDDEN_FROM_APPS_MENU.includes(key)).map((key) => {
    const { label, icon: KeyIcon } = PANEL_KEY_METADATA[key];
    return {
      id: key,
      label,
      icon: <KeyIcon className="h-4 w-4" strokeWidth={1.5} />,
      // Mirrors the header icon buttons' own `PANEL_BUTTON_SELECTED_CLASS`
      // condition — whichever app currently owns the shared panel gets the
      // same blue "active" row treatment here (MenuRadixItem's `item.active`
      // branch) that its header icon gets.
      active: panelOpen && activePanelKey === key,
      onClick: handlePanelButtonClick(key),
      // Selecting an app should just switch the shared panel to it, the
      // same way clicking its header icon would — not also close this
      // menu, since a caller might want to pin/unpin or jump between
      // several apps in one pass without it snapping shut after the first.
      closeOnSelect: false,
      draggable: true,
      dragOver: panelDragOverKey === key,
      onDragStart: (e) => panelDragHandlers.onDragStart(e, key),
      onDragOver: (e) => panelDragHandlers.onDragOver(e, key),
      onDrop: (e) => panelDragHandlers.onDrop(e, key),
      onDragEnd: panelDragHandlers.onDragEnd,
      onDragLeave: panelDragHandlers.onDragLeave,
      // Keyboard alternative to the drag reorder above (lyra-ui MenuRadix:
      // Alt+Shift+ArrowUp/Down on a focused row) — same shared order state.
      onKeyboardMove: (direction: -1 | 1) => panelDragHandlers.onKeyboardMove?.(key, direction),
      rightElement: (
        <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Same unread count `NotificationsBell`'s own header icon shows
              (`notifications.filter((n) => !n.read).length`) — reused here,
              not recomputed with different criteria, so this row can't tell
              a different story than the icon it's a menu-row stand-in for.
              `Badge`'s own `shape="circle"`/`variant="critical"`/`size="sm"`
              is the exact styling `Button`'s built-in `badge` prop already
              uses for this same count elsewhere (button.tsx) — reused
              directly since a `Menu` row's `rightElement` isn't an
              icon-shaped `Button`/`ActionIconButton` itself, so that prop
              isn't available here the way it is on the header icon. */}
          {key === "notif" && notifications.filter((n) => !n.read).length > 0 && (
            <Badge shape="circle" variant="critical" size="sm" count={notifications.filter((n) => !n.read).length} />
          )}
          <PanelPinButton
            pinned={pinnedKeys[key]}
            onToggle={() => setPinnedKeys((prev) => ({ ...prev, [key]: !prev[key] }))}
            pinnedLabel={`Unpin ${label}`}
            unpinnedLabel={`Pin ${label}`}
            // Notifications used to be forced pinned here (`disabled` +
            // hardcoded `pinnedLabel` explaining why) — per explicit
            // request it's unpinnable like every other app now. Unpinning
            // it just stops rendering `NotificationsBell` in the header
            // (same `showHeaderIcon` gate every other key already goes
            // through, see that loop below) — it doesn't lose the count
            // itself, which reappears as a badge on "View All Apps" instead
            // (see that button's own `badge` prop below), so an unread
            // notification is never silently unreachable.
            //
            // Only override the icon/className when PINNED — unpinned rows
            // pass neither prop, so they fall straight through to
            // `PanelPinButton`'s own untouched default rendering (plain gray
            // outline Pin, no rotation since `pinned` is false), exact same
            // as before this change. Pinned rows get a custom solid blue pin
            // (`fill-lyra-fg-active-strong` + matching `text-*`, same
            // "filled + colored icon" idiom `FavoriteButton`'s star already
            // uses) instead of the default's plain 45°-rotated outline Pin.
            // Passing a custom `icon` also opts this into `PanelPinButton`'s
            // "selected button background" treatment — not wanted here,
            // just the icon itself should read as filled/blue — so
            // `className` overrides that back to transparent (twMerge drops
            // the conflicting `bg-*`), also only when pinned.
            icon={
              pinnedKeys[key] ? (
                <Pin className="h-4 w-4 rotate-45 fill-lyra-fg-active-strong text-lyra-fg-active-strong" strokeWidth={1.5} />
              ) : undefined
            }
            className={pinnedKeys[key] ? "bg-transparent hover:bg-lyra-state-hover" : undefined}
          />
        </span>
      ),
    };
  });

  // ── Responsive header icon collapse ──
  // As the viewport narrows, the pinned icon-button row can eventually run
  // out of room and squish/wrap `AppName` ("Agent Next Gen") instead — so
  // rather than letting that happen, buttons drop out of the header one at
  // a time, always starting with the FARTHEST LEFT pinned one in the
  // *current* (user-reorderable) `panelOrder` — since that's the icon
  // nearest `AppName` and the first to collide with it as space runs out,
  // dragging a button further right also moves it further down the "gets
  // hidden first" list. A dropped button isn't gone — same as unpinning it,
  // it just stops rendering in the header and stays reachable via "View All
  // Apps" (`appsMenuItems` above lists every key regardless of pinned/
  // responsively-hidden state).
  //
  // This used to be a table of fixed viewport-width breakpoints, which
  // hid icons well before they actually needed the room (lots of dead space
  // between `AppName` and the icons at widths that were already hiding
  // several of them) and didn't account for anything BUT window width
  // (e.g. a wider/narrower `AppName` — it hardcodes "Agent Next Gen" today,
  // but AppMenu/AppName are generic). Replaced with real geometry: measure
  // the actual gap between `AppName`'s rendered right edge
  // (`appNameMeasureRef`) and the visible icon row's rendered left edge
  // (`headerIconsMeasureRef`) after every layout, and only hide/reveal a
  // icon when that gap actually crosses a threshold — i.e. when they're
  // genuinely about to collide, not on a width guess. A small hysteresis
  // gap (`SHOW_GAP_PX` well above `HIDE_GAP_PX`) keeps this from
  // flapping — hiding an icon frees up roughly one icon's width of gap,
  // which would otherwise immediately clear the "show one back" threshold
  // and re-show it next frame.
  const pinnedKeysInHeaderOrder = panelOrder.filter((key) => pinnedKeys[key]);
  const appHeaderRef = useRef<HTMLElement>(null);
  const appNameMeasureRef = useRef<HTMLDivElement>(null);
  const headerIconsMeasureRef = useRef<HTMLDivElement>(null);
  const [autoHiddenCount, setAutoHiddenCount] = useState(0);
  useLayoutEffect(() => {
    const HIDE_GAP_PX = 16; // start hiding once closer than this
    const SHOW_GAP_PX = 84; // ~44px icon + gap, plus headroom above HIDE_GAP_PX so it doesn't immediately re-show what was just hidden
    const measure = () => {
      const appNameEl = appNameMeasureRef.current;
      const iconsEl = headerIconsMeasureRef.current;
      if (!appNameEl || !iconsEl) return;
      const gap = iconsEl.getBoundingClientRect().left - appNameEl.getBoundingClientRect().right;
      setAutoHiddenCount((prev) => {
        if (gap < HIDE_GAP_PX && prev < pinnedKeysInHeaderOrder.length) return prev + 1;
        if (gap > SHOW_GAP_PX && prev > 0) return prev - 1;
        return prev;
      });
    };
    measure();
    // Widening the window back out doesn't necessarily change either
    // measured element's OWN size — once `AppName` is back to its natural
    // width and the hidden icons are gone, both boxes can sit still while
    // `justify-between` just grows the empty space between them, so a
    // ResizeObserver on only those two elements can miss the "there's now
    // room again" case entirely (this was the bug: icons stayed hidden
    // after growing the window back, even once the gap ,`prev` never
    // re-evaluated because nothing observed had actually changed size). The
    // header's OWN box, and the window itself, reliably do change size on
    // every resize regardless of whether `AppName`/the icon row happen to
    // — observing/listening to those too guarantees at least one
    // `measure()` call per resize either way.
    const ro = new ResizeObserver(measure);
    if (appHeaderRef.current) ro.observe(appHeaderRef.current);
    if (appNameMeasureRef.current) ro.observe(appNameMeasureRef.current);
    if (headerIconsMeasureRef.current) ro.observe(headerIconsMeasureRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // Re-measure whenever the pinned set changes (pinning/unpinning shifts
    // how many icons COULD show) and every time `autoHiddenCount` itself
    // changes — each change nudges the count by exactly one and re-runs
    // this effect, converging step by step rather than jumping straight to
    // a final value in one pass.
  }, [pinnedKeysInHeaderOrder.length, autoHiddenCount]);
  const responsivelyHiddenKeys = new Set(
    pinnedKeysInHeaderOrder.slice(0, Math.min(autoHiddenCount, pinnedKeysInHeaderOrder.length))
  );
  const showHeaderIcon = (key: PanelKey) => pinnedKeys[key] && !responsivelyHiddenKeys.has(key);

  // How much room the DOCKED shared panel can actually claim without
  // pushing `containerRef`'s own `min-w-[374px]` floor (and so the whole
  // row) past the viewport — see `INTERACTION_MAIN_CONTENT_MIN_WIDTH`'s own
  // doc comment for the full reasoning. Computed here (not just down at the
  // docked-panel render block that actually uses it) so it can ALSO feed
  // `Draggable`'s own `maxWidth` prop below — per explicit follow-up
  // report, capping only the RENDERED width (this file's own earlier
  // attempt) still let an active drag visually run the panel off the right
  // edge of the screen while dragging, since that render-width clamp used
  // to explicitly bypass itself while `panelIsResizing`. `Draggable` itself
  // already re-reads `maxWidth` live on every pointer-move during a drag
  // (`draggable.tsx`'s own resize handlers), so feeding it this same,
  // per-render-fresh boundary stops the drag handle itself right at the
  // wall instead of only clipping the box after the fact.
  const leftNavRenderWidth = isNavNarrow ? 0 : navOpen ? 256 : 60;
  const maxDockedWidthForMainFloor = Math.max(
    0,
    bodyContainerWidth - leftNavRenderWidth - INTERACTION_MAIN_CONTENT_MIN_WIDTH - 12
  );

  // The one shared `Draggable` — its header (icon/actions/title) and body
  // swap to whichever button's content is active; the container itself
  // (variant/width/position) never does.
  const sharedPanel = panelMounted && activePanelContent ? (
    <Draggable
      ref={panelRef}
      variant={panelVariant}
      defaultWidth={panelWidth}
      defaultHeight={panelHeight}
      // Shares `containerRef`'s own tested VISUAL content floor
      // (`SHARED_CONTENT_MIN_VISUAL_WIDTH`) rather than a separate,
      // never-validated 280px default — per explicit request to give the
      // main content column and the docked shared panel the same real
      // on-screen minimum size. Deliberately NOT
      // `INTERACTION_MAIN_CONTENT_MIN_WIDTH` (374) — that number already has
      // `containerRef`'s own `pr-3` padding baked in (see that constant's own
      // doc comment), but this outer box carries no equivalent padding of
      // its own, so adding it here would make the panel's floor render 12px
      // WIDER than `containerRef`'s, not the same. Below this the panel's
      // own content (list rows, labels, actions) gets just as cramped as the
      // main column would.
      minWidth={SHARED_CONTENT_MIN_VISUAL_WIDTH}
      // This instance already computes its own precise ceiling from real
      // sibling layout (`maxDockedWidthForMainFloor`, above) — `Draggable`'s
      // generic "below 1440px viewport, tighten to 800px" heuristic
      // (`getResponsiveMaxWidth`) has no visibility into that and was
      // capping the panel below 1024px even while `containerRef` sat
      // comfortably above its own floor with room to spare. Opting out lets
      // the floor-aware ceiling be the only cap, matching the explicit
      // requirement: resizable up to `SHARED_PANEL_MAX_WIDTH` OR until
      // `containerRef` hits its floor, whichever is smaller — nothing else.
      disableResponsiveMaxWidth
      // Deliberately NOT unified with `containerRef`'s max — main stays
      // uncapped (grows to fill whatever's left via `flex-1`) per explicit
      // request; only the DOCKED panel is capped here, to stop it from
      // squeezing `containerRef` under its own floor (see
      // `maxDockedWidthForMainFloor`'s own doc comment just above). No
      // effect on the FLOAT variant (an undocked/dragged float panel
      // doesn't claim any of `containerRef`'s layout space to begin with).
      // Fullscreen bypasses `Draggable` entirely (see
      // `sharedPanelFullScreenOverlay`) and is already uncapped — it fills
      // whatever `containerRef` itself measures, with no width cap of its
      // own, so "uncapped when full screen" falls out for free here.
      maxWidth={panelVariant === "docked" ? Math.min(SHARED_PANEL_MAX_WIDTH, maxDockedWidthForMainFloor) : SHARED_PANEL_MAX_WIDTH}
      minHeight={400}
      onVariantChange={handlePanelVariantChange}
      onWidthChange={setPanelWidth}
      onResizeStateChange={setPanelIsResizing}
      className={cn(
        "rounded-lyra-lg border border-lyra-border-subtle",
        // Floating (undocked/dragged) gets an 0.8 (80%) opacity background
        // per explicit request — plain `bg-lyra-bg-surface-base/80` can't
        // work here since Tailwind can't generate opacity-modified
        // utilities for our `var(--lyra-color-*)` tokens (same root cause
        // as the Modal backdrop's own `color-mix()` override, overlay.tsx/
        // AgentNextGenPage.tsx doc comments), so `color-mix()` directly
        // against the same `--lyra-color-bg-surface-base` variable the
        // plain utility itself resolves to (tailwind-preset.ts) is used
        // instead. Docked keeps the normal fully-opaque background.
        // `backdrop-blur-sm` (4px) — "blur the background slightly" —
        // softens whatever shows through that 20% transparency, same
        // pairing the Modal backdrop's own color-mix()-plus-backdrop-blur-sm
        // treatment already uses (entry-agent-next-gen-v2.tsx).
        panelVariant === "float"
          ? "shadow-lg backdrop-blur-sm bg-[color-mix(in_srgb,var(--lyra-color-bg-surface-base)_80%,transparent)]"
          : "h-full bg-lyra-bg-surface-base"
      )}
      renderHeaderControls={({ gripProps, dockButtonProps, dockIcon, variant: dVariant }) => (
        <>
          <ContainerHeader
            title={activePanelContent.title}
            titleText={activePanelContent.titleText}
            titleBadge={activePanelContent.titleBadge}
            titleClassName={activePanelContent.titleClassName}
            icon={
              dVariant === "float"
                ? <div {...gripProps}><GripVertical className="h-4 w-4" strokeWidth={1.5} /></div>
                : activePanelContent.dockedIcon
            }
            bordered={!activePanelContent.headerContent}
            actions={
              <>
                {activePanelContent.headerActions}
                <Tooltip content="Full Screen" placement="bottom" asLabel>
                  <ActionIconButton
                    aria-label="Full Screen"
                    size="sm"
                    onClick={() => setPanelFullScreen(true)}
                    className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
                  >
                    <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </ActionIconButton>
                </Tooltip>
                <Tooltip content={dockButtonProps["aria-label"]} placement="bottom" asLabel>
                  <ActionIconButton
                    {...dockButtonProps}
                    size="sm"
                    className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
                  >
                    {dockIcon}
                  </ActionIconButton>
                </Tooltip>
              </>
            }
            onClose={() => setPanelOpen(false)}
            // Reverted back to `ContainerHeader`'s own generic default `X`
            // — see AgentNextGenPage.tsx's own matching call site for the
            // full doc comment; mirrored here verbatim.
          />
          {activePanelContent.headerContent && (
            // `activePanelKey === "search"` skips this wrapper ENTIRELY
            // (no padding, no border) for the Search panel's tabbed
            // headerContent, per explicit request — its `TabList` is meant
            // to sit flush against the panel's own edges (left/right/
            // bottom), not inset like every other panel's headerContent
            // (Screen Pop's Select, etc.), which still gets the padded,
            // bordered wrapper as before. `TabList` already draws its own
            // "tab separator" underline right under the tabs themselves
            // regardless (see `searchContent`'s own doc comment), so
            // there's still a real divider here even with the wrapper
            // gone.
            activePanelKey === "search" ? (
              activePanelContent.headerContent
            ) : (
              <div className="shrink-0 px-4 pb-3 border-b border-lyra-border-subtle">
                {activePanelContent.headerContent}
              </div>
            )
          )}
        </>
      )}
    >
      {/* Per explicit request ("when the user navigates between apps,
          please have them fade in when transitioning"): `key={activePanelKey}`
          forces a fresh mount on every app switch (Home/Search/Agent Chat/
          Schedule/etc.), which is what lets `animate-in fade-in-0` actually
          replay instead of only firing once ever — same "force a remount to
          replay animate-in" pattern this file's own desk-tab switch and
          active-interaction switch already use elsewhere in this file.
          Applied identically at every render site of `activePanelContent.
          body` (this docked/float `Draggable`, the fullscreen overlay, and
          the combined-mode panel below) so the fade is consistent
          regardless of which layout is currently active. */}
      <div key={activePanelKey} className="flex flex-col flex-1 min-h-0 animate-in fade-in-0 duration-200">
        {activePanelContent.body}
      </div>
    </Draggable>
  ) : null;

  // Fullscreen overlay for the shared panel — see `panelFullScreen`'s own
  // doc comment above for why this bypasses `Draggable` entirely rather
  // than trying to make its "float" variant cover the container. Mirrors
  // the Customer Information panel's header shape (title/icon/actions via
  // `ContainerHeader`, using the same `activePanelContent` the docked/float
  // rendering above uses) plus a `Minimize2` "exit full screen" action.
  // Positioned against `containerRef`'s own div (see where this is
  // rendered, below), which is already `relative` and is exactly the "main
  // content container" (everything right of LeftNav, below AppHeader) this
  // should fill; NOT `fixed`/the viewport, which would also cover LeftNav
  // and AppHeader. Deliberately NOT a plain `inset-0`, either — the
  // containing block for an absolutely positioned element is its
  // ancestor's PADDING box, so `right-0`/`bottom-0` would land flush with
  // containerRef's true outer edge, swallowing its own `pr-3 pb-3` (the
  // same gap the normal docked panel gets via its wrapper's `marginRight:
  // 12`/`pb-3`). Using `right-3 bottom-3` instead (matching `pr-3`/`pb-3`'s
  // 12px) reproduces that same gap so the fullscreen panel lines up with
  // where the docked panel's own right/bottom edges would sit — flush only
  // on top/left, matching the docked panel's own flush-top/flush-left
  // look. `rounded-lyra-lg border ... overflow-hidden` also matches
  // `sharedPanel`'s own docked-variant styling (and `Draggable`'s own
  // docked-branch wrapper, which always applies `overflow-hidden` — see
  // draggable.tsx) rather than the previous full-bleed/borderless look.
  // `z-[9]` sits above the Customer Information panel's `z-[5]` but
  // deliberately BELOW LeftNav's own collapse/expand toggle button
  // (`z-10`, left-nav.tsx) — that button is positioned `absolute -right-3`
  // (poking ~12px past LeftNav's own right edge, i.e. spatially into
  // `containerRef`'s territory), and `containerRef` itself doesn't
  // establish its own stacking context (no z-index of its own), so a
  // descendant's z-index here competes directly against LeftNav's
  // sibling-level z-10, not just against other things inside `containerRef`
  // — going any higher (e.g. the `z-[50]` this used originally) paints
  // over/hides that toggle button, per explicit follow-up request to keep
  // it clickable/visible instead. Doesn't need to compete with the
  // app-header's own menus (`z-[9999]`) — those live in a different row
  // entirely (above `containerRef`, not inside it).
  // Mounted on `fullScreenRendered` (which outlives `panelFullScreen` by
  // 180ms on the way out — see that state's own doc comment) rather than
  // `panelFullScreen` directly, so the fade/scale-out transition below
  // actually gets to play instead of the overlay just disappearing the
  // instant fullscreen is exited. The transition itself keys off
  // `fullScreenVisible`, NOT `panelFullScreen` directly — see that
  // state's own doc comment for why a freshly-mounted node needs a
  // separate "hidden first, visible one frame later" flag to actually
  // animate in, rather than just popping straight to its final opacity/
  // scale with nothing to transition from. CSS transition (not a
  // keyframe animation) per the same reasoning as the float/docked panels
  // just below — avoids compositor fill-mode flash. `scale`'s default
  // center origin reads fine here since this overlay already fills the
  // whole container; a corner-anchored origin would need `transformOrigin`
  // too, but center suits a "settle into place" feel just as well without
  // the extra complexity.
  const sharedPanelFullScreenOverlay = panelMounted && activePanelContent && fullScreenRendered ? (
    <div
      className="absolute top-0 left-0 right-3 bottom-3 z-[9] flex flex-col rounded-lyra-lg border border-lyra-border-subtle bg-lyra-bg-surface-base overflow-hidden"
      style={{
        opacity: fullScreenVisible ? 1 : 0,
        transform: fullScreenVisible ? "scale(1)" : "scale(0.98)",
        transition: fullScreenVisible
          ? "opacity 200ms ease, transform 200ms cubic-bezier(0.4, 0, 0.2, 1)"
          : "opacity 150ms ease, transform 150ms ease",
        pointerEvents: fullScreenVisible ? "auto" : "none",
      }}
    >
      <ContainerHeader
        title={activePanelContent.title}
        titleText={activePanelContent.titleText}
        titleBadge={activePanelContent.titleBadge}
        titleClassName={activePanelContent.titleClassName}
        icon={activePanelContent.dockedIcon}
        bordered={!activePanelContent.headerContent}
        actions={
          <>
            {activePanelContent.headerActions}
            <Tooltip content="Exit Full Screen" placement="bottom" asLabel>
              <ActionIconButton
                aria-label="Exit Full Screen"
                size="sm"
                onClick={() => setPanelFullScreen(false)}
                className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
              >
                <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </ActionIconButton>
            </Tooltip>
            {/* "Drag mode" — see `handleFullScreenToDragMode`'s own doc
                comment for why this (not `Draggable`'s own dock button,
                which isn't mounted while fullscreen) is how fullscreen gets
                to float. Kept in the same relative position `Draggable`'s
                own dock button normally occupies (right after the
                full-screen toggle) so the header's button layout doesn't
                jump around across the transition. */}
            <Tooltip content="Undock" placement="bottom" asLabel>
              <ActionIconButton
                aria-label="Undock"
                size="sm"
                onClick={handleFullScreenToDragMode}
                className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
              >
                <Move className="h-3.5 w-3.5" strokeWidth={1.5} />
              </ActionIconButton>
            </Tooltip>
          </>
        }
        onClose={() => {
          setPanelFullScreen(false);
          setPanelOpen(false);
        }}
        // Same revert-to-default-`X` as the docked variant's own
        // `ContainerHeader` above — see that call site's own doc comment.
      />
      {activePanelContent.headerContent && (
        // See the docked variant's own matching wrapper (above) for why
        // "search" skips this wrapper entirely.
        (activePanelKey === "search" ? (
          activePanelContent.headerContent
        ) : (
          <div className="shrink-0 px-4 pb-3 border-b border-lyra-border-subtle">
            {activePanelContent.headerContent}
          </div>
        ))
      )}
      {/* Per explicit request ("... fade in when transitioning" — see the
          docked variant's own matching wrapper above for the full doc
          comment): `key={activePanelKey}` forces a remount on every app
          switch so `animate-in fade-in-0` replays each time. */}
      <div key={activePanelKey} className="flex flex-col flex-1 min-h-0 animate-in fade-in-0 duration-200">
        {activePanelContent.body}
      </div>
    </div>
  ) : null;

  return (
    <PageClockContext.Provider value={clock}>
    <QueueSimContext.Provider value={queueSim}>
    <div className="flex flex-col h-screen bg-lyra-bg-surface-shell overflow-hidden animate-in fade-in-0 duration-500">
      {/* Marcus's Next Best Action card lives in a persistent host node (moved into the transcript by PersistentHostSlot),
          so navigating away and back never resets its state or its running timers. Unmounted when the assignment is dismissed. */}
      {interactions.some((i) => i.id === MARCUS_WEBB_ID) &&
        createPortal(
                                      <MarcusWebbNextBestActionCard
            onComplete={handleMarcusWebbOutcomeMessage}
            onAgentContactedCustomer={() =>
              handleMarcusWebbOutcomeMessage(
                "Great news — I've received approval from a supervisor. I'm processing your $200 refund now; you should see it back on your original payment method within 3-5 business days. Is there anything else I can help with?"
              )
            }
            onCustomerApprovedResolution={() =>
              handleMarcusWebbCustomerReply("That's great, thank you so much for your help!")
            }
            onDispositionUpdated={handleMarcusWebbResolved}
            onAssignmentClosed={() => {
              // See `MARCUS_WEBB_AUTO_DISMISS_ON_CLOSE`'s own doc
              // comment — held off for now while testing.
              if (!MARCUS_WEBB_AUTO_DISMISS_ON_CLOSE) return;
              handleDismissInteraction(MARCUS_WEBB_ID);
              // Re-arms "L" — see `marcusWebbTriggered`'s own doc
              // comment (it's otherwise a one-shot flag that's
              // never reset anywhere else in this file).
              setMarcusWebbTriggered(false);
            }}
            onPhotoRequested={() =>
              handleMarcusWebbOutcomeMessage(
                "Understood — to help us evaluate this further, could you send a photo of the damaged ear cup?"
              )
            }
            // Per explicit request ("add customer
            // responses to the transcript
            // indicating they are annoyed they
            // have to provide visual proof and
            // that the refund was denied") —
            // both reuse `handleMarcusWebbCustomerReply`,
            // the same "Marcus himself replying"
            // handler `onCustomerRespondedToTakeover`
            // already uses below.
            onCustomerReactedToRejection={() =>
              handleMarcusWebbCustomerReply(
                "Wait, seriously? I've been more than patient about this — I really don't understand why it's being denied."
              )
            }
            onCustomerReactedToPhotoRequest={() =>
              handleMarcusWebbCustomerReply(
                "Are you kidding me? I already explained what happened. Fine, I'll send a photo, but this is getting frustrating."
              )
            }
            onPhotoExpand={() => setMarcusWebbPhotoExpanded(true)}
            onStatusEscalated={handleMarcusWebbEscalated}
            takenOver={!marcusWebbReviewing}
            onTakeoverGreeting={() =>
              handleMarcusWebbHumanAgentMessage(
                "Hello, Mr. Webb. This is John. I noticed you are not happy about your headphones. Would you be interested in store credit or a discount?"
              )
            }
            onCustomerRespondedToTakeover={() =>
              handleMarcusWebbCustomerReply("I'll take store credit.")
            }
            onRemedyIssued={(remedy, detail) => {
              handleMarcusWebbHumanAgentMessage(
                remedy === "store-credit"
                  ? `Perfect — I've issued $${detail.storeCreditAmount} as store credit to your account; you'll see it available for your next purchase.`
                  : remedy === "discount-code"
                    ? `Great — I've sent a ${detail.discountPercent}% discount code for your next order to the email on file.`
                    : `Understood — I'll go ahead and take care of that: ${detail.note?.trim()}`
              );
              // The reject-then-remedy path's own
              // "issue answered" moment — mirrors
              // `onDispositionUpdated`'s identical
              // call on the Approve path
              // (`handleMarcusWebbResolved`,
              // below in this same file), so both
              // ways of resolving Marcus's
              // exception converge on the one
              // shared "Resolved" signal that now
              // also reveals the Unassign &
              // Dismiss icon (see `showDismiss
              // Button` above and `onDismiss
              // Channel` below).
              handleMarcusWebbResolved();
            }}
            onActionLogEntryOpen={(entry) =>
              openDetailPanelContent({ kind: "action-log", entry })
            }
            selectedActionLogEntryId={
              activeInteraction?.id === MARCUS_WEBB_ID && selectedDetailPanelContent?.kind === "action-log"
                ? selectedDetailPanelContent.entry.id
                : null
            }
            onViewArticle={(article) =>
              openDetailPanelContent({ kind: "article", article })
            }
            selectedArticleId={
              activeInteraction?.id === MARCUS_WEBB_ID && selectedDetailPanelContent?.kind === "article"
                ? selectedDetailPanelContent.article.id
                : null
            }
            // Per explicit follow-up request
            // ("this should behave the same as
            // if I clicked between contact
            // history items on the home page"),
            // order/transactions go through the
            // SAME `openDetailPanelContent` (its
            // own toggle-off-if-same/swap-if-
            // different semantics, above).
            // Marcus Webb's clickable name
            // ("customer") no longer does, per a
            // LATER explicit request ("move the
            // customer information content back
            // to the side panel") — it now opens
            // the DOCKED `CustomerInformationSide
            // Panel`'s own "Customer Info"
            // drill-in instead
            // (`focusCustomerPanelTab`), the same
            // target the Contact Overview's own
            // "View customer info" link opens, so
            // the two can never disagree about
            // where "customer info" actually
            // lives.
            onOpenCustomerInfo={focusCustomerPanelTab}
            onOpenOrderInfo={() =>
              openDetailPanelContent({ kind: "order", order: MARCUS_WEBB_ORDER })
            }
            copilotRequests={marcusCopilotRequests}
            onOpenCopilotRequest={(r) => openDetailPanelContent({ kind: "marcus-copilot", ...r })}
            activeCopilotRequestId={
              activeInteraction?.id === MARCUS_WEBB_ID && selectedDetailPanelContent?.kind === "marcus-copilot"
                ? selectedDetailPanelContent.id
                : null
            }
            onOpenExperienceMemory={(focus) => {
              setMarcusMemoryFocus(focus);
              openExperienceMemoryInSidePanel();
            }}
            onOpenTransactions={(round) =>
              openDetailPanelContent({ kind: "transactions", ...round })
            }
            selectedTransactionsId={
              activeInteraction?.id === MARCUS_WEBB_ID && selectedDetailPanelContent?.kind === "transactions"
                ? selectedDetailPanelContent.id
                : null
            }
            onDismissAndUnassign={() => handleDismissInteraction(MARCUS_WEBB_ID)}
            questionSlotElement={marcusQuestionSlotEl}
          />,
          marcusCardHost
        )}

      {/* ── App Header ── */}
      <AppHeader
        ref={appHeaderRef}
        appName={
          // `appNameMeasureRef` — see "Responsive header icon collapse"
          // above — reads this wrapper's rendered right edge every layout
          // to decide whether the icon row on the other side of the header
          // is crowding it, so icons only hide once there's a real
          // overlap risk instead of a fixed viewport-width guess.
          <div ref={appNameMeasureRef} className="flex items-center">
            {/* Per explicit follow-up request ("rename the page Agent
                Workspace 2.0 | Phase 1"): this is the page's own displayed
                title (top-left of the header), separate from the app-menu
                dropdown label (`buildAppMenuGroups`, agent-next-gen-
                outbound-data.tsx) — that one was already renamed from
                "Phase 1B" to "Phase 1" earlier; this on-page title still
                read the older "Agent Workspace 2.0 Advanced" (itself
                predating "Phase 1B") until now. Matches the naming
                convention `AgentWorkspace2WithDeskPage.tsx`'s own identical
                `AppNameMenu` call site already uses for its title ("Agent
                Workspace 2.0 | Phase 2"). */}
            <AppNameMenu
              icon={<img src={appIcon} alt="Agent Workspace 2.0 | Phase 1" className="h-6 w-6" />}
              name="Agent Workspace 2.0 | Phase 1"
              compact={isCompactHeader}
              groups={appMenuGroups}
              menuFooter={<CXoneLogo />}
              open={appMenuOpen}
              onOpenChange={setAppMenuOpen}
            />
          </div>
        }
        actions={
          <>
            {/* Search / Customers / Accounts / Tickets / WEM / Screen Pop /
                Agent Chat / Schedule / Notifications / Ask AI — all ten
                now go through lyra-ui's `ActionIconButton` (`size="xl"`,
                44px), the single canonical AppHeader icon-button shape.
                These used to be hand-rolled `<button>`s (`h-10 w-10
                rounded-lyra-lg`) matching `NotificationsBell`'s own
                trigger, which at the time was also hand-rolled rather than
                built on `ActionIconButton` — lyra-ui has since consolidated
                `NotificationsBell` and `ActionIconButton` onto one shared
                implementation (composing `Button` internally), with
                44px/`rounded-lyra-sm` as the confirmed canonical AppHeader
                size, so this row now matches `Header.tsx`'s (and lyra-ui's
                own `AppHeader.stories.tsx`) icon buttons instead of
                diverging from them. Labeled "Agent Chat" — renamed from
                "Conversations" (itself previously renamed from "Messages"),
                per explicit request tying it to the same click behavior
                Sarah Miller's "New Agent Chat" notification now switches to
                (see `onNotificationClick`'s own doc comment above) — same
                trigger/panel throughout, just the label. Screen Pop sits to
                the left of Agent Chat, using lucide's `MonitorUp` (monitor +
                up arrow) to match the requested icon exactly.

                Customers/Accounts/Tickets/WEM all share the exact same
                single-container panel every other button here does (see
                `handlePanelButtonClick`/`contentByPanelKey` above) — each
                just shows its own blank placeholder body, no bespoke
                content yet since none of the four has a real data source
                in this prototype. Search is the one exception — its body
                is the real `InteractionsListView` (moved in from the old
                "Interactions" desk tab) behind a Contacts/Messages/
                Customers/Threads `TabList` in `headerContent` (see
                `searchContent`'s own doc comment for the full story).
                WEM = Workforce Engagement Management — `UserCog` (a
                person + a settings/management gear) per explicit request
                for "an appropriate Workforce management Lucide icon",
                swapped in for the previous placeholder `Gauge`.

                Trailing "View All Apps" kebab (after Notifications, before
                the AgentProfile divider) lists all nine of these (via
                `appsMenuItems`, built above from `PANEL_KEY_METADATA`) with
                a pin toggle per row — unpinning one wraps its button above
                in `{showHeaderIcon("KEY") && ...}` (`pinnedKeys[key] &&
                !responsivelyHiddenKeys.has(key)`, see the "Responsive
                header icon collapse" block above), hiding the persistent
                header icon while leaving the app reachable from this menu
                (its `onClick` is the same `handlePanelButtonClick` the
                header icon itself uses). That same `showHeaderIcon` check
                is also what auto-hides pinned buttons left-to-right as the
                viewport narrows, so a small screen doesn't squish
                `AppName`. `KebabMenuButton` (not the hand-rolled
                `Menu`) because its rows render as Radix `<div
                role="menuitem">`s rather than `<button>`s — required here
                since each row nests a real `<button>` (`PanelPinButton`) in
                `rightElement`, which would be invalid HTML nested inside
                another button. Wrapped in `Tooltip`+`span` because
                `KebabMenuButton` doesn't spread arbitrary props onto its
                inner trigger, so `Tooltip`'s `asChild` cloning needs that
                intermediate span to attach its hover handlers (same fix
                already used for the "More options" overflow menu in
                lyra-ui's own agent-notifications.tsx). Sized up from its
                24px default to the 44px `ActionIconButton` standard via
                `className` (twMerge dedupes the conflicting h-6/w-6). Uses
                `align="right"` (its default) here since it now sits at the
                right end of the row, matching every other right-aligned
                overflow kebab in this file. */}
            {/* Search through Notifications used to be nine near-identical
                hand-written blocks (one per key); collapsed into a single
                `.map()` over the live, reorderable `panelOrder` (filtered to
                whichever are currently pinned-and-visible via
                `showHeaderIcon`) so drag-to-reorder only has to be wired up
                once. Each icon is wrapped in a plain draggable `<div>`
                rather than teaching `ActionIconButton`/`NotificationsBell`
                themselves about native HTML5 drag — same
                `panelDragHandlers`/`panelDragOverKey` the "View All Apps"
                menu rows below use, so dragging an icon here to reorder it
                moves the very same `panelOrder` array those rows read (and
                a drag in the menu reorders the header right back), rather
                than two independently-drifting orders. "notif" still
                renders the specialized `NotificationsBell` (badge count,
                its own `open`/`onOpenChange`) instead of a generic
                `ActionIconButton` — everything else comes straight out of
                `PANEL_KEY_METADATA`. `headerIconsMeasureRef` wraps just
                this visible row (not the kebab/separator/profile after it)
                — its rendered LEFT edge is the other half of the "Responsive
                header icon collapse" gap measurement above, alongside
                `appNameMeasureRef`. */}
            {/* Per explicit follow-up request ("add the search app icon
                button back to the top right panel") — re-added just the
                Search icon that the broader row-hide below removed, as its
                own always-rendered button rather than folded back into the
                `panelOrder.filter(showHeaderIcon).map(...)` row just below
                (still `false &&`'d out in full), since only Search itself
                was asked back, not the rest of that row or the "View All
                Apps" kebab. Per a LATER explicit request ("hide the search
                icon button in the top right for now - that will not be
                part of phase 1"), this is now itself wrapped in `false &&`
                — same "kept, not deleted, in case it needs to come back"
                treatment as the row below, rather than removing the button
                outright. Same `ActionIconButton`/`handlePanelButtonClick`/
                `PANEL_BUTTON_SELECTED_CLASS` wiring the row uses per-icon,
                so re-enabling this opens the real Search panel exactly like
                it did before. */}
            {false && (
              <ActionIconButton
                size="xl"
                title={PANEL_KEY_METADATA.search.label}
                aria-expanded={panelOpen && activePanelKey === "search"}
                onClick={handlePanelButtonClick("search")}
                className={panelOpen && activePanelKey === "search" ? PANEL_BUTTON_SELECTED_CLASS : undefined}
              >
                <Search className="h-5 w-5" strokeWidth={1.5} />
              </ActionIconButton>
            )}
            {/* Per explicit request ("remove the apps in the top right
                including the app selector to match phase 1") — the app icon
                row (Search / Customers / Accounts / Tickets / WEM / Screen
                Pop / Agent Chat / Schedule / Notifications) and the "View
                All Apps" picker/kebab are both hidden here, mirroring
                AgentNextGenPage.tsx's own identical `false &&` treatment
                (see that file's copy of this exact block for the fuller
                "why" — Phase 2 was left untouched there, same reasoning
                applies here). Wrapped in `false &&` rather than deleted, in
                case it needs to come back. Search itself is exempted above
                per the follow-up request, so this map now effectively covers
                only the remaining eight keys whenever it's re-enabled. */}
            {false && (
              <>
            <div ref={headerIconsMeasureRef} className="flex items-center gap-0">
              {panelOrder.filter(showHeaderIcon).map((key) => {
                const { label, icon: KeyIcon } = PANEL_KEY_METADATA[key];
                const isActive = panelOpen && activePanelKey === key;
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={(e) => panelDragHandlers.onDragStart(e, key)}
                    onDragOver={(e) => panelDragHandlers.onDragOver(e, key)}
                    onDrop={(e) => panelDragHandlers.onDrop(e, key)}
                    onDragEnd={panelDragHandlers.onDragEnd}
                    onDragLeave={panelDragHandlers.onDragLeave}
                    className={cn(
                      "rounded-lyra-sm cursor-grab active:cursor-grabbing transition-colors",
                      panelDragOverKey === key && "bg-lyra-bg-active-moderate"
                    )}
                  >
                    {key === "notif" ? (
                      <NotificationsBell
                        notifications={notifications}
                        open={isActive}
                        onOpenChange={() => handlePanelButtonClick("notif")()}
                        renderPanel={false}
                      />
                    ) : (
                      <ActionIconButton
                        size="xl"
                        title={label}
                        aria-expanded={isActive}
                        onClick={handlePanelButtonClick(key)}
                        className={isActive ? PANEL_BUTTON_SELECTED_CLASS : undefined}
                      >
                        <KeyIcon className="h-5 w-5" strokeWidth={1.5} />
                      </ActionIconButton>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Separator between the icon-button row and the "View All
                Apps" kebab — same `orientation="vertical"` + `h-auto
                self-stretch` sizing lyra-ui's own vertical Separator usage
                uses elsewhere (see `dashboard-card.tsx`'s metric-row
                divider) so it stretches to match the row's height inside
                AppHeader's `flex items-center` actions container instead of
                a hand-picked fixed height. */}
            <Separator orientation="vertical" className="h-auto self-stretch pl-lyra-1 pr-lyra-1" />
            <Tooltip content="View All Apps" placement="bottom" disabled={appsMenuOpen}>
              <span className="inline-flex">
                <KebabMenuButton
                  items={appsMenuItems}
                  ariaLabel="View All Apps"
                  icon={<LayoutGrid className="h-5 w-5" strokeWidth={1.5} />}
                  // Same "outline" treatment as `Button`'s own `variant=
                  // "outline"` (button.tsx) — bordered/`bg-lyra-bg-control`
                  // rather than the plain borderless icon button every
                  // other AppHeader trigger uses, so this one reads as a
                  // distinct "more" control rather than just another app
                  // shortcut. `KebabMenuButton` isn't built on `Button`
                  // (it's its own hand-rolled trigger), so these classes are
                  // reproduced directly rather than passed as a `variant` prop.
                  className="h-11 w-11 rounded-lyra-sm border border-lyra-border-soft bg-lyra-bg-control text-lyra-fg-action hover:bg-lyra-state-hover active:bg-lyra-state-pressed data-[state=open]:bg-lyra-state-hover"
                  onOpenChange={setAppsMenuOpen}
                  // Notifications is unpinnable now (see the `PanelPinButton`
                  // row above) — once it's unpinned (or responsively
                  // auto-hidden, `showHeaderIcon` covers both), its own
                  // `NotificationsBell` badge disappears from the header
                  // along with it. Surface the same unread count here
                  // instead, so an unread notification never goes
                  // completely invisible just because its icon is tucked
                  // away — only shown while the header ISN'T already
                  // showing that count itself, to avoid the same number
                  // appearing on two icons at once.
                  badge={!showHeaderIcon("notif") ? notifications.filter((n) => !n.read).length : undefined}
                />
              </span>
            </Tooltip>
              </>
            )}
            {/* Status timer: only `AgentProfile` re-renders each second
                (its `timer` prop is a string, so it can't tick on its own). */}
            <ClockTick>
              {(clockTick) => (
            <AgentProfile
              name="John Smith"
              initials="JS"
              status={agentStatus}
              onStatusChange={handleStatusChange}
              onDarkModeToggle={handleDarkModeToggle}
              isDarkMode={darkMode}
              timer={formatWaitTime(clockTick - statusSinceTick)}
              // Hidden while the provider has no agent leg, and until the
              // first agent snapshot arrives (no fake state before hydrate).
              agentLegStatus={agentState?.leg}
              onAgentLegToggle={handleAgentLegToggle}
              hideAgentLeg={!agentLegCapable || !agentState}
              // Standalone AppHeader "?" icon removed — this app now uses
              // `AgentProfile`'s own conditional "Help" row instead (renders
              // below "Agent Leg Disconnected" whenever `onHelpClick` is
              // passed; see agent-profile.tsx). Same destination/new-tab
              // behavior as the removed icon button.
              onHelpClick={() => window.open("https://help.nicecxone.com/content/agent/cxoneagent/cxoneagent.htm?cshid=CXoneAgent", "_blank", "noopener,noreferrer")}
              onLogOut={() => onNavigate?.("login")}
              // Per explicit request: this prototype has no real
              // integrations to surface here, so the status menu's
              // "Connected Apps" row (which otherwise always renders, even
              // with a permanently-empty "0" badge — see `hideConnectedApps`'s
              // own doc comment, agent-profile.tsx) is hidden outright.
              hideConnectedApps
              className="ml-1"
            />
              )}
            </ClockTick>
          </>
        }
      />

      {/* ── Body: LeftNav + Content ── */}
      {/* overflow-hidden ensures docked panels never push layout past the viewport.
          ref measured by `bodyContainerRef` (see its own doc comment) — this
          row's own width drives `isNavNarrow`'s container query. */}
      <div ref={bodyContainerRef} className="flex flex-1 min-h-0 overflow-hidden">

        <LeftNav
          // Home and Settings — per explicit request ("move the home button
          // above the settings like in phase 1 left nav (match to phase
          // 1)"): mirrors `AgentNextGenPage.tsx`'s own latest arrangement
          // exactly (see that file's identical comment on this same prop
          // for the fuller history) — `items` no longer holds Home at all;
          // `footer` holds BOTH Home and Settings together, Home first (see
          // `footer`'s own doc comment further down). Used to be one
          // `buildNavItems(...)` array split across `items`/`footer`
          // (`homeNavItem` here, `settingsNavItem` there) — that was itself
          // mirroring an EARLIER shape of 2.0's own left nav, since
          // superseded there by this "both together in footer" arrangement.
          items={[]}
          open={navOpen}
          onToggle={() => setNavOpen((v) => !v)}
          overlay={isNavNarrow}
          // `itemsFirst` stays truthy solely to keep `stickyCaption` (below)
          // rendering at all — left-nav.tsx's own doc comment: "only
          // meaningful combined with itemsFirst, ... ignored when
          // itemsFirst is falsy" — even though `items` itself is now empty
          // (Home having moved to `footer`, below). The sticky-top box
          // `itemsFirst` creates now holds only the "Assignments" caption.
          itemsFirst
          // Lets `header` (the caption/cards region) grow to fill
          // whatever height Home+"New Outbound" don't use, so the
          // "Your assignment queue is empty" message can be vertically
          // centered in that leftover space instead of sitting flush
          // under the caption — see the centering wrapper around
          // `EmptyState` below, and `headerFillsHeight`'s own doc comment
          // in left-nav.tsx.
          headerFillsHeight
          // "Assignments (N)" caption — per explicit follow-up request
          // ("fix the assignments header under the home button so it
          // doesn't scroll"), mirrored from 2.0 (`AgentNextGenPage.tsx` —
          // see that file's own comment on this same prop for the fuller
          // writeup): rendered via `stickyCaption` now, the same sticky-top
          // box as `items` (Home), so it stays pinned with Home instead of
          // scrolling away with the cards under it.
          stickyCaption={
            <AssignmentsSectionCaption
              expanded={navOpen}
              count={interactions.length}
              sort={assignmentSort}
              onSortChange={setAssignmentSort}
              // Per explicit request — see `ADVANCED_ASSIGNMENT_SORT_
              // OPTIONS`'s own doc comment above.
              sortOptions={ADVANCED_ASSIGNMENT_SORT_OPTIONS}
              sortDirection={assignmentSortDirection}
              onSortDirectionChange={setAssignmentSortDirection}
              allExpanded={channelsAllExpanded}
              onToggleAllExpanded={handleToggleAllChannelsExpanded}
              // See `AssignmentsSectionCaption`'s own doc comment on
              // `compact` — see 2.0's own copy for the full reasoning.
              compact
            />
          }
          // Home + Settings — per explicit request ("move the home button
          // above the settings like in phase 1 left nav (match to phase
          // 1)"), both render together in `footer`, Home first, genuinely
          // pinned to the TRUE bottom of the nav (not just `sticky
          // bottom-0`, which only holds once the card list actually
          // overflows; a short list used to leave a Home-less Settings
          // sitting right after the cards with empty space below). `footer`
          // renders as a sibling AFTER the whole scrollable region entirely
          // — always at the aside's real bottom edge regardless of how much
          // content is above it. `NavRail` (exported from left-nav.tsx)
          // renders both `NavItem`s with the exact same TreeMenu/icon-only
          // styling `items` itself uses — mirrors `AgentNextGenPage.tsx`'s
          // own identical `footer` exactly.
          footer={
            // `expanded={navOpen}` passed explicitly, NOT left to
            // `injectExpanded` — `left-nav.tsx`'s INLINE (non-overlay)
            // mode renders `footer` as `{footer}` directly, with no
            // `injectExpanded` call at all (only the OVERLAY-mode branch
            // auto-injects `expanded`), so `NavRail` would otherwise be
            // stuck on its `expanded = false` default — always the
            // icon-only collapsed button, even with the nav wide open.
            // Same reason `AssignmentsSectionCaption`/`EmptyState` below
            // (in `header`) already take `expanded={navOpen}` explicitly.
            <NavRail
              expanded={navOpen}
              // Passed straight through as the full `buildNavItems(...)`
              // pair (Home first, then Settings) rather than destructuring
              // just one element out of it, now that both live here
              // together — same shape `AgentNextGenPage.tsx`'s own `footer`
              // already passes.
              items={buildNavItems(
                Boolean(activeInteraction),
                // Per explicit follow-up request, Home no longer resets
                // `showAllContacts`/`selectedAllContactsRecord` — see that
                // state's own doc comment for why "Home" now always resumes
                // whatever was showing there before the agent navigated
                // away (plain dashboard or All Contacts), instead of
                // forcing back to the plain dashboard every time.
                () => { switchActiveInteraction(null); setShowSettings(false); },
                showSettings,
                // Same follow-up — opening Settings no longer discards All
                // Contacts' own state either; it just takes visual priority
                // while showing (this ternary branch is checked first), and
                // All Contacts reappears exactly as left once Settings
                // closes.
                () => { setShowSettings(true); switchActiveInteraction(null); }
              )}
            />
          }
          // "New Outbound" itself has moved several times now: started as
          // this exact `pinnedHeader` (fixed at the very TOP of the whole
          // rail, above the "Assignments" caption); moved to a `beforeItems`
          // slot (left-nav.tsx) pinning it to the STICKY BOTTOM rail
          // alongside Home/Settings (reverted — reported "problematic");
          // moved again to a plain child of `header`, scrolling directly
          // below the caption (reverted per THIS request — "move new
          // outbound back above assignments header"). Landed back here,
          // exactly where it started. `beforeItems` (added to left-nav.tsx
          // for the middle arrangement) was already removed entirely once
          // nothing used it — not re-added for this reversion since
          // `pinnedHeader` covers this exact spot on its own.
          pinnedHeader={
            /* The shared New Outbound launcher (P0.5b.2). This page's scope
               and in-call rule are a temporary parity exception (rows
               14/15): Dial Pad only (no group picker, "New Outbound" header,
               no back button), and disabled while the agent is on a live
               call (`agentOnActiveVoiceCall` — not merely while a scripted
               AI call like Marcus's runs before Takeover).
               `handleDialpadSubmit` tells a completed redial apart from an
               ordinary dial. */
            <NewOutboundLauncher
              outboundConfig={outboundConfig}
              scope="dialpad"
              inCallPolicy="disable"
              onActiveCall={agentOnActiveVoiceCall}
              expanded={navOpen}
              onStartCall={handleStartCall}
              onQuickDial={handleDialpadSubmit}
              dialpadRequest={outboundDial.dialpadRequest}
              onDialpadRequestHandled={outboundDial.clearDialpadRequest}
            />
          }
          header={
            <>
              {/* Per explicit request ("add a message and icon into the left
                  nav when there are no assignments indicating that the
                  agent's assignment queue is empty") — only while expanded;
                  the icon-only collapsed rail has no room for text (matches
                  `AssignmentsSectionCaption`'s own "nothing to show" null
                  return in that state, just above).

                  Wrapped in a `flex-1 min-h-0 items-center justify-center`
                  container to vertically center it — this only has real
                  slack to center within because `header` itself now grows
                  to fill the rail's available height (`headerFillsHeight`
                  on `LeftNav`, above); without that, this wrapper's
                  `flex-1` would have nothing to consume and the message
                  would still sit flush under the caption. `EmptyState`'s
                  own `h-full`/`py-8` (meant for a bounded box) is still
                  overridden with `h-auto`/`py-6` — the centering comes
                  from THIS wrapper now, not from `EmptyState` trying to
                  size itself.

                  `animate-in fade-in-0 duration-150 delay-200
                  fill-mode-backwards` — per explicit follow-up ("text
                  growing/shrinking ... have it fade in"), mirrored from
                  AgentNextGenPage.tsx (see that file's own comment on this
                  same block for the full writeup): without it, this message
                  mounts the instant `navOpen` flips true while the `<aside>`
                  is still mid-`transition-all duration-200` on its own
                  width, so it visibly rewraps as the box widens. `delay-200`
                  waits out that same 200ms before the message starts
                  becoming visible; `duration-150 fill-mode-backwards` is the
                  fade-in itself, held at opacity 0 for the whole delay
                  (approximating the requested `display: none` → `display:
                  inline`, since `display` can't be transitioned/faded).
                  Close needs no equivalent — this block unmounts instantly
                  when `navOpen` goes false, before the aside starts
                  collapsing, so nothing is ever visible to reflow. */}
              {interactions.length === 0 && navOpen && (
                <div className="flex flex-1 min-h-0 items-center justify-center animate-in fade-in-0 duration-150 delay-200 fill-mode-backwards">
                  <EmptyState
                    icon={<Inbox className="h-8 w-8" strokeWidth={1.5} />}
                    message="Your assignment queue is empty"
                    description="New assignments will appear here."
                    className="h-auto w-full py-6"
                    // Per explicit follow-up, with a screenshot comparing
                    // this to Contact History's own "Nothing to Display"
                    // placeholder: `EmptyState`'s default `tone`
                    // (`text-lyra-fg-disabled`) read too dim/low-contrast
                    // next to it. `tone="secondary"` matches that
                    // placeholder's own `text-lyra-fg-secondary` exactly.
                    tone="secondary"
                  />
                </div>
              )}
              {/* No cards until the agent actually starts one above — each
                  card is one contact (or quick-dialed number), with every
                  channel they're being reached on folded into that same
                  card unless it's a different address on an already-open
                  type, which opens as its own row instead (see
                  handleStartCall's merge-by-type+address logic). Sorted per
                  `assignmentSort` (`AssignmentsSectionCaption`'s own sort
                  button) — `interactions` itself stays in insertion order
                  for everything else that reads it, only this rendering
                  reorders a copy.
                  Each card sits in its own `<ClockTick>`, so a tick
                  re-renders that card (its elapsed/hold/awaiting timers)
                  and not the page. The card body below keeps its old
                  indentation to keep this diff small. */}
              {sortAssignments(interactions, assignmentSort, assignmentSortDirection).map((interaction) => (
                <ClockTick key={interaction.id}>
                  {(clockTick) => {
                const mostRecentId = interaction.threads[interaction.threads.length - 1]?.id;
                // For the active card specifically, an open channel preview
                // (`channelPreviewThreadKey`) takes over which channel this
                // card highlights as "current" - `currentThreadId` itself
                // no longer changes when a channel's selected (see
                // `handleChannelSelect`'s own doc comment), so without this
                // the card's highlight would never move off whichever
                // channel happened to be current when it was added.
                const currentId =
                  interaction.id === activeInteractionId && channelPreviewThreadKey
                    ? channelPreviewThreadKey
                    : (interaction.currentThreadId ?? mostRecentId);
                // Seconds since the CUSTOMER last wrote on this channel —
                // only meaningful (and only ever read) for a channel that's
                // actually awaiting, which per `hasCustomerResponded` below
                // can't be true without `lastCustomerMessageTick` also being
                // set, so this never actually falls back to `startTick` in
                // practice — kept as `?? c.startTick` only to satisfy the
                // type (`lastCustomerMessageTick` is optional).
                const channelAwaitingWaitSeconds = (c: Thread) =>
                  clockTick - (c.lastCustomerMessageTick ?? c.startTick);
                // Per explicit request: none of this card's timers (this
                // per-channel `elapsed` below, and the compact-tile
                // `elapsed`/`earliestStart` further down) should start
                // counting until the CUSTOMER has actually said something on
                // that channel — an agent-initiated channel that's still
                // waiting on the customer's very first reply has nothing to
                // measure yet ("since it opened" was a misleading reading
                // there: it made a freshly-dialed outbound channel look like
                // it'd already been waiting on someone). Once the customer
                // has responded at least once, `lastCustomerMessageTick` is
                // set for good (see its own doc comment) and every one of
                // these readings resumes exactly as before.
                const hasCustomerResponded = (c: Thread) => c.lastCustomerMessageTick !== undefined;
                const channels: InteractionChannel[] = interaction.threads.map((c) => {
                  // Identifies this specific channel's own Outcome popover —
                  // `c.id ?? c.type` is the same fallback `InteractionChannel
                  // .id`'s own doc comment establishes for "no id supplied,
                  // type alone is unique enough on this card"; prefixing the
                  // interaction id keeps it unique across DIFFERENT cards
                  // too, since `outcomeDraftKey` is one shared piece of
                  // state for the whole left nav (only one popover open at
                  // a time), not scoped per-card.
                  const outcomeKey = `${interaction.id}:${c.id ?? c.type}`;
                  // Per explicit request: a channel that's been explicitly
                  // closed (via the status popover), OR the whole interaction
                  // this card represents (a reopened-from-history, read-only
                  // one — `interaction.closed`), stops counting toward SLA/
                  // awaiting-response entirely — same union of conditions the
                  // record-header `ChannelTab` call site's own `channelClosed`
                  // now applies (channel-row.tsx). There's no reply pending on
                  // something that's already been closed out, so it shouldn't
                  // keep escalating amber/red (or green) no matter how long
                  // it's sat since. Drives the READ-ONLY lockdown below
                  // (`removable`) — NOT the SLA timer directly (see
                  // `slaSuppressed` just below for that) — since "Resolved"
                  // needs to affect one without the other (next paragraph).
                  const isClosed = interaction.threadStatuses?.[c.id] === "Closed" || !!interaction.closed;
                  // Per explicit request/follow-up clarification: a brand-new
                  // AGENT-INITIATED OUTBOUND channel — this channel's OWN
                  // `c.startedFresh` (see `Thread.startedFresh`'s own doc
                  // comment for why per-Thread, not `interaction.startedFresh`),
                  // reused straight from the same signal `isFreshLaunch`/
                  // `copilotAvailable` already key off — hasn't earned
                  // Consult/Transfer, Outcome, or Unassign & Dismiss yet, so
                  // this card's kebab collapses to a plain close ("×") button
                  // just like a closed one (`removable` below).
                  // `!hasCustomerResponded(c)` matters too: the moment the
                  // customer actually replies, this is a real, live
                  // conversation like any other — same "still fresh vs.
                  // already has real activity" split `copilotAvailable`
                  // already draws — so the lockdown lifts automatically
                  // rather than persisting for the rest of the interaction's
                  // life just because it happened to start as an outbound
                  // dial. Never true for a customer-initiated thread
                  // (notification/table-row opens deliberately don't set
                  // `startedFresh` — see those call sites' own doc comments),
                  // matching the explicit "not outbound" clarification.
                  // Voice never reads as a draft here either — same
                  // exclusion/reasoning as `activeChannelIsNewOutboundThread`
                  // above (its own doc comment has the full "no per-message
                  // model for voice" explanation) — per explicit request.
                  const isNewOutboundThread = c.type !== "voice" && !!c.startedFresh && !hasCustomerResponded(c);
                  // Per explicit request: a "Resolved" channel ALSO stops
                  // counting toward SLA/awaiting-response — same treatment
                  // `isClosed` above already gets — WITHOUT closing the
                  // thread: `isClosed` alone (not this) still drives
                  // `removable`/the composer/kebab lockdown below, so a
                  // Resolved channel stays a completely normal, repliable,
                  // dismissable channel; only its timer/dot goes quiet, per
                  // explicit follow-up ("don't close the thread"). A
                  // channel can't be both interaction-`closed` (read-only)
                  // and still accepting a status change to "Resolved" at
                  // the same time in practice, so this simple OR is safe —
                  // it's not trying to distinguish those two cases.
                  const slaSuppressed = isClosed || interaction.threadStatuses?.[c.id] === "Resolved";
                  const effectiveAwaitingResponse = !slaSuppressed && (c.awaitingResponse ?? false);
                  return {
                    id: c.id,
                    type: c.type,
                    // Per `hasCustomerResponded`'s own doc comment above: no
                    // reading at all until the customer has said something on
                    // this channel at least once — an agent-initiated channel
                    // still waiting on a first reply has nothing to count yet.
                    // Per explicit follow-up, also blank once `slaSuppressed`
                    // (closed OR Resolved) — there's nothing left to time on
                    // a channel that's already closed out or wrapped up, so
                    // the timer disappears there too rather than freezing
                    // on/continuing to show "how long since this channel
                    // opened". Once neither of those applies: awaiting: "how
                    // long since the CUSTOMER last wrote" — the metric that
                    // actually matters for a digital SLA. Not awaiting: "how
                    // long since this channel opened" — still the useful
                    // reading once there's nothing pending (but the channel
                    // isn't closed/resolved either). See
                    // `lastCustomerMessageTick`'s own doc comment for why
                    // these two diverge after more than one exchange.
                    //
                    // Voice is a deliberate exception to the "not
                    // `hasCustomerResponded` ⇒ blank" rule above — per
                    // explicit request ("when a voice call starts - add a
                    // timer to the interactionNavItem"): a call has no
                    // "waiting on the customer's first reply" ambiguity the
                    // way an agent-initiated text channel does (there's no
                    // message model to wait on at all, same reasoning
                    // `isNewOutboundThread` above already carves voice out
                    // for), so it should just always show its own running
                    // "since it started" duration the instant it's dialed.
                    // Still blanked once `slaSuppressed` (closed/resolved)
                    // — same "nothing left to time" reasoning as every
                    // other channel type.
                    elapsed: slaSuppressed
                      ? ""
                      : c.type === "voice"
                      ? formatElapsedTime(clockTick - c.startTick)
                      : !hasCustomerResponded(c)
                      ? ""
                      : effectiveAwaitingResponse
                      ? formatElapsedTime(channelAwaitingWaitSeconds(c))
                      : formatElapsedTime(clockTick - c.startTick),
                    // Per explicit request ("when a call is placed on hold,
                    // add an on hold timer below the call timer in the call
                    // controls and in the interaction nav item") — a NEW
                    // line below `elapsed` above (`ChannelRowProps.
                    // onHoldElapsed`, channel-row.tsx — deliberately not
                    // `elapsedOverride`, which SWAPS that line instead; see
                    // that prop's own doc comment for why this request gets
                    // its own separate field), driven by the same
                    // `heldByAgent`/`heldSinceTick` pair the call controls
                    // bar's own `onHoldChange` handler sets above. Only
                    // meaningful for the live voice thread itself, so
                    // `c.heldSinceTick` (rather than any card-level state)
                    // is checked directly — every other channel/thread never
                    // has this field set at all.
                    onHoldElapsed:
                      c.heldByAgent && c.heldSinceTick !== undefined
                        ? formatElapsedTime(clockTick - c.heldSinceTick)
                        : undefined,
                    preview: c.preview,
                    current: c.id === currentId,
                    // See `effectiveAwaitingResponse` above — not read
                    // straight off `c.awaitingResponse` any more, since a
                    // closed channel should never render red/amber/green
                    // just because it happened to be awaiting right before
                    // it was closed.
                    awaitingResponse: effectiveAwaitingResponse,
                    // Amber-vs-red-vs-green escalation (see
                    // `getAwaitingSeverity`'s own doc comment) — `undefined`
                    // (not computed at all) when this channel isn't
                    // effectively awaiting (not awaiting at all, OR closed),
                    // so `ChannelRow`/`InteractionNavItem` (lyra-ui) fall
                    // back to their own "nothing pending" look rather than a
                    // stray severity value with no `awaitingResponse` to go
                    // with it.
                    awaitingSeverity: effectiveAwaitingResponse
                      ? getAwaitingSeverity(channelAwaitingWaitSeconds(c))
                      : undefined,
                    // Closed (either the whole reopened-from-history
                    // interaction, or just this one channel via the status
                    // popover — same `isClosed` above) is read-only — no
                    // kebab, so there's no way to Unassign & Dismiss/Consult/
                    // Transfer/change Outcome on a conversation that's
                    // already over. `ChannelRow` (lyra-ui) replaces the
                    // kebab with a real close ("×") button in that case
                    // instead of just hiding it — see `removable`'s own doc
                    // comment on `InteractionChannel` for that wiring.
                    // Same collapsed/close-only treatment for a brand-new
                    // outbound thread (`isNewOutboundThread`, above) — per
                    // explicit request, it hasn't earned a working kebab
                    // yet either.
                    removable: isClosed || isNewOutboundThread ? false : undefined,
                    // Per explicit follow-up request: the `removable={false}`
                    // fallback above reads as a red trash icon/"Delete Draft"
                    // for a genuine, never-launched draft thread specifically
                    // (`isNewOutboundThread`), NOT for an already-closed
                    // channel/interaction — those still get the plain
                    // neutral "×"/"Close" treatment (`ChannelRow`'s own
                    // `removeVariant` default). See `InteractionChannel.
                    // removeVariant`'s own doc comment, channel-row.tsx.
                    removeVariant: isNewOutboundThread ? "delete-draft" : "close",
                    // Per explicit request ("update the voice assignment
                    // tiles to only display the end call and outcome
                    // buttons and then show the dismiss button when the
                    // call is ended (mirror phase 1 but not the hold state
                    // yet)") — `showKebab` stays scoped to voice only, unlike
                    // `AgentNextGenPage.tsx`'s own identical values (which
                    // it applies to every channel type; see that file's own
                    // doc comments on these same four props for the fuller
                    // "why" each one exists). `undefined` for every other
                    // type falls back to `ChannelRow`'s own default
                    // (`showKebab` true, `showDismissButton` false — and,
                    // per a later explicit follow-up request ("always
                    // display the outcome button in the interactionNavItems
                    // - no longer have them display on hover only... this
                    // can be a component level update"), `alwaysShowOutcome`
                    // now ALSO true, `ChannelRow`'s own default having been
                    // flipped for every consumer — see that prop's own doc
                    // comment, channel-row.tsx). While the
                    // call is live (`removable` above still `undefined`,
                    // i.e. `showMenu` true): no Consult/Transfer, no kebab,
                    // Outcome permanently visible (not hover-only), plus a
                    // standalone always-visible "Unassign & Dismiss" —
                    // together the only two actions on the tile. Once the
                    // call ends (`isClosed` above flips `removable` to
                    // `false`, i.e. `showMenu` false), `ChannelRow` replaces
                    // this whole cluster with its own single plain "×"
                    // Close/Dismiss button regardless of these four props —
                    // same shared fallback Phase 1 gets, nothing extra
                    // needed here for that transition. Deliberately NOT
                    // porting Phase 1's `onHold`/`findLiveVoiceThread`/
                    // `OnHoldPill` hold-state visuals — per this request,
                    // "not the hold state yet".
                    //
                    // `showConsultTransfer` — per a later explicit
                    // follow-up request ("in the interactionNavItem move
                    // consult/transfer into the 3 dots more menu like you
                    // did in the interaction itself"), now unconditionally
                    // `false` for every channel type (previously only for
                    // voice, with non-voice falling back to `ChannelRow`'s
                    // default `true` — leaving the standalone icon visible
                    // for SMS/digital channels, which is what the request
                    // was about). The standalone button hiding doesn't lose
                    // the action: `ChannelRow`'s own
                    // `stripPromotedChannelRowActions` (channel-row.tsx)
                    // folds "Consult / Transfer" into its kebab instead
                    // whenever `showConsultTransfer` is `false`, so this one
                    // flag both hides the icon and surfaces the item in the
                    // menu for every channel type — voice already got this
                    // for free (its kebab is hidden entirely via `showKebab`
                    // above, so Consult/Transfer was already absent there
                    // rather than double-exposed).
                    //
                    // `showDismissButton` — per a later explicit follow-up
                    // ("also remove the unassign and dismiss icon button
                    // while the call is on"), Unassign & Dismiss is now
                    // hidden while the call is still live and only appears
                    // once the agent has hung up (`voiceCallEnded` true) —
                    // mirroring `AgentNextGenPage.tsx`'s own identical
                    // formula exactly. Outcome (above) stays visible the
                    // whole time regardless, per the original request.
                    showConsultTransfer: false,
                    // Per explicit follow-up request ("always have the more
                    // options available in the interactionNavItem") — the
                    // kebab was made unconditional for every row for a
                    // while, superseding an earlier Marcus-only exception
                    // to a "hide kebab for every voice channel" rule (a
                    // reopened Contact History voice assignment, e.g.
                    // Nathan Cole, used to have no kebab at all — that's
                    // the bug report that fixed). Reversed by a LATER
                    // explicit request ("remove the more options for phase
                    // 1 - these will not be available until phase 2"):
                    // `false` hides it outright for every row/channel type
                    // here again — there's currently nothing behind it this
                    // page actually wants exposed yet (Consult/Transfer is
                    // hidden too, `showConsultTransfer: false` just above,
                    // and "Unassign & Dismiss" is stripped from every kebab
                    // dropdown regardless — see that prop's own doc comment
                    // right below), so an always-present kebab was just a
                    // dead-end trigger. `AgentWorkspace2WithDeskPage.tsx`
                    // ("Phase 2") keeps its own identical prop wired
                    // however it already had it — this change is scoped to
                    // this page's own channel-row mapping only.
                    showKebab: false,
                    alwaysShowOutcome: c.type === "voice" ? true : undefined,
                    // "Unassign & Dismiss" is stripped from every row's
                    // kebab dropdown outright (`ChannelRow`'s own
                    // `stripPromotedChannelRowActions`, channel-row.tsx), so
                    // the standalone icon is this action's only path from
                    // the left nav now — unconditional for every non-voice
                    // channel (chat/email/sms/etc. can be dismissed any
                    // time), but per explicit follow-up request ("calls
                    // cannot be dismissed until they are ended"), still
                    // gated for voice on `interaction.closed`/
                    // `voiceCallEnded` for every voice channel EXCEPT
                    // Marcus. Per a later, explicit follow-up request
                    // ("once the action is taken by the agent in the marcus
                    // webb contact then add the dismiss and unassign icon
                    // so the agent can remove it from their assignments"),
                    // Marcus's own tile is a deliberate, scoped exception to
                    // that general rule — once his one channel reads
                    // "Resolved" (`handleMarcusWebbResolved`, fired by both
                    // the Approve path AND the reject-then-remedy path's
                    // `onRemedyIssued`), the agent can dismiss the
                    // assignment without first hanging up the call. Every
                    // OTHER voice channel still needs `closed`/
                    // `voiceCallEnded` — this isn't a reversal of the
                    // general rule, just a named carve-out for this one
                    // scripted scenario.
                    // Per explicit follow-up request: once a voice call has
                    // ended, "Save & Dismiss" in the Outcome popover below
                    // replaces this standalone icon entirely (rather than
                    // both being shown) — so the "show once
                    // closed/voiceCallEnded" half of this condition is
                    // dropped; the Marcus Webb pre-hangup exception (a
                    // distinct, unrelated carve-out — see doc comment
                    // above) is preserved unchanged.
                    showDismissButton:
                      c.type === "voice"
                        ? !interaction.closed &&
                          !interaction.voiceCallEnded &&
                          interaction.id === MARCUS_WEBB_ID &&
                          interaction.threadStatuses?.[c.id] === "Resolved"
                        : // Lucas's AI-led chat can't be unassigned/dismissed by hand: its wrap-up closes it.
                          interaction.id !== LUCAS_THOMAS_ID || interaction.threadStatuses?.[c.id] === "Closed" || !lucasThomasReviewing,
                    // Locks the kebab and Outcome — visibly present but
                    // non-interactive — for as long as the agent is only
                    // reviewing Marcus's still-live AI-agent call
                    // (`marcusWebbReviewing`), same "hasn't taken over yet"
                    // gate `onEndCall` used to use below. Scoped to Marcus
                    // only; every other channel's cluster is unaffected
                    // (`undefined`). Deliberately doesn't cover the standalone
                    // Dismiss icon above — dismissing was never part of this
                    // lock, on either this left-nav copy or the transcript
                    // header's own identical `controlsReadOnly` idea.
                    controlsDisabled:
                      interaction.id === MARCUS_WEBB_ID
                        ? marcusWebbReviewing
                        : // Outcome (and the kebab) stay locked on Lucas until the agent takes over.
                        interaction.id === LUCAS_THOMAS_ID
                        ? lucasThomasReviewing
                        : // Outcome stays locked on an incoming call until it is accepted.
                        interaction.id === TOM_LEWIS_CALL_ID
                        ? tomLewisCallRinging
                        : undefined,
                    // Per explicit follow-up request ("remove the ability to
                    // hang up from the interactionNavItem overall") — "hide,
                    // don't destroy," same pattern as
                    // `HIDDEN_OUTBOUND_GROUP_IDS`/
                    // `MARCUS_WEBB_AUTO_DISMISS_ON_CLOSE`/
                    // `SHOW_APPROVE_PROCESSING_STEPS` elsewhere in this file:
                    // `SHOW_END_CALL_IN_INTERACTION_NAV_ROWS` (defined near
                    // those other flags) gates the whole computed handler
                    // below off, rather than deleting it — the real, still
                    // fully-working way to hang up a live call is the main
                    // call-controls bar's own "End Call" button
                    // (`VoiceCallControls`'s `onHangUp`, which independently
                    // sets this exact same `voiceCallEnded` flag), so this
                    // was always a redundant second entry point rather than
                    // the only one.
                    onEndCall:
                      SHOW_END_CALL_IN_INTERACTION_NAV_ROWS &&
                      c.type === "voice" &&
                      !interaction.closed &&
                      !interaction.voiceCallEnded &&
                      !(interaction.id === MARCUS_WEBB_ID && marcusWebbReviewing)
                        ? () => {
                            // A provider call ends through `end()` (to
                            // wrap-up); a scripted scenario call locally.
                            if (!contactCommands.hangUp(c)) {
                              setInteractions((prev) =>
                                prev.map((i) =>
                                  i.id === interaction.id ? { ...i, voiceCallEnded: true } : i
                                )
                              );
                            }
                            if (interaction.id === activeInteractionId) {
                              setVoiceVideoWindowOpen(false);
                              setVoiceVideoFullScreen(false);
                            }
                          }
                        : undefined,
                    // Forwarded straight from `Thread.direction` — drives
                    // `VoiceDirectionIcon`/`SmsDirectionIcon` at this row's
                    // own channel icon (lyra-ui, channel-row.tsx). Per
                    // explicit request ("update the voice directions to
                    // indicate inbound or outbound like in Phase 1") — see
                    // `AgentNextGenPage.tsx`'s own identical assignment.
                    direction: c.direction,
                    // Wires "Outcome" to a real popover (see
                    // `ChannelOutcomeConfig`'s own doc comment,
                    // channel-row.tsx) — harmless to always pass even on a
                    // closed/read-only card, since `showMenu={removable !==
                    // false}` already hides the whole button (and this along
                    // with it) there.
                    outcome: {
                      open: outcomeDraftKey === outcomeKey && outcomeDraftSource === "leftnav",
                      onOpenChange: (open: boolean) => handleOutcomeOpenChange(outcomeKey, open, "leftnav"),
                      // Same options list AND same underlying value as the
                      // session-status pill's own dropdown
                      // (`TranscriptSessionSeparator`, fed by THIS channel's
                      // own `interaction.channelStatuses[c.id]`/
                      // `handleInteractionStatusChange` — rule #29) — not a
                      // separate `outcomeDraft` field like Tags/Disposition/
                      // Summary, so changing status from either surface
                      // changes it in both, per explicit request, WITHOUT
                      // touching any sibling channel's own status (see
                      // `Interaction.channelStatuses`'s own doc
                      // comment). Fallback here is `"Open"`, not
                      // `"Resolved"` — a channel with no status set yet is
                      // a genuinely untouched/fresh thread, not one that's
                      // already wrapped up (bug fix; this used to read
                      // `?? "Resolved"`, matching `buildDismissedContact-
                      // HistoryEntry`'s own fallback for this same field —
                      // that one intentionally still uses `"Resolved"`,
                      // since it only ever runs at dismiss time for an
                      // already-concluded historical entry, so the two no
                      // longer need to match).
                      resolutionOptions: TRANSCRIPT_SESSION_STATUS_OPTIONS,
                      resolution: interaction.threadStatuses?.[c.id] ?? "Open",
                      onResolutionChange: (value: string) =>
                        handleInteractionStatusChange(interaction.id, c.id, value),
                      // Voice has no real Open/Pending/Resolved/Closed
                      // disposition to log — hide the Status field in the
                      // Log Outcome popover for voice channels.
                      voice: c.type === "voice",
                      tagOptions: OUTCOME_TAG_OPTIONS,
                      selectedTags: outcomeDraft.tags,
                      onTagsChange: handleOutcomeTagsChange,
                      dispositionOptions: OUTCOME_DISPOSITION_OPTIONS,
                      dispositionCode: outcomeDraft.dispositionCode,
                      onDispositionChange: handleOutcomeDispositionChange,
                      summary: outcomeDraft.summary,
                      onSummaryChange: (value: string) => setOutcomeDraft((d) => ({ ...d, summary: value })),
                      onSave: handleOutcomeSave,
                      onCancel: handleOutcomeCancel,
                      // Per explicit request: once this voice channel's call
                      // has ended, the footer becomes "Save & Redial"/
                      // "Save & Dismiss" instead — see `ChannelOutcomeConfig`'s
                      // own doc comment (outcome-panel.tsx). `anchorEl` here
                      // is the Outcome trigger's OWN DOM node (threaded
                      // through by `buildOutcomePopoverSlots`'s `triggerRef`
                      // param, channel-row.tsx) — anchors the resulting
                      // "Redial Contact" popover right on this row's own
                      // Outcome button, same as Contact History's own Redial
                      // button anchors its identical popover on itself.
                      callEnded: c.type === "voice" && !!(interaction.closed || interaction.voiceCallEnded),
                      onSaveAndRedial: (anchorEl) =>
                        handleOutcomeSaveAndRedial(
                          interaction.id,
                          c.value ?? c.addressLabel ?? synthesizeChannelAddress("voice", interaction.customerId ?? interaction.id, interaction.customerName),
                          anchorEl
                        ),
                      onSaveAndDismiss: () => handleOutcomeSaveAndDismiss(interaction.id),
                    } satisfies ChannelOutcomeConfig,
                    // A live call stays blue-highlighted alongside the open chat (Lucas: John on the call).
                    alwaysHighlighted: interaction.id === LUCAS_THOMAS_ID && c.type === "voice" && !interaction.voiceCallEnded && !interaction.closed,
                  };
                });
                // Closed OR Resolved channels drop out of every card-level
                // SLA/timer computation below — per explicit request, once a
                // channel is closed OR resolved it should stop counting
                // toward the card's own dot/color/timer entirely, not just
                // stop escalating (Resolved doesn't touch anything else —
                // the card stays a normal, open, dismissable card; see
                // `slaSuppressed`'s own doc comment above for the same split
                // at the per-channel level). A card whose only channel(s)
                // are all closed/resolved ends up with an empty
                // `cardOpenChannels`, which is exactly what makes
                // `earliestStart` (and so `elapsed`, at the render call site
                // below) `undefined` — the counter itself disappears rather
                // than falling back to "time since it was opened," same as
                // the dot disappearing once `awaitingSeverity` has nothing
                // left to compute from. (Despite the name, "open" here means
                // "still counts toward the SLA timer," not "not closed" —
                // this is a timer-only list, not the read-only-lockdown one.)
                //
                // Marcus's own voice channel is a deliberate, scoped
                // exception to the "Resolved drops out" half of this rule —
                // per explicit follow-up request ("the timer should be
                // visible in the marcus webb collapsed interactionNavItem").
                // `handleMarcusWebbResolved` (above) flips his channel's
                // session status to "Resolved" the moment the agent
                // approves the refund, but the CALL ITSELF is still live at
                // that point (same "resolved disposition, still-connected
                // call" gap `showDismissButton`'s own doc comment already
                // documents for this exact channel) — the collapsed tile's
                // timer disappearing right as the agent approves would read
                // as the call having ended, when it hasn't. Gated on
                // `!interaction.voiceCallEnded` so this exception itself
                // switches off, same as every other card, the moment the
                // call actually does end.
                const cardOpenChannels = interaction.threads.filter(
                  (c) =>
                    (interaction.id === MARCUS_WEBB_ID && c.type === "voice" && !interaction.voiceCallEnded) ||
                    (interaction.threadStatuses?.[c.id] !== "Closed" &&
                      interaction.threadStatuses?.[c.id] !== "Resolved")
                );
                // Per explicit request: an open channel that's never actually
                // heard from the customer yet (`hasCustomerResponded` above)
                // doesn't count toward "since it opened" either — an
                // agent-initiated channel still waiting on a first reply has
                // nothing to time, same reasoning as the per-channel
                // `elapsed` above. A card whose only open channel(s) are all
                // still waiting on that first reply ends up with an empty
                // `respondedOpenChannels`, which is what makes `earliestStart`
                // (and so `elapsed`, at the render call site below)
                // `undefined` — the counter disappears rather than starting
                // to tick the moment the channel was created. Voice channels
                // are exempt from the `hasCustomerResponded` check here too
                // — same reasoning as the per-channel `elapsed` above (a
                // call always has something to time, "waiting on a first
                // reply" doesn't apply to it) — so a voice-only card still
                // gets a running compact-tile timer the instant it's dialed.
                const respondedOpenChannels = cardOpenChannels.filter(
                  (c) => c.type === "voice" || hasCustomerResponded(c)
                );
                const earliestStart =
                  respondedOpenChannels.length > 0
                    ? Math.min(...respondedOpenChannels.map((c) => c.startTick))
                    : undefined;
                // Card-level awaiting wait: the WORST (longest) of this
                // card's own awaiting, still-OPEN channels — not the
                // earliest-opened channel's own elapsed time — a card with
                // one fresh channel and one long-overdue one should read as
                // overdue, not average out to something in between.
                // `undefined` when nothing still-open on this card is
                // awaiting at all, so the card falls back to
                // `earliestStart`'s plain "since it opened" reading below
                // (itself `undefined`, and so blank, once every channel is
                // closed) — same as before this feature existed.
                const cardAwaitingChannels = cardOpenChannels.filter((c) => c.awaitingResponse);
                const cardAwaitingWaitSeconds =
                  cardAwaitingChannels.length > 0
                    ? Math.max(...cardAwaitingChannels.map(channelAwaitingWaitSeconds))
                    : undefined;
                // PROTOTYPE (CollapsedChannelBadge, local-only): the same
                // channel this card's `currentChannelKey` prop below already
                // resolves to — falls back to the most-recent channel when
                // nothing's explicitly current yet, same fallback `currentId`
                // itself uses. Only actually rendered by `InteractionNavCard`
                // itself once collapsed — see that component's own doc
                // comment (above `AgentNextGenPage`) for why this whole card
                // is built through it now, rather than this `.map()`
                // returning two structurally different shapes depending on
                // `navOpen` the way it originally did.
                const currentChannelType =
                  channels.find((c) => c.id === currentId)?.type ?? channels[channels.length - 1]?.type;
                // Same `heldByAgent` field the expanded card's own
                // `onHoldElapsed` line above already reads directly off
                // Per bug report ("when an unknown customer is dialed,
                // the collapsed interactionNavItem should display a user
                // icon - this was fixed a while ago not sure why it's
                // back"): the collapsed tile's own `customerIdentified`
                // (below, at this card's `InteractionNavCard`) used to
                // check only `!interaction.id.startsWith("adhoc:")` — but
                // a fresh quick-dial to an unmatched number gets a
                // `quickdial:`-prefixed id (`handleStartCall`, above), and
                // a redial with no real contact gets `redial:` (`handleRedial`,
                // above), neither of which is `adhoc:` — so both silently
                // read as "identified" and showed meaningless
                // phone-number-derived initials instead of the generic
                // `User` fallback. Same general, precise "is this a real
                // customer" signal `activeInteractionIsRealCustomer`
                // (above) already established for the record header/etc.,
                // just re-derived per-card here since this loop iterates
                // every interaction, not only the active one.
                const cardIsRealCustomer =
                  CREATE_NEW_CUSTOMERS.some((c) => c.id === interaction.entityId) ||
                  createdCustomerRecords.some((c) => c.id === interaction.entityId) ||
                  !!interaction.entityId?.startsWith("history:") ||
                  interaction.id === LUCAS_THOMAS_ID;
                // `interaction.threads` — re-derived here (not from
                // `cardOpenChannels`, which a closed/resolved held call
                // would already have dropped out of) since a collapsed
                // card's badge should keep showing "on hold" for as long as
                // the live call controls bar itself would.
                const cardOnHold = interaction.threads.some((c) => c.type === "voice" && c.heldByAgent);
                // Per explicit follow-up request ("when a call is put on
                // hold use the hold time in the collapsed
                // interactionNavItem") — the same `c.heldSinceTick` the
                // expanded card's own `onHoldElapsed` line reads (above),
                // re-derived here for whichever thread `cardOnHold` just
                // found. `undefined` whenever nothing's actually held,
                // which is exactly when the plain `elapsed` computation
                // below should be used instead (see that prop's own call
                // site further down).
                const cardHeldSinceTick = interaction.threads.find(
                  (c) => c.type === "voice" && c.heldByAgent
                )?.heldSinceTick;
                return (
                  <InteractionNavCard
                    leaving={interaction.id === TOM_LEWIS_CALL_ID && tomLewisCallLeaving}
                    // While the call is unanswered and the nav is collapsed, show the hover preview automatically.
                    forceHoverOpen={interaction.id === TOM_LEWIS_CALL_ID && tomLewisCallRinging && !tomLewisCallLeaving}
                    key={interaction.id}
                    currentChannelType={currentChannelType}
                    showChannelBadge={channels.length <= 1}
                    cardOnHold={cardOnHold}
                    cardHoldSeverity={cardHeldSinceTick !== undefined ? getHoldSeverity(clockTick - cardHeldSinceTick) : undefined}
                    // `InteractionNavItem`'s OWN `onHold` prop (lyra-ui) —
                    // distinct from `cardOnHold` just above (this file's
                    // own wrapper prop, forwarded only to
                    // `CollapsedChannelBadge`). Flows through `itemProps`
                    // to `InteractionNavItem` itself, which per explicit
                    // follow-up request ("make the hold counter red in the
                    // collapsed interactionNavItem") now also recolors the
                    // collapsed tile's own elapsed-time text red while
                    // true — see that prop's own doc comment
                    // (interaction-nav-item.tsx) — on top of the
                    // border/background treatment it already drove on the
                    // EXPANDED card.
                    onHold={cardOnHold}
                    // Same `cardAwaitingWaitSeconds`/`getAwaitingSeverity`
                    // this card's own `awaitingSeverity` prop below already
                    // resolves — reused, not recomputed, so a single-channel
                    // card's collapsed badge escalates in lockstep with
                    // everything else reading this card's severity (the
                    // avatar/border, the elapsed timer, the corner dot).
                    badgeSeverity={cardAwaitingWaitSeconds !== undefined ? getAwaitingSeverity(cardAwaitingWaitSeconds) : undefined}
                    customerName={interaction.customerName}
                    // `cardIsRealCustomer` (just above, in this same
                    // `.map()`) — was a narrow `!id.startsWith("adhoc:")`
                    // check that missed the `quickdial:`/`redial:`
                    // synthetic-id cases (see that const's own doc
                    // comment for the bug this fixes). Tells the compact
                    // tile to show a generic `User` icon in its avatar
                    // instead of deriving meaningless initials off a raw
                    // dialed number — `customerName` itself is untouched,
                    // so the card's title text still reads as the address.
                    customerIdentified={cardIsRealCustomer}
                    // Per explicit request ("add the new badge to any
                    // unread assignments (assignments that haven't been
                    // clicked on yet)") — see `useNewAssignments` for what
                    // counts as "clicked".
                    isNewAssignment={isNewAssignment(interaction.id)}
                    active={activeInteractionId === interaction.id}
                    // Exits fullscreen directly here (not just via the
                    // `activeInteractionId`-keyed effect near
                    // `panelFullScreen`'s own declaration) because clicking
                    // the ALREADY-active card sets the same id — no value
                    // change, so that effect wouldn't fire, and the click
                    // would otherwise silently do nothing while the shared
                    // panel is covering the content the agent just clicked
                    // to see. Harmless/redundant on a real switch, where
                    // the effect would already handle it.
                    onClick={() => {
                      switchActiveInteraction(interaction.id);
                      setPanelFullScreen(false);
                    }}
                    awaitingResponse={cardAwaitingChannels.length > 0}
                    awaitingSeverity={cardAwaitingWaitSeconds !== undefined ? getAwaitingSeverity(cardAwaitingWaitSeconds) : undefined}
                    // "" (not a fallback duration) once every channel on
                    // this card is closed — see `cardOpenChannels`'s own doc
                    // comment above for why `earliestStart` is `undefined`
                    // in that case. `InteractionNavItem` (lyra-ui) skips
                    // rendering the elapsed span entirely for an empty
                    // string, so the counter itself disappears rather than
                    // showing a stale/frozen time.
                    // While on hold, the collapsed tile's own timer
                    // switches to counting the HOLD time (same reasoning
                    // as `cardHeldSinceTick`'s own doc comment above) —
                    // matching what the docked call-controls footer
                    // already shows ("On hold 00:04") instead of the
                    // total call duration the plain `elapsed` computation
                    // below would otherwise keep showing. Falls back to
                    // that plain computation whenever nothing's held
                    // (`cardHeldSinceTick === undefined`), exactly as
                    // before this feature existed.
                    elapsed={
                      cardHeldSinceTick !== undefined
                        ? formatElapsedTime(clockTick - cardHeldSinceTick)
                        : earliestStart !== undefined
                        ? formatElapsedTime(cardAwaitingWaitSeconds ?? clockTick - earliestStart)
                        : ""
                    }
                    expanded={navOpen}
                    channels={channels}
                    onDismiss={() => handleDismissInteraction(interaction.id)}
                    onDismissChannel={(channel) => handleDismissChannel(interaction.id, channel)}
                    // Per a later explicit follow-up request ("I want the
                    // '+' to also be in the interactionNavItem"):
                    // `getHeaderAction` alone returns `null` for any
                    // interaction with no matching contact in
                    // `contactsById` (its own doc comment) — falls back to
                    // the same directory-independent `AddChannelAdHocButton`
                    // the record header's own `titleSuffix` uses, but ONLY
                    // for whichever card is the currently active
                    // interaction: `handleAddAdHocChannel` (like the record
                    // header's own call) is only ever wired to
                    // `activeInteraction`, so a non-active card's "+" still
                    // only shows when `getHeaderAction` itself resolves a
                    // real contact for it. `className` shrinks the ad-hoc
                    // trigger's own default solid-primary "icon-md" look
                    // down to match `getHeaderAction`'s plain ghost
                    // `h-6 w-6` "+" exactly, so the two read as the
                    // identical control regardless of which one happens to
                    // render for a given card.
                    footerAction={
                      interaction.id === TOM_LEWIS_CALL_ID && tomLewisCallRinging ? (
                        <div className="flex flex-row-reverse gap-2">
                          <Button
                            variant="default"
                            size="md"
                            className="flex-1"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleAcceptTomLewisCall();
                            }}
                          >
                            <Phone className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                            Accept
                          </Button>
                          <Button
                            variant="destructive"
                            size="md"
                            className="flex-1"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleDeclineTomLewisCall();
                            }}
                          >
                            <PhoneOff className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                            Decline
                          </Button>
                        </div>
                      ) : undefined
                    }
                    headerAction={
                      SHOW_ADD_CHANNEL_HEADER_BUTTONS &&
                      ((interaction.entityId ? getHeaderAction(interaction.entityId) : null) ??
                        (SHOW_ADD_CHANNEL_HEADER_BUTTON &&
                          interaction.id === activeInteractionId && (
                            <AddChannelAdHocButton
                              onLaunch={handleAddAdHocChannel}
                              skillOptions={OUTBOUND_CONFIG.skillOptions}
                              className="h-6 w-6 px-0 bg-transparent text-lyra-fg-secondary hover:bg-lyra-state-hover active:bg-lyra-state-pressed"
                            />
                          )))
                    }
                    // Renders side by side with `collapsible`'s own
                    // expand/collapse chevron, rather than being replaced
                    // by it — see `InteractionNavItem`'s own `collapsible`
                    // doc comment (interaction-nav-item.tsx) for the shared
                    // slot's current behavior.
                    collapsible
                    // "Collapse all"/"Expand all" (`AssignmentsExpandCollapseAllButton`
                    // above) — see `channelsAllExpanded`'s own doc comment
                    // near its declaration for why this is a one-shot
                    // `{ expanded, version }` override object rather than a
                    // plain controlled boolean.
                    channelsExpandedOverride={{
                      expanded: channelsAllExpanded,
                      version: channelsExpandedOverrideVersion,
                    }}
                    // Mirrors this card's own expanded state up into
                    // `channelsExpandedById` — see that state's own doc
                    // comment for why (catching up
                    // `AssignmentsExpandCollapseAllButton`'s own label once
                    // every card happens to agree by hand).
                    onChannelsExpandedChange={(expanded) =>
                      setChannelsExpandedById((prev) =>
                        prev[interaction.id] === expanded ? prev : { ...prev, [interaction.id]: expanded }
                      )
                    }
                    // Kept in sync with the ChannelToggle bar in this
                    // interaction's record-header PageHeader — see
                    // Interaction.currentChannelId's own doc comment.
                    currentChannelKey={currentId}
                    onCurrentChannelChange={(key) => handleChannelSelect(interaction.id, key)}
                  />
                );
              }}
                </ClockTick>
              ))}
            </>
          }
        />

        {/* Content area — flex-1 shrinks to give space to docked panels,
            down to `INTERACTION_MAIN_CONTENT_MIN_WIDTH` (350px) — below
            that, the docked shared panel's own render width clamps down
            instead (see `dockedPanelRenderWidth`'s own doc comment,
            further down) so THIS floor never has to fight it for space and
            push the whole row past the viewport. ref used to position
            float panels.

            `flex-col` (was a plain `flex` row — `Container` used to be its
            only normal-flow child, so row-vs-column made no visible
            difference) — per later explicit follow-up request ("move the
            call controls below the main container..."), the persistent
            voice call-controls bar now renders as `Container`'s own
            sibling right below it (see that render site's own doc comment
            further down), so this box needs to actually stack them
            vertically now instead of sitting them side by side. The
            floated/full-screen shared-panel overlays further down are
            `position: fixed`/`absolute` either way — out of normal flow,
            so this direction change doesn't move either of them. */}
        <div ref={containerRef} className="relative flex flex-col flex-1 min-w-[374px] overflow-hidden pr-3 pb-3">

          {/* Main Container — flex column so `isCombinedPanelMode`'s tab row
              can stack above the content instead of sitting beside it. The
              Customer Information `SidePanel` docks left of that entire
              column (tab row included) via the nested flex-row wrapper just
              inside — same "panel beside column" shape as
              `AgentNextGenTemplate.stories.tsx`'s reference layout, just
              with `isCombinedPanelMode`'s own stacking preserved unchanged
              one level in. */}
          <Container className="flex flex-col flex-1 overflow-hidden relative">

            {/* Row: Customer Information panel (left) + everything else
                (tab row + content column, stacked). Not flattened into
                Container itself since `isCombinedPanelMode`'s tab row must
                stay OUTSIDE the panel's reach — only the column to its
                right stacks vertically. */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

                {/* Below 768px with a docked panel open: a second region
                    (`PANEL_KEY_METADATA[activePanelKey].label`, e.g. "Notifications") sits
                    alongside this main region, and this whole container
                    becomes the shared surface both toggle inside of instead
                    of the panel docking beside it. Per explicit follow-up
                    request ("use toggle buttons instead of tabs for the
                    combined panels"): switched from the `TabList`/`Tab`
                    composition (still used everywhere else in this file,
                    e.g. the Dashboard's own tab row below) to `ToggleGroup`
                    — a two-item single-select segmented control reads more
                    like "which surface is showing" (a view switch) than
                    "which sub-page am I on" (what tabs usually mean), and
                    it visually sets this switch apart from the record
                    header's OWN channel `TabList` that can render directly
                    underneath it once `narrowActiveRegion === "main"`
                    lands on an active interaction — two adjacent real tab
                    rows would have read as one continuous 3+-tab strip. */}
                {isCombinedPanelMode && (
                  <div className="bg-lyra-bg-surface-base p-2 shrink-0 border-b border-lyra-border-subtle">
                    <ToggleGroup
                      fullWidth
                      items={[
                        { value: "main", label: mainRegionTabLabel },
                        { value: "panel", label: activePanelKey ? PANEL_KEY_METADATA[activePanelKey].label : "" },
                      ]}
                      value={narrowActiveRegion}
                      // `ToggleGroup`'s single-select mode deselects on
                      // re-click of the already-active item (empty string)
                      // — this switch should always have exactly one side
                      // active, so an empty next value is ignored rather
                      // than passed through (same guard lyra-ui schedule-panel's
                      // own Day/Week `ToggleGroup` already uses).
                      onValueChange={(next) => {
                        if (next === "main" || next === "panel") setNarrowActiveRegion(next);
                      }}
                    />
                  </div>
                )}

                {/* Content column: PageHeader + page body */}
                <div
                  className={cn(
                    "flex flex-1 flex-col min-w-0 overflow-hidden",
                    isCombinedPanelMode && narrowActiveRegion !== "main" && "hidden"
                  )}
                >
              {showSettings ? (
                // ── Settings — a blank page for now (real settings content
                // isn't built yet), same "just the header, blank body below"
                // placeholder pattern the interaction record view below
                // uses. Takes priority over both Desk and an active
                // interaction — see the `showSettings` state's own doc
                // comment for how the three views stay mutually exclusive.
                // `key="settings"` (here and on the other two branches
                // below) forces a fresh mount every time the agent switches
                // between Settings/an interaction/the Desk dashboard, which
                // is what makes `animate-in fade-in-0` actually replay on
                // every switch — without a distinct key, React just patches
                // the existing tree in place (same position, same type where
                // it happens to coincide) and the "enter" animation only
                // fires once, on this whole page's very first mount. Plain
                // `div` instead of the bare `<>...</>` these three branches
                // used to be — a Fragment contributes no box of its own for
                // an animation/opacity class to apply to; classes here match
                // the parent "Content column" div's own
                // `flex flex-1 flex-col min-w-0 overflow-hidden` exactly, so
                // this extra nesting level is layout-inert.
                <div key="settings" className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200">
                  {showPageHeader && <PageHeader title="Settings" />}
                  <div className="flex-1 overflow-y-auto" />
                </div>
              ) : showAllContacts && !activeInteraction ? (
                // ── All Contacts — standalone, detached view. Per explicit
                // follow-up request ("detach the contacts table from the
                // search panel and have it exist on its own"), this is a
                // 4th mutually-exclusive top-level view (see
                // `showAllContacts` state's own doc comment), independent
                // of the shared Search panel/`Draggable`/`activePanelKey`
                // machinery §134 originally used. `InteractionsListView` is
                // `&& !activeInteraction` — per a further follow-up ("keep
                // home page (all contacts) at the last state before
                // navigating away"), `showAllContacts` is no longer cleared
                // when an interaction starts, so this guard is what actually
                // lets the active-interaction branch above take priority
                // instead of this one (see `showAllContacts`'s own doc
                // comment for the full rationale).
                // mounted directly with NO wrapping scroll/padding div — it
                // manages its own internal scrolling and fills its parent
                // (confirmed via its own root className), same as how it's
                // already mounted inside the Search panel's Contacts tab.
                // The breadcrumb reads "Dashboard / All Contacts"; clicking
                // "Dashboard" returns to the Home dashboard view.
                <div key="all-contacts" className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200">
                  {showPageHeader && (
                    <PageHeader
                      title="All Contacts"
                      breadcrumb={{
                        label: "Dashboard",
                        onClick: () => {
                          setShowAllContacts(false);
                          setSelectedAllContactsRecord(null);
                        },
                      }}
                    />
                  )}
                  {/* Per explicit follow-up request ("below the dashboard /
                      all contacts page header at tabs for Contacts
                      (Active), Messages and Threads") — see
                      `allContactsTab`'s own doc comment above for why only
                      "Contacts" has real content so far. */}
                  <TabList className="px-4" overflowMenu>
                    {ALL_CONTACTS_TABS.map((label) => (
                      <Tab
                        key={label}
                        active={allContactsTab === label}
                        onClick={() => setAllContactsTab(label)}
                      >
                        {label}
                      </Tab>
                    ))}
                  </TabList>
                  {allContactsTab !== "Contacts" ? (
                    // Placeholder — see `allContactsTab`'s own doc comment.
                    <div className="flex-1 overflow-y-auto" />
                  ) : (
                  /* Body row: table + this view's OWN right-docked
                      `InteriorPanel` — a second, independent instance from
                      the dashboard's own (further below), since this whole
                      view is now a standalone container with nothing else
                      to share that docked slot with. Per explicit follow-up
                      request ("when one of the rows is clicked, open an
                      interior panel like the ones in My Contact History"),
                      a row click here no longer jumps straight into a live
                      assignment (`handleOpenInteractionRow`, still what
                      this panel's own footer button calls) — it opens this
                      summary first, same "Duration"/notes box + synthesized
                      Conversation section `ContactHistoryEntryDetail`
                      already renders for a My Contact History row (see
                      `selectedContactHistoryEntry`'s own doc comment further
                      up, and `buildContactHistoryEntryFromInteractionRecord`,
                      agent-next-gen-interactions-table.tsx, for how a table
                      row is adapted into that same shape). */
                  <div className="relative flex flex-1 min-h-0 overflow-hidden">
                    <InteractionsListView
                      onAddToast={addToast}
                      // Per explicit follow-up request ("when the contact
                      // row is selected show it as active and allow it to
                      // close the panel on toggle") — clicking the row
                      // that's ALREADY selected now closes the panel
                      // instead of just reopening the same one; clicking
                      // any other row still swaps to it as before.
                      // `activeRecordId` (below) is what makes that row
                      // render as active in the table itself — see its own
                      // doc comment (agent-next-gen-interactions-table.tsx).
                      onOpenInteraction={(record) =>
                        setSelectedAllContactsRecord((prev) => (prev?.id === record.id ? null : record))
                      }
                      activeRecordId={selectedAllContactsRecord?.id ?? null}
                    />
                    {showInteriorPanel && (
                      <InteriorPanel
                        side="right"
                        open={Boolean(selectedAllContactsRecord)}
                        headerTitle={selectedAllContactsRecord?.customerName}
                        headerSubhead={selectedAllContactsRecord?.skill}
                        onClose={() => setSelectedAllContactsRecord(null)}
                        // Per explicit follow-up request ("update the
                        // toggle close icon for interior panels to be an
                        // 'x' icon") — reverts the `PanelRightClose`
                        // override an earlier request introduced here,
                        // back to `ContainerHeader`'s own generic default
                        // `X` (simply omitting `closeIcon` entirely now
                        // gets that default). Applies everywhere this
                        // pattern was used, not just Phase 1 — see the
                        // other 5 identical reverts (this file's own
                        // second `InteriorPanel`, `AgentWorkspace2WithDesk
                        // Page.tsx`'s two, `agent-next-gen-customer-info-
                        // panel.tsx`'s two, `agent-next-gen-in-contact-
                        // panel.tsx`'s one).
                        // Same mutually-exclusive Redial/Re-open convention
                        // `selectedContactHistoryEntry`'s own footer already
                        // uses (voice-only gets "Redial") — both just call
                        // `handleOpenInteractionRow`, the one handler this
                        // table's rows have always used to actually open a
                        // live assignment, then close this summary panel.
                        footer={
                          selectedAllContactsRecord ? (
                            selectedAllContactsRecord.type === "voice" ? (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  handleOpenInteractionRow(selectedAllContactsRecord);
                                  setSelectedAllContactsRecord(null);
                                }}
                              >
                                <PhoneOutgoing className="h-3.5 w-3.5" strokeWidth={1.5} />
                                Redial
                              </Button>
                            ) : (
                              <Button
                                onClick={() => {
                                  handleOpenInteractionRow(selectedAllContactsRecord);
                                  setSelectedAllContactsRecord(null);
                                }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                                Takeover Assignment
                              </Button>
                            )
                          ) : undefined
                        }
                      >
                        {selectedAllContactsRecord && (
                          <ContactHistoryEntryDetail
                            entry={buildContactHistoryEntryFromInteractionRecord(selectedAllContactsRecord)}
                          />
                        )}
                      </InteriorPanel>
                    )}
                  </div>
                  )}
                </div>
              ) : activeInteraction ? (
                // ── Active interaction's detail page — replaces the Desk
                // dashboard the moment a new assignment is started/quick-
                // dialed/redialed (see `activeInteraction` above). Just the
                // record header for now; the blank body below is where a
                // real case/contact detail view will go. Reverts back to
                // the dashboard automatically once the interaction is
                // dismissed (`activeInteractionId` clears). Keyed on the
                // interaction's own `id` (not a static string, unlike the
                // Settings/dashboard branches) — switching directly between
                // two different active interactions (redial/quick-dial while
                // one's already open) should still remount and replay the
                // fade-in, not just re-render the same subtree with new
                // props, the way a static key would.
                //
                // `delay-150 fill-mode-backwards` added to the plain
                // `animate-in fade-in-0` above (per explicit request — a
                // switch between assignments should read as one clean soft
                // fade, not a flash of whatever this specific assignment's
                // own content happens to animate on mount). A fresh remount
                // isn't actually blank underneath: things like an open-by-
                // default `Accordion` (Customer Information's Overview
                // cards) run their own `animate-accordion-down` height
                // grow-in the INSTANT they're painted, regardless of
                // whether the surrounding wrapper is still fading up from
                // opacity 0 — CSS animations tied to a class/data-attribute
                // that's already true at first paint still play from their
                // first frame, they don't wait for an ancestor's opacity to
                // reach 1 first. With only a plain fade before, that meant
                // briefly seeing pieces of the new assignment (cards
                // growing open, etc.) settle into place THROUGH the fade
                // rather than after it — every switch showing a flicker of
                // its own internals assembling.
                //
                // `fill-mode-backwards` (tailwindcss-animate's own utility
                // for `animation-fill-mode`) holds the fade-in animation's
                // FIRST frame — opacity 0 — for the entire `delay-150`
                // window before the animation itself starts, keeping this
                // whole subtree invisible while those nested mount-time
                // animations run their course out of sight. 150ms
                // comfortably covers the accordion height animation's own
                // 200ms duration by the time the fade-in itself finishes
                // (150ms delay + 200ms fade ≈ 350ms total), so by the time
                // anything here actually becomes visible, the new
                // assignment has already finished assembling underneath —
                // the agent just sees one soft fade to the fully-settled
                // page, never the assembly itself. `duration-200` (below)
                // is unchanged — this only changes WHEN the fade starts and
                // HOW it looks the moment it does, not how long the actual
                // fade takes once it begins.
                <div key={`interaction-${activeInteraction.id}`} className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200 delay-150 fill-mode-backwards">
                  {showPageHeader && (
                    <>
                    {/* ── Record header ──
                        `PageHeader` is back (per explicit follow-up
                        request — it had been removed entirely in favor of
                        just this row's own tab bar; see this file's git
                        history for that earlier removal's own reasoning),
                        now as its own row ABOVE the channel tabs instead of
                        the tabs being this whole area's only content.
                        Title/subtitle show the customer's name/id
                        (`recordId`) directly again — no longer only
                        reachable via the Customer Information panel's own
                        header — with an "Active"/"Closed" status badge
                        alongside, mirroring `activeInteraction.closed`.

                        `actions` holds the header-level buttons, per
                        explicit request: at full width, one small outline
                        icon button PER channel this contact can still add
                        (Call/Email/SMS/…, via `getAvailableChannels` below)
                        instead of a single combined "Add Channel" trigger —
                        each one is still the exact same `AddChannelButton`
                        every other "+" in this app uses (`getHeaderAction`,
                        create-new.tsx), just locked to one channel via its
                        new `initialChannel` option (skips straight to the
                        phone/skill picker, no redundant "Select Channel"
                        step) and wearing that channel's own icon via
                        `icon` instead of the default "+". Below the
                        `recordHeaderWidth < 768` breakpoint, this whole row
                        collapses down to the single combined "+" trigger
                        instead (the original, unrestricted `getHeaderAction`
                        call — every channel back in one "Select Channel"
                        picker) — there isn't room for one button per
                        channel once the header itself gets this tight.
                        Customer Information is deliberately LAST in
                        `actions` — a plain flex row, so whichever child
                        renders last just naturally lands at the far right
                        of it, no extra positioning prop needed.

                        Customer Information collapses to icon-only at the
                        SAME `recordHeaderWidth < 768` breakpoint (per
                        explicit follow-up request) — drops its "Customer
                        Information" label down to a bare id-card glyph
                        exactly when the channel buttons above collapse to
                        their own single icon trigger, so the whole row
                        changes shape together instead of one side
                        collapsing before the other.
                        `ref={recordHeaderRef}` — a dedicated measurement of
                        THIS header's own width (see that ref's own doc
                        comment for why `sidePanelContainerWidth` stopped
                        being a safe stand-in for it once this button
                        started rendering unconditionally, not just while
                        the docked panel is closed). */}
                    <PageHeader
                      ref={recordHeaderRef}
                      // Per explicit follow-up request: this record header
                      // sits directly above the session row
                      // (`TranscriptSessionSeparator`/the channel tab row),
                      // which already draws its own `border-b` right
                      // underneath — this header's own default border just
                      // doubled that into two parallel lines with an odd
                      // gap between them. `compact` shrinks the row from
                      // the default `min-h-[68px]`/`py-4` down to
                      // `min-h-[54px]` with the bottom padding dropped, so
                      // the whole thing reads as one tightly-packed header
                      // instead of two stacked bordered rows (see both
                      // props' own doc comments, page-header.tsx).
                      bordered={false}
                      compact
                      // Per explicit request ("add an icon indicating
                      // whether the interaction is an agent or a customer
                      // to the left of the name"): `Headphones` for
                      // `activeInteractionIsAgentCall` (defined above —
                      // the same "is this interaction's own `id` one of
                      // `OUTBOUND_AGENTS`'s ids" check that already gates
                      // Customer Information/the status chip for agent-
                      // to-agent calls), `User` otherwise. Matches the
                      // exact glyphs the New Outbound "Choose group"
                      // Select already shows for these two categories
                      // (`agentCategoryIcon`/`customerCategoryIcon`,
                      // agent-next-gen-outbound-data.tsx) so the same icon
                      // means the same thing in both places.
                      //
                      // Per explicit follow-up request ("use the avatar
                      // variant in a circle and remove the divider"):
                      // wrapped in `Icon` (icon.tsx) with `shape="circle"`
                      // — a colored circle avatar shell rather than a bare
                      // glyph, matching lyra-ui's own `PageHeader` "Record
                      // Header (Circle Avatar, No Divider)" story
                      // (PageHeader.stories.tsx). Once the icon is a
                      // self-contained circle like this, the divider
                      // `icon` renders by default between itself and the
                      // title just doubles up on separation the circle's
                      // own background already provides — dropped via
                      // `iconDivider={false}` (see that prop's own doc
                      // comment, page-header.tsx).
                      //
                      // `background` is driven by `activeInteractionIsAgentCall`
                      // per a further explicit follow-up ("use a different
                      // accent color for customer vs. agent avatar") —
                      // "active" (blue) for an agent call, "shell" (neutral
                      // gray) for a real customer. Not new colors: these are
                      // the EXACT SAME `Icon` `background` values —
                      // `agentCategoryLeadingIcon`/`customerCategoryLeadingIcon`
                      // (agent-next-gen-outbound-data.tsx) already build by
                      // hand for the New Outbound picker's own "Agents"/
                      // "Customers" category rows (`bg-lyra-bg-active-subtle`/
                      // `text-lyra-fg-active-strong` and `bg-lyra-bg-surface-
                      // shell`/`text-lyra-fg-secondary` respectively — see
                      // that file's own doc comment on the category color
                      // pairing) — so the record header now reads as the
                      // same category-to-color mapping the picker already
                      // established, not a one-off purple used for both.
                      // Per explicit follow-up request ("display the status
                      // in the avatar as a badge"), the record header's own
                      // "Online"/"Closed" pill (that used to sit inline
                      // after the customer's name, see `badge`/`badgeColor`
                      // below — now removed) has moved onto this avatar's
                      // own bottom-right corner instead, matching the
                      // exact `AgentPresenceBadge` corner treatment the
                      // Outbound picker's own contact rows already use
                      // (create-new.tsx) — a `size="sm"` circle `Badge`
                      // with `px-0`/`border-lyra-bg-surface-base`.
                      //
                      // Per a further explicit follow-up request ("customer
                      // statuses should only be visible in chats"), this
                      // now only renders at all when `hasOpenChatThread` is
                      // true — the ORIGINAL "idle" (amber, for voice/SMS/
                      // email/WhatsApp with no live signal) branch is gone
                      // entirely rather than just recolored, since a
                      // non-chat interaction shouldn't show ANY presence
                      // indicator, matching the OLD pill's own original
                      // reasoning that those channels have no way to
                      // honestly know whether the customer is still there.
                      // Once a chat thread IS open, it's just two states:
                      // "online" (green) normally, "offline" (gray) once
                      // the interaction is closed — and per a further
                      // follow-up request ("it should be a green check
                      // like other available statuses"), each renders a
                      // real Check/X glyph as the Badge's content rather
                      // than a plain dot, matching `AgentPresenceBadge`'s
                      // own `available`/`offline` treatment exactly. Only
                      // for a real customer, not an agent call
                      // (`!activeInteractionIsAgentCall`) — presence is a
                      // customer concept here; an agent's own status
                      // already has its own dedicated surface elsewhere
                      // (the status menu).
                      icon={
                        <span className="relative inline-flex">
                          {/* Per explicit follow-up request ("avatars
                              within the contact and call details should be
                              the initials of the customer OR a customer
                              avatar if no customer name is known", then
                              "add a story to the avatar component ... use
                              it in agent-next-gen-v3"): now built on
                              lyra-ui's shared `Avatar` (avatar.tsx) instead
                              of the hand-rolled `Icon`/purple-circle split
                              this block used right after the first request
                              — that hand-rolled version is exactly what
                              `Avatar` generalizes (see its own doc
                              comment). `color="active"` for an agent call
                              (was `Icon background="active"`), `color=
                              "primary"` (this app's purple "identified
                              customer" chip, same as `VoiceCallControls`'s
                              own) once a real match's name is known, else
                              `color="shell"` with no `initials` — `Avatar`
                              itself falls back to a generic `User` glyph
                              whenever `initials` is omitted, so that
                              branch no longer needs its own explicit
                              `icon={User}`. `size="md"` matches this
                              header's prior `Icon size="md"` exactly (both
                              are the same 36px circle). */}
                          {activeInteractionIsAgentCall ? (
                            <Avatar icon={Headphones} color="active" size="md" />
                          ) : activeInteractionIsRealCustomer && activeInteraction.customerName ? (
                            <Avatar initials={initialsFor(activeInteraction.customerName)} color="primary" size="md" />
                          ) : (
                            <Avatar color="shell" size="md" />
                          )}
                          {!activeInteractionIsAgentCall && hasOpenChatThread && (
                            // Per explicit request ("add a tooltip to the
                            // user status badge"), wrapped in a real
                            // `Tooltip` on hover — same "Online"/"Offline"
                            // wording as this badge's own `aria-label`
                            // just below (not "Available"/"Unavailable":
                            // this is customer CHAT presence, a distinct
                            // concept from the agent's own Available/
                            // Unavailable status elsewhere in this app —
                            // see `AgentStatus`, agent-profile.tsx). No
                            // `asLabel`: the Badge already sets its own
                            // `aria-label` below, so this stays purely a
                            // visual hover affordance on top of that, not
                            // a second/duplicate accessible name.
                            <Tooltip
                              content={activeInteraction.closed ? "Offline" : "Online"}
                              placement="bottom"
                            >
                              <Badge
                                shape="circle"
                                variant={activeInteraction.closed ? "neutral" : "success"}
                                size="sm"
                                aria-label={activeInteraction.closed ? "Offline" : "Online"}
                                className="absolute bottom-[-2px] right-[-2px] px-0 border border-lyra-bg-surface-base"
                              >
                                {activeInteraction.closed ? (
                                  <X className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
                                ) : (
                                  <Check className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
                                )}
                              </Badge>
                            </Tooltip>
                          )}
                        </span>
                      }
                      iconDivider={false}
                      title={activeInteraction.customerName ?? "Customer"}
                      // Per explicit request ("a badge to the left of the
                      // customer name ... that says 'Active Call' for
                      // active call contacts so people don't get lost
                      // visually"): `PageHeader`'s own built-in `badge`
                      // prop (see `PageHeader.stories.tsx`'s "With Badge"
                      // story) — no new prop needed, this one was just
                      // unused at this call site since the "Online"/
                      // "Closed" presence pill moved onto the avatar's own
                      // corner (see that badge's own doc comment above).
                      // `isViewingLiveVoiceCallInteraction` is already
                      // exactly "the interaction THIS header belongs to has
                      // a live voice call" (this header only ever renders
                      // for `activeInteraction`).
                      badge={isViewingLiveVoiceCallInteraction ? "Active Call" : undefined}
                      // Per explicit follow-up request (mockup's own 4
                      // states — even State 2/4, with the full tab row
                      // showing, still read the ACTIVE tab's own "{icon}
                      // {Channel label} | {Draft/date}" subtitle, e.g.
                      // "Email | Draft" — not the plain customer-ID text):
                      // this is now UNCONDITIONAL, every customer
                      // interaction, regardless of `showChannelTabRow`/
                      // channel count. Previously gated on
                      // `!showChannelTabRow` (back when that const meant
                      // "unknown contact," not "channel count") — now that
                      // it's channel-count-based, gating this on it too
                      // would have made the subtitle flip back to the
                      // plain customer ID the moment a second channel
                      // opened, which the mockup explicitly does NOT want.
                      // Same "{icon} {Channel label} | {date/time or
                      // Draft}" format Agent Workspace 2.0 always shows
                      // (AgentNextGenPage.tsx — see `CHANNEL_TYPE_META`/
                      // `resolveActiveChannelDateTimeLabel`'s own doc
                      // comments above for where each half comes from).
                      // `undefined` (not a bare channel label with nothing
                      // after it) whenever either half is missing —
                      // `PageHeader`'s own `{subtitle && ...}` guard
                      // (page-header.tsx) then skips the subtitle row
                      // entirely, same fallback 2.0 uses. Falls back to the
                      // plain customer ID only when there's genuinely no
                      // active channel to describe (shouldn't normally
                      // happen while `activeInteraction` is set, but keeps
                      // this defensive rather than rendering nothing).
                      //
                      // Per a later explicit follow-up request: once 2+
                      // channels are open (`showChannelTabRow`), the single
                      // active tab's own "{icon} {label} | {date}" line
                      // above stops answering the question that actually
                      // matters with several channels live at once — this
                      // branch takes over instead, reading "{N} channels
                      // open | Last Customer Response: {date/time}" (count =
                      // `activeInteraction.threads.length`, matching
                      // `showChannelTabRow`'s own threshold/definition; see
                      // `resolveInteractionLastCustomerResponseLabel`'s own
                      // doc comment for how that timestamp is resolved
                      // across every thread, not just the active one). If
                      // NO thread has a qualifying response yet, the
                      // trailing clause is simply omitted rather than
                      // printing a broken "Last Customer Response:" with
                      // nothing after it.
                      subtitle={
                        // See `SHOW_RECORD_HEADER_SUBTITLE`'s own doc
                        // comment above — hidden per explicit request, the
                        // rest of this ternary untouched underneath.
                        !SHOW_RECORD_HEADER_SUBTITLE ? undefined :
                        showChannelTabRow && activeInteraction.threads.length >= 2 ? (
                          <span className="truncate">
                            {activeInteraction.threads.length} channels open
                            {lastCustomerResponseLabel ? ` | Last Customer Response: ${lastCustomerResponseLabel}` : ""}
                          </span>
                        ) : activeChannelType && activeChannelDateTime ? (
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="shrink-0 text-lyra-fg-secondary" aria-hidden="true">
                              {CHANNEL_TYPE_META[activeChannelType].icon}
                            </span>
                            <span className="truncate">
                              {CHANNEL_TYPE_META[activeChannelType].label} | {activeChannelDateTime}
                            </span>
                          </span>
                        ) : (
                          activeInteraction.customerId
                        )
                      }
                      // Per later explicit follow-up request ("float the
                      // channel toggles to the right where the current
                      // toggle icon is"): `ChannelToggleGroup`/`ChannelToggle`
                      // moved out of this `titleSuffix` slot (right after the
                      // customer name) into `actions` below instead — see
                      // that prop's own doc comment for the full "why" and
                      // what it replaced there. `titleSuffix` is omitted
                      // entirely now (nothing left to put in it) rather than
                      // left passing an empty/`false` value.
                      // `badge`/`badgeColor` (the old inline "Online"/
                      // "Closed" pill) are gone — see the `icon` prop's own
                      // doc comment above for where that signal moved to
                      // (the avatar's own corner badge, three states now
                      // instead of two). `hasOpenChatThread` still checks
                      // whether ANY thread on this interaction is chat, not
                      // just whichever tab is currently selected — per the
                      // ORIGINAL explicit follow-up request behind that
                      // check ("leave the active badge visible if the
                      // agent switches between chat/other channels"),
                      // switching tabs away from chat shouldn't make the
                      // presence signal disappear when a chat thread is
                      // still open elsewhere on the same card.
                      // Per later explicit follow-up request ("float the
                      // channel toggles to the right where the current
                      // toggle icon is; move the toggle icon to the session
                      // row to the right of the outcome icon button"): this
                      // slot used to hold the Customer Information panel's
                      // own hover-preview `Popover` + toggle `ActionIconButton`
                      // — moved down to the session row instead, via
                      // `TranscriptSessionSeparator`'s own pre-existing
                      // `onToggleDetailsPanel` "Open Details Panel" icon,
                      // which dropped the hover-preview convenience (that
                      // button had no equivalent for it) down to a plain
                      // click-to-toggle.
                      //
                      // Per a LATER explicit follow-up request ("move the
                      // details side panel toggle to above the session row
                      // to the right of the voice + button group"), it's
                      // back here again — same spot it originally occupied,
                      // one full circle. Per explicit follow-up when THAT
                      // move was scoped ("keep the hover-preview, hand-roll
                      // the new button instead" of lyra-ui's `PageHeader`
                      // own built-in `panelToggle="right"` slot, which can't
                      // wrap its internal button in custom Popover content),
                      // this is a real `Button`/`Popover` pair rendered
                      // directly in this `actions` block — not
                      // `panelToggle`/`onInnerPanelToggle` — specifically so
                      // the hover-preview mechanism (`customerInfoPreviewOpen`/
                      // `openCustomerInfoPreview`/
                      // `scheduleCloseCustomerInfoPreview`, still declared
                      // above) can keep wrapping it, moved verbatim from
                      // `TranscriptSessionSeparator`'s own former render of
                      // it (`detailsPanelPreviewContent` and friends,
                      // formerly passed to the OTHER `<InteractionTranscript>`
                      // call site below — no longer passed there at all now
                      // that this is the button rendering it). Gated on
                      // `!sidePanelOpen` — same "hide once the real panel is
                      // already open" reasoning `detailsPanelOpen` used to
                      // give `TranscriptSessionSeparator`.
                      //
                      // `ChannelToggleGroup`/`ChannelToggle` — was this
                      // header's own `titleSuffix` (right after the customer
                      // name; see that (now-removed) slot's own doc comment
                      // above) — now renders here instead, so it floats at
                      // the row's far right. The wrapping `<div className=
                      // "flex items-center gap-1">` below is what lets the
                      // panel-toggle button sit beside it as a sibling,
                      // rather than needing its own separate `actions` slot.
                      actions={
                        <div className="flex items-center gap-1">
                        {/* "+" Add Channel trigger — per explicit follow-up
                            request ("move the + button outside of the
                            toggle group and hide the toggle group for
                            now"), no longer folded into `ChannelToggleGroup`'s
                            own bordered shell via its `action` prop (see
                            that prop's own former doc comment, still on
                            `ChannelToggleGroup` below, for why it moved IN
                            there in the first place) — rendered as a plain
                            standalone sibling instead, so it keeps working
                            even while the toggle group itself is hidden.
                            Same `getHeaderAction` (stock picker) ??
                            `AddChannelAdHocButton` (directory-independent
                            fallback) pair, unchanged. */}
                        {SHOW_ADD_CHANNEL_HEADER_BUTTONS && SHOW_ADD_CHANNEL_HEADER_BUTTON && (getHeaderAction(
                          activeInteraction.entityId ?? "",
                          "ml-0.5 h-8 w-8 px-0 border border-lyra-border-soft bg-lyra-bg-control text-lyra-fg-action hover:bg-lyra-state-hover active:bg-lyra-state-pressed",
                          { label: "Add Channel", showLabel: false }
                        ) ?? (
                          <AddChannelAdHocButton
                            onLaunch={handleAddAdHocChannel}
                            skillOptions={OUTBOUND_CONFIG.skillOptions}
                            className="ml-0.5 h-8 w-8 px-0 border border-lyra-border-soft bg-lyra-bg-control text-lyra-fg-action hover:bg-lyra-state-hover active:bg-lyra-state-pressed"
                          />
                        ))}
                        {/* Per explicit request ("add an icon representing
                            the channel to the right of the '+' ... and
                            open a side panel ... with the channel
                            content"), later broadened by an explicit
                            follow-up ("the chat icon should be visible ...
                            all open channels should display"): one small
                            icon per Thread on this interaction — ALL of
                            them, including whichever one is currently
                            `currentThreadId`/shown in the main transcript
                            column, not just the non-active ones (that
                            channel's own panel-based preview, toggled by
                            this same icon, is a genuinely separate view
                            from the main column — see this whole icon
                            row's shared `channelPreviewThreadKey` doc
                            comment further up — so it still needs its own
                            toggle here too, same as every other channel).
                            With the pill row above hidden, this is now the
                            only way to reach a channel's own preview.
                            Reuses `CHANNEL_TYPE_META` (lyra-ui,
                            channel-row.tsx) for the icon/label rather than
                            inventing a second mapping — the same one this
                            header's own active-channel icon already uses a
                            few hundred lines up. Toggle-open, same
                            semantics `openDetailPanelContent`'s own doc
                            comment established: clicking the icon for
                            whatever's ALREADY showing closes the panel
                            instead of re-opening it — mutually exclusive
                            with every other channel icon AND the Contact
                            Details button (see `handleSidePanelIconToggle`'s
                            own doc comment) since they all share this one
                            `channelPreviewThreadKey` state. */}
                        {/* Per explicit follow-up request ("just hide the
                            voice icon in phase 1 it's confusing with no
                            other channels"): with voice as the only
                            channel this deployment ever has (see
                            `SHOW_ADD_CHANNEL_HEADER_BUTTONS`'s own doc
                            comment — no way to launch a second, non-voice
                            one), this icon button no longer earns its
                            place next to Contact Details — it can't
                            distinguish one channel from another when
                            there's only ever the one, so it just reads as
                            a redundant, always-on duplicate of the phone
                            icon in the record header's own title/call
                            controls. Skipped entirely (not merely
                            disabled/dimmed) rather than deleting the whole
                            block below — every other channel type keeps
                            rendering here untouched, and this comes back
                            with a one-line removal of this guard if a
                            future deployment adds a second channel type
                            back. Every one of the `isVoiceChannel`
                            special-cases below (active-tooltip, no-op
                            click, etc.) stays in place regardless — dead
                            code for now, but exactly what a future
                            multi-channel deployment would need again the
                            moment this early return comes back out. */}
                        {activeInteraction.threads.map((c) => {
                          if (!SHOW_VOICE_CHANNEL_HEADER_ICON && c.type === "voice") return null;
                          // Lucas Thomas's chat lives in the main column — no header channel icon.
                          if (activeInteraction.id === LUCAS_THOMAS_ID) return null;
                          const key = c.id ?? c.type;
                          const meta = CHANNEL_TYPE_META[c.type];
                          // Per explicit request ("update the functionality
                          // of the top right channel buttons in phase 1 to
                          // match phase 2 ... you just need to address the
                          // voice icon button - it should be active and not
                          // toggle the side panel"): this deployment is
                          // voice-only now (see `SHOW_RECORD_HEADER_ADD_
                          // CHANNEL_BUTTON`'s own doc comment above — no way
                          // to launch a second, non-voice channel anymore),
                          // so voice is always both the only channel AND
                          // this interaction's own main content
                          // (`activeChannelKey`) — there's nothing left for
                          // its icon to "preview" in a side panel; clicking
                          // it used to toggle `channelPreviewThreadKey`
                          // open, popping the exact same transcript already
                          // showing in the main column into a redundant
                          // side-panel copy of itself. Every OTHER channel
                          // type keeps the original `channelPreviewThreadKey`
                          // toggle behavior untouched — out of scope per the
                          // request's own wording, and effectively unreached
                          // now that there's no way to add one of them.
                          // Lucas Thomas's chat lives in the main column only — its icon behaves like voice (active, no side-panel preview).
                          const isVoiceChannel = c.type === "voice" || activeInteraction.id === LUCAS_THOMAS_ID;
                          const isOpen = isVoiceChannel ? key === activeChannelKey : channelPreviewThreadKey === key;
                          // Whether this icon's own channel is the one
                          // currently showing in the main column — drives
                          // the "{channel} active" `Tooltip` below, same as
                          // Phase 2's `isActiveChannel`. Independent of
                          // `isOpen`/`isVoiceChannel`: today only voice can
                          // ever be `activeChannelKey`, but this stays
                          // generic rather than voice-specific so another
                          // channel type picks it up for free if the
                          // voice-only restriction is ever lifted.
                          const isActiveChannel = key === activeChannelKey;
                          // Per explicit follow-up request: the voice
                          // icon's own hover label reads "Voice
                          // Transcript" (this preview IS just the
                          // transcript — see `footerOverride`'s own doc
                          // comment further down for why voice never gets
                          // a composer here) rather than plain "Voice",
                          // which reads more like a still-ringing/active
                          // call indicator. Every other channel keeps
                          // `meta.label` unchanged.
                          const previewLabel = c.type === "voice" ? "Voice Transcript" : meta.label;
                          const hoverOpen = activeInteraction.id !== LUCAS_THOMAS_ID && channelHoverPreviewKey === key;
                          // Per explicit follow-up request ("on hover for
                          // the voice, chat, sms, email channel icons in
                          // the top right, display the content of the
                          // panel like you do for contact details"): same
                          // hover-preview `Popover` pattern as the
                          // "Contact Details" button's own (render site
                          // further down) — a plain text `Tooltip` isn't
                          // enough content on its own anymore, so it's
                          // replaced here rather than layered underneath.
                          // The preview body mirrors exactly what clicking
                          // this icon opens in the real docked panel (see
                          // `bodyOverride`/`footerOverride`'s own doc
                          // comments at that render site) — duplicated
                          // rather than shared, same as the Contact
                          // Details hover preview's own duplication of
                          // `DetailsPanelAccordions`/tabs just below.
                          return (
                            <div
                              key={key}
                              onMouseEnter={() => openChannelHoverPreview(key)}
                              onMouseLeave={scheduleCloseChannelHoverPreview}
                            >
                              {/* `Tooltip` wraps `Popover` through a plain
                                  `span` rather than directly — `Popover`
                                  doesn't spread arbitrary extra props
                                  through to its own trigger, so `Tooltip`'s
                                  `asChild`/Slot injection silently drops
                                  without that intervening real DOM node.
                                  Same fix as Phase 2's own copy of this
                                  exact composition; see lyra-ui's
                                  `popover.tsx` top-of-file comment. */}
                              <Tooltip content={`${meta.label} active`} placement="bottom" disabled={!isActiveChannel}>
                              <span className="inline-flex">
                              <Popover
                                open={hoverOpen}
                                placement="bottom"
                                align="end"
                                showArrow={false}
                                bodyPadding={false}
                                className="border-0 bg-transparent p-0 shadow-none"
                                onOpenAutoFocus={(e: Event) => e.preventDefault()}
                                onCloseAutoFocus={(e: Event) => e.preventDefault()}
                                onInteractOutside={(e: Event) => {
                                  if ((e.target as Element)?.closest?.("[data-radix-popper-content-wrapper]")) {
                                    e.preventDefault();
                                  }
                                }}
                                content={
                                  <div
                                    onMouseEnter={() => openChannelHoverPreview(key)}
                                    onMouseLeave={scheduleCloseChannelHoverPreview}
                                    className="flex max-h-[70vh] w-[340px] flex-col overflow-hidden rounded-lyra-lg border border-lyra-border-soft bg-lyra-bg-surface-container-subtle shadow-lg"
                                  >
                                    <PanelHeader title={previewLabel} subhead={activeInteraction.customerName} />
                                    <div className="flex-1 overflow-y-auto">
                                      {c.type === "email" ? (
                                        <div className="flex h-full items-center justify-center px-6 py-10 text-center text-sm text-lyra-fg-secondary">
                                          Coming soon
                                        </div>
                                      ) : (
                                        <InteractionTranscript
 hideAiActions={hideAiActions}
                                          hideMockFollowUpMessages={activeInteraction.id === LUCAS_THOMAS_ID}
                                          channelType={c.type}
                                          direction={c.direction}
                                          customerName={activeInteraction.customerName}
                                          contactId={c.contactId ?? activeInteraction.customerId}
                                          // Per explicit request ("display
                                          // the phone number instead of the
                                          // contact ID in the session row")
                                          // — see `InteractionTranscript`'s
                                          // own `channelAddressLabel` prop
                                          // doc comment (agent-next-gen-
                                          // transcript.tsx) and
                                          // AgentWorkspace2WithDeskPage.tsx's
                                          // identical wiring.
                                          channelAddressLabel={c.addressLabel}
                                          skillLabel={c.preview}
                                          isFreshLaunch={!!c.startedFresh}
                                          liveMessages={activeInteraction.liveMessages?.[key] ?? []}
                                          currentStatus={activeInteraction.threadStatuses?.[key]}
                                          onCurrentStatusChange={(status) =>
                                            handleInteractionStatusChange(activeInteraction.id, key, status)
                                          }
                                          showSessionActionCluster={false}
                                          showViewDetails={false}
                                        />
                                      )}
                                    </div>
                                    {c.type !== "email" &&
                                      c.type !== "voice" &&
                                      !activeInteraction.closed &&
                                      activeInteraction.threadStatuses?.[key] !== "Closed" && (
                                        <InteractionComposer
                                          onSend={(text) => handleSendMessage(activeInteraction.id, text, key)}
                                          hideAiActions={hideAiActions}
                                          onHideAiActionsChange={setHideAiActions}
                                        />
                                      )}
                                  </div>
                                }
                              >
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  aria-pressed={isOpen}
                                  aria-label={
                                    isVoiceChannel
                                      ? `${previewLabel} active`
                                      : `${isOpen ? "Close" : "Open"} ${previewLabel} preview`
                                  }
                                  className={cn(
                                    "ml-0.5 h-8 w-8 px-0 border border-lyra-border-soft bg-lyra-bg-control text-lyra-fg-action hover:bg-lyra-state-hover active:bg-lyra-state-pressed",
                                    isOpen && PANEL_BUTTON_SELECTED_CLASS
                                  )}
                                  onClick={() => {
                                    if (isVoiceChannel) return;
                                    setChannelPreviewThreadKey((prev) => (prev === key ? null : key));
                                  }}
                                >
                                  {meta.icon}
                                </Button>
                              </Popover>
                              </span>
                              </Tooltip>
                            </div>
                          );
                        })}
                        {/* Hidden for now per that same explicit request —
                            `false &&` rather than deleting the block, so
                            the pill row (channel switching/outcome/history
                            tab UI) comes back with a one-line flip once
                            it's wanted again. */}
                        {SHOW_CHANNEL_TOGGLE_GROUP && activeInteraction.threads.length > 0 && (
                          <ChannelToggleGroup>
                            {activeInteraction.threads.map((c) => {
                              const key = c.id ?? c.type;
                              const outcomeKey = `${activeInteraction.id}:${key}`;
                              // Voice never reads as a draft — see this
                              // same check's own doc comment at
                              // `activeChannelIsNewOutboundThread` above.
                              const isNewOutboundThread =
                                c.type !== "voice" &&
                                !!c.startedFresh &&
                                c.lastCustomerMessageTick === undefined;
                              // Own `<ClockTick>`: only this tab re-renders
                              // for its last-contact/awaiting timers.
                              return (
                                <ClockTick key={key}>
                                  {(clockTick) => (
                                <ChannelToggle
                                  type={c.type}
                                  address={c.addressLabel}
                                  statusLabel={activeInteraction.threadStatuses?.[c.id] ?? "Open"}
                                  lastCustomerContactLabel={
                                    c.lastCustomerMessageTick !== undefined
                                      ? formatElapsedTime(clockTick - c.lastCustomerMessageTick)
                                      : undefined
                                  }
                                  interactionId={c.reopenedContacts?.[c.reopenedContacts.length - 1]?.contactId ?? c.contactId}
                                  active={
                                    !isHistoryConversationView &&
                                    (activeInteraction.currentThreadId ?? activeInteraction.threads[activeInteraction.threads.length - 1]?.id) === key
                                  }
                                  awaitingResponse={
                                    activeInteraction.threadStatuses?.[c.id] !== "Closed" &&
                                    activeInteraction.threadStatuses?.[c.id] !== "Resolved" &&
                                    (c.awaitingResponse ?? false)
                                  }
                                  awaitingSeverity={
                                    activeInteraction.threadStatuses?.[c.id] !== "Closed" &&
                                    activeInteraction.threadStatuses?.[c.id] !== "Resolved" &&
                                    c.awaitingResponse
                                      ? getAwaitingSeverity(clockTick - (c.lastCustomerMessageTick ?? c.startTick))
                                      : undefined
                                  }
                                  onClick={() => {
                                    setHistoryConversationTab((t) => (t && t.active ? { ...t, active: false } : t));
                                    handleChannelSelect(activeInteraction.id, key);
                                  }}
                                  onDismiss={() => {
                                    if (activeInteraction.threads.length > 1) handleDismissChannel(activeInteraction.id, c);
                                    else handleDismissInteraction(activeInteraction.id);
                                  }}
                                  showMenu={
                                    !activeInteraction.closed &&
                                    activeInteraction.threadStatuses?.[c.id] !== "Closed" &&
                                    !isNewOutboundThread
                                  }
                                  removeVariant={isNewOutboundThread ? "delete-draft" : "close"}
                                  outcome={{
                                    open: outcomeDraftKey === outcomeKey && outcomeDraftSource === "tab",
                                    onOpenChange: (open) => handleOutcomeOpenChange(outcomeKey, open, "tab"),
                                    resolutionOptions: TRANSCRIPT_SESSION_STATUS_OPTIONS,
                                    resolution: activeInteraction.threadStatuses?.[c.id] ?? "Open",
                                    onResolutionChange: (value) =>
                                      handleInteractionStatusChange(activeInteraction.id, c.id, value),
                                    voice: c.type === "voice",
                                    tagOptions: OUTCOME_TAG_OPTIONS,
                                    selectedTags: outcomeDraft.tags,
                                    onTagsChange: (tags) => setOutcomeDraft((d) => ({ ...d, tags })),
                                    dispositionOptions: OUTCOME_DISPOSITION_OPTIONS,
                                    dispositionCode: outcomeDraft.dispositionCode,
                                    onDispositionChange: (value) => setOutcomeDraft((d) => ({ ...d, dispositionCode: value })),
                                    summary: outcomeDraft.summary,
                                    onSummaryChange: (value) => setOutcomeDraft((d) => ({ ...d, summary: value })),
                                    onSave: handleOutcomeSave,
                                    onCancel: handleOutcomeCancel,
                                  } satisfies ChannelOutcomeConfig}
                                />
                                  )}
                                </ClockTick>
                              );
                            })}
                            {historyConversationForActive && (
                              <PlainToggleTab
                                active={historyConversationForActive.active}
                                icon={<History className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
                                onClick={() =>
                                  setHistoryConversationTab((t) => (t ? { ...t, active: true } : t))
                                }
                                menuItems={[
                                  {
                                    id: "close-history-conversation-tab",
                                    label: "Close Tab",
                                    onClick: () => setHistoryConversationTab(null),
                                  },
                                ]}
                              >
                                {historyConversationForActive.entry.timestampDisplay}
                              </PlainToggleTab>
                            )}
                          </ChannelToggleGroup>
                        )}
                        {/* "Open Details Panel" — see this `actions` block's
                            own top doc comment for the full history of where
                            this button has lived. Per explicit follow-up
                            request ("make the contact details toggle button
                            not disappear when it's open"), this trigger
                            stays visible/clickable at all times now — it no
                            longer unmounts once the real panel is open, so
                            it still works to close the panel again (or, per
                            the earlier explicit request behind
                            `handleSidePanelIconToggle`'s own doc comment,
                            to switch a channel preview back to actual
                            Contact Details). The hover-preview `Popover`
                            itself only shows while Contact Details ISN'T
                            already the panel's own visible content —
                            `sidePanelOpen && !channelPreviewThreadKey`, the
                            same condition `openCustomerInfoPreview`'s own
                            guard now uses (not whenever the panel is merely
                            open at all): per explicit follow-up request ("if
                            a panel is open the inactive channel icon and
                            contact details should retain their hover
                            actions so agents can preview other channels
                            while on a current channel"), a CHANNEL preview
                            being open doesn't block this hover peek at
                            Contact Details, since Contact Details isn't
                            what's actually showing in that case. The
                            wrapping div's hover handlers (not the
                            `Popover`'s own trigger) are what open/close the
                            preview — same split `TranscriptSessionSeparator`'s
                            former render of this used, so the pointer can
                            cross from this button into the popover's own
                            (portaled) content without it flickering shut. */}
                        {/* Per explicit follow-up request ("go back to
                            hiding the contact details button when the
                            panel is open"): reverting the earlier explicit
                            request ("make the contact details toggle
                            button not disappear when it's open") this
                            trigger's outer wrapper got — it's gated behind
                            `!(sidePanelOpen && !channelPreviewThreadKey)`
                            again now, same condition the hover-preview
                            `Popover` just below already uses for its own
                            `open` prop, so this button unmounts entirely
                            (rather than merely losing its "selected" look)
                            once the real Contact Details panel is the
                            side panel's visible content. A channel preview
                            being open instead doesn't hide it — Contact
                            Details isn't what's showing then, so this
                            trigger (and its own hover peek) still work. */}
                        {!(sidePanelOpen && !channelPreviewThreadKey) && (
                        <div onMouseEnter={openCustomerInfoPreview} onMouseLeave={scheduleCloseCustomerInfoPreview}>
                            <Popover
                              open={customerInfoPreviewOpen && !(sidePanelOpen && !channelPreviewThreadKey)}
                              placement="bottom"
                              align="end"
                              showArrow={false}
                              bodyPadding={false}
                              className="border-0 bg-transparent p-0 shadow-none"
                              onOpenAutoFocus={(e: Event) => e.preventDefault()}
                              onCloseAutoFocus={(e: Event) => e.preventDefault()}
                              onInteractOutside={(e: Event) => {
                                if ((e.target as Element)?.closest?.("[data-radix-popper-content-wrapper]")) {
                                  e.preventDefault();
                                }
                              }}
                              content={
                                <div
                                  onMouseEnter={openCustomerInfoPreview}
                                  onMouseLeave={scheduleCloseCustomerInfoPreview}
                                  className="flex max-h-[70vh] w-[340px] flex-col overflow-hidden rounded-lyra-lg border border-lyra-border-soft bg-lyra-bg-surface-container-subtle shadow-lg"
                                >
                                  <PanelHeader
                                    title="Contact Details"
                                    // Per explicit follow-up request: same
                                    // clickable-name treatment the docked
                                    // panel's own header already has (see
                                    // `CustomerInformationSidePanel`'s
                                    // `onViewCustomerInfo` doc comment,
                                    // agent-next-gen-customer-info-panel.tsx)
                                    // — `focusCustomerPanelTab` already
                                    // closes this hover preview itself
                                    // (`setCustomerInfoPreviewOpen(false)`)
                                    // as part of opening the docked panel
                                    // into its "Customer Info" drill-in, so
                                    // no extra close handling is needed
                                    // here.
                                    subhead={
                                      activeInteractionIsRealCustomer && activeInteraction.customerName ? (
                                        <Tooltip content="View Customer Info" placement="bottom">
                                          <button
                                            type="button"
                                            onClick={focusCustomerPanelTab}
                                            className="lyra-body-sm text-lyra-fg-link hover:underline focus-visible:outline-none"
                                          >
                                            {activeInteraction.customerName}
                                          </button>
                                        </Tooltip>
                                      ) : (
                                        activeInteraction.customerName
                                      )
                                    }
                                    tabs={
                                      <TabList className="px-4">
                                        {(panelVoiceThread
                                          ? (["Details", "Transcript", "Session Details"] as const)
                                          : (["Details", "Session Details"] as const)
                                        ).map((label) => (
                                          <Tab
                                            key={label}
                                            active={customerPanelActiveTab === label}
                                            onClick={() => setCustomerPanelActiveTab(label)}
                                          >
                                            {/* Displayed as "Overview"/"Session"
                                                — same underlying identifiers as
                                                the docked panel's own identical
                                                tab row (that render site's own
                                                comment); "Details" stays the
                                                real state value everywhere else
                                                in the file references/compares
                                                it against. */}
                                            {label === "Session Details" ? "Session" : label === "Details" ? "Overview" : label}
                                          </Tab>
                                        ))}
                                      </TabList>
                                    }
                                  />
                                  <div className="flex-1 overflow-y-auto">
                                    {customerPanelActiveTab === "Transcript" && panelVoiceThread ? (
                                      <InteractionTranscript
 hideAiActions={hideAiActions}
                                        hideMockFollowUpMessages={activeInteraction.id === LUCAS_THOMAS_ID}
                                        channelType="voice"
                                        direction={panelVoiceThread?.direction}
                                        customerName={activeInteraction.customerName}
                                        contactId={panelVoiceThread?.contactId ?? activeInteraction.customerId}
                                        // Per explicit request ("display
                                        // the phone number instead of the
                                        // contact ID in the session row")
                                        // — see `InteractionTranscript`'s
                                        // own `channelAddressLabel` prop
                                        // doc comment (agent-next-gen-
                                        // transcript.tsx) and
                                        // AgentWorkspace2WithDeskPage.tsx's
                                        // identical wiring.
                                        channelAddressLabel={panelVoiceThread?.addressLabel}
                                        skillLabel={panelVoiceThread?.preview}
                                        isFreshLaunch={!!panelVoiceThread?.startedFresh}
                                        liveMessages={activeInteraction.liveMessages?.[panelVoiceThread?.id ?? "voice"] ?? []}
                                        dimmed={!!activeInteraction.closed || activeChannelStatus === "Closed"}
                                        currentStatus={activeChannelStatus}
                                        onCurrentStatusChange={(status) =>
                                          activeChannel &&
                                          handleInteractionStatusChange(activeInteraction.id, activeChannel.id, status)
                                        }
                                        showSessionActionCluster={false}
                                        onViewSessionDetails={(session) => {
                                          setSelectedDetailPanelContent(null);
                                          setSelectedVoiceDetailsSession(session);
                                          setCustomerPanelActiveTab("Session Details");
                                        }}
                                        showViewDetails={false}
                                      />
                                    ) : customerPanelActiveTab === "Session Details" ? (
                                      sessionDetailsTabContent.body
                                    ) : (
                                      <DetailsPanelAccordions
 artifacts={panelArtifacts}
 onOpenArtifact={(id: string) => {
 // Opening an artifact from the hover preview closes the popover to make room for the side panel.
 clearTimeout(customerInfoPreviewTimer.current);
 setCustomerInfoPreviewOpen(false);
 reopenPanelArtifact(id);
 }}
 onViewAllArtifacts={() => setCustomerPanelActiveTab("Artifacts")}
 onViewExperienceMemory={
 activeInteraction.id === LUCAS_THOMAS_ID || activeInteraction.id === MARCUS_WEBB_ID || isColdCallId(activeInteraction.id) ? () => openExperienceMemoryInSidePanel() : undefined
 }
                                        customerName={activeInteraction.customerName}
                                        customerContextOverview={customerContextOverviewInfo}
                                        // Per explicit request ("replace the
                                        // autosummary card in the contact
                                        // details with the content depicted
                                        // in the screenshot of the real
                                        // time summary card") — same
                                        // content the docked panel's own
                                        // `DetailsPanelAccordions` call
                                        // shows just below (per that same
                                        // "hover preview and docked panel
                                        // use the exact same content" rule
                                        // this file's own `onLinkCustomer`
                                        // doc comment already documents).
                                        showRealTimeSummary
                                        realTimeSummaryUpdatedAtTick={realTimeSummaryUpdatedAtTick}
                                        onViewCustomerInfo={
                                          activeInteractionIsRealCustomer ? focusCustomerPanelTab : undefined
                                        }
                                        // Same button/content the docked panel's own
                                        // `DetailsPanelAccordions` call shows (see
                                        // `linkCustomerPanelOpen`'s own doc comment) —
                                        // per explicit request, the hover preview and
                                        // the docked panel use the exact same content,
                                        // this button included. Opens the real, docked
                                        // panel's own overlay (`handleLinkCustomerFromPreview`
                                        // just above) since this preview itself is only
                                        // ever a transient hover popover.
                                        onLinkCustomer={
                                          activeInteractionIsRealCustomer ? undefined : handleLinkCustomerFromPreview
                                        }
                                      />
                                    )}
                                  </div>
                                </div>
                              }
                            >
                              {/* Ported from Agent Workspace 2.0/v2's own
                                  identical toggle (`AgentWorkspaceAdvancedPage.tsx`,
                                  that project's copy) per explicit request
                                  ("replace the current toggle icon ... with
                                  the customer information button from v2
                                  ... keep the hover state, etc. - just
                                  update the button"): same `Button`
                                  variant/size, `IdCard` icon + responsive
                                  "Contact Details" label (collapses to
                                  icon-only below 768px, measured off this
                                  record header itself via
                                  `recordHeaderWidth`), and the same
                                  "selected" treatment
                                  (`PANEL_BUTTON_SELECTED_CLASS`) the header's
                                  other panel-toggle buttons already use
                                  while their own panel is open — this one
                                  simply never had it. `aria-pressed`/a
                                  dynamic `aria-label` (open vs close) swap
                                  in too. The hover-preview wiring around
                                  this button (the wrapping `div`'s
                                  `onMouseEnter`/`onMouseLeave`, and the
                                  `Popover`'s own `open`/placement props,
                                  just above) is untouched — only the
                                  trigger `Button` itself changes. */}
                              <Button
                                variant="outline"
                                size="md"
                                className={cn(
                                  "shrink-0 animate-in fade-in-0 duration-200",
                                  recordHeaderWidth < 768 && "w-8 gap-0 px-0",
                                  sidePanelOpen && !channelPreviewThreadKey && PANEL_BUTTON_SELECTED_CLASS
                                )}
                                aria-pressed={sidePanelOpen && !channelPreviewThreadKey}
                                onClick={handleSidePanelIconToggle}
                                aria-label={
                                  sidePanelOpen && !channelPreviewThreadKey
                                    ? "Close Contact Details"
                                    : sidePanelToggleLabel ?? "Open Contact Details"
                                }
                              >
                                <IdCard className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                                {recordHeaderWidth >= 768 && <span>Contact Details</span>}
                              </Button>
                            </Popover>
                          </div>
                        )}
                        </div>
                      }
                    />
                    {/* Per the latest explicit follow-up request ("float the
                        channel toggles to the right..."): the
                        `ChannelToggleGroup`/`ChannelToggle` pills now render
                        in this record header's own `actions` slot above
                        (floated right), not `titleSuffix` (inline after the
                        name) anymore — see that slot's own doc comment for
                        the full history/reasoning. */}
                    </>
                  )}
                  {/* Body row: transcript+composer column. Customer
                      Information now renders as a `SidePanel` docked left of
                      the whole outer Container (see above), not inside this
                      row — so this is just the transcript/composer column
                      now, no docked panel sibling here anymore. (Used to
                      also conditionally show the "Customer History" tab's
                      list + right-docked detail panel here instead, when
                      that tab was selected — moved into the Customer
                      Information panel itself as an "Interactions" tab per
                      explicit request (later renamed "Contacts" — see
                      `CUSTOMER_PANEL_TABS`), so this is unconditional
                      again.) */}
                  <div className="relative flex flex-1 overflow-hidden">
                      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                        {isHistoryConversationView && historyConversationForActive ? (
                          /* Past-session conversation, opened as its own tab in
                             this record area (see the history `Tab` in the
                             header row above) — replaces the live transcript/
                             composer while active. Read-only by nature: it's
                             an archived session, so no composer renders. */
                          <HistoryConversationView entry={historyConversationForActive.entry} />
                        ) : (
                        <>
                        {/* Wraps just the notices + transcript — see
                            AgentNextGenPage.tsx's identical wrapper for the
                            full "why `relative`, why NOT the composer/
                            VoiceCallControls bar too" reasoning. */}
                        <div className="relative flex flex-1 flex-col min-w-0 overflow-hidden">
                        {/* Reopened-from-history, closed interaction — read-only
                            notice. See `Interaction.closed`'s own doc
                            comment for the full picture (also drives hiding
                            `InteractionComposer` below and every channel's
                            kebab, both in this column and in the LeftNav
                            card/ChannelToggleGroup above). */}
                        {activeInteraction.closed && (
                          <div className="shrink-0 px-6 pt-4">
                            <InlineNotification variant="info">
                              You are viewing a closed interaction.
                            </InlineNotification>
                          </div>
                        )}
                        {/* Distinct from the read-only "closed interaction" notice
                            above — this is for a still-open assignment where just
                            THIS ONE channel has been set to "Closed" via the status
                            popover (see `Interaction.channelStatuses`'s own
                            doc comment). The agent can still switch to any other
                            (open, or not-yet-opened) channel on this same card
                            normally; only this specific channel's own composer
                            hides, per explicit request. */}
                        {!activeInteraction.closed && activeChannelStatus === "Closed" && (
                          <div className="shrink-0 px-6 pt-4">
                            <InlineNotification variant="info">
                              This channel is closed. Click Add Channel above and select the
                              appropriate channel to re-open the conversation.
                            </InlineNotification>
                          </div>
                        )}
                        {/* SLA banner — same `activeChannelAwaitingSeverity`
                            signal the record-header tab's own icon/color and
                            the LeftNav card's own dot already reflect for
                            this exact channel (see that derived value's own
                            doc comment above), just surfaced here as an
                            actual message too instead of relying on color
                            alone. Only for "warning"/"critical" — the green
                            "success" tier (customer just responded, still
                            well within SLA) isn't something worth an actual
                            banner over, same as "not awaiting at all"
                            (`undefined`) isn't. Also gated on "Resolved",
                            not just "Closed"/`activeInteraction.closed` —
                            per explicit request, a resolved channel stops
                            counting toward SLA (this banner included)
                            without being closed out: `activeChannel.
                            awaitingResponse` itself is never cleared by a
                            status change (see `handleInteractionStatusChange`'s
                            own doc comment — it only ever writes
                            `threadStatuses`), so without this explicit
                            check the banner could still fire for a channel
                            that was awaiting right up until the agent
                            marked it Resolved. */}
                        {!activeInteraction.closed &&
                          activeChannelStatus !== "Closed" &&
                          activeChannelStatus !== "Resolved" &&
                          (activeChannelAwaitingSeverity === "warning" || activeChannelAwaitingSeverity === "critical") && (
                          <div className="shrink-0 px-6 pt-4">
                            <InlineNotification variant={activeChannelAwaitingSeverity === "critical" ? "error" : "warning"}>
                              {activeChannelAwaitingSeverity === "critical"
                                ? "Agent has breached SLA time."
                                : "Agent is nearing SLA breach."}
                            </InlineNotification>
                          </div>
                        )}
                        {/* Hold SLA banner — voice calls on hold: same inline
                            alert style as the chat SLA banner above, warning
                            at 15s on hold, error at 30s. */}
                        {!activeInteraction.closed &&
                          !activeInteraction.voiceCallEnded &&
                          (activeChannelHoldSeverity === "warning" || activeChannelHoldSeverity === "critical") && (
                          <div className="shrink-0 px-6 pt-4">
                            <InlineNotification variant={activeChannelHoldSeverity === "critical" ? "error" : "warning"}>
                              {activeChannelHoldSeverity === "critical"
                                ? "Agent has breached hold time SLA."
                                : "Agent is nearing hold time SLA breach."}
                            </InlineNotification>
                          </div>
                        )}
                        <InteractionTranscript
 hideAiActions={hideAiActions}
                          hideMockFollowUpMessages={activeInteraction.id === LUCAS_THOMAS_ID}
                          channelType={activeChannelType}
                          // Feeds `TranscriptSessionSeparator`'s
                          // direction-aware voice/SMS icon. Per explicit
                          // request ("update the voice directions to
                          // indicate inbound or outbound like in Phase 1")
                          // — see `InteractionTranscript`'s own `direction`
                          // prop doc comment (agent-next-gen-transcript.tsx)
                          // and `AgentNextGenPage.tsx`'s identical call site.
                          direction={activeChannel?.direction}
                          customerName={activeInteraction.customerName}
                          // The active Thread's own base Contact id — falls
                          // back to the Customer ID only for the handful of
                          // non-outbound-originated flows whose Thread never
                          // set `contactId` (see that field's own doc
                          // comment on `Thread`) — a real Contact id is
                          // always preferred when one exists.
                          contactId={activeChannel?.contactId ?? activeInteraction.customerId}
                          // Per explicit request ("display the phone
                          // number instead of the contact ID in the
                          // session row") — see `InteractionTranscript`'s
                          // own `channelAddressLabel` prop doc comment
                          // (agent-next-gen-transcript.tsx) and
                          // AgentWorkspace2WithDeskPage.tsx's identical
                          // wiring.
                          channelAddressLabel={activeChannel?.addressLabel}
                          // Per explicit request ("rename the view details
                          // link 'Session Details'") — see
                          // `InteractionTranscript`'s own
                          // `viewDetailsLabel` prop doc comment
                          // (agent-next-gen-transcript.tsx). The only Phase
                          // 1 call site that actually renders this link at
                          // all (`showViewDetails` defaults `true` here,
                          // unlike every other call site on this page).
                          viewDetailsLabel="Session Details"
                          skillLabel={activeChannel?.preview}
                          // Per-Thread — see `Thread.startedFresh`'s own doc
                          // comment for why this reads the ACTIVE channel's
                          // own flag, not `activeInteraction.startedFresh`.
                          isFreshLaunch={!!activeChannel?.startedFresh}
                          // Per explicit request: mirrors `isFreshLaunch`'s
                          // own gating just above — see AgentNextGenPage.tsx's
                          // identical wiring for the full reasoning. Gated on
                          // `activeInteractionIsRealCustomer` (above) so a
                          // contact with no backing `CREATE_NEW_CUSTOMERS`/
                          // `createdCustomerRecords`/Contact History entry
                          // never gets fabricated content — a genuinely
                          // brand-new contact reads as a plain first contact
                          // instead. No longer ALSO gated on
                          // `activeChannel?.startedFresh` — see
                          // AgentNextGenPage.tsx's identical gate for the
                          // full reasoning (a real customer's overview now
                          // shows for an existing-conversation/transfer
                          // pickup too, just repositioned by
                          // `InteractionTranscript`'s own `isFreshLaunch`
                          // check).
                          // Per explicit request ("display the AI accordions
                          // in the place of the Context Overview... mirror
                          // Phase 1 functionality"): replaces the old plain
                          // `contactOverview` block with the same
                          // `customerContextOverview` prop AgentNextGenPage.tsx
                          // ("Phase 1") already passes at its own three
                          // `<InteractionTranscript>` call sites — renders the
                          // Customer Profile / Customer Snapshot / Next Best
                          // Action accordion cards (lyra-ui's
                          // `CustomerContextOverview`) instead of the original
                          // `ContactOverview` block. `undefined` for an
                          // unknown contact (`customerContextOverviewInfo`'s
                          // own `!isKnownCustomer` branch never sets
                          // `customerCard`, but the whole prop still needs to
                          // be present/absent to select the right branch in
                          // `renderContactOverviewBlock`, agent-next-gen-
                          // transcript.tsx) — matches this file's own prior
                          // `activeInteractionIsRealCustomer` gate.
                          //
                          // NOTE: this drops the bespoke "Journey Summary"
                          // card the old block added via `buildCopilotSummary`
                          // — Phase 1's `CustomerContextOverviewInfo` shape has
                          // no equivalent slot for it, and fully mirroring
                          // Phase 1 (as explicitly requested) means this
                          // content no longer renders here.
                          customerContextOverview={
                            activeInteractionIsRealCustomer
                              ? // Per explicit request ("i want the next best
                                // action content ... to populate like the way
                                // claude asks questions"), Marcus Webb's own
                                // refund-escalation Next Best Action swaps its
                                // plain sentence for an interactive Approve/
                                // Reject/Something-else card
                                // (`MarcusWebbNextBestActionCard`) via
                                // `ContactOverview`'s own `nextBestActionContent`
                                // override — every other interaction keeps
                                // `customerContextOverviewInfo` exactly as-is.
                                // `nextBestActionBare` per a later explicit
                                // follow-up request ("remove the next best
                                // action accordion") — the card already
                                // supplies its own bordered option/confirmation
                                // rows, so the surrounding accordion's own
                                // sparkle-icon title bar/chevron/green
                                // background would just be redundant chrome
                                // around it.
                                activeInteraction.id === MARCUS_WEBB_ID
                                ? {
                                    ...customerContextOverviewInfo,
                                    nextBestActionContent: (
                                      <PersistentHostSlot host={marcusCardHost} />
                                    ),
                                    nextBestActionBare: true,
                                  }
                                : customerContextOverviewInfo
                              : undefined
                          }
                          // Per explicit request ("hide the customer
                          // profile and contact snapshot from the main
                          // container and just display the next best
                          // action"), then a follow-up request ("add the
                          // contact overview accordion back into the main
                          // container above next best action" — "Contact
                          // Snapshot" specifically; "Customer Profile"
                          // stays hidden), then a follow-up request
                          // ("Autosummary should only display in the
                          // contact details") reversing that middle step
                          // (both hidden again, "Next Best Action" only),
                          // then a LATEST follow-up request ("replace the
                          // next best action in all new assignments with
                          // autosummary — tie the autosummary to the
                          // contact so it is not random info") reversing
                          // THAT: "Customer Profile" stays hidden, but
                          // "Contact Snapshot" (renamed "Autosummary" —
                          // see `CustomerContextOverview`'s own doc
                          // comment, contact-overview.tsx) is shown again
                          // here while "Next Best Action" is force-hidden
                          // instead — the main transcript column's fresh-
                          // assignment card now surfaces the real,
                          // per-contact Autosummary recap
                          // (`customerContextOverviewInfo.snapshot`, built
                          // per contact by `buildCustomerContextOverviewInfo`
                          // same as every other consumer of that object —
                          // never placeholder/random copy) instead of the
                          // generic Next Best Action suggestion. The voice
                          // "Details" side panel tab (below, near
                          // `activeChannelType === "voice"`) still shows
                          // its own separate, un-gated
                          // `DetailsPanelAccordions` render — see that
                          // render site's own doc comment — so Autosummary
                          // now renders in BOTH spots, matching this
                          // latest request. See `InteractionTranscript`'s
                          // own `showCustomerContextProfile`/
                          // `showCustomerContextSnapshot`/
                          // `showCustomerContextNextBestAction` prop doc
                          // comments (agent-next-gen-transcript.tsx).
                          showCustomerContextProfile={false}
                          showCustomerContextSnapshot={true}
                          // Marcus Webb is the one exception: his own
                          // "Next Best Action" isn't a plain suggested
                          // sentence at all, it's the interactive Approve/
                          // Reject/Something-else escalation card
                          // (`MarcusWebbNextBestActionCard`, wired above
                          // via `nextBestActionContent`/`nextBestActionBare`)
                          // the agent actually has to act on to resolve his
                          // scenario — `CustomerContextOverview` filters
                          // the whole "next-best-action" section (bare
                          // card included) out of `sections` entirely
                          // whenever `showNextBestAction` is `false` (see
                          // that component's own `.filter` on `sections`,
                          // contact-overview.tsx), so force-hiding it here
                          // unconditionally would silently break his
                          // takeover flow rather than just swap its look.
                          // Every other interaction keeps the new
                          // Autosummary-instead-of-Next-Best-Action
                          // behavior.
                          showCustomerContextNextBestAction={activeInteraction.id === MARCUS_WEBB_ID}
                          // "View customer info" — per explicit request
                          // ("match the customer info side panel content
                          // to what is currently in phase 1 (clicking
                          // view customer info opens the customer
                          // information within the side panel)"): now
                          // gated on `activeInteractionIsRealCustomer`
                          // (previously unconditional), mirroring
                          // AgentNextGenPage.tsx's identical gate on its
                          // own equivalent call site — see
                          // `focusCustomerPanelTab`'s own doc comment for
                          // what it now does. No `onViewInteractionHistory`
                          // here (this page's panel tabs never include
                          // "Contacts" either, whether the interaction is
                          // a real customer or not — see the `tabs` prop
                          // at this page's own `CustomerInformationSidePanel`
                          // call site).
                          onViewCustomerInfo={
                            activeInteractionIsRealCustomer ? focusCustomerPanelTab : undefined
                          }
                          // Per explicit request/follow-up clarification —
                          // see `activeChannelIsNewOutboundThread`'s own
                          // doc comment above for the full reasoning.
                          isNewThread={activeChannelIsNewOutboundThread}
                          // Per explicit follow-up request ("let's update
                          // the channel controls to always be in the
                          // session row - even if there is only one channel
                          // open (no tabs) - moving them around is
                          // confusing"): was `showChannelTabRow` — this
                          // cluster used to relocate up into the record
                          // header whenever there was only 1 channel open
                          // and only live here once a 2nd channel made the
                          // real tab row appear. Now always on — this
                          // session row is the single, permanent home for
                          // these controls regardless of channel count; the
                          // header's own now-removed copy is gone (see the
                          // record-header `actions` call site above).
                          showSessionActionCluster
                          // Per explicit follow-up request ("hide the add
                          // participant icon button and for all interactions
                          // move the transfer inside the 3 dots menu - move
                          // the 3 dots to the left of the outcome button and
                          // move the status chip to the left of the 3 dots
                          // button") — three new, Advanced-only props on the
                          // shared `agent-next-gen-transcript.tsx` component
                          // (see each one's own doc comment there): Add
                          // Participant hidden outright, Consult/Transfer
                          // folded into the kebab's own menu instead of its
                          // own icon, and the status tag/kebab/Outcome
                          // reordered to render in that sequence. Applied
                          // unconditionally here (not gated by channel type)
                          // per "for all interactions".
                          showSessionAddParticipant={false}
                          sessionTransferInKebabMenu
                          sessionStatusAndKebabBeforeOutcome
                          // Per explicit follow-up request ("remove the
                          // more options for phase 1 - these will not be
                          // available until phase 2") — `showSessionKebabMenu`
                          // defaults to `true` (`InteractionTranscript`'s own
                          // default, agent-next-gen-transcript.tsx); `false`
                          // hides this session row's own kebab outright,
                          // mirroring the identical `showKebab: false` change
                          // at the LeftNav's own `ChannelRow` channel mapping
                          // above (same request, same reasoning — nothing
                          // behind either kebab is ready for this phase yet).
                          // `sessionTransferInKebabMenu` just above is left
                          // as-is rather than removed too — with the kebab
                          // itself hidden it's simply inert (nothing left to
                          // fold Consult/Transfer into), so Phase 2 (which
                          // still wants this exact prop combination) doesn't
                          // need it re-added later.
                          showSessionKebabMenu={false}
                          // Per explicit request: while reviewing Marcus
                          // Webb's still-live AI-agent conversation, the
                          // status chip/kebab/Outcome button are locked
                          // (visible but non-interactive) until the agent
                          // takes over — same `MARCUS_WEBB_ID &&
                          // marcusWebbReviewing` guard already used
                          // elsewhere in this file for this exact state
                          // (e.g. the hang-up button, the review `ActionBar`
                          // itself).
                          reopenedContacts={activeChannel?.reopenedContacts}
                          // Per explicit follow-up request ("do not have the
                          // transcript appear in the main content area"):
                          // this is the main record column's own
                          // `InteractionTranscript` instance, always
                          // mounted here regardless of channel type — unlike
                          // the two Transcript-tab instances (session
                          // details panel + its hover-preview twin, both
                          // explicitly gated on `customerPanelActiveTab ===
                          // "Transcript" && activeChannelType === "voice"`),
                          // this one has no such gate, so a voice thread's
                          // `liveMessages` (e.g. `MARCUS_WEBB_CALL_TRANSCRIPT`,
                          // wired in under the `"voice"` key by the "L"
                          // keydown handler) would otherwise leak into the
                          // main column too. Excluded here for voice
                          // specifically — chat/sms/whatsapp still get their
                          // live messages here same as before, since that's
                          // the exact mechanism this column's own
                          // conversation view is built on.
                          sessionControlsReadOnly={
                            (activeInteraction.id === MARCUS_WEBB_ID && marcusWebbReviewing) ||
                            (activeInteraction.id === LUCAS_THOMAS_ID && lucasThomasReviewing)
                          }
                          liveMessages={
                            isColdCallId(activeInteraction.id)
                              ? // The call transcript lives in the Transcript tab; the main column keeps only AI action rows (interstitials).
                                (activeInteraction.liveMessages?.voice ?? []).filter((m) => !!m.instruction)
                              : activeChannelType === "voice"
                                ? []
                                : (activeInteraction.liveMessages?.[activeChannelKey] ?? [])
                          }
                          // See `customerTyping`'s own doc comment above —
                          // scoped to whichever channel is ACTIVE right now,
                          // same reasoning `applyToChannel` itself already
                          // uses for `channelKeyAtSend`.
                          isCustomerTyping={!!customerTyping[`${activeInteraction.id}:${activeChannelKey}`]}
                          isAiTyping={!!aiTyping[`${activeInteraction.id}:${activeChannelKey}`]}
                          onApprovalDecision={activeInteraction.id === LUCAS_THOMAS_ID ? handleLucasApprovalDecision : undefined}
                          onApprovalCallRequest={activeInteraction.id === LUCAS_THOMAS_ID ? handleLucasCallRequest : undefined}
                          onWrapUpComplete={
                            activeInteraction.id === LUCAS_THOMAS_ID
                              ? () => {
                                  handleLucasApprovalDecision("ship-wrapup", "");
                                  // The review banner animates out (no takeover: no handoff message, no SLA clock).
                                  setLucasThomasBannerExiting(true);
                                  window.setTimeout(() => {
                                    setLucasThomasBannerHidden(true);
                                    setLucasThomasBannerExiting(false);
                                  }, 220);
                                }
                              : undefined
                          }
                          approvalTakenOver={activeInteraction.id === LUCAS_THOMAS_ID && !lucasThomasReviewing}
                          onApprovalSuggestionAsk={
                            activeInteraction.id === LUCAS_THOMAS_ID
                              ? (text: string) => handleCopilotAsk(LUCAS_THOMAS_ID, "chat", text)
                              : undefined
                          }
                          autosummaryBlue={activeInteraction.id === LUCAS_THOMAS_ID || activeInteraction.id === MARCUS_WEBB_ID || isColdCallId(activeInteraction.id)}
                          // AI-led cases always keep the Autosummary above the conversation, even when the transcript remounts with messages already present.
                          contactOverviewPosition={activeInteraction.id === LUCAS_THOMAS_ID || activeInteraction.id === MARCUS_WEBB_ID || isColdCallId(activeInteraction.id) ? "top" : undefined}
                          activeSnapshotLink={activeInteraction.id === LUCAS_THOMAS_ID || isColdCallId(activeInteraction.id) ? lucasActiveLinkKey : undefined}
                          onSnapshotLink={
                            isColdCallId(activeInteraction.id)
                              ? (key) => {
                                  if (key === "order" || key === "card" || key === "void-steps" || key === "maya-order" || key === "maya-card" || key === "maya-refund-steps") {
                                    openDetailPanelContent({ kind: "tom-call", panel: key });
                                  } else if (key.startsWith("instruction:")) {
                                    const [, decision, text, time] = key.split(":");
                                    openDetailPanelContent({
                                      kind: "lucas-instruction",
                                      decision,
                                      text: decodeURIComponent(text ?? ""),
                                      time: decodeURIComponent(time ?? ""),
                                    });
                                  }
                                }
                              : activeInteraction.id === MARCUS_WEBB_ID
                              ? (key) => {
                                  if (key === "order") openDetailPanelContent({ kind: "order", order: MARCUS_WEBB_ORDER });
                                }
                              : activeInteraction.id === LUCAS_THOMAS_ID
                              ? (key) =>
                                  key === lucasActiveLinkKey
                                    // Clicking the row/link whose panel is already open closes it (toggle).
                                    ? setSelectedDetailPanelContent(null)
                                    : key.startsWith("instruction:")
                                    ? (() => {
                                        const [, decision, text, time] = key.split(":");
                                        openDetailPanelContent({
                                          kind: "lucas-instruction",
                                          decision,
                                          text: decodeURIComponent(text ?? ""),
                                          time: decodeURIComponent(time ?? ""),
                                        });
                                      })()
                                    : key.startsWith("memory:")
                                    ? openExperienceMemoryInSidePanel(key.slice("memory:".length) as LucasThomasMemoryFocus)
                                    : openDetailPanelContent({ kind: "lucas", panel: key as LucasThomasPanelKey })
                              : undefined
                          }
                          // Same union of conditions the "closed
                          // interaction"/"channel closed" banners just above
                          // this transcript already gate on — see `dimmed`'s
                          // own doc comment for why both, not just one.
                          dimmed={!!activeInteraction.closed || activeChannelStatus === "Closed"}
                          currentStatus={activeChannelStatus}
                          onCurrentStatusChange={(status) =>
                            activeChannel && handleInteractionStatusChange(activeInteraction.id, activeChannel.id, status)
                          }
                          // Same shared `outcomeDraftKey`/`outcomeDraft` state
                          // the LeftNav's own `ChannelRow` Outcome button uses
                          // for this exact channel (`outcomeKey` — same
                          // `${interactionId}:${channelKey}` scheme that
                          // call site uses) — see `InteractionTranscript`'s
                          // own outcome props' doc comment.
                          outcomeOpen={outcomeDraftKey === activeChannelOutcomeKey && outcomeDraftSource === "transcript"}
                          onOutcomeOpenChange={(open) => handleOutcomeOpenChange(activeChannelOutcomeKey!, open, "transcript")}
                          outcomeTags={outcomeDraft.tags}
                          onOutcomeTagsChange={handleOutcomeTagsChange}
                          outcomeDispositionCode={outcomeDraft.dispositionCode}
                          onOutcomeDispositionChange={handleOutcomeDispositionChange}
                          outcomeSummary={outcomeDraft.summary}
                          onOutcomeSummaryChange={(value) => setOutcomeDraft((d) => ({ ...d, summary: value }))}
                          onOutcomeSave={handleOutcomeSave}
                          onOutcomeCancel={handleOutcomeCancel}
                          // Per explicit request: once this voice channel's
                          // call has ended, the Outcome popover's footer
                          // becomes "Save & Redial"/"Save & Dismiss" instead
                          // — same condition as the LeftNav `ChannelRow`
                          // config's own `callEnded` above. `anchorEl` here
                          // is the Outcome trigger's OWN DOM node
                          // (`OutcomePanel` threads it through automatically
                          // — see its own doc comment, outcome-panel.tsx),
                          // so the resulting "Redial Contact" popover
                          // anchors right on this session row's Outcome
                          // button, same as Contact History's own Redial
                          // button anchors its identical popover on itself.
                          outcomeCallEnded={activeChannelType === "voice" && !!(activeInteraction.closed || activeInteraction.voiceCallEnded)}
                          onOutcomeSaveAndRedial={(anchorEl) =>
                            handleOutcomeSaveAndRedial(
                              activeInteraction.id,
                              activeChannel?.value ??
                                activeChannel?.addressLabel ??
                                synthesizeChannelAddress("voice", activeInteraction.customerId ?? activeInteraction.id, activeInteraction.customerName),
                              anchorEl
                            )
                          }
                          onOutcomeSaveAndDismiss={() => handleOutcomeSaveAndDismiss(activeInteraction.id)}
                          // Same dismiss logic `ChannelTab`'s own kebab
                          // "Unassign & Dismiss" entry uses for this exact
                          // channel — dismiss just the channel while others
                          // remain open, or the whole interaction once this
                          // is the last one. Per explicit follow-up request
                          // ("also remove the unassign and dismiss icon
                          // button while the call is on") — hidden
                          // (`undefined`) while a voice call is still live,
                          // same as the LeftNav `ChannelRow` config's own
                          // `showDismissButton` just above; mirrors
                          // `AgentNextGenPage.tsx`'s own identical gating.
                          // Same Marcus-only exception as that LeftNav copy
                          // too — once his channel reads "Resolved," this
                          // icon (here, "the top right of the contact")
                          // doesn't have to wait for the call to actually be
                          // hung up either. Per a later explicit follow-up
                          // request: once the call has actually ended,
                          // "Save & Dismiss" in the Outcome popover replaces
                          // this icon entirely — so unlike before, this no
                          // longer shows again once `voiceCallEnded` is true
                          // (the `closed`-reopened-from-history branch, i.e.
                          // "Remove from Queue", and the live Marcus
                          // exception are both preserved unchanged).
                          onDismissChannel={
                            activeChannel &&
                            // Lucas's chat can only be removed once it is Closed (then the "X" / Remove from Queue shows).
                            (activeInteraction.id !== LUCAS_THOMAS_ID || activeChannelStatus === "Closed" || !lucasThomasReviewing) &&
                            (activeChannelType !== "voice" ||
                              activeInteraction.closed ||
                              (!activeInteraction.voiceCallEnded &&
                                activeInteraction.id === MARCUS_WEBB_ID &&
                                activeChannelStatus === "Resolved"))
                              ? () => {
                                  if (activeInteraction.threads.length > 1) {
                                    handleDismissChannel(activeInteraction.id, activeChannel);
                                  } else {
                                    handleDismissInteraction(activeInteraction.id);
                                  }
                                }
                              : undefined
                          }
                          // Wired for every channel — see
                          // `currentSessionDetails`'s own doc comment above
                          // for the full rationale.
                          onCurrentSessionChange={activeChannelType === "voice" ? setCurrentVoiceSession : setCurrentSessionDetails}
                          // See AgentNextGenPage.tsx's identical prop for
                          // the full rationale.
                          hideSessionSeparatorFade={
                            activeChannelType === "voice" && voiceVideoWindowOpen && voiceVideoFullScreen
                          }
                          // Per later explicit request ("put the transcript
                          // and session tabs into the new customer
                          // information side panel"): "View Details" now
                          // targets that ONE docked panel's own "Session
                          // Details" tab (`customerPanelActiveTab`/
                          // `sidePanelOpen`) instead of a dedicated,
                          // separate overlay — same toggle semantics as
                          // before (already showing this exact session ->
                          // close; otherwise switch to it and open), minus
                          // the old "close instead of switching tabs when
                          // open on a different tab" quirk, which made
                          // sense for a panel that ONLY ever showed
                          // Details/Transcript/Session but would now also
                          // close the shared Customer Information panel out
                          // from under an agent who simply had it open on
                          // its "Details" accordions for an unrelated
                          // reason.
                          onViewSessionDetails={(session) => {
                            // A slide-out panel (order/card/instruction…) closes when Session Details is opened.
                            setSelectedDetailPanelContent(null);
                            const alreadyShowingThisSession =
                              sidePanelOpen &&
                              customerPanelActiveTab === "Session Details" &&
                              (activeChannelType === "voice"
                                ? selectedVoiceDetailsSession?.id === session.id
                                : selectedSessionDetails?.id === session.id);
                            if (alreadyShowingThisSession) {
                              setSidePanelOpen(false);
                            } else {
                              if (activeChannelType === "voice") {
                                setSelectedVoiceDetailsSession(session);
                              } else {
                                setSelectedSessionDetails(session);
                              }
                              setCustomerPanelActiveTab("Session Details");
                              setSidePanelOpen(true);
                            }
                          }}
                          // Per explicit follow-up request ("move the
                          // details side panel toggle to above the session
                          // row to the right of the voice + button group"),
                          // the "Open Details Panel" toggle (button +
                          // hover-preview `Popover`) moved from this session
                          // row up to the record header's own `actions`
                          // block (`PageHeader`'s call site, above) —
                          // `onToggleDetailsPanel`/`detailsPanelOpen`/
                          // `detailsPanelPreviewContent`/
                          // `detailsPanelPreviewOpen`/
                          // `onDetailsPanelPreviewHoverStart`/
                          // `onDetailsPanelPreviewHoverEnd` are no longer
                          // passed here at all; see that `actions` block's
                          // own doc comment for the full history/reasoning.
                        />
                        {/* Full-screen video — see AgentNextGenPage.tsx's
                            identical render site for the full rationale. */}
                        {voiceVideoWindowOpen && voiceVideoFullScreen && activeChannelType === "voice" && (
                          <VideoCallFullScreen
                            customerName={activeInteraction.customerName}
                            onExitFullScreen={() => setVoiceVideoFullScreen(false)}
                            // See AgentNextGenPage.tsx's identical prop for
                            // the full rationale.
                            onClose={() => {
                              setVoiceVideoWindowOpen(false);
                              setVoiceVideoFullScreen(false);
                            }}
                            customerIdentified={activeInteractionIsRealCustomer}
                          />
                        )}
                        {/* Reject flow's customer-provided photo "takes
                            over" the MAIN interaction column, same
                            mechanic as the video call full-screen just
                            above — see `marcusWebbPhotoExpanded`'s own doc
                            comment. Never rendered inside the transcript
                            column itself (an earlier pass got this
                            backwards — see `MarcusWebbNextBestActionCard`'s
                            own top doc comment). Per a later explicit
                            request, this is now the real photo
                            (`src/assets/headphones.jpg`) — `object-contain`
                            (not `-cover`, unlike the small thumbnail on the
                            card itself) so the whole image is visible in
                            this larger, full-screen context rather than
                            cropped to fill it.

                            No explicit z-index on the root, and the close
                            button pushed down to `top-14` instead of
                            `top-4` — same fix `VideoCallFullScreen`'s own
                            doc comment already documents for this identical
                            problem (an earlier pass here covered the
                            transcript's own sticky session separator,
                            `TranscriptSessionSeparator`, `sticky top-0
                            z-[1]`, per explicit bug report: "have the full
                            screen image appear under the session row").
                            Leaving this root at z-index:auto lets that
                            separator's own explicit `z-[1]` win any
                            overlap, and `top-14` (56px, past the
                            separator's own single-row height) keeps the
                            close button from ever landing in that same
                            strip in the first place. */}
                        {marcusWebbPhotoExpanded && activeInteraction.id === MARCUS_WEBB_ID && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-lyra-bg-surface-inverse">
                            <button
                              type="button"
                              onClick={() => setMarcusWebbPhotoExpanded(false)}
                              aria-label="Exit full screen"
                              className="absolute right-4 top-14 flex h-8 w-8 items-center justify-center rounded-lyra-sm text-lyra-fg-on-primary transition-colors hover:bg-white/10"
                            >
                              <Minimize2 className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                            </button>
                            <img
                              src={damagedHeadphonesImg}
                              alt="Photo of the damaged headphone ear cup"
                              className="max-h-[80%] max-w-[80%] object-contain"
                            />
                          </div>
                        )}
                        </div>
                        {/* Marcus Webb's currently-active question (and the
                            Contact Overview accordion, while one's pending)
                            portal here (see `MarcusWebbNextBestActionCard`'s
                            own `questionSlotElement` doc comment). A real
                            `shrink-0` flex sibling of the transcript wrapper
                            above — NOT `absolute` — per explicit bug report:
                            floating it over the transcript (an earlier
                            attempt, chosen to avoid "scrunching" the
                            transcript's scroll height) instead covered real
                            content behind it (the customer's photo) and, with
                            no scroll mechanism of its own inside an
                            `overflow-hidden` ancestor, silently clipped a
                            tall options list with no way to reach the last
                            option. `max-h-[50vh] overflow-y-auto` is the
                            fix: bounded so the transcript above always keeps
                            a fair share of the column, but scrollable so a
                            tall card is always fully reachable instead of
                            clipped. `empty:hidden` collapses it to nothing
                            (matching the old "costs nothing while idle"
                            behavior) whenever nothing's actually portaled
                            into it. `max-w-[768px] mx-auto px-6` matches the
                            transcript's own centered message column exactly
                            (agent-next-gen-transcript.tsx). */}
                        <div
                          ref={setMarcusQuestionSlotEl}
                          className="mx-auto flex w-full max-w-[768px] shrink-0 flex-col gap-3 overflow-y-auto px-6 pb-3 empty:hidden max-h-[50vh]"
                        >
                          {/* Per explicit follow-up request ("remove the
                              AI ask a question from the contact main
                              containers for all interactions"): every
                              interaction OTHER than Marcus Webb used to get
                              an inert "ask a question" field here — fully
                              uncontrolled/inert (no `value`/`onChange`/
                              `onSubmit`), never wired to anything real —
                              instead of this slot just collapsing to
                              nothing. That's gone now; this node exists
                              purely as Marcus Webb's own portal target
                              (`questionSlotElement`, set via
                              `setMarcusQuestionSlotEl` above) for his
                              scripted questions AND his own real ask-flow,
                              elsewhere in this same return when he's
                              active — every other interaction now leaves
                              this slot genuinely empty (`empty:hidden`
                              above collapses it to nothing, same as
                              before). */}
                        </div>
                        {/* Per explicit request ("add the chat input to the
                            bottom of a chat in v1"): the main transcript
                            column renders its own `InteractionComposer` again
                            for chat / SMS / WhatsApp (not voice or email),
                            reversing the earlier "keep it in the side panel
                            only" request below. Hidden once the interaction
                            or this thread is closed, and while Marcus Webb's
                            review bar owns this slot. The side panel's
                            channel-preview composer is unchanged. */}
                        {activeInteraction &&
                          activeChannelType &&
                          activeChannelType !== "voice" &&
                          activeChannelType !== "email" &&
                          !activeInteraction.closed &&
                          activeInteraction.threadStatuses?.[activeChannelKey] !== "Closed" &&
                          !(activeInteraction.id === MARCUS_WEBB_ID && marcusWebbReviewing) &&
                          (
                            <InteractionComposer
                              hideAiActions={hideAiActions}
                              onHideAiActionsChange={setHideAiActions}
                              copilotOnly={activeInteraction.id === LUCAS_THOMAS_ID && lucasThomasReviewing}
                              onTakeover={activeInteraction.id === LUCAS_THOMAS_ID ? () => handleLucasTakeover() : undefined}
                              onSend={(text) => handleSendMessage(activeInteraction.id, text, activeChannelKey)}
                              copilotSuggestions={
                                activeInteraction.id === LUCAS_THOMAS_ID
                                  ? LUCAS_THOMAS_COPILOT_SUGGESTIONS
                                  : ["Summarize this conversation", "Suggest a reply", "What is the customer's history?"]
                              }
                              copilotSuggestionLinks={
                                activeInteraction.id === LUCAS_THOMAS_ID ? LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS : undefined
                              }
                              copilotSuggestionReplacements={
                                activeInteraction.id === LUCAS_THOMAS_ID
                                  ? LUCAS_THOMAS_COPILOT_SUGGESTION_REPLACEMENTS
                                  : undefined
                              }
                              onCopilotSuggestionLink={(key: string) =>
                                openDetailPanelContent({ kind: "lucas", panel: key as LucasThomasPanelKey })
                              }
                              onCopilotAsk={(text: string) => handleCopilotAsk(activeInteraction.id, activeChannelKey, text)}
                            />
                          )}
                        {/* Per explicit request ("don't add the chat input
                            to the main container when a new chat is open -
                            keep it in the side panel"): the main transcript
                            column never renders its own `InteractionComposer`
                            anymore, for ANY channel type, including chat/
                            SMS/WhatsApp, which used to get one here. Replying
                            now always happens through the docked side panel
                            (`CustomerInformationSidePanel`'s channel-preview
                            override, opened via that channel's own icon in
                            the header row - see `channelPreviewThreadKey`),
                            the same single composer surface every other
                            channel preview already uses, rather than a
                            second, main-column-only composer instance. */}
                        {/* "Reviewing this conversation" action bar — per a
                            LATER explicit follow-up request ("move the
                            review action bar back to the bottom and remove
                            the min-height so it isn't so tall"), moved back
                            here (its original spot, in `InteractionComposer`'s
                            own slot — voice has no composer of its own) after
                            a brief stint hoisted above the contact identity
                            row; see git history for that in-between
                            position's own doc comment if it's ever needed
                            again. Gated on `activeInteraction.id ===
                            MARCUS_WEBB_ID` (not `liveVoiceCallInteraction`,
                            which persists regardless of what's on screen) so
                            it only ever shows while actually looking at
                            Marcus's interaction. lyra-ui's own `ActionBar`
                            (icon + title + description + an `actions` slot)
                            reused as-is; only "Takeover" is wired
                            (`setMarcusWebbReviewing(false)` — the sole way
                            out of review mode, matching the toast's own
                            "Takeover" one step up the flow);
                            "Guide Conversation"/"Transfer" have no specified
                            behavior yet, left as inert buttons. No more
                            fixed `h-20` — per the same explicit request, the
                            outer card now sizes to `ActionBar`'s own natural
                            content height instead of being forced taller
                            than it needs. */}
                        {/* Cold call from Tom Lewis: just the Ask Copilot footer (no AI agent to take over from). */}
                        {isColdCallId(activeInteraction.id) && !(activeInteraction.id === TOM_LEWIS_CALL_ID && tomLewisCallRinging) && (
                          <InteractionComposer
                            copilotOnly
                            onSend={() => {}}
                            copilotSuggestions={activeInteraction.id === MAYA_CHEN_CALL_ID ? MAYA_CHEN_CALL_COPILOT_SUGGESTIONS : TOM_LEWIS_CALL_COPILOT_SUGGESTIONS}
                            copilotSuggestionLinks={activeInteraction.id === MAYA_CHEN_CALL_ID ? MAYA_CHEN_CALL_COPILOT_LINKS : TOM_LEWIS_CALL_COPILOT_LINKS}
                            onCopilotSuggestionLink={(key: string) =>
                              openDetailPanelContent({ kind: "tom-call", panel: key as TomLewisCallPanelKey })
                            }
                            onCopilotAsk={(text: string) => handleCopilotAsk(activeInteraction.id, "voice", text)}
                          />
                        )}
                        {activeInteraction.id === MARCUS_WEBB_ID && (
                          // Stays after takeover (Ask Copilot only — a voice call has no chat input); the Takeover Call button only while reviewing.
                          <InteractionComposer
                            copilotOnly
                            takeoverLabel="Takeover Call"
                            takeoverDisabled={!!liveVoiceCallInteraction && liveVoiceCallInteraction.id !== MARCUS_WEBB_ID}
                            takeoverDisabledReason="A call is already in progress"
                            onTakeover={marcusWebbReviewing ? () => setMarcusWebbReviewing(false) : undefined}
                            onSend={() => {}}
                            copilotSuggestions={["Summarize this call", "Show purchase history", "What did the AI agent try?"]}
                            copilotSuggestionLinks={{
                              "Summarize this call": "Summarize this call",
                              "Show purchase history": "Show purchase history",
                              "What did the AI agent try?": "What did the AI agent try?",
                            }}
                            onCopilotAsk={(text: string) =>
                              handleMarcusCopilotAsk(
                                text,
                                ["Summarize this call", "Show purchase history", "What did the AI agent try?"].includes(text) ? undefined : 1800
                              )
                            }
                            onCopilotSuggestionLink={(text: string) => {
                              const req = marcusCopilotRequestsRef.current[marcusCopilotRequestsRef.current.length - 1];
                              if (req) openDetailPanelContent({ kind: "marcus-copilot", ...req });
                            }}
                          />
                        )}
                        </>
                        )}
                      </div>
                      {/* The separate voice/non-voice "Session Details"
                          `InteriorPanel` overlay that used to render here
                          (portaled beside `CustomerInformationSidePanel`)
                          is gone — per later explicit request ("put the
                          transcript and session tabs into the new customer
                          information side panel and rename the side panel
                          Session Details"), its Transcript/Session Details
                          tabs moved INTO that docked panel itself (see its
                          own render site's doc comment, several hundred
                          lines down) instead of living in a second, parallel
                          panel. */}
                  </div>
                </div>
              ) : (
                <div key="dashboard" className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200">
              {/* Body row: main content + interior panel */}
              <div className="relative flex flex-1 overflow-hidden">
              {/* Customers list view + row-info panel stay mounted across
                  desk-tab switches (never unmounted by the `hidden` toggle
                  below) so `CustomersListView`'s own search/sort/filters/
                  added-filter-keys/visible-columns/pagination/row-selection
                  state all survive navigating away to another tab and back
                  — a plain `cond ? <CustomersListView/> : ...` would remount
                  it fresh (and lose every one of those) each time.

                  Both now live together in ONE real box (`flex flex-1
                  overflow-hidden`, not `display:contents`) that toggles
                  `hidden` as a whole, rather than each having its own
                  separate visibility mechanism the way this used to be
                  split (`CustomersListView` behind a `contents`/`hidden`
                  wrapper, `CustomerRowInfoPanel` driven by nulling its own
                  `row` prop instead). That split was the actual cause of a
                  reported bug: nulling `row` on tab-switch didn't hide the
                  panel — it told `InteriorPanel` to CLOSE, which plays its
                  own 250ms width-close transition. Because the panel was a
                  real flex sibling of whatever the newly-selected tab was
                  about to show, that 250ms of shrinking width visibly
                  reflowed the new tab's content growing to fill the space
                  beside it — the "dashboard animating its position" bug.
                  Removing it from layout instantly (rather than animating
                  the panel closed) is what fixes the reported reflow — the
                  panel's own real open/close animation still plays normally
                  for actual same-tab closes (its header's × button, or
                  `onRowClick` picking a different row); only navigating AWAY
                  from this tab skips it.

                  `display:none` (Tailwind's `hidden`) was the first attempt
                  here, but it caused a SECOND, subtler bug on the way BACK
                  in: `InteriorPanel` (inside `CustomerRowInfoPanel`) tracks
                  its own real DOM parent's width via `ResizeObserver` to
                  decide whether to auto-full-screen below 768px (see that
                  component's own doc comment) — and `display:none` elements
                  report a genuine 0×0 size to `ResizeObserver`, not just a
                  stale old value. So the instant this wrapper went
                  `display:none`, the observer fired with width 0, and that
                  0 lingered as `InteriorPanel`'s last-known parent width
                  until a NEW (necessarily asynchronous — `ResizeObserver`
                  callbacks never run synchronously with the style change
                  that caused them) callback caught up with the real width
                  after switching back. For that one frame, `parentWidth`
                  read as 0 (well under both the 1024px/768px thresholds),
                  so `InteriorPanel` briefly rendered its full-screen/
                  absolute-overlay layout before correcting itself back to
                  its normal ~350-425px docked width and position — visible
                  as the panel sliding in from full width, the left-to-right
                  animation reported after this fix's first pass.

                  `visibility:hidden` (`invisible`) + `position:absolute
                  inset-0` was the SECOND attempt, replacing `display:none` —
                  it still generates a real box with a real, stable size for
                  `ResizeObserver`, fixing the bug above. But it introduced a
                  THIRD bug: `visibility` is inherited but overridable by a
                  descendant that sets its own explicit value — and
                  `InteriorPanel`'s inner content div does exactly that
                  (`style={{ visibility: open ? "visible" : "hidden" }}`,
                  interior-panel.tsx), keyed off its OWN `open` prop, which is
                  `row !== null` — true regardless of which desk tab is
                  active, since `row` is just `selectedCustomerRow` now, not
                  gated on `activeDeskTab` (see the render call site below).
                  So `invisible` on this wrapper got silently overridden back
                  to visible one level down, and — still `position:absolute`,
                  so no longer competing for flex space either — the panel
                  rendered floating on top of whatever tab WAS actually
                  active, confirmed from a screenshot showing it overlapping
                  the Dashboard.

                  `opacity-0` (this wrapper) + `inert` (native HTML attribute,
                  supported as a real prop since React 19 — see this file's
                  own React version) is the fix that actually holds up:
                  unlike `visibility`, `opacity` composites the WHOLE
                  subtree as one flattened layer, so a descendant's own
                  inline `opacity`/`visibility` can't punch back through a
                  `0`-opacity ancestor the way it could with `visibility`
                  alone. `inert` (not just `pointer-events-none`) additionally
                  drops the entire subtree out of tab order and the
                  accessibility tree and blocks ALL interaction, not only
                  pointer events — the same "fully inactive but still really
                  there, still correctly sized" result `visibility:hidden`
                  was reaching for, just via a property children genuinely
                  cannot override.

                  On this page none of the above applies anymore: Phase 1
                  has no desk tabs (`activeDeskTab` is a constant "home"), so
                  the always-mounted, invisible Customers table only sat on
                  top of Home, where the component-highlight overlay labeled
                  Home as `CustomersListView`/`TableToolbar`/... It's now
                  rendered only while the Customers tab is active, i.e.
                  never on Phase 1. The tab-switch handling above still
                  lives in AgentWorkspace2WithDeskPage.tsx, which has real
                  desk tabs. The Search panel's own Customers sub-tab
                  doesn't need this block; it renders its own row panel. */}
              {activeDeskTab === "customers" && (
              <div className="relative flex flex-1 overflow-hidden animate-in fade-in-0 duration-200">
                <CustomersListView
                  onStartInteraction={(contact, channel, phone, skillId) =>
                    handleStartCall({ contact, channel, phone, skillId })
                  }
                  addedFilterKeys={customerAddedFilterKeys}
                  onAddedFilterKeysChange={setCustomerAddedFilterKeys}
                  filterValues={customerFilterValues}
                  onFilterValuesChange={setCustomerFilterValues}
                  // Per explicit request, clicking a row in this (Agent
                  // Workspace 2.0's own, non-"With Desk") Customers table no
                  // longer opens `CustomerRowInfoPanel` — a no-op. The panel
                  // itself, `selectedCustomerRow`, and `openRowId` below are
                  // all left in place unchanged (still driven by other
                  // sources of the same shared state, e.g. the Search
                  // panel's own Customers sub-tab — see `searchContent`'s
                  // own `onRowClick` further up) — this only disables the
                  // click affordance on THIS table's own rows.
                  onRowClick={() => {}}
                  searchQuery={customerSearchQuery}
                  onSearchChange={setCustomerSearchQuery}
                  sortKey={customerSortKey}
                  sortDir={customerSortDir}
                  onSort={handleCustomerSort}
                  sortedRows={customerSortedRows}
                  openRowId={selectedCustomerRow?.contactNumber ?? null}
                  // Per explicit request (with screenshots) — leading
                  // overlapping channel-icon stack instead of the "Channels"
                  // column, Premium/Advanced only. See `leadingChannelStack`'s
                  // own doc comment (agent-next-gen-customers-table.tsx).
                  leadingChannelStack
                  // Per explicit request ("add a blank column header and if
                  // a record is open as an assignment or as a tab add an
                  // eye icon"), Premium/Advanced only — a row is "open" if
                  // it has a live left-nav assignment card (`interactions`,
                  // matched on `Interaction.customerId`, the same id space
                  // as `row.contactNumber` — see `isRowOpen`'s own doc
                  // comment, agent-next-gen-customers-table.tsx). This tier
                  // has no customer full-screen tabs (`openCustomerTabs` is
                  // a Premium-only feature — see AgentWorkspace2WithDeskPage.
                  // tsx's own call site), so that half of the check simply
                  // doesn't apply here.
                  isRowOpen={(row) => interactions.some((i) => i.customerId === row.contactNumber)}
                />
                <CustomerRowInfoPanel
                  row={selectedCustomerRow}
                  onClose={() => setSelectedCustomerRow(null)}
                  onPrevious={() => handleCustomerRowNav(-1)}
                  onNext={() => handleCustomerRowNav(1)}
                  hasPrevious={selectedCustomerIndex > 0}
                  hasNext={selectedCustomerIndex !== -1 && selectedCustomerIndex < customerSortedRows.length - 1}
                  onStartInteraction={(contact, channel, phone, skillId) =>
                    handleStartCall({ contact, channel, phone, skillId })
                  }
                  tabs={AGENT_WORKSPACE_CUSTOMER_PANEL_TABS}
                  onAddToast={addToast}
                  // Per explicit request ("hide the next/prev in the
                  // customer info cards for advanced and premium in the
                  // customer table view") — see `hidePrevNext`'s own doc
                  // comment (agent-next-gen-customer-info-panel.tsx).
                  hidePrevNext
                />
              </div>
              )}
              {activeDeskTab !== "customers" && (activeDeskTab !== "home" ? (
                // Accounts/Tickets/WEM — no content built yet; same
                // "Coming soon" placeholder treatment used elsewhere in
                // this file for in-progress tabs (e.g. the Customer
                // History tab), rather than silently falling through to
                // the Dashboard's own queue widgets/summary cards below.
                // `key={activeDeskTab}` forces a fresh mount on every
                // switch (including Accounts → Tickets, which would
                // otherwise reuse this exact same element/position and
                // never replay `animate-in`) — same reasoning as the
                // top-level Settings/interaction/dashboard branches' own
                // `key`s above. "Interactions" no longer has its own
                // branch here — that content moved to the Search right
                // panel (see `searchContent`'s own doc comment), so this
                // page's `activeDeskTab` union no longer offers it at all.
                <div key={activeDeskTab} className="flex flex-1 items-center justify-center p-4 animate-in fade-in-0 duration-200">
                  <p className="lyra-body-md text-lyra-fg-disabled text-center">Coming soon</p>
                </div>
              ) : (
                <>
                <div key={activeDeskTab} className="flex flex-1 flex-col min-w-0 overflow-y-auto px-6 py-6 animate-in fade-in-0 duration-200">
                  <div className="w-full max-w-[1024px] mx-auto lyra-container-grid-wrap">
                    {showPageHeader && (
                      // Dashboard header — per explicit request ("go back
                      // to the version of the home page that does NOT
                      // have a home page header"), moved back OUT of the
                      // fixed, non-scrolling top slot and into the
                      // scrollable dashboard body instead — mirrors the
                      // identical change made to 2.0 (`AgentNextGenPage.tsx`
                      // §129, which has the full rationale, including the
                      // historical `-mx-6 mb-6`/`bordered={false}`/
                      // `titleSize="2xl"` wrapper this reuses) and Premium
                      // (`AgentWorkspace2WithDeskPage.tsx`, same §129
                      // follow-up).
                      //
                      // Title switched from "Agent {first} {last}" to a
                      // plain "Hello {first name}" greeting. Subtitle
                      // ("User Name: {id}") is unchanged. The tri-state
                      // Connect Agent Leg/Connecting.../Connection Lag
                      // Time block that used to sit under the Personal
                      // Queue chip in `actions` is removed entirely —
                      // `actions` now holds only the chip.
                      <div className="-mx-6 mb-6">
                        <PageHeader
                          title={`Hello ${CURRENT_AGENT_FIRST_NAME}`}
                          subtitle={`User Name: ${CURRENT_AGENT_ID}`}
                          bordered={false}
                          titleSize="2xl"
                          actions={
                            <Tooltip content="Toggle Assignment Panel" placement="bottom" asLabel>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setNavOpen((v) => !v)}
                                className={cn(
                                  "h-6 shrink-0 gap-0.5 rounded-lyra-md px-2 lyra-body-md-emphasis",
                                  hasBreachedSlaAssignment
                                    ? "bg-lyra-status-critical-subtle text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:opacity-80"
                                    : interactions.length > 0
                                    ? "bg-lyra-status-warning-subtle text-lyra-status-warning-strong hover:bg-lyra-status-warning-subtle hover:opacity-80"
                                    : "bg-lyra-status-success-subtle text-lyra-status-success-strong hover:bg-lyra-status-success-subtle hover:opacity-80"
                                )}
                              >
                                My Assignment Queue: {interactions.length > 0 ? interactions.length : "Empty"}
                                {hasBreachedSlaAssignment && (
                                  <CircleAlert className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                                )}
                                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                              </Button>
                            </Tooltip>
                          }
                        />
                      </div>
                    )}
                    {/* ── Queue widgets ──
                        `DashboardQueue` ("cards" variant, its default) —
                        the numbers come straight from `buildLatestContacts`
                        (see `homeQueueBases` above), so they'd stay in
                        sync with the accordion presentation of the same
                        data if that's ever turned back on (see the note
                        below) — and Contacts/Wait Time visibly
                        tick/fluctuate in real time rather than sitting
                        frozen at the same numbers forever. Only this
                        element re-renders for that (`<QueueSubItems>` +
                        `<ClockTick>`). Clicking a widget opens the interior
                        panel with that queue's sub-queue breakdown; the
                        selected widget gets the "info-strong" (blue)
                        treatment `DashboardQueue` applies on selection,
                        driven by the controlled `selectedId`/`onSelect`
                        pair kept in sync with the panel state. */}
                    {/* No `mt-6` here — this is the first row in the
                        dashboard body, and the scroll wrapper around
                        `.lyra-container-grid-wrap` already supplies its
                        own top spacing (`py-6` a few lines up), so an
                        extra `mt-6` on top of that just doubled the gap
                        between the tab bar and this row. The rows below
                        (`ContactHistoryCard`, the summary cards) keep
                        their own `mt-6` — they still need spacing from
                        whatever row sits above THEM. */}
                    <QueueSubItems>
                      {(queueSubItems) => (
                    <ClockTick>
                      {(clockTick) => (
                    <DashboardQueue
                      items={buildLatestContacts(homeQueueBases, queueSubItems, clockTick).map((contact) => ({
                        id: contact.id,
                        name: contact.name,
                        icon: contact.icon,
                        wait: contact.wait,
                        skillsCount: contact.skillsCount,
                        contactsCount: contact.contactsCount,
                        agentsCount: contact.agentsCount,
                      }))}
                      selectedId={selectedQueueId}
                      onSelect={(id) => {
                        // Same "only one job in this shared docked slot at a
                        // time" rule as the Contact History row's own
                        // `onSelectEntry` above, the other direction — a
                        // queue widget click while a Contact History entry's
                        // summary is showing needs to actually swap the
                        // panel over, not leave the old entry's content
                        // sitting underneath a now-mismatched queue header.
                        setSelectedContactHistoryEntry(null);
                        setSelectedQueueId(id);
                      }}
                    />
                      )}
                    </ClockTick>
                      )}
                    </QueueSubItems>

                    {/* ── Latest Cases ──
                        Removed for now (was `DashboardQueue`'s "accordion"
                        variant, showing the same data as expandable rows
                        with each queue's `InteractionsTable` as content) —
                        may come back later, so `buildLatestContacts`,
                        `InteractionsTable`, and the rest of the data/markup
                        it depended on are left in place rather than deleted. */}

                    <div className="mt-6">
                      <ContactHistoryCard
                        onSelectEntry={(entry) => {
                          // Clicking the row that's ALREADY selected closes
                          // the panel instead of re-opening it on itself —
                          // same "click the already-selected one to toggle
                          // it off" behavior `DashboardQueue`'s own
                          // `selectedId`/`onSelect` pair documents for the
                          // queue widgets above.
                          if (entry.id === selectedContactHistoryEntry?.id) {
                            setSelectedContactHistoryEntry(null);
                            return;
                          }
                          // Deselect the OTHER two jobs this shared interior
                          // panel slot can show — only one is ever relevant
                          // at a time, same "selectedQueueId set takes
                          // priority" convention that panel's own doc
                          // comment already documents.
                          setSelectedQueueId(null);
                          setInteriorPanelOpen(false);
                          setSelectedContactHistoryEntry(entry);
                        }}
                        selectedEntryId={selectedContactHistoryEntry?.id ?? null}
                        historyByRange={contactHistoryByRange}
                        // Per explicit request ("default the phase 1
                        // contact history filter to last 72 hours") — see
                        // `ContactHistoryCard`'s own `defaultDateFilter`
                        // doc comment (agent-next-gen-contact-history.tsx)
                        // for why this tier alone passes it.
                        defaultDateFilter="last72h"
                        // `onOpenAllContacts` intentionally omitted — per
                        // explicit request ("remove all contacts button from
                        // the contact history in the home dashboard"). This
                        // card's own `headerTitleBadge` only renders its
                        // "All Contacts" button when this prop is passed
                        // (agent-next-gen-contact-history.tsx's own
                        // `onOpenAllContacts && (...)` check), so leaving it
                        // out removes the button with no changes needed to
                        // that shared component. `handleOpenAllContacts`
                        // itself (below) and the standalone "All Contacts"
                        // view it opens (`showAllContacts`, this file's own
                        // `key="all-contacts"` branch) are left in place
                        // rather than deleted, same "may come back later"
                        // treatment this dashboard's own removed "Latest
                        // Cases" section gets (its own doc comment, just
                        // above) — only this one entry point into it is
                        // gone now.
                      />
                    </div>

                    {/* ── Summary cards ──
                        Was three cards (Activity/Performance/Productivity);
                        Activity's ring chart moved into the bottom of
                        PerformanceBreakdownCard (Productivity) and the
                        standalone Activity card was removed, since the ring
                        visualized the exact same Available/Working/
                        Unavailable data Productivity's own rows already
                        list — one card showing it twice added nothing a
                        single card + ring didn't already cover. */}
                    <div className="mt-6 lyra-container-grid">
                      <PerformanceSummaryCard />
                      <PerformanceBreakdownCard />
                    </div>
                  </div>
                </div>
                {showInteriorPanel && (
                  <InteriorPanel
                    side="right"
                    // Reuses this one docked slot for THREE different jobs
                    // — the pre-existing "Case Details" form, the queue
                    // drill-down, and (per explicit request)
                    // `selectedContactHistoryEntry`'s own Contact History
                    // row summary — rather than stacking a second right-side
                    // panel, since only one detail view is ever relevant at
                    // a time. `selectedQueueId` set takes priority over
                    // `selectedContactHistoryEntry`, which in turn takes
                    // priority over the plain `interiorPanelOpen` "Case
                    // Details" default — same priority order in the open
                    // condition, header, content, and footer below.
                    open={interiorPanelOpen || Boolean(selectedQueueId) || Boolean(selectedContactHistoryEntry)}
                    headerTitle={
                      selectedQueueId
                        ? homeQueueBases.find((c) => c.id === selectedQueueId)?.name ?? "Queue"
                        : selectedContactHistoryEntry
                        ? selectedContactHistoryEntry.name
                        : "Case Details"
                    }
                    // "{n} Skills" for the queue drill-down (the same count
                    // as that queue widget's own Skills metric; the queue
                    // simulation only changes counts, never list lengths,
                    // so the initial list's length is the live one too and
                    // this panel doesn't re-render on its 4s beat) or,
                    // per explicit follow-up request, the routing skill name
                    // for a Contact History entry (previously the case ID —
                    // `headerTitle` above already shows the customer's real
                    // name, so this now surfaces a second, distinct fact
                    // about the contact instead).
                    headerSubhead={
                      selectedQueueId
                        ? `${(INITIAL_QUEUE_SUB_ITEMS[selectedQueueId] ?? []).length} Skills`
                        : selectedContactHistoryEntry?.skillName
                    }
                    onClose={() => {
                      setInteriorPanelOpen(false);
                      setSelectedQueueId(null);
                      setSelectedContactHistoryEntry(null);
                    }}
                    // `PanelRightClose` — same "closing a docked right-side
                    // panel" glyph as this panel's sibling instance above,
                    // instead of `ContainerHeader`'s generic default `X`.
                    // Redial/Re-open — per explicit request, these used to
                    // render here (this `InteriorPanel`'s own `footer`
                    // slot, which pins to the bottom of the panel). Per a
                    // later explicit follow-up request ("move the redial
                    // button up directly below the gray box"), this is now
                    // the `actionButton` prop on `ContactHistoryEntryDetail`
                    // below instead — see that call site's own doc comment
                    // for the exact same button JSX/handlers, just
                    // relocated so it sits immediately after the gray card
                    // regardless of panel height, instead of anchored to
                    // the panel's own bottom edge.
                  >
                    {selectedQueueId ? (
                      <div className="flex flex-col">
                        {/* Only these rows re-render on the queue
                            simulation's 4s beat ("N In Queue"). */}
                        <QueueSubItems>
                          {(queueSubItems) => (
                        <>
                        {(queueSubItems[selectedQueueId] ?? []).map((item, i) => (
                          <div
                            key={item.id}
                            className={cn(
                              "flex flex-col gap-2 px-4 py-4",
                              i > 0 && "border-t border-lyra-border-subtle"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="inline-flex items-center gap-2 lyra-body-md-emphasis text-lyra-fg-default">
                                <item.icon className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} />
                                {item.label}
                              </span>
                              <span className="lyra-body-sm text-lyra-fg-secondary whitespace-nowrap">
                                {item.inQueueCount} In Queue
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 lyra-body-sm text-lyra-fg-secondary">
                              <Clock className="h-3 w-3" strokeWidth={1.5} />
                              Longest Wait Time: {item.wait}
                            </span>
                            {/* Available / Working / Unavailable agent counts for
                                this sub-queue — same icons, colors, and order as
                                PRODUCTIVITY_STATUS_META (Activity/Productivity
                                cards), just rendered as compact circular Icon
                                badges instead of a donut/bar. Each badge gets a
                                hover tooltip spelling out what the count means,
                                since the color/icon alone doesn't say "agents". */}
                            <div className="flex items-center gap-3">
                              <Tooltip content="Available Agents" placement="top">
                                <span className="inline-flex items-center gap-1.5">
                                  <Icon icon={CheckCircle2} size="sm" background="success" shape="circle" decorative />
                                  <span className="lyra-body-sm-emphasis text-lyra-fg-default">{item.available}</span>
                                </span>
                              </Tooltip>
                              <Tooltip content="Working Agents" placement="top">
                                <span className="inline-flex items-center gap-1.5">
                                  <Icon icon={CircleDot} size="sm" background="warning" shape="circle" decorative />
                                  <span className="lyra-body-sm-emphasis text-lyra-fg-default">{item.working}</span>
                                </span>
                              </Tooltip>
                              <Tooltip content="Unavailable Agents" placement="top">
                                <span className="inline-flex items-center gap-1.5">
                                  <Icon icon={MinusCircle} size="sm" background="critical" shape="circle" decorative />
                                  <span className="lyra-body-sm-emphasis text-lyra-fg-default">{item.unavailable}</span>
                                </span>
                              </Tooltip>
                            </div>
                          </div>
                        ))}
                        </>
                          )}
                        </QueueSubItems>
                      </div>
                    ) : selectedContactHistoryEntry ? (
                      <ContactHistoryEntryDetail
                        entry={selectedContactHistoryEntry}
                        // Redial/Re-open — per explicit request, these used
                        // to render in this `InteriorPanel`'s own separate
                        // `footer` slot (which pins to the bottom of the
                        // panel); per a later explicit follow-up request
                        // ("move the redial button up directly below the
                        // gray box"), passed in here instead so
                        // `ContactHistoryEntryDetail` renders it immediately
                        // after its own gray card. Mutually exclusive by
                        // channel type, per explicit request — a voice
                        // contact (`entry.redial`) only ever gets "Redial"
                        // (starting a literal fresh call is the only thing
                        // "reopening" a call can mean), never "Re-open"
                        // alongside it; every other channel type only ever
                        // gets "Re-open" (nothing to "redial" on a
                        // chat/SMS/email/WhatsApp contact).
                        //
                        // Re-open still reopens the contact as a live
                        // assignment in the left nav
                        // (`handleReopenContactHistoryEntry`'s own doc
                        // comment) and closes this panel immediately, since
                        // there's nothing left here to look at once that's
                        // happened. Redial no longer does either of those
                        // things directly — per explicit follow-up request
                        // ("add the number / skill selection popover to the
                        // click of a redial to phase 1B - same
                        // functionality as in Phase 1"),
                        // `handleRedialButtonClick` only opens the Dial Pad
                        // popover (anchored on this very button — its own
                        // `e.currentTarget`, passed through as `anchorEl`,
                        // see `dialpadRequest`'s own doc comment above) and
                        // leaves this panel open; the actual redial only
                        // happens once the agent picks a skill and submits
                        // there (`handleDialpadSubmit`/`handleRedial`).
                        // Mirrors AgentNextGenPage.tsx's own identical
                        // treatment.
                        actionButton={
                          selectedContactHistoryEntry.redial ? (
                            <Button
                              variant="outline"
                              // Per explicit request ("in phase 1, we cannot
                              // have 2 or more calls at the same time, so if
                              // an agent is on an active call then disable
                              // the ... redial buttons in the contact
                              // history"), then a follow-up bug report ("only
                              // disable when the agent is on an active
                              // call") — same `agentOnActiveVoiceCall` signal
                              // the "New Outbound" trigger's own identical
                              // `disabled` wiring uses (see that render
                              // site's own doc comment, and
                              // `agentOnActiveVoiceCall`'s own doc comment,
                              // for why this isn't the plain
                              // `liveVoiceCallInteraction` it originally
                              // read). `title` (native `Button` prop,
                              // button.tsx) renders as a plain browser
                              // tooltip on this non-icon variant, same as
                              // every other `title` this file already passes
                              // to a non-icon `Button`.
                              disabled={agentOnActiveVoiceCall}
                              title={agentOnActiveVoiceCall ? "A call is already in progress" : undefined}
                              onClick={(e) => {
                                handleRedialButtonClick(selectedContactHistoryEntry, e.currentTarget);
                              }}
                            >
                              <PhoneOutgoing className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Redial
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                handleReopenContactHistoryEntry(selectedContactHistoryEntry);
                                setSelectedContactHistoryEntry(null);
                              }}
                            >
                              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Takeover Assignment
                            </Button>
                          )
                        }
                      />
                    ) : (
                      <div className="flex flex-col gap-4 px-4 py-4">
                        <Input label="Subject" placeholder="Enter subject" />
                        <Input label="Priority" placeholder="Select priority" />
                        <Input label="Assignee" placeholder="Search agents" />
                        <Input label="Tags" placeholder="Add tags" />
                      </div>
                    )}
                  </InteriorPanel>
                )}
                </>
              ))}
              </div>
                </div>
              )}
            </div>

            {/* The docked panel's own content, inline as this container's
                second tab — `Draggable`'s own grip/resize plumbing is
                skipped (nothing to drag-position or resize-into once this
                pane spans the container's full width), but the real
                `ContainerHeader` (title/icon/actions/close) is NOT — same
                shape `sharedPanel`'s `renderHeaderControls` below renders,
                just with the dock button wired directly to
                `handlePanelVariantChange` instead of `Draggable`'s own
                internal toggle (there's no mounted `Draggable` instance
                here to own that state while this pane is showing). Always
                shows the "docked" dock icon/label (`Move`/"Undock") since
                this pane only ever renders while `panelVariant === "docked"`
                — clicking it hands off to the exact same float rendering
                below (untouched), which is what makes the tabs disappear;
                re-docking from there flips `panelVariant` back to "docked"
                and `isCombinedPanelMode` brings the tabs right back. Also
                guarded on `!panelFullScreen` — if the nav narrows into
                combined mode while the shared panel happens to be
                fullscreen, `sharedPanelFullScreenOverlay` (rendered as
                `containerRef`'s own last child, further down) already
                covers this content; skip this copy so
                `activePanelContent.body` isn't mounted twice at once. */}
            {isCombinedPanelMode && activePanelContent && !panelFullScreen && (
              <div
                className={cn(
                  "flex flex-1 flex-col min-w-0 overflow-hidden",
                  narrowActiveRegion !== "panel" && "hidden"
                )}
              >
                <ContainerHeader
                  title={activePanelContent.title}
                  titleText={activePanelContent.titleText}
                  titleBadge={activePanelContent.titleBadge}
                  titleClassName={activePanelContent.titleClassName}
                  icon={activePanelContent.dockedIcon}
                  bordered={!activePanelContent.headerContent}
                  actions={
                    <>
                      {activePanelContent.headerActions}
                      <Tooltip content="Undock" placement="bottom" asLabel>
                        <ActionIconButton
                          aria-label="Undock"
                          size="sm"
                          onClick={() => handlePanelVariantChange("float")}
                          className="text-lyra-fg-secondary hover:text-lyra-fg-secondary"
                        >
                          <Move className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </ActionIconButton>
                      </Tooltip>
                    </>
                  }
                  onClose={() => setPanelOpen(false)}
                />
                {activePanelContent.headerContent && (
                  // See the docked variant's own matching wrapper (above)
                  // for why "search" skips this wrapper entirely.
                  (activePanelKey === "search" ? (
                    activePanelContent.headerContent
                  ) : (
                    <div className="shrink-0 px-4 pb-3 border-b border-lyra-border-subtle">
                      {activePanelContent.headerContent}
                    </div>
                  ))
                )}
                {/* Per explicit request ("... fade in when transitioning" —
                    see the docked variant's own matching wrapper above for
                    the full doc comment): `key={activePanelKey}` forces a
                    remount on every app switch so `animate-in fade-in-0`
                    replays each time. */}
                <div key={activePanelKey} className="flex flex-col flex-1 min-h-0 animate-in fade-in-0 duration-200">
                  {activePanelContent.body}
                </div>
              </div>
            )}

              </div>
              {/* Customer Information now docks on the RIGHT of the main
                  content column (per explicit request — was on the left) —
                  this block itself is unchanged from its old position
                  (still this exact same conditional/wrapper/`SidePanel`
                  usage), just moved to render AFTER the content column
                  instead of before it, so it's the row's LAST flex child
                  instead of its first. `SidePanel`'s own `side="right"`
                  prop (set on the `SidePanel` inside
                  `CustomerInformationSidePanel` itself, not here) is what
                  actually flips its border/resize-handle/slide-direction to
                  match — this DOM move alone only changes which edge of the
                  ROW it renders against. Per explicit request, also gated
                  on `!activeInteractionIsAgentCall` — an agent-to-agent
                  call hides this docked panel outright (see that const's
                  own doc comment above), not just its Detail-only
                  "unknown contact" fallback. */}
              {!activeInteractionIsAgentCall && showPanelToggle && activeInteraction && (
                // `key`ed on the assignment's own id, same "force a full
                // remount on every genuine switch" technique the content
                // column further down already uses (see that div's own
                // `animate-in fade-in-0 duration-200 delay-150 fill-mode-
                // backwards` doc comment for the full explanation) —
                // applied here too per explicit follow-up report: an
                // earlier fix suppressed `SidePanel`'s own width/opacity
                // transition instead (a briefly-toggled `!important` CSS
                // class), which stopped it sliding open/shut but replaced
                // that with a different problem — the panel then just
                // snapped into view with no animation at all while the
                // content column beside it was still doing its own soft
                // fade, so the two read as out of sync ("not fading, just
                // appearing").
                //
                // Remounting fixes both at once: a freshly-inserted DOM
                // node has no PRIOR width/opacity value on that same node
                // for `SidePanel`'s own `transition` to animate FROM, so
                // its width-slide never plays (no suppression hack
                // needed) — but a CSS *animation* (unlike a *transition*)
                // still runs from its keyframes at mount regardless, which
                // is exactly what `animate-in fade-in-0` on this wrapper
                // is, so the panel now genuinely fades in, on the same
                // `duration-200 delay-150` timing as the content column,
                // instead of either sliding open or hard-cutting into
                // place.
                //
                // Side effect, expected rather than a regression: this
                // panel's own internal `activeTab` (Overview/Interactions/
                // Detail/Directory — `CustomerInformationSidePanel`'s own
                // `useState(0)`), and the Interactions tab's own
                // `selectedHistoryIndex` (`CustomerInformationPanelBody`),
                // now reset to their defaults on every genuine assignment
                // switch too, since remounting discards them along with
                // everything else in the subtree. Landing on a different
                // customer's Overview tab first, rather than wherever the
                // PREVIOUS customer's panel happened to be left, matches the
                // same "genuinely new context should start from the top"
                // reasoning the outer interaction detail page's own
                // `key={`interaction-${id}`}` remount already establishes.
                //
                // `z-[5]` here (on THIS wrapper, not just relying on
                // `SidePanel`'s own internal `z-[5]`) — per explicit
                // follow-up report: a full-screen restore (this panel
                // unpinned/`position: absolute`, meant to overlay the
                // whole content column) briefly flashed with the
                // transcript visible on top instead of properly
                // underneath. Root cause is a well-known CSS gotcha: ANY
                // element with a live `animation-name` (which `animate-in`
                // sets, permanently, for as long as the class stays on the
                // element — not just while actually mid-play) forms its
                // OWN stacking context, same as `opacity`/`transform`/
                // `filter` do. Before this wrapper existed, `SidePanel`'s
                // own `position: absolute; z-index: 5` sat DIRECTLY in
                // `Container`'s stacking context, at the same explicit-
                // positive-z-index tier as the record header's sticky
                // separator (`z-[1]`), `InteriorPanel` (`z-[3]`), and the
                // shared panel's fullscreen overlay (`z-[9]`) — see those
                // components' own doc comments for this whole tier system.
                // Once wrapped, `z-[5]` on `SidePanel` only orders things
                // INSIDE this new stacking context (nothing else is in
                // here to compete with) — this wrapper itself, having NO
                // z-index of its own, instead got silently pushed down to
                // the plain "z-index: auto" tier alongside the content
                // column sibling next to it, so the two started competing
                // by DOM ORDER instead of by their intended z-index
                // values. Setting `z-[5]` explicitly on this wrapper (a
                // flex item of the `flex flex-1 overflow-hidden min-h-0`
                // row above — z-index applies to flex items without
                // needing `position` set) restores the exact same tier
                // this whole subtree occupied before the wrapper was
                // introduced.
                <div
                  key={`side-panel-${activeInteraction.id}`}
                  // `h-full` — explicit, not left to this flex item's own
                  // default cross-axis `align-items: stretch` from its
                  // parent row (`flex flex-1 overflow-hidden min-h-0`,
                  // "Row: Customer Information panel + everything else"
                  // above) — confirmed live as the actual root cause of
                  // the docked panel's own internal scrolling never
                  // engaging (while full-screen/unpinned mode, which
                  // reaches its height via `position: absolute` against
                  // `Container` instead — an unambiguous MAIN-axis
                  // flex-grow box, not cross-axis stretch — worked fine
                  // the whole time). Mirrored one level down on
                  // `SidePanel`'s own pinned-branch outer div
                  // (side-panel.tsx), which had the identical gap.
                  className="shrink-0 h-full z-[5] animate-in fade-in-0 duration-200 delay-150 fill-mode-backwards"
                >
                <CustomerInformationSidePanel
                  open={sidePanelOpen || !!channelPreviewThreadKey}
                  // Always unpinned (floating overlay) while full-screen —
                  // per explicit request this should overlay the parent
                  // Container, not push the tab row/transcript column over
                  // via docked mode.
                  pinned={sidePanelFullScreen ? false : effectiveSidePanelPinned}
                  // Always shown, even in the narrow-container overlay mode
                  // — per explicit request, an agent who's opened it as a
                  // floating overlay still needs a way to close it again
                  // from inside the panel itself, not just the (now-hidden
                  // while open) header toggle icon.
                  onClose={handleSidePanelClose}
                  fullScreen={sidePanelFullScreen}
                  // Hidden below 350px of container width — see
                  // `isSidePanelAtMinimalThreshold`'s own doc comment.
                  onToggleFullScreen={
                    isSidePanelAtMinimalThreshold ? undefined : () => setSidePanelFullScreen((v) => !v)
                  }
                  onMouseEnter={onSidePanelHoverStart}
                  onMouseLeave={sidePanelResizing ? undefined : onSidePanelHoverEnd}
                  customerName={activeInteraction.customerName}
                  recordId={activeInteraction.customerId}
                  channels={activeInteraction.threads}
                  startedFresh={activeInteraction.startedFresh}
                  // Per explicit request: a brand-new outbound assignment
                  // NOT associated with a real customer record shows ONLY
                  // the Detail tab (no Overview/Copilot/Notes/etc.) — for
                  // its whole lifetime, based purely on customer identity
                  // (`activeInteractionIsRealCustomer`, see that const's own
                  // doc comment above). An interaction WITH a real customer
                  // record keeps this tier's normal reduced tab set
                  // (`AGENT_WORKSPACE_CUSTOMER_PANEL_TABS` — unlike
                  // Premium, this tier never used the full `CUSTOMER_PANEL_TABS`
                  // set here, so that's what "real customer" keeps, not the
                  // full set).
                  tabs={activeInteractionIsRealCustomer ? AGENT_WORKSPACE_CUSTOMER_PANEL_TABS : (["Detail"] as const)}
                  onOpenHistoryConversation={(entry) =>
                    setHistoryConversationTab({ interactionId: activeInteraction.id, entry, active: true })
                  }
                  // Full-screen substitutes the parent Container's own
                  // measured width (`sidePanelContainerWidth` — already
                  // tracked for the narrow-container guard) for the normal
                  // drag-resized width, so the panel's unpinned/absolute
                  // rendering covers the whole container edge to edge.
                  width={sidePanelFullScreen ? sidePanelContainerWidth : sidePanelWidth}
                  containerWidth={sidePanelContainerWidth}
                  onWidthChange={setSidePanelWidth}
                  onResizeStateChange={setSidePanelResizing}
                  onAddToast={addToast}
                  recordDraft={activeCustomerRecordDraft}
                  overviewEditing={activeCustomerOverviewEditing}
                  onOverviewEditingChange={setActiveCustomerOverviewEditing}
                  // The old "only open the customer information
                  // automatically if a NEW message appears in the copilot
                  // window" behavior (`onCopilotFirstAvailable`) is gone
                  // along with Copilot itself — see `CustomerInformationSidePanel`'s
                  // own doc comment (agent-next-gen-customer-info-panel.tsx)
                  // for the "stop launching copilot - hide it completely"
                  // fix this prop was removed as part of.
                  onStartInteraction={(contact, channel, phone, skillId) =>
                    handleStartCall({ contact, channel, phone, skillId })
                  }
                  focusTabOverride={customerPanelFocusTab}
                  // Per explicit request ("contact details panel for
                  // unmatched customers should match the hover popover.
                  // add a button above auto summary that says link to
                  // existing customer and then when that is clicked slide
                  // in a panel with the search customer / create new
                  // customer panel content") — the customer-matching UI
                  // (search/possible-matches/create-new) no longer shows
                  // automatically just because the interaction is
                  // unmatched (`!activeInteractionIsRealCustomer` alone);
                  // it now also requires `linkCustomerPanelOpen`, set by
                  // the new "Link to existing customer" button
                  // (`onLinkCustomer` on `bodyOverride`'s own
                  // `DetailsPanelAccordions` below) — an unmatched
                  // customer's docked panel therefore shows the SAME
                  // `bodyOverride` content the hover popover always shows
                  // by default now, matching it, with this flow reachable
                  // as an on-demand overlay instead of the default view.
                  // See `matchState`'s own doc comment (agent-next-gen-
                  // customer-info-panel.tsx) for what each piece does.
                  // `undefined` for a real-customer interaction, same as
                  // every OTHER consumer of this component always passes.
                  matchState={
                    !activeInteractionIsRealCustomer && linkCustomerPanelOpen
                      ? {
                          step: customerMatchStep,
                          query: customerMatchQuery,
                          onQueryChange: setCustomerMatchQuery,
                          possibleMatches: possibleCustomerMatches,
                          searchResults: customerSearchResults,
                          onLinkRecord: handleLinkCustomerRecord,
                          onStartCreate: handleStartCreateCustomer,
                          onBackToSearch: handleBackToCustomerSearch,
                          onSaveNewCustomer: handleSaveNewCustomer,
                        }
                      : undefined
                  }
                  // Back arrow for the match flow's "search" step (the
                  // "create" step already gets one via `matchState.onBackToSearch`
                  // regardless) — closes this on-demand overlay back to the
                  // normal `bodyOverride` content, same button-driven
                  // open/close pair `skipGroupPicker`'s own opt-in pattern
                  // (create-new.tsx, lyra-ui) already established this
                  // session for a similarly scoped, single-consumer tweak
                  // to a shared component.
                  matchStateOnBack={() => setLinkCustomerPanelOpen(false)}
                  // Per explicit request ("swap the actual content
                  // rendered inside each panel", then later "put the
                  // transcript and session tabs into the new customer
                  // information side panel and rename the side panel
                  // Session Details"): this docked panel now shows the same
                  // Customer Profile/Contact Snapshot/Files accordion
                  // content (`DetailsPanelAccordions`) the voice "Details"
                  // tab used to show exclusively, instead of its own normal
                  // Overview/Detail/Notes tabs — see `bodyOverride`'s own
                  // doc comment (agent-next-gen-customer-info-panel.tsx)
                  // for the fuller "why" — AND, per the later request, the
                  // Transcript (voice only)/Session Details tabs that used
                  // to live in a totally separate "Session Details"
                  // `InteriorPanel` overlay are merged in here too, via
                  // `headerTitleOverride`/`headerTabsOverride` (same
                  // override pattern as `bodyOverride` itself — see each
                  // prop's own doc comment). "View customer info" (both
                  // from the main transcript's Contact Overview and from
                  // this panel's own embedded accordions) just makes sure
                  // this ONE panel is open and on its "Details" tab now
                  // (`focusCustomerPanelTab`, redesigned alongside this
                  // change) — there's no separate surface left to open.
                  // Per explicit follow-up request ("put the content of
                  // the channels IN the side panel (where the contact
                  // details content is now)" / "so a chat opens in that
                  // side panel"): while `channelPreviewThread` is set, it
                  // takes over the title, tabs, body, AND footer below —
                  // this whole panel becomes that channel's preview
                  // instead of Contact Details, exactly like switching
                  // interactions/tabs already replaces this same panel's
                  // content in place (no second panel).
                  headerTitleOverride={
                    channelPreviewThread
                      ? channelPreviewMeta?.label
                      : customerPanelActiveTab === "Artifacts"
                      ? "Artifacts"
                      : customerPanelActiveTab === "Experience Memory"
                      ? activeInteraction.customerName
                      : customerPanelActiveTab === "Customer Info"
                      ? customerInfoOverlayContent.headerTitle
                      : "Contact Details"
                  }
                  // Per explicit request ("move the customer information
                  // content back to the side panel... have a back arrow
                  // next to the Customer's name"): while
                  // `customerPanelActiveTab === "Customer Info"`, this
                  // panel shows the exact same back arrow/record-id
                  // subhead the old floating overlay used to, now routed
                  // through these two new override props instead — see
                  // `headerIconOverride`/`headerSubheadOverride`'s own doc
                  // comments (agent-next-gen-customer-info-panel.tsx).
                  // Guarded on `!channelPreviewThread` explicitly since
                  // neither prop has a pre-existing ternary of its own to
                  // slot into (unlike `headerTitleOverride` above).
                  headerIconOverride={
                    !channelPreviewThread &&
                    (customerPanelActiveTab === "Artifacts" || customerPanelActiveTab === "Experience Memory") ? (
                      <button
                        type="button"
                        onClick={() => setCustomerPanelActiveTab("Details")}
                        aria-label="Back to Contact Details"
                        className="flex h-6 w-6 items-center justify-center rounded-lyra-sm text-lyra-fg-secondary hover:bg-lyra-state-hover transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    ) : !channelPreviewThread && customerPanelActiveTab === "Customer Info"
                      ? customerInfoOverlayContent.headerIcon
                      : undefined
                  }
                  headerSubheadOverride={
                    !channelPreviewThread && customerPanelActiveTab === "Experience Memory"
                      ? "Experience Memory"
                      : !channelPreviewThread && customerPanelActiveTab === "Artifacts"
                      ? activeInteraction.customerName
                      : !channelPreviewThread && customerPanelActiveTab === "Customer Info"
                      ? customerInfoOverlayContent.headerSubhead
                      : undefined
                  }
                  // Per the same explicit request: the customer's name
                  // (this panel's own normal subhead, via `onViewCustomerInfo`
                  // just below) is now a clickable "View Customer Info"
                  // link into that same drill-in, instead of a separate
                  // button — see `CustomerInformationSidePanel`'s own
                  // `onViewCustomerInfo` doc comment.
                  onViewCustomerInfo={
                    !channelPreviewThread &&
                    customerPanelActiveTab !== "Customer Info" &&
                    activeInteractionIsRealCustomer
                      ? focusCustomerPanelTab
                      : undefined
                  }
                  headerTabsOverride={
                    channelPreviewThread
                      ? undefined
                      : customerPanelActiveTab === "Artifacts" || customerPanelActiveTab === "Experience Memory"
                      ? <></>
                      : customerPanelActiveTab === "Customer Info"
                      ? (
                        // Per explicit request: fade in the drill-in's own
                        // content (not the panel itself) each time it's
                        // entered — this branch swap already causes a real
                        // unmount/remount (a different JSX tree than the
                        // normal tab row), so a plain `animate-in` wrapper
                        // replays once per entry with no `key` needed, and
                        // doesn't re-trigger while just browsing the
                        // drill-in's own internal Overview/Detail/Notes
                        // tabs (unrelated state).
                        <div className="animate-in fade-in-0 duration-200">
                          {customerInfoOverlayContent.headerTabs}
                        </div>
                      )
                      : (
                        <TabList className="px-4">
                          {(panelVoiceThread
                            ? (["Details", "Transcript", "Session Details"] as const)
                            : (["Details", "Session Details"] as const)
                          ).map((label) => (
                            <Tab
                              key={label}
                              active={customerPanelActiveTab === label}
                              onClick={() => setCustomerPanelActiveTab(label)}
                            >
                              {/* Displayed as "Overview"/"Session" — the
                                  underlying identifiers stay "Details"/"Session
                                  Details" (used throughout for state/
                                  comparisons). */}
                              {label === "Session Details" ? "Session" : label === "Details" ? "Overview" : label}
                            </Tab>
                          ))}
                        </TabList>
                      )
                  }
                  // A channel preview's own composer lives here, in
                  // `footerOverride` — same "fixed footer outside the
                  // scrollable body" treatment the Session tab's own
                  // `sessionDetailsTabContent.footer` already gets just
                  // below, rather than being hand-stacked inside
                  // `bodyOverride` itself. No composer at all for email
                  // (its body is just a "Coming soon" placeholder), for
                  // voice (per explicit follow-up request — a voice
                  // preview is just the transcript, same as the main
                  // column's own voice view never gets a composer either
                  // — see `activeChannelType !== "voice"` at that render
                  // site), or once this specific thread has actually
                  // closed.
                  footerOverride={
                    channelPreviewThread
                      ? (channelPreviewThread.type !== "email" &&
                          channelPreviewThread.type !== "voice" &&
                          !activeInteraction.closed &&
                          activeInteraction.threadStatuses?.[channelPreviewThreadStableKey!] !== "Closed" && (
                            <InteractionComposer
                              hideAiActions={hideAiActions}
                              onHideAiActionsChange={setHideAiActions}
                              onSend={(text) =>
                                handleSendMessage(activeInteraction.id, text, channelPreviewThreadStableKey!)
                              }
                              copilotSuggestions={
                                activeInteraction.id === LUCAS_THOMAS_ID
                                  ? LUCAS_THOMAS_COPILOT_SUGGESTIONS
                                  : ["Summarize this conversation", "Suggest a reply", "What is the customer's history?"]
                              }
                              copilotSuggestionLinks={
                                activeInteraction.id === LUCAS_THOMAS_ID ? LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS : undefined
                              }
                              copilotSuggestionReplacements={
                                activeInteraction.id === LUCAS_THOMAS_ID
                                  ? LUCAS_THOMAS_COPILOT_SUGGESTION_REPLACEMENTS
                                  : undefined
                              }
                              onCopilotSuggestionLink={(key: string) =>
                                openDetailPanelContent({ kind: "lucas", panel: key as LucasThomasPanelKey })
                              }
                              onCopilotAsk={(text: string) =>
                                handleCopilotAsk(activeInteraction.id, channelPreviewThreadStableKey!, text)
                              }
                            />
                          )) || undefined
                      : customerPanelActiveTab === "Customer Info"
                      ? customerInfoOverlayContent.footer
                      : customerPanelActiveTab === "Session Details"
                      ? sessionDetailsTabContent.footer
                      : undefined
                  }
                  bodyOverride={
                    channelPreviewThread ? (
                      channelPreviewThread.type === "email" ? (
                        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-lyra-fg-secondary">
                          Coming soon
                        </div>
                      ) : (
                        <InteractionTranscript
 hideAiActions={hideAiActions}
                          hideMockFollowUpMessages={activeInteraction.id === LUCAS_THOMAS_ID}
                          channelType={channelPreviewThread.type}
                          direction={channelPreviewThread.direction}
                          customerName={activeInteraction.customerName}
                          contactId={channelPreviewThread.contactId ?? activeInteraction.customerId}
                          // Per explicit request ("display the phone
                          // number instead of the contact ID in the
                          // session row") — see `InteractionTranscript`'s
                          // own `channelAddressLabel` prop doc comment
                          // (agent-next-gen-transcript.tsx).
                          channelAddressLabel={channelPreviewThread.addressLabel}
                          skillLabel={channelPreviewThread.preview}
                          isFreshLaunch={!!channelPreviewThread.startedFresh}
                          liveMessages={activeInteraction.liveMessages?.[channelPreviewThreadStableKey!] ?? []}
                          currentStatus={activeInteraction.threadStatuses?.[channelPreviewThreadStableKey!]}
                          onCurrentStatusChange={(status) =>
                            handleInteractionStatusChange(activeInteraction.id, channelPreviewThreadStableKey!, status)
                          }
                          showSessionActionCluster={false}
                          showViewDetails={false}
                        />
                      )
                    ) : customerPanelActiveTab === "Experience Memory" ? (
                      <div className="animate-in fade-in-0 duration-200">
                        {activeInteraction.id === MAYA_CHEN_CALL_ID ? (
                          <MayaChenCallMemoryPanelBody />
                        ) : activeInteraction.id === TOM_LEWIS_CALL_ID ? (
                          <TomLewisCallMemoryPanelBody />
                        ) : activeInteraction.id === MARCUS_WEBB_ID ? (
                          <MarcusWebbMemoryPanelBody
                            focus={marcusMemoryFocus}
                            onOpenOrder={() => openDetailPanelContent({ kind: "order", order: MARCUS_WEBB_ORDER })}
                          />
                        ) : (
                        <LucasThomasMemoryPanelBody
                          focus={experienceMemoryFocus}
                          onOpenOrder={(orderId) =>
                            openDetailPanelContent({ kind: "lucas-order", orderId, from: "memory" })
                          }
                        />
                        )}
                      </div>
                    ) : customerPanelActiveTab === "Artifacts" ? (
                      <div className="animate-in fade-in-0 duration-200">
                        <ArtifactsListBody artifacts={panelArtifacts} onOpenArtifact={reopenPanelArtifact} />
                      </div>
                    ) : customerPanelActiveTab === "Customer Info" ? (
                      // Same fade-in reasoning as `headerTabsOverride`'s
                      // own identical wrapper just above.
                      <div className="animate-in fade-in-0 duration-200">
                        {customerInfoOverlayContent.body}
                      </div>
                    ) : customerPanelActiveTab === "Transcript" && panelVoiceThread ? (
                      // A fresh `InteractionTranscript` instance, same as
                      // this tab always rendered back when it lived in the
                      // separate "Session Details" overlay — see that
                      // render site's own former doc comment (git history)
                      // for the full "why a second instance, not the main
                      // column's own".
                      <InteractionTranscript
 hideAiActions={hideAiActions}
                        hideMockFollowUpMessages={activeInteraction.id === LUCAS_THOMAS_ID}
                        channelType="voice"
                        direction={panelVoiceThread?.direction}
                        customerName={activeInteraction.customerName}
                        contactId={panelVoiceThread?.contactId ?? activeInteraction.customerId}
                        // Per explicit request ("display the phone number
                        // instead of the contact ID in the session row")
                        // — see `InteractionTranscript`'s own
                        // `channelAddressLabel` prop doc comment
                        // (agent-next-gen-transcript.tsx).
                        channelAddressLabel={panelVoiceThread?.addressLabel}
                        skillLabel={panelVoiceThread?.preview}
                        isFreshLaunch={!!panelVoiceThread?.startedFresh}
                        liveMessages={activeInteraction.liveMessages?.[panelVoiceThread?.id ?? "voice"] ?? []}
                        dimmed={!!activeInteraction.closed || activeChannelStatus === "Closed"}
                        currentStatus={activeChannelStatus}
                        onCurrentStatusChange={(status) =>
                          activeChannel && handleInteractionStatusChange(activeInteraction.id, activeChannel.id, status)
                        }
                        showSessionActionCluster={false}
                        onViewSessionDetails={(session) => {
                          setSelectedDetailPanelContent(null);
                          setSelectedVoiceDetailsSession(session);
                          setCustomerPanelActiveTab("Session Details");
                        }}
                        showViewDetails={false}
                      />
                    ) : customerPanelActiveTab === "Session Details" ? (
                      sessionDetailsTabContent.body
                    ) : (
                      <DetailsPanelAccordions
 artifacts={panelArtifacts}
 onOpenArtifact={reopenPanelArtifact}
 onViewAllArtifacts={() => setCustomerPanelActiveTab("Artifacts")}
 onViewExperienceMemory={
 activeInteraction.id === LUCAS_THOMAS_ID || activeInteraction.id === MARCUS_WEBB_ID || isColdCallId(activeInteraction.id) ? () => openExperienceMemoryInSidePanel() : undefined
 }
                        customerName={activeInteraction.customerName}
                        customerContextOverview={customerContextOverviewInfo}
                        // Per explicit request ("replace the autosummary
                        // card in the contact details with the content
                        // depicted in the screenshot of the real time
                        // summary card ... ignore the edit/pin icons and
                        // keep it as an accordion"), then a follow-up
                        // clarification ("do not modify the autosummary
                        // card that is inline with the conversation -
                        // create a new card and call it 'Real-Time
                        // Summary'") — this docked "Contact Details" panel
                        // is the one place that opts in; the main
                        // transcript column's own `customerContextOverview`
                        // render (this page's other call site, further up)
                        // is untouched, still the original "Autosummary".
                        // `realTimeSummaryUpdatedAtTick` — see that state's
                        // own doc comment above (near `clock`) for how
                        // it's derived.
                        showRealTimeSummary
                        realTimeSummaryUpdatedAtTick={realTimeSummaryUpdatedAtTick}
                        onViewCustomerInfo={
                          activeInteractionIsRealCustomer ? focusCustomerPanelTab : undefined
                        }
                        // Opens the on-demand search/create-new overlay
                        // above (`matchState`/`matchStateOnBack`) — see
                        // `linkCustomerPanelOpen`'s own doc comment for the
                        // fuller "why". `undefined` for a real-customer
                        // interaction, same as `onViewCustomerInfo` right
                        // above (there's nothing to link once matched).
                        onLinkCustomer={
                          activeInteractionIsRealCustomer ? undefined : () => setLinkCustomerPanelOpen(true)
                        }
                      />
                    )
                  }
                />
                </div>
              )}

            </div>

            {/* The "View customer info" floating overlay that used to
                render here is gone — per explicit request ("move the
                customer information content back to the side panel"),
                that content now shows INSIDE the docked
                `CustomerInformationSidePanel` above instead (its own
                "Customer Info" `customerPanelActiveTab` value), via
                `headerTitleOverride`/`headerIconOverride`/
                `headerSubheadOverride`/`headerTabsOverride`/
                `footerOverride`/`bodyOverride` on that render site — see
                each override's own doc comment there. */}

            {/* Marcus Webb action-log detail / "Do Something" knowledge-
                article detail — ONE shared floating panel, rendered via
                the same `InContactInteriorPanel` wrapper the "View
                customer info" overlay just above uses (per explicit
                request, "the same overlay type of panel as when customer
                info is clicked from the details panel" — later
                formalized into that shared wrapper once an audit found
                the two had drifted on `maxWidth`, see that file's own
                doc comment). Per a LATER explicit follow-up
                ("toggling between refund approved and tablet warranty
                coverage should change the content of the container —
                like how the home page works"), this used to be TWO
                separate overlays (one per content kind) — now it's one,
                switching between `DetailPanelContent`'s three "views"
                (see that type's own doc comment). `onBack` (new on
                `InteriorPanel`/`ContainerHeader` — see interior-panel.tsx/
                container-header.tsx) renders a back arrow to the left of
                the title, shown only for the `"article-link"` view, to
                return to the article without a second nested panel
                (nesting isn't supported).

                Per explicit bug report (on the original single-purpose
                version of this panel), this used to gate the WHOLE
                `InteriorPanel` on its own nullable selection state — the
                same value also driving `open` — so the instant it
                closed, that state became `null` and React unmounted the
                panel in that same render, skipping its slide/fade
                animation entirely (that animation depends on the
                component staying mounted across an `open=true` →
                `open=false` transition — see `interior-panel.tsx`'s own
                width/opacity transition logic). Gating on
                `activeInteraction` instead keeps it mounted for the
                interaction's whole lifetime; `lastDetailPanelContent`
                (never nulled) keeps its content from going blank
                mid-close. */}
            {activeInteraction && (
              <InContactInteriorPanel
                open={!!selectedDetailPanelContent}
                onClose={() => setSelectedDetailPanelContent(null)}
                headerTitle={
                  lastDetailPanelContent?.kind === "action-log"
                    ? lastDetailPanelContent.entry.title
                    : lastDetailPanelContent?.kind === "article"
                      ? lastDetailPanelContent.article.title
                      : lastDetailPanelContent?.kind === "article-link"
                        ? lastDetailPanelContent.link.title
                        : lastDetailPanelContent?.kind === "order"
                          ? lastDetailPanelContent.order.itemName
                          : lastDetailPanelContent?.kind === "lucas"
                          ? LUCAS_THOMAS_PANEL_TITLES[lastDetailPanelContent.panel].title
                          : lastDetailPanelContent?.kind === "tom-call"
                          ? TOM_LEWIS_CALL_PANEL_TITLES[lastDetailPanelContent.panel].title
                          : lastDetailPanelContent?.kind === "lucas-memory"
                          ? "Lucas Thomas"
                          : lastDetailPanelContent?.kind === "lucas-instruction" || lastDetailPanelContent?.kind === "marcus-copilot"
                          ? lastDetailPanelContent.text
                          : lastDetailPanelContent?.kind === "lucas-order"
                          ? LUCAS_THOMAS_ORDER_DETAILS[lastDetailPanelContent.orderId].item
                          : lastDetailPanelContent?.kind === "transactions"
                            ? lastDetailPanelContent.note
                            : undefined
                }
                headerSubhead={
                  lastDetailPanelContent?.kind === "action-log"
                    ? lastDetailPanelContent.entry.timestamp
                    : lastDetailPanelContent?.kind === "transactions"
                      ? lastDetailPanelContent.timestamp
                      : lastDetailPanelContent?.kind === "lucas"
                      ? LUCAS_THOMAS_PANEL_TITLES[lastDetailPanelContent.panel].subhead
                      : lastDetailPanelContent?.kind === "tom-call"
                      ? TOM_LEWIS_CALL_PANEL_TITLES[lastDetailPanelContent.panel].subhead
                      : lastDetailPanelContent?.kind === "lucas-memory"
                      ? "Experience Memory"
                      : lastDetailPanelContent?.kind === "lucas-instruction" || lastDetailPanelContent?.kind === "marcus-copilot"
                      ? `${lastDetailPanelContent.time} · John Smith`
                      : lastDetailPanelContent?.kind === "lucas-order"
                      ? `${LUCAS_THOMAS_ORDER_DETAILS[lastDetailPanelContent.orderId].orderId} · ${LUCAS_THOMAS_ORDER_DETAILS[lastDetailPanelContent.orderId].ordered}`
                      : undefined
                }
                onBack={
                  // Orders opened from the purchase-history panel go back to it; orders opened from the docked
                  // Experience Memory view have nothing to go back to inside the slide-out, so no arrow.
                  lastDetailPanelContent?.kind === "lucas-order" && lastDetailPanelContent.from === "purchases"
                    ? () => setSelectedDetailPanelContent({ kind: "lucas", panel: "purchase-history" })
                    : lastDetailPanelContent?.kind === "lucas-order"
                    ? undefined
                    : lastDetailPanelContent?.kind === "article-link"
                    ? () =>
                        setSelectedDetailPanelContent({ kind: "article", article: lastDetailPanelContent.article })
                    : undefined
                }
              >
                {lastDetailPanelContent?.kind === "action-log" && (
                  <MarcusWebbActionDetailPanelBody entry={lastDetailPanelContent.entry} />
                )}
                {lastDetailPanelContent?.kind === "article" && (
                  <KnowledgeArticleDetailPanelBody
                    data={lastDetailPanelContent.article}
                    onViewLink={(link) =>
                      setSelectedDetailPanelContent({
                        kind: "article-link",
                        article: lastDetailPanelContent.article,
                        link,
                      })
                    }
                  />
                )}
                {lastDetailPanelContent?.kind === "article-link" && (
                  <KnowledgeArticleLinkDetailBody link={lastDetailPanelContent.link} />
                )}
                {lastDetailPanelContent?.kind === "lucas-memory" && (
                  <LucasThomasMemoryPanelBody
                    focus={lastDetailPanelContent.focus}
                    onOpenOrder={(orderId) => setSelectedDetailPanelContent({ kind: "lucas-order", orderId })}
                  />
                )}
                {lastDetailPanelContent?.kind === "tom-call" && <TomLewisCallPanelBody panel={lastDetailPanelContent.panel} />}
                {lastDetailPanelContent?.kind === "marcus-copilot" && (
                  <MarcusWebbCopilotPanelBody text={lastDetailPanelContent.text} time={lastDetailPanelContent.time} />
                )}
                {lastDetailPanelContent?.kind === "lucas-instruction" && (
                  <LucasThomasInstructionPanelBody
                    decision={lastDetailPanelContent.decision}
                    text={lastDetailPanelContent.text}
                    time={lastDetailPanelContent.time}
                  />
                )}
                {lastDetailPanelContent?.kind === "lucas-order" && (
                  <LucasThomasOrderPanelBody orderId={lastDetailPanelContent.orderId} />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "product" && (
                  <LucasThomasProductPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "payments" && (
                  <LucasThomasPaymentsPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "fraud-screening" && (
                  <LucasThomasFraudPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "payment-preferences" && (
                  <LucasThomasPreferencesPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "shipping-check" && (
                  <LucasThomasShippingPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "ai-attempts" && (
                  <LucasThomasAiAttemptsPanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "purchase-history" && (
                  <LucasThomasPurchaseHistoryPanelBody
                    onOpenOrder={(orderId) =>
                      setSelectedDetailPanelContent({ kind: "lucas-order", orderId, from: "purchases" })
                    }
                  />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "article-pay-3-2" && (
                  <LucasThomasArticlePanelBody />
                )}
                {lastDetailPanelContent?.kind === "lucas" && lastDetailPanelContent.panel === "payment-link" && (
                  <LucasThomasPaymentLinkPanelBody />
                )}
                {lastDetailPanelContent?.kind === "order" && (
                  <MarcusWebbOrderDetailPanelBody order={lastDetailPanelContent.order} />
                )}
                {lastDetailPanelContent?.kind === "transactions" && (
                  <MarcusWebbTransactionsDetailPanelBody
                    note={lastDetailPanelContent.note}
                    timestamp={lastDetailPanelContent.timestamp}
                    date={lastDetailPanelContent.date}
                    showFullTransactions={lastDetailPanelContent.showFullTransactions}
                  />
                )}
              </InContactInteriorPanel>
            )}

          </Container>

          {/* Voice call controls — per explicit follow-up request ("move
              the call controls below the main container so if a user
              navigates to home/settings while on a call the controls of
              the current call stay visible"): used to render nested inside
              the active-interaction branch's own content column, in the
              same `shrink-0` slot `InteractionComposer` occupies for a chat
              channel (see that branch's own doc comment for where this
              used to live) — that whole branch (and everything inside it)
              unmounts the instant the agent navigates to Settings/Home,
              which is exactly the reported bug. Rendered here instead, as
              `Container`'s own sibling, this bar no longer lives or dies
              with whichever top-level view (Settings/All Contacts/an
              active interaction/the Desk dashboard — the mutually-
              exclusive branches `Container` switches between) happens to
              be showing, so a live call now stays visible under all of
              them.

              Gated on `liveVoiceCallThread` (see its own doc comment
              above) instead of `activeInteraction`/`activeChannelType` —
              this is the one substantive behavior change that comes with
              the reposition, not just a cosmetic move: `activeInteraction`
              itself goes `null` on every Home/Settings nav click
              (`switchActiveInteraction(null)`, LeftNav's own `footer`
              items below), so gating on it here would have made the
              reposition a no-op — the bar would still have vanished the
              moment the agent actually navigated away, just from a
              different-looking spot. `liveVoiceCallThread` is derived
              straight from `interactions` itself, which `switchActive-
              Interaction` never touches, so it keeps resolving to the
              right call regardless of which interaction (if any) is
              currently "active."

              Per explicit follow-up request, this ONLY repositions the
              existing single-call bar — it does NOT add any hold/multi-
              call handling. `onHangUp`/`callStartTick` below now read off
              `liveVoiceCallInteraction`/`liveVoiceCallThread` rather than
              `activeInteraction`/`activeChannel` (so hanging up or the
              running timer still target the right call once it's no
              longer the active one); `onToggleTranscript`/`onToggleVideo`
              stay wired to `sidePanelOpen`/the video window exactly as
              before, but ONLY while `isViewingLiveVoiceCallInteraction` —
              both are page-level UI that belongs to whichever interaction
              is currently ON SCREEN, not to whichever one happens to have
              the live call, and those can now be two different
              interactions. Left `undefined` (hides each button outright,
              same pattern every other optional callback on this shared
              component already follows) rather than wiring them to act on
              the wrong interaction's panel/video window, or against no
              interaction at all.

              While `marcusWebbReviewing` is on, this whole page-level bar
              is hidden outright (no `VoiceCallControls`, and no substitute
              either) — per explicit follow-up request ("we need to move
              the action bar to inside the container b/c it should not be
              viewable when the user in on other pages"): the "Reviewing
              this conversation" `ActionBar` used to render right here, as
              this same page-level sibling, which meant it kept showing no
              matter which interaction (or Settings/Home) the agent had
              actually navigated to — exactly the persistence this comment
              praises for a real live call is wrong for "reviewing," which
              should only be visible while actually looking at that one
              interaction. It's moved to that interaction's own content
              column instead (`activeInteraction.id === MARCUS_WEBB_ID &&
              marcusWebbReviewing`, right where `InteractionComposer` would
              sit for a chat channel — see that composer's own doc comment
              for the "why nothing renders there for voice today" this
              reuses). */}
          {liveVoiceCallInteraction &&
          liveVoiceCallThread &&
          !(marcusWebbReviewing && liveVoiceCallInteraction.id === MARCUS_WEBB_ID) ? (
            <VoiceCallControls
              // Per explicit follow-up request/reference screenshot, now
              // that this bar sits directly on the page background instead
              // of at the bottom of the transcript column: overrides this
              // component's own default `bg-lyra-bg-surface-base px-4
              // py-2` (wide) / `px-2 py-2` (compact) — both branches share
              // one root node (see that node's own doc comment,
              // agent-next-gen-voice-call-controls.tsx), so this one
              // `className` reaches whichever is currently showing. No
              // white card background, no left/right inset (flush with
              // `Container`'s own edges), 8px top padding only (was 8px on
              // every side) — `pt-2 pb-0` (not `py-0`) so top and bottom
              // can differ; `cn`'s own tailwind-merge cleanly drops the
              // conflicting defaults for all four (background + all three
              // padding axes) rather than fighting them. `animate-in
              // slide-in-from-bottom-4 fade-in-0 duration-200` per explicit
              // follow-up request ("animate up the call controls / action
              // bar when they are instantiated") — tailwindcss-animate's own
              // entrance utilities, replaying on their own every time this
              // mounts fresh (a real call starting, or `marcusWebbReviewing`
              // switching back to `false`) without needing a `key`.
              className="bg-transparent px-0 pt-2 pb-0 animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
              // Per explicit request ("hide the video button in v3 for now
              // - keep it in phase 2"): re-using the same `showAddVideo`
              // flag Agent Workspace 2.0 Phase 1 already established (see
              // that prop's own doc comment, agent-next-gen-voice-call-
              // controls.tsx) rather than a new one, since it's the exact
              // same "not ready yet, coming back later" gate.
              showAddVideo={false}
              // Per explicit request ("when a call is placed on hold, add
              // an on hold timer below the call timer in the call controls
              // and in the interaction nav item") — same `Thread.
              // heldByAgent`/`onHoldChange` wiring Agent Workspace 2.0's
              // own identical call site already established (see that
              // field's own doc comment, agent-next-gen-interaction-
              // dashboard.tsx), plus the new `heldSinceTick` companion
              // field (same file) this request adds, set/cleared in
              // lockstep with `heldByAgent` right here so
              // `holdStartTick` below always has a real start point
              // for the bar to diff the page clock against whenever
              // `onHold` is true.
              onHold={liveVoiceCallThread.heldByAgent}
              onHoldChange={(next) => {
                // A provider call holds/resumes through `hold()` and the
                // held state comes back as an event (P0.5b.2); only a
                // scripted scenario call is held locally.
                if (contactCommands.setHold(liveVoiceCallThread, next)) return;
                setInteractions((prev) =>
                  prev.map((interaction) =>
                    interaction.id === liveVoiceCallInteraction.id
                      ? {
                          ...interaction,
                          threads: interaction.threads.map((c) =>
                            c.id === liveVoiceCallThread.id
                              ? { ...c, heldByAgent: next, heldSinceTick: next ? clock.now() : undefined }
                              : c
                          ),
                        }
                      : interaction
                  )
                );
              }}
              holdStartTick={liveVoiceCallThread.heldSinceTick}
              onHangUp={() => {
                const endedInteractionId = liveVoiceCallInteraction.id;
                const endedThreadKey = liveVoiceCallThread.id ?? liveVoiceCallThread.type ?? "channel";
                // Lucas's call is placed from his chat: the chat stays the main content (and the outcome is logged against it) until the assignment is dismissed.
                const lucasChatThread =
                  endedInteractionId === LUCAS_THOMAS_ID
                    ? liveVoiceCallInteraction.threads.find((t) => t.type === "chat")
                    : undefined;
                const outcomeThreadKey = lucasChatThread ? (lucasChatThread.id ?? lucasChatThread.type) : endedThreadKey;
                // A provider call ends through `end()`: it goes to wrap-up,
                // which the card shows as ended (P0.5b.2). Only a scripted
                // scenario call is marked ended locally.
                const endedByProvider = contactCommands.hangUp(liveVoiceCallThread);
                setInteractions((prev) =>
                  prev.map((i) =>
                    i.id === endedInteractionId
                      ? {
                          ...i,
                          ...(endedByProvider ? {} : { voiceCallEnded: true }),
                          // Per explicit request ("when a call is ended,
                          // open the outcome menu ... for the active
                          // contact"): force the tab bar onto the voice
                          // channel that just ended, regardless of
                          // whichever channel tab happened to be selected
                          // — otherwise `activeChannelOutcomeKey` below
                          // (built from whatever tab IS selected) wouldn't
                          // match the outcome popover this opens for the
                          // voice channel specifically, and it would
                          // silently fail to show.
                          currentThreadId: outcomeThreadKey,
                          // Lucas's call row leaves the nav card on hang-up; only the chat remains.
                          ...(lucasChatThread ? { threads: i.threads.filter((t) => t.type !== "voice") } : {}),
                        }
                      : i
                  )
                );
                setVoiceVideoWindowOpen(false);
                setVoiceVideoFullScreen(false);
                // A call that's ended should never leave `marcusWebbReviewing`
                // stuck `true` for next time — see that state's own doc
                // comment (above, with the rest of the Marcus Webb state).
                if (endedInteractionId === MARCUS_WEBB_ID) setMarcusWebbReviewing(false);
                // Per explicit request: ending a call opens the Log
                // Outcome popover for that call's session row — navigating
                // back to it first (same `switchActiveInteraction` every
                // other navigation path uses) if the agent isn't already
                // on it, rather than opening a popover on a row that isn't
                // even visible.
                if (endedInteractionId !== activeInteractionId) {
                  switchActiveInteraction(endedInteractionId);
                }
                handleOutcomeOpenChange(`${endedInteractionId}:${outcomeThreadKey}`, true, "transcript");
              }}
              callStartTick={liveVoiceCallThread.startTick}
              onAddToast={addToast}
              onToggleTranscript={
                isViewingLiveVoiceCallInteraction
                  ? () => {
                      if (sidePanelOpen && customerPanelActiveTab === "Transcript") {
                        setSidePanelOpen(false);
                      } else {
                        setCustomerPanelActiveTab("Transcript");
                        setSidePanelOpen(true);
                      }
                    }
                  : undefined
              }
              transcriptOpen={isViewingLiveVoiceCallInteraction && sidePanelOpen && customerPanelActiveTab === "Transcript"}
              // Per explicit request: the Transcript trigger stays visible
              // even while away from the interaction that owns this call
              // (unlike Video, still hidden outright via `undefined` above)
              // — clicking it opens a confirm `Popover` (inside
              // `VoiceCallControls` itself, anchored to the trigger) asking
              // whether to navigate back, rather than acting on the wrong
              // interaction's `sidePanelOpen`/`customerPanelActiveTab`.
              transcriptNeedsConfirm={!isViewingLiveVoiceCallInteraction}
              onConfirmViewTranscript={() => {
                if (!liveVoiceCallInteraction) return;
                // Set BEFORE switching — see `pendingCustomerPanelTabRef`'s
                // own doc comment for why a direct `setCustomerPanelActiveTab`
                // call here gets silently overwritten back to "Details" by
                // the interaction-switch reset effect a render later.
                pendingCustomerPanelTabRef.current = "Transcript";
                switchActiveInteraction(liveVoiceCallInteraction.id);
                setSidePanelOpen(true);
              }}
              onToggleVideo={
                isViewingLiveVoiceCallInteraction
                  ? () =>
                      setVoiceVideoWindowOpen((v) => {
                        const next = !v;
                        if (!next) setVoiceVideoFullScreen(false);
                        return next;
                      })
                  : undefined
              }
              videoOpen={isViewingLiveVoiceCallInteraction && voiceVideoWindowOpen}
              // Per explicit follow-up request/reference screenshot ("add
              // the customer avatar. Add the name / number/email above the
              // timer"): same fallback order `activeUnknownContactIdentifier`
              // above already uses for "whatever we can display for this
              // customer" — a real name first, then the human-readable
              // address, then the raw dialed/typed value, then this card's
              // own stable id as the last resort (there's always SOME
              // string). `customerInitials` is intentionally left unpassed
              // here — deriving real initials would duplicate lyra-ui's own
              // unexported `getInitials` (interaction-nav-item.tsx) rather
              // than reuse it, so for now every live call shows the generic
              // white `User` fallback glyph the component already falls
              // back to without it, matching the reference screenshot's own
              // unmatched-quickdial-number example. Per explicit follow-up
              // request ("avatars within the contact and call details
              // should be the initials of the customer OR a customer
              // avatar if no customer name is known"): now reuses this
              // file's own `initialsFor` (already imported for the current
              // agent's own avatar, above) the same way
              // `buildCustomerContextOverviewInfo` derives
              // `customerCard.avatarInitials` — gated on
              // `liveVoiceCallInteractionIsRealCustomer` (just above) so an
              // unidentified/ad-hoc caller's raw dialed number still falls
              // back to the generic glyph instead of nonsense initials
              // derived from digits.
              customerLabel={
                liveVoiceCallInteraction.customerName ??
                liveVoiceCallThread.addressLabel ??
                liveVoiceCallThread.value ??
                liveVoiceCallInteraction.id
              }
              customerInitials={
                liveVoiceCallInteractionIsRealCustomer && liveVoiceCallInteraction.customerName
                  ? initialsFor(liveVoiceCallInteraction.customerName)
                  : undefined
              }
            />
          ) : null}

          {/* Shared single-container panel — float (CSS transitions, not
              keyframe animations — avoids compositor fill-mode flash).
              Was five near-identical blocks (one per panel); with only one
              physical container now, there's only one. */}
          {panelVariant === "float" && panelMounted && !panelFullScreen && (
            <div
              style={{
                ...getPanelFloatStyle(),
                pointerEvents: "none",
                visibility: panelState === "closed" ? "hidden" : "visible",
                opacity: panelState === "open" ? 1 : 0,
                transform: panelState === "open" ? "translateY(0)" : "translateY(-8px)",
                transition: panelState === "open"
                  ? "opacity 150ms ease, transform 150ms ease"
                  : "opacity 100ms ease, transform 100ms ease",
              }}
            >
              {sharedPanel}
            </div>
          )}

          {/* Shared single-container panel — fullscreen. Rendered here, as
              the last child of `containerRef`'s own div (which is already
              `relative`), so the `absolute inset-0` overlay fills exactly
              this container — LeftNav and AppHeader (both outside this
              div entirely) stay visible/untouched. See
              `sharedPanelFullScreenOverlay`'s own doc comment (near
              `sharedPanel`, above) for why this bypasses `Draggable`
              entirely instead of trying to stretch its "float" variant to
              cover the container. */}
          {sharedPanelFullScreenOverlay}

        </div>

        {/* Shared single-container panel — docked (sibling of containerRef
            so flex layout keeps it in-bounds). Was five near-identical
            blocks (one per panel); with only one physical container now,
            there's only one. Skipped in `isCombinedPanelMode` — below
            768px the panel's content renders inline as the main
            container's second tab instead (see above), not as this
            separate docked-width column beside it. Also skipped while
            `panelFullScreen` is on — `sharedPanelFullScreenOverlay` (an
            `absolute inset-0` overlay rendered as `containerRef`'s own last
            child, just above) takes over instead.

            `dockedPanelRenderWidth` (below), not the raw `panelWidth`
            state, drives this block's own two `width` styles —
            `maxDockedWidthForMainFloor` (computed once, alongside
            `sharedPanel` above, so `Draggable`'s own `maxWidth` prop there
            can use the exact same boundary) is `containerRef`'s own
            `min-w-[374px]` floor's other half: without SOMETHING here
            actively shrinking to make room, that floor has nowhere to
            borrow space from on its own — once this panel's width plus
            that floor plus LeftNav's own width exceed what
            `bodyContainerWidth` actually has, plain CSS has no way to
            shrink one flex sibling to free up room for another's min-width,
            so the ROW just grows past the viewport instead (confirmed live
            as the actual failure mode of an earlier, simpler attempt at
            this same min-width — and, separately, of an even earlier
            version of THIS fix that only capped the render width while
            NOT actively dragging, which still let a live drag visually run
            the panel off the right edge of the screen; feeding the same
            boundary into `Draggable`'s own `maxWidth` above closes that
            gap too, so this now applies unconditionally, drag or not).
            `panelWidth` itself (the drag-resized value `Draggable`'s own
            `onWidthChange` writes) is left untouched everywhere else —
            float-mode sizing, `Draggable`'s own `defaultWidth`, the
            reset-on-close effect, etc. — so this only clamps what actually
            PAINTS while docked; the size the agent actually dragged to is
            still exactly what they get back the moment there's room for it
            again (window widened, LeftNav collapsed, panel re-opened after
            being closed). */}
        {panelVariant === "docked" && !isCombinedPanelMode && !panelFullScreen && (() => {
          const dockedPanelRenderWidth = Math.min(panelWidth, maxDockedWidthForMainFloor);
          return (
        <div className="flex h-full pb-3" style={{
            width: panelState === "open" ? dockedPanelRenderWidth : 0,
            height: "100%",
            marginRight: panelState === "open" ? 12 : 0,
            overflow: "hidden",
            flexShrink: 0,
            transition: panelIsResizing ? "none" : "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}>
            <div
              className="flex flex-col h-full animate-in fade-in-0 duration-150"
              style={{
                width: dockedPanelRenderWidth,
                height: "100%",
                display: panelState === "open" ? "flex" : "none",
              }}
            >
              {sharedPanel}
            </div>
        </div>
          );
        })()}

      </div>

      {/* ── Welcome modal — shown once on page load. Uses the real lyra-ui
          `Modal` component (variant="light": frosted blur backdrop,
          portal-rendered via Radix Dialog, focus-trapped) rather than a
          hand-rolled backdrop div, so it actually dims/blurs the dashboard
          behind it like a real overlay instead of just painting over it.
          Not dismissible via backdrop click or Escape — only the two
          buttons close it. Previously composed by hand as `Overlay` +
          `AgentWelcomeMessage` (which itself rendered its own
          `Container variant="modal"` shell) — `Modal` now owns that
          Radix Dialog wiring directly, so `AgentWelcomeMessage` is passed
          `bare` to skip its own card chrome and avoid nesting two.

          `Modal`'s "light" variant is a fixed `bg-white/70` by design (see
          Overlay.stories.tsx — "light" vs. "dark" are two deliberately
          static, theme-independent overlay looks, not meant to react to
          dark mode). This page's backdrop needs to actually match the
          current theme, so we override just the background color via
          `overlayClassName` (twMerge drops the variant's `bg-white/70` for
          this `bg-[color-mix(...)]`, keeping `backdrop-blur-sm`). We use
          color-mix() instead of a plain `bg-lyra-bg-surface-shell/70`
          opacity modifier because Tailwind can't generate opacity-modified
          utilities for our `var(--lyra-color-*)` tokens (same root cause as
          the Tag border-color bug — see lyra-ui's PROJECT_SUMMARY.md).

          The card itself is still the shared `AgentWelcomeMessage` lyra-ui
          component (icon/title/lastLogin block + info-box slot + Separator +
          two-button footer) — `ariaTitle` gives screen readers the real
          dialog name since that title now renders inside `AgentWelcomeMessage`
          itself rather than through `Modal`'s own `headerTitle`. ── */}
      <Modal
        variant="light"
        overlayClassName="bg-[color-mix(in_srgb,var(--lyra-color-bg-surface-shell)_75%,transparent)]"
        open={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        closeOnBackdropClick={false}
        ariaTitle={`Good morning, ${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`}
      >
        {/* Info-box `children` (skills/teammates summary) hidden for
            now — per explicit request. `AgentWelcomeMessage` only renders
            that slot (and the Separator above the footer that goes with
            it) when `children` is actually passed, so simply omitting it
            here removes the box cleanly rather than rendering it empty.
            The numbers it used to show (`AGENT_SKILLS_COUNT`/
            `TEAMMATES_ONLINE_COUNT`/`TEAMMATES_AVAILABLE_COUNT`) are still
            defined/unused above — left in place to restore this easily
            later. */}
        <AgentWelcomeMessage
          bare
          icon={<img src={appIcon} alt="" className="h-8 w-8 shrink-0" />}
          title={`Good morning, ${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`}
          lastLogin={WELCOME_MODAL_LAST_LOGIN}
          onPrimaryClick={handleGoAvailable}
          // Uses AgentWelcomeMessage's own default "Start Unavailable" label
          // (no secondaryLabel override — see CLAUDE.md's lyra-ui rules).
          // Per explicit follow-up request, reverted from a prior app-only
          // "Start Offline" override back to this default. Still calls
          // handleStartUnavailable, which sets the agent's real AgentStatus
          // to "unavailable" — lyra-ui's AgentStatus type has no distinct
          // "offline" value (dropped "offline" a while back, see
          // handleStartUnavailable's own doc comment above).
          onSecondaryClick={handleStartUnavailable}
        />
      </Modal>

      {/* Fired by `fireDismissToast` (`handleDismissInteraction`/
          `handleDismissChannel`), `fireAgentLegStatusToast`
          (`AgentProfile`'s own `onAgentLegStatusChange`), and
          `handleInteractionStatusChange` (any status pill/Outcome
          Resolution change) — kept at the very end of this tree, a sibling
          of everything else, same as `Modal` above, so it's always mounted
          regardless of which desk tab/panel is currently active.

          Wrapping `<div>` takes over the `fixed bottom-4 right-4`
          positioning `ToastContainer` normally owns itself (overridden
          below via its own `className` — `cn`'s `tailwind-merge` cleanly
          drops the conflicting defaults rather than fighting them) so the
          "Dismiss All" chip can sit as a normal flex sibling ABOVE the
          toast stack, per explicit request, rather than needing a second,
          separately-measured `fixed` element trying to track the first
          toast's ever-changing position by hand. */}
      {/* `z-[9999]` — same top-most tier `AppHeader`'s own menus reserve
          (see the floated-panel `zIndex: 40` cap's own doc comment a few
          hundred lines up) — was `z-50`, which sat comfortably above a
          normal docked/full-screen `CustomerInformationSidePanel` (`z-[5]`/
          `z-[9]`) but still lost to it visually once confirmed live (a
          save-confirmation toast peeking out from BEHIND the panel's own
          edit-mode content, not floating above it) — per explicit request,
          a toast should never be hidden behind ANY panel, so this jumps
          straight to the same reserved top tier menus use rather than
          guessing at some smaller number still under whatever the panel's
          own effective stacking context turns out to be. */}
      {/* Floating video window — see AgentNextGenPage.tsx's identical
          render site for the full positioning/z-index rationale, including
          why this is anchored via `left`/`top` (not `right`/`bottom` —
          that anchoring made the corner-resize handle visually grow the
          window LEFT/UP instead of right/down, a confirmed live bug) and
          why it's hidden while `voiceVideoFullScreen`. */}
      {voiceVideoWindowOpen && !voiceVideoFullScreen && activeInteraction && activeChannelType === "voice" && (
        <div
          className="fixed z-40"
          style={{ left: "calc(100vw - 324px)", top: "calc(100vh - 496px)" }}
        >
          <VideoCallWindow
            customerName={activeInteraction.customerName}
            onClose={() => setVoiceVideoWindowOpen(false)}
            onFullScreen={() => setVoiceVideoFullScreen(true)}
          />
        </div>
      )}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
        {/* Marcus Webb's own incoming-call notice — per explicit request,
            rendered in this SAME toast area (this whole `fixed bottom-4
            right-4` block, shared with the plain `toasts` stack below) so
            it visually arrives from the same place every other
            notification does, first in this flex-col so it stacks above
            them rather than getting buried underneath. A lyra-ui `Popover`
            (`asAnchor`, so nothing here has click-to-toggle behavior of its
            own — see `Popover`'s own `asAnchor` doc comment, popover.tsx)
            anchored to a plain, invisible `span` planted right here rather
            than at Marcus's own (nonexistent-until-committed) trigger
            button — `placement="top"` is what makes it slide in FROM the
            bottom (`data-[side=top]:slide-in-from-bottom-2`/`slide-out-to-
            bottom-1`, popover.tsx's own Content className) instead of
            sideways, satisfying "animate up from the bottom of the screen"
            for free, off the same Popover primitive every other
            hover-preview in this file already uses. */}
        {marcusWebbNoticeOpen && (
          <Popover
            open={marcusWebbNoticeOpen}
            onOpenChange={setMarcusWebbNoticeOpen}
            asAnchor
            placement="top"
            align="end"
            sideOffset={0}
            showArrow={false}
            bodyPadding={false}
            className="border-0 bg-transparent p-0 shadow-none"
            onOpenAutoFocus={(e: Event) => e.preventDefault()}
            // Escape/outside-click still `preventDefault()`d — per explicit
            // follow-up request, the notice now has a real close button
            // (`onClose` below) instead, which stays the one deliberate way
            // to dismiss it rather than also allowing an accidental
            // Escape/outside-click to do the same.
            onEscapeKeyDown={(e: Event) => e.preventDefault()}
            onInteractOutside={(e: Event) => e.preventDefault()}
            content={
              <MarcusWebbIncomingCallNotice
                contextOverview={marcusWebbContextOverviewInfo}
                onClose={() => setMarcusWebbNoticeOpen(false)}
                onReview={() => {
                  // Per explicit follow-up request, "Review" now navigates
                  // to the contact view too — same `setActiveInteractionId`
                  // "Takeover" already used, so both actions land the agent
                  // on Marcus's interaction; only what's available once
                  // they're there differs — this is that split
                  // (`marcusWebbReviewing`, see its own doc comment above):
                  // "Review" leaves the agent in review-only mode (the
                  // live-call bar shows the "Reviewing this conversation"
                  // `ActionBar` in place of full `VoiceCallControls`),
                  // "Takeover" (below) skips it entirely.
                  commitMarcusWebbInteraction();
                  setMarcusWebbNoticeOpen(false);
                  setActiveInteractionId(MARCUS_WEBB_ID);
                  setMarcusWebbReviewing(true);
                  // Per explicit follow-up request ("display the transcript
                  // in the session details panel when the contact goes into
                  // review mode"), LATER reversed by a further explicit
                  // follow-up ("Marcus Webb shouldn't default to Transcript
                  // on first open, show the Overview tab like other
                  // contacts") — this no longer force-selects "Transcript"
                  // here; the `[activeInteractionId]` effect's own
                  // unconditional `setCustomerPanelActiveTab("Details")`
                  // (displayed as "Overview") now applies to this switch
                  // exactly like every other interaction, Marcus included.
                  // `setSidePanelOpen(false)` still needs to be explicit here
                  // (same as `onTakeover` just below) — the docked panel
                  // doesn't otherwise know this counts as a fresh interaction
                  // "loading" since Marcus's interaction is seeded directly
                  // rather than going through one of the shared launch-path
                  // handlers that already call this.
                  setSidePanelOpen(false);
                }}
                onTakeover={() => {
                  commitMarcusWebbInteraction();
                  setMarcusWebbNoticeOpen(false);
                  setActiveInteractionId(MARCUS_WEBB_ID);
                  setMarcusWebbReviewing(false);
                  // Per explicit follow-up request ("start every
                  // conversation with the contact details panel closed") —
                  // this is itself a "new interaction loading" for the
                  // agent (the first time Marcus's interaction becomes
                  // active this session), same as every other
                  // `isNewInteraction` launch path's own
                  // `setSidePanelOpen(false)` (see the `sidePanelOpen` state
                  // declaration's own doc comment) — but this one is
                  // hand-written since Marcus's interaction is seeded
                  // directly rather than going through one of those shared
                  // launch-path handlers. `customerPanelActiveTab` needs no
                  // explicit set here: `marcusWebbReviewing` is already
                  // `false` by the time the `[activeInteractionId]` effect
                  // above runs, so its own guard already resets it to
                  // "Details" (displayed as "Overview") exactly like every
                  // other interaction switch.
                  setSidePanelOpen(false);
                }}
              />
            }
          >
            <span className="h-0 w-0" />
          </Popover>
        )}
        {/* Only once there's more than one toast actually stacked up —
            with just one (or zero) on screen, its own "×" is already the
            one-click way to clear it; this chip only earns its place once
            dismissing them one at a time would actually be tedious. */}
        {/* Counts the dedicated agent-leg toast (below) alongside the plain
            `toasts` list — it's not part of that array (see
            `agentLegDisconnectedToastOpen`'s own doc comment above), but it
            still visually stacks with everything else here, so the chip's
            "is it worth a one-click clear-everything" threshold needs to
            count it too. */}
        {toasts.length + (agentLegDisconnectedToastOpen ? 1 : 0) > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              dismissAllToasts();
              // Not phased through `forceClosed`/a delayed removal the way
              // `dismissAllToasts` staggers the plain `toasts` list's own
              // exit animation — same accepted "immediate, unanimated
              // close" this toast's own "Connect" button already does (see
              // `handleConnectAgentLeg`), just triggered from "Dismiss All"
              // instead.
              setAgentLegDisconnectedToastOpen(false);
            }}
            className="rounded-full bg-lyra-bg-surface-overlay shadow-lg"
          >
            Dismiss All
          </Button>
        )}
        <ToastContainer className="static bottom-auto right-auto z-auto">
          {toasts.map((t) => (
            <Toast
              key={t.id}
              variant={t.variant}
              title={t.title}
              duration={t.duration}
              // Set by `dismissAllToasts` (toast.tsx) on every toast at
              // once, so clicking "Dismiss All" plays every toast's own
              // exit animation simultaneously instead of them vanishing
              // instantly — see `Toast`'s own `forceClosed` doc comment.
              forceClosed={t.closing}
              onDismiss={() => dismissToast(t.id)}
            >
              {t.message}
            </Toast>
          ))}
          {/* Dedicated "Agent Leg Disconnected" toast (lyra-ui) — see
              `agentLegDisconnectedToastOpen`'s own doc comment above for why
              this lives outside the plain `toasts` list. Only mounted while
              actually open, same "presence controls mounting" idiom the
              `.map()` above already uses per-item. */}
          <IfCapable when={(c) => c.interaction.agentLeg}>
            {agentLegDisconnectedToastOpen && (
              <AgentLegDisconnectedToast
                onConnect={handleConnectAgentLeg}
                onDismiss={() => setAgentLegDisconnectedToastOpen(false)}
              />
            )}
          </IfCapable>
        </ToastContainer>
      </div>
    </div>
    </QueueSimContext.Provider>
    </PageClockContext.Provider>
  );
}
