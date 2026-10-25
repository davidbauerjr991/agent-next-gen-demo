// Each non-conversation kind's minimal action area (P-HOME-1): what the
// schedule source says about it. Only actions that exist are shown — a
// callback's Dial; joining a meeting or starting a module arrive with their
// connections (P-HOME-2 and later), so they aren't buttons yet.
import { Button, Container, MenuItem } from "@nicecxone/lyra-ui";
import { OUTBOUND_CONFIG } from "@/components/agent-next-gen-outbound-data";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { UNAVAILABLE_CALL_TOOLTIP, useAgentAvailable } from "@/contact-handling/presence-gates";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import type { ScheduleItem } from "@/providers";
import { t } from "@/i18n";

function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <div className="-mx-3 flex flex-col">
      {lines.map((line) => (
        <MenuItem key={line} as="div" static comfortable={false} label={line} />
      ))}
    </div>
  );
}

function Summary({ item }: { item: ScheduleItem }) {
  return <p className="lyra-body-md text-lyra-fg-secondary">{[item.subtitle, item.sourceLabel].filter(Boolean).join(" · ")}</p>;
}

/** A callback: who, why, and Dial. The call starts as its own voice
 *  assignment until P0.9's WorkItem lets a leg join the callback. */
function CallbackBody({ item, onDialed }: { item: ScheduleItem; onDialed: () => void }) {
  const { outboundDial } = useWorkspace();
  const available = useAgentAvailable();
  const detail = item.detail.kind === "callback" ? item.detail : null;
  if (!detail) return null;
  const skill = OUTBOUND_CONFIG.skillOptions[0]?.value ?? "";
  return (
    <Container variant="neutral-subtle" headerTitle={t("Callback · {name}", { name: item.customer?.name ?? detail.phone })}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <Summary item={item} />
        <p className="lyra-body-md">{detail.reason}</p>
        <div>
          <DisabledReason reason={available ? undefined : UNAVAILABLE_CALL_TOOLTIP}>
            <Button
              variant="default"
              size="md"
              disabled={!available}
              onClick={() => {
                outboundDial.quickDial(detail.phone, skill);
                onDialed();
              }}
            >
              {t("Dial {phone}", { phone: detail.phone })}
            </Button>
          </DisabledReason>
        </div>
        <p className="lyra-body-sm text-lyra-fg-secondary">
          {t("The call opens as its own assignment; joining it to this callback arrives with work items (P0.9).")}
        </p>
      </div>
    </Container>
  );
}

export function KindBody({ item, onDialed }: { item: ScheduleItem; onDialed: () => void }) {
  const d = item.detail;
  switch (d.kind) {
    case "callback":
      return <CallbackBody item={item} onDialed={onDialed} />;
    case "meeting":
      return (
        <Container variant="neutral-subtle" headerTitle={t("Agenda")}>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Summary item={item} />
            <Lines lines={d.agenda} />
          </div>
        </Container>
      );
    case "training":
      return (
        <Container variant="neutral-subtle" headerTitle={t("Module")}>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Summary item={item} />
            <p className="lyra-body-md">{d.module}</p>
            {d.dueLabel && <p className="lyra-body-sm text-lyra-fg-secondary">{d.dueLabel}</p>}
          </div>
        </Container>
      );
    case "task":
      return (
        <Container variant="neutral-subtle" headerTitle={t("Ticket {ticket}", { ticket: d.ticket })}>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Summary item={item} />
            <p className="lyra-body-md">{d.summary}</p>
          </div>
        </Container>
      );
    case "conversation":
      return (
        <Container variant="neutral-subtle" headerTitle={t("Conversation")}>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Summary item={item} />
            <p className="lyra-body-md">{d.summary}</p>
          </div>
        </Container>
      );
    default:
      return (
        <Container variant="neutral-subtle" headerTitle={t("Details")}>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <Summary item={item} />
            <Lines lines={d.points} />
          </div>
        </Container>
      );
  }
}
