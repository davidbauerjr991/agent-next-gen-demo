// Each non-conversation kind's minimal action area (P-HOME-1): what the
// schedule source says about it. Only actions that exist are shown — a
// callback's Dial and a task's "Call <customer>" (P-HOME-1d); joining a
// meeting or starting a module arrive with their connections (P-HOME-2 and
// later), so they aren't buttons yet. The outcome is on the card (Outcome).
import { Button, Container, MenuItem } from "@nicecxone/lyra-ui";
import { DisabledReason } from "@/contact-handling/DisabledReason";
import { scheduleCallTarget, useScheduleDial } from "@/contact-handling/home/useScheduleCalls";
import { UNAVAILABLE_CALL_TOOLTIP, useAgentAvailable } from "@/contact-handling/presence-gates";
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

/** A call from this item: opens the dial pad beneath the button, prefilled
 *  with the customer's number (skill and submit are the agent's); never dials directly. */
function CallButton({ item, label }: { item: ScheduleItem; label: string }) {
  const available = useAgentAvailable();
  const dial = useScheduleDial();
  if (!scheduleCallTarget(item)) return null;
  return (
    <div>
      <DisabledReason reason={available ? undefined : UNAVAILABLE_CALL_TOOLTIP}>
        <Button variant="default" size="md" disabled={!available} data-schedule-call="" onClick={(e) => dial(item, e.currentTarget)}>
          {label}
        </Button>
      </DisabledReason>
    </div>
  );
}

/** A callback: who, why, and Dial. Until P0.9 the call is its own voice
 *  assignment carrying the callback's customer; its wrap-up completes the callback. */
function CallbackBody({ item }: { item: ScheduleItem }) {
  const detail = item.detail.kind === "callback" ? item.detail : null;
  if (!detail) return null;
  return (
    <Container variant="neutral-subtle" headerTitle={t("Callback · {name}", { name: item.customer?.name ?? detail.phone })}>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <Summary item={item} />
        <p className="lyra-body-md">{detail.reason}</p>
        <CallButton item={item} label={t("Dial {phone}", { phone: detail.phone })} />
        <p className="lyra-body-sm text-lyra-fg-secondary">
          {t("The call opens as its own assignment with this customer; its wrap-up completes the callback.")}
        </p>
      </div>
    </Container>
  );
}

export function KindBody({ item }: { item: ScheduleItem }) {
  const d = item.detail;
  switch (d.kind) {
    case "callback":
      return <CallbackBody item={item} />;
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
            {/* A call from a task leaves the task open; the call's summary joins its notes. */}
            {item.customer && <CallButton item={item} label={t("Call {name}", { name: item.customer.name })} />}
            {item.notes?.length ? (
              <div className="flex flex-col gap-1" data-task-notes>
                <span className="lyra-label text-lyra-fg-secondary">{t("Notes")}</span>
                <Lines lines={item.notes} />
              </div>
            ) : null}
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
