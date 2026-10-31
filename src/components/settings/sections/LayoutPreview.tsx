// Settings → Layout's live preview (P-LAYOUT): the page's slots as a scaled schematic, each a lyra Container
// holding its parts in order, from the same `layout.parts` the workspace reads, so a move shows at once. The
// reference cells render the real cards on Maya Chen's seeded case (the P-CARDS approach: the cards' own components,
// fed the scenario's content rather than a second workspace controller); every other part is a labelled box. A
// picture, not a control: inert, named for assistive tech.
import type { ReactNode } from "react";
import { Container } from "@nicecxone/lyra-ui";
import { CustomerInfoCard } from "@/components/ai-cards/CustomerInfoCard";
import { initialsFor } from "@/components/agent-next-gen-shared-utils";
import { homeIsTwoColumn, homeSectionsInOrder, partOf } from "@/contact-handling/home/home-layout";
import { JourneySummaryCard } from "@/components/ai-cards/JourneySummaryCard";
import { RealTimeSummaryCard } from "@/components/ai-cards/RealTimeSummaryCard";
import { t } from "@/i18n";
import { partsOnPage } from "@/layout/layout-edit";
import { PARTS, type PartId, type ReferenceCellPart } from "@/layout/parts";
import { REFERENCE_CELL_IDS } from "@/layout/presets";
import { SLOTS, type Page, type SlotId } from "@/layout/slots";
import { MAYA_CHEN_SCRIPT } from "@/scenarios/scripts/maya-chen";
import { useSettings } from "@/settings";

const MAYA = MAYA_CHEN_SCRIPT.content;
const MAYA_NAME = MAYA_CHEN_SCRIPT.entity.name;
const noop = () => {};
/** Each card open, as the reference column first shows it. */
const opened = { open: true, onOpenChange: noop };

/** Maya's case through each reference card's own component. */
const REFERENCE_CARDS: Record<ReferenceCellPart, () => ReactNode> = {
  realTimeSummary: () => (
    <RealTimeSummaryCard
      {...opened}
      onCopy={noop}
      summary={{
        card: { id: "preview-summary", kind: "text", purpose: "real-time-summary", title: "", status: "complete", provenance: { tier: 2, collections: ["transcript"] }, text: MAYA.overview.journeySummary },
        updatedAt: 0,
      }}
    />
  ),
  journeySummary: () => <JourneySummaryCard {...opened} journey={MAYA.journey} lookingUp={false} />,
  customerInfo: () => (
    <CustomerInfoCard {...opened} customerName={MAYA_NAME} customerCard={{ avatarInitials: initialsFor(MAYA_NAME), subtitle: MAYA.overview.subtitle, tags: [...MAYA.overview.tags] }} />
  ),
};

const isReferenceCell = (part: PartId): part is ReferenceCellPart => part in REFERENCE_CARDS;

export function LayoutPreview({ page }: { page: Page }) {
  const [{ parts }] = useSettings("layout");
  const [canvas] = useSettings("canvas");
  const [home] = useSettings("home");
  // What the page would render: a switched-off reference cell or Home section isn't drawn.
  const homeOff = new Set<string>(home.sections.filter((s) => !s.enabled).map((s) => partOf(s.key)));
  const shown = (part: PartId) =>
    !homeOff.has(part) && (!isReferenceCell(part) || canvas.cells[REFERENCE_CELL_IDS[part].cell]?.enabled !== false);
  // Home's own rule: one column unless the feed is on in main with a section beside it. In one column main is Home's
  // own one-column rows, wherever the map puts them.
  const oneColumnHome = page === "home" && !homeIsTwoColumn(home, parts);
  const partsIn = (id: SlotId): PartId[] =>
    oneColumnHome && id === "main"
      ? homeSectionsInOrder(home, parts).map(partOf)
      : oneColumnHome && id === "main-trailing"
        ? []
        : partsOnPage(parts, id, page);
  const slot = (id: SlotId, className?: string) => {
    const list = partsIn(id).filter(shown);
    if (list.length === 0 && id !== "main") return null;
    return (
      <Container variant="neutral-dotted" radius="md" className={className} data-preview-slot={id}>
        <div className="flex flex-col gap-2 p-2">
          <span className="lyra-label text-lyra-fg-secondary">{t(SLOTS[id].label)}</span>
          {list.map((part) =>
            isReferenceCell(part) ? (
              <div key={part} data-preview-part={part}>
                {REFERENCE_CARDS[part]()}
              </div>
            ) : (
              <div key={part} className="rounded-lyra-sm border border-lyra-border-subtle bg-lyra-bg-surface-base px-2 py-1 lyra-body-sm text-lyra-fg-default" data-preview-part={part}>
                {t(PARTS[part].label)}
              </div>
            ),
          )}
        </div>
      </Container>
    );
  };
  return (
    <div
      role="img"
      aria-label={t(page === "home" ? "Preview of the Home layout" : "Preview of the Interaction layout")}
      className="w-[520px] max-w-full shrink-0 overflow-hidden rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-surface-container-subtle"
      data-layout-preview={page}
    >
      {/* The workspace at about half size: the real cards keep their own widths inside. Inert inside the named
          picture (on the picture itself, `inert` would drop its name too). */}
      <div inert className="flex w-[960px] flex-col gap-2 p-3 [zoom:0.54]">
        {slot("header")}
        <div className="flex items-start gap-2">
          {slot("left-nav", "w-[180px] shrink-0")}
          {slot("interior-panel", "w-[200px] shrink-0")}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {page === "home" && slot("home-top")}
            <div className="flex items-start gap-2">
              {slot("main", "min-w-0 flex-1")}
              {page === "home" ? slot("main-trailing", "w-[360px] shrink-0") : slot("reference", "w-[360px] shrink-0")}
            </div>
          </div>
          {slot("docked-panel", "w-[220px] shrink-0")}
        </div>
        {slot("dock-bottom")}
      </div>
    </div>
  );
}
