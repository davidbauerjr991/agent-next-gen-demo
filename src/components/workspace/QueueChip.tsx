// "My Assignment Queue: n" (P-HOME-1n; from WorkspaceHome's page header). A lyra `Tag` pill in a ghost `Button`,
// the session status pill's construction (session-row-parts.tsx), so its severity is the Tag's variant: critical
// when an assignment breaches its SLA, warning while any are open, success when the queue is empty. It shows or hides
// the assignments list where it is: the left nav, or the interior panel (P-LAYOUT-F1). (Its app-header switcher,
// for placement "none", went with that placement in P-LAYOUT-F1 B.)
import { Button, Tag, Tooltip } from "@nicecxone/lyra-ui";
import { ChevronRight, CircleAlert } from "lucide-react";
import { t } from "@/i18n";
import { useSlotFor } from "@/layout/useSlot";
import { setAssignmentsWorkingState, useAssignmentsWorkingState } from "@/contact-handling/assignments-working-state";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useRailAssignmentCount } from "@/contact-handling/home/useScheduleCards";

export function QueueChip() {
  const { hasBreachedSlaAssignment, setNavOpen } = useWorkspace();
  const inPanel = useSlotFor("assignments") === "interior-panel";
  const { panelOpen } = useAssignmentsWorkingState();
  const count = useRailAssignmentCount();
  const toggle = () => (inPanel ? setAssignmentsWorkingState({ panelOpen: !panelOpen }) : setNavOpen((v) => !v));
  return (
    <Tooltip content={t("Toggle Assignment Panel")} placement="bottom" asLabel>
      <Button variant="ghost" size="sm" onClick={toggle} data-slot="queue-chip" className="h-auto shrink-0 rounded-full p-0">
        <Tag
          label={t("My Assignment Queue: {count}", { count: count > 0 ? String(count) : t("Empty") })}
          variant={hasBreachedSlaAssignment ? "critical" : count > 0 ? "warning" : "success"}
          shape="pill"
          icon={hasBreachedSlaAssignment ? <CircleAlert strokeWidth={1.5} aria-hidden="true" /> : undefined}
          trailingIcon={<ChevronRight strokeWidth={1.5} />}
        />
      </Button>
    </Tooltip>
  );
}
