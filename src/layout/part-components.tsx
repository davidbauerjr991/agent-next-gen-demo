// Each part's form in every slot it may take (P-LAYOUT): the component `<Slot>` renders there, or the host that
// mounts it — a list its container builds from the map (the rail's items, the header's icons, Home's tabs and
// sections), a portal host, or the canvas registry. Thin wrappers around the existing components: nothing here
// restructures one. The registry (`parts.ts`) stays data only; this is its component side, and a test holds every
// part's every allowed slot to a form here.
import type { ComponentType } from "react";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useAssignmentCards, useChannelChipsShown } from "@/contact-handling/useAssignmentCards";
import { AssignmentEntryCard, AssignmentsCaption, AssignmentsEmptyState } from "@/components/workspace/AssignmentCardList";
import { AssignmentInlineRows } from "@/components/workspace/AssignmentInlineRows";
import { QueueChip } from "@/components/workspace/QueueChip";
import { HEADER_APP_PARTS, HOME_SECTION_PARTS, PARTS, REFERENCE_CELL_PARTS, type PartId } from "./parts";
import type { SlotId } from "./slots";

/** A container's sub-places within one slot: LeftNav's sticky caption and its top, Home's page header. A part's
 *  form without a region renders in the slot's main place. */
export type SlotRegion = "caption" | "top" | "page-header";
export type SlotKey = SlotId | `${SlotId}:${SlotRegion}`;

export interface PartProps {
  slot: SlotId;
  /** LeftNav's overlay hover state, forwarded by `<Slot>` (LeftNav clones it onto its slots' top-level children). */
  expanded?: boolean;
}

/** Mounted by a host other than `<Slot>`: what mounts it, for the docs. */
export interface HostedForm {
  host: string;
}
export type PartForm = ComponentType<PartProps> | HostedForm;

export const isHosted = (form: PartForm): form is HostedForm => typeof form === "object";

// ── The assignments ─────────────────────────────────────────────────────────────────────────────────────────

/** "Assignments (N)" in LeftNav's sticky caption, pinned with Home above the cards. */
function LeftNavAssignmentsCaption() {
  const { navOpen } = useWorkspace();
  return <AssignmentsCaption expanded={navOpen} mount="leftNav" />;
}

/** The left nav's cards: every card, conversations and opened schedule items' kind cards alike, in one sorted list
 *  with one drag wiring (P-HOME-1m: Custom order covers both; drags only while the nav is open). With none, the
 *  empty message, while the nav is open (the icon-only rail has no room for text): `header` fills the rail's
 *  height (`headerFillsHeight`), so the wrapper centers it there, and it fades in after the nav's 200ms widening so
 *  it doesn't rewrap as the box grows. */
function LeftNavAssignments({ expanded }: PartProps) {
  const { interactions, isNavNarrow, navOpen } = useWorkspace();
  const { entries, itemProps } = useAssignmentCards(navOpen && !isNavNarrow);
  const chipsShown = useChannelChipsShown("leftNav");
  if (interactions.length === 0 && entries.length === 0) {
    return navOpen ? (
      <div className="flex flex-1 min-h-0 items-center justify-center animate-in fade-in-0 duration-150 delay-200 fill-mode-backwards">
        <AssignmentsEmptyState />
      </div>
    ) : null;
  }
  // LeftNav's overlay hover `expanded` reaches the cards through `<Slot>`; inline mode injects nothing, so the card
  // falls back to `navOpen`.
  return (
    <>
      {entries.map((entry) => (
        <AssignmentEntryCard key={entry.key} entry={entry} dragProps={itemProps(entry.key)} slotExpanded={expanded} navOpen={navOpen} hideChip={!chipsShown} />
      ))}
    </>
  );
}

// ── The voice bar, the queue chip ───────────────────────────────────────────────────────────────────────────

/** Voice controls "Top of left nav": the voice bar portals in here (v3's `LeftNavVoiceSlot`), only while the nav
 *  is open; collapsed, it falls back to the bottom (`WorkspaceVoiceBar`). */
function LeftNavVoiceHost() {
  const { navOpen, setVoiceNavSlotMounted, voiceBarHost } = useWorkspace();
  return navOpen ? <HostSlot host={voiceBarHost} data-slot="left-nav-voice" onMountedChange={setVoiceNavSlotMounted} /> : null;
}

