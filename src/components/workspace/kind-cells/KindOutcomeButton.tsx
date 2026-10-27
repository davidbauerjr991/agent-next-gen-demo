// A kind's Outcome trigger and popover (P-HOME-1d–1g): on the kind card's row
// and on the kind cell's session row. Saving completes the item into History.
import * as React from "react";
import { Button, ContainerHeader, Popover, SuccessIconSolid } from "@nicecxone/lyra-ui";
import { scheduleCardKey } from "@/domain";
import { outcomeDraftKey } from "@/contact-handling/useChannelOutcomeDrafts";
import { useScheduleLeg } from "@/contact-handling/home/useScheduleCards";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useScheduleProvider } from "@/provider-context";
import type { ScheduleItem } from "@/providers";
import { t } from "@/i18n";
import { useKindOutcomeForm } from "./KindOutcomeForm";

/** Keeps a click inside the portaled popover from reaching the card (it would switch cards), as lyra's Outcome popover does. */
const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

/** The kind's Outcome: anchored to its button and laid out in the popover's header / content / footer slots with the
 *  conversation row's Outcome popover's own spacing. lyra's `buildOutcomePopoverSlots` builds those slots from a
 *  contact's fields only (tags, disposition, summary), so a kind's own form composes the same parts here. The card's
 *  and the cell's session row's. P-HOME-1g: it's the card's one Outcome; a joined call's Voice row ✓ is that call's
 *  wrap-up, and what the wrap-up records fills this form (`useKindOutcomeForm`'s `fill`). */
export function KindOutcomeButton({ item }: { item: ScheduleItem }) {
  const { activeInteractionId, outcomeDrafts, switchActiveInteraction } = useWorkspace();
  const schedule = useScheduleProvider();
  const [open, setOpen] = React.useState(false);
  const leg = useScheduleLeg(item);
  const legVoice = leg?.threads.find((th) => th.type === "voice");
  const wrapUp = legVoice ? outcomeDrafts.draftFor(outcomeDraftKey(leg!.id, legVoice.id ?? legVoice.type)) : undefined;
  const form = useKindOutcomeForm(item, wrapUp && { disposition: wrapUp.dispositionCode, note: wrapUp.summary });
  const save = () => {
    setOpen(false);
    schedule?.complete(item.id, form.outcome()).then(
      () => {
        if (activeInteractionId === scheduleCardKey(item.id)) switchActiveInteraction(null);
      },
      (err) => {
        if (import.meta.env.DEV) console.warn("[schedule] complete failed", err);
      },
    );
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
      align="end"
      // lyra's Outcome popover's own layer (channel-row.tsx).
      className="z-[9999] w-80"
      onCloseAutoFocus={(e) => e.preventDefault()}
      header={
        <div onClick={stopBubble}>
          <ContainerHeader title={t("Outcome")} bordered={false} className="px-5 pb-0" onClose={() => setOpen(false)} />
        </div>
      }
      content={
        <div className="flex flex-col gap-4 pb-2 pt-1" onClick={stopBubble}>
          {form.fields}
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-1" onClick={stopBubble} data-kind-outcome-footer="">
          <Button variant="outline" size="md" onClick={() => setOpen(false)}>
            {t("Cancel")}
          </Button>
          <Button variant="default" size="md" onClick={save} disabled={!form.canSave}>
            {t("Save outcome")}
          </Button>
        </div>
      }
    >
      <Button
        variant="icon"
        size="icon-sm"
        aria-label={t("Outcome")}
        className="shrink-0 text-lyra-fg-secondary"
        data-kind-outcome-trigger=""
        onClick={(e) => e.stopPropagation()}
      >
        <SuccessIconSolid className="h-4 w-4 text-lyra-status-info-strong" />
      </Button>
    </Popover>
  );
}
