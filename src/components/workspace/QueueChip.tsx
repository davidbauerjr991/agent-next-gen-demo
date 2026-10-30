// "My Assignment Queue: n" (P-HOME-1n; from WorkspaceHome's page header). A lyra `Tag` pill in a ghost `Button`,
// the session status pill's construction (session-row-parts.tsx), so its severity is the Tag's variant: critical
// when an assignment breaches its SLA, warning while any are open, success when the queue is empty. In the left-nav
// and interior-panel slots it toggles the nav, as before. With the assignments at the top of Home (placement
// "none") it's the way between them: it mounts in the app header and opens a menu of Home and every open
// assignment, from the one card list.
import { useState } from "react";
import { Button, Menu, Popover, Tag, Tooltip, type MenuEntry } from "@nicecxone/lyra-ui";
import { ChevronDown, ChevronRight, CircleAlert, Home, MessageSquare } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useRailAssignmentCount } from "@/contact-handling/home/useScheduleCards";
import { useAssignmentCards, type AssignmentEntry } from "@/contact-handling/useAssignmentCards";
import { CONTACT_HISTORY_CHANNEL_LABEL } from "@/components/agent-next-gen-contact-history";
import { KindIcon, kindLabel } from "@/components/home/home-kinds";

/** Where the chip is mounted: Home's page header, or the app header (placement "none" only). */
export type QueueChipMount = "home" | "appHeader";

function entryRow(entry: AssignmentEntry) {
  if (entry.type === "schedule") {
    return { label: entry.item.customer?.name ?? entry.item.title, description: kindLabel(entry.item.kind), icon: <KindIcon kind={entry.item.kind} />, offered: entry.item.state === "offered" };
  }
  const { interaction } = entry;
  const channels = [...new Set(interaction.threads.map((th) => CONTACT_HISTORY_CHANNEL_LABEL[th.type as keyof typeof CONTACT_HISTORY_CHANNEL_LABEL] ?? th.type))];
  return {
    label: interaction.customerName ?? interaction.threads[0]?.value ?? "",
    description: channels.join(" · "),
    icon: <MessageSquare className="h-4 w-4" strokeWidth={1.5} />,
    offered: !!interaction.offered,
  };
}

export function QueueChip({ mount }: { mount: QueueChipMount }) {
  const {
    activeInteractionId, hasBreachedSlaAssignment, setLeftNavPage, setNavOpen, setPanelFullScreen, setShowSettings, switchActiveInteraction,
  } = useWorkspace();
  // P-LAYOUT: where it mounts is its part's slot (`<Slot>`); in the app header (it follows the assignments to the
  // top of Home there) it's the switcher.
  const isSwitcher = mount === "appHeader";
  const count = useRailAssignmentCount();
  const { entries } = useAssignmentCards(false);
  const [open, setOpen] = useState(false);

  const pill = (
    <Tag
      label={t("My Assignment Queue: {count}", { count: count > 0 ? String(count) : t("Empty") })}
      variant={hasBreachedSlaAssignment ? "critical" : count > 0 ? "warning" : "success"}
      shape="pill"
      icon={hasBreachedSlaAssignment ? <CircleAlert strokeWidth={1.5} aria-hidden="true" /> : undefined}
      trailingIcon={
        isSwitcher ? (
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} strokeWidth={1.5} />
        ) : (
          <ChevronRight strokeWidth={1.5} />
        )
      }
    />
  );
  const trigger = (onClick?: () => void) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-haspopup={isSwitcher ? "menu" : undefined}
      aria-expanded={isSwitcher ? open : undefined}
      data-slot="queue-chip"
      className="h-auto shrink-0 rounded-full p-0"
    >
      {pill}
    </Button>
  );

  if (!isSwitcher) {
    return (
      <Tooltip content={t("Toggle Assignment Panel")} placement="bottom" asLabel>
        {trigger(() => setNavOpen((v) => !v))}
      </Tooltip>
    );
  }

  const go = (key: string | null) => {
    setOpen(false);
    setShowSettings(false);
    setLeftNavPage(null);
    switchActiveInteraction(key);
    // As a card click does: picking the already-active card still leaves a full-screen panel.
    if (key) setPanelFullScreen(false);
  };
  const items: MenuEntry[] = [
    { id: "home", label: t("Home"), icon: <Home className="h-4 w-4" strokeWidth={1.5} />, active: activeInteractionId === null, onClick: () => go(null) },
    ...entries.map((entry) => {
      const row = entryRow(entry);
      return {
        id: entry.key,
        label: row.label,
        description: row.description,
        icon: row.icon,
        active: activeInteractionId === entry.key,
        rightElement: row.offered ? <Tag label={t("Offered")} variant="info" /> : undefined,
        // An offer's Accept / Decline are on its tile at the top of Home.
        onClick: () => go(row.offered ? null : entry.key),
      };
    }),
  ];
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
      bodyPadding={false}
      // Focus goes back to the chip on close (Radix's default; the chip has no tooltip here to re-pop).
      content={<Menu items={items} bare />}
    >
      {trigger()}
    </Popover>
  );
}