const HomeQueueChip = () => <QueueChip mount="home" />;
const AppHeaderQueueChip = () => <QueueChip mount="appHeader" />;

// ── Every part ──────────────────────────────────────────────────────────────────────────────────────────────

const CARD_OFFER: HostedForm = { host: "IncomingOfferActions on the offered card (the assignments part's cards)" };
const REFERENCE_CELL: Partial<Record<SlotKey, PartForm>> = {
  reference: { host: "the canvas registry → ReferenceColumn (useCanvasRegions)" },
  main: { host: "the canvas registry → the conversation's overview (useCanvasRegions top)" },
};
const DETAIL: Partial<Record<SlotKey, PartForm>> = {
  reference: { host: "the slide-over (ReferenceSlotFrame, contactDetailsFor)" },
  "docked-panel": { host: "WorkspaceRightPanel (slideOverPlacement)" },
};
const HOME_SECTION: Partial<Record<SlotKey, PartForm>> = {
  main: { host: "HomeDashboard (one column's rows, or two columns' feed)" },
  "main-trailing": { host: "HomeDashboard (two columns' right column, HomeTwoColumn)" },
};
const HEADER_APP: Partial<Record<SlotKey, PartForm>> = {
  header: { host: "WorkspaceAppHeader's icon row (useWsPanels header pins)" },
  "left-nav": { host: "the rail's items (useWsPanels navRailItems)" },
  "home-top": { host: "HomeTabStrip (useWsPanels tabApps)" },
};

type Forms = Partial<Record<SlotKey, PartForm>>;

/** A group's forms, kept to the slots each of its parts allows (Due soon, Contact History: main only; Agent Chat:
 *  never a Home tab). */
const each = <P extends PartId>(parts: readonly P[], forms: Forms) =>
  Object.fromEntries(
    parts.map((p) => [p, Object.fromEntries(Object.entries(forms).filter(([key]) => (PARTS[p].allowedSlots as readonly string[]).includes(key.split(":")[0])))]),
  ) as Record<P, Forms>;

export const PART_FORMS: Record<PartId, Forms> = {
  assignments: {
    "left-nav:caption": LeftNavAssignmentsCaption,
    "left-nav": LeftNavAssignments,
    "interior-panel": { host: "AssignmentsInteriorPanel (lyra's left SidePanel, first in the content card's row)" },
    // Placement "none" (P-LAYOUT fix (b)): inline rows, newest first, View opens one in the main column.
    "home-top": AssignmentInlineRows,
  },
  incomingTile: { "left-nav": CARD_OFFER, "interior-panel": CARD_OFFER, "home-top": CARD_OFFER },
  queueChip: { "home-top:page-header": HomeQueueChip, header: AppHeaderQueueChip },
  voiceBar: {
    "dock-bottom": { host: "WorkspaceVoiceBar's bottom host (voice-bar-bottom)" },
    "left-nav:top": LeftNavVoiceHost,
  },
  conversation: {
    main: { host: "InteractionBody (the transcript and composer)" },
    "docked-panel": { host: "WorkspaceRightPanel's thread (ChannelThreadBody)" },
  },
  aiFeed: {
    main: { host: "InteractionBody (inline rows in the transcript, or AiWorkspaceColumn without it)" },
    "docked-panel": { host: "Contact Details' AI Overview (OverviewBody)" },
  },
  copilotInput: {
    main: { host: "copilotHost in the main composer or AiWorkspaceColumn's dock" },
    "docked-panel": { host: "copilotHost in Contact Details' footer" },
  },
  ...each(REFERENCE_CELL_PARTS, REFERENCE_CELL),
  ...each(["contactDetails", "experienceMemory", "sessionDetails"], DETAIL),
  ...each(["activityFeed", ...HOME_SECTION_PARTS], HOME_SECTION),
  notifications: { header: { host: "WorkspaceAppHeader's icon row (NotificationsBell)" } },
  ...each(HEADER_APP_PARTS, HEADER_APP),
};

/** A part's form at one place: `slot` or `slot:region`. */
export function formAt(part: PartId, slot: SlotId, region?: SlotRegion): PartForm | undefined {
  return PART_FORMS[part][region ? (`${slot}:${region}` as SlotKey) : slot];
}
