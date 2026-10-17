import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button, Menu, Popover } from "@nicecxone/lyra-ui";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";
import { formatElapsedTime } from "@/components/agent-next-gen-shared-utils";
import { cn } from "@/lib/utils";
import type { VoiceBarCall } from "./useVoiceBarCall";

const callKey = (call: VoiceBarCall) => `${call.card.id}:${call.thread.id}`;

/** The name a call goes by in the voice bar. */
export const callLabel = (call: VoiceBarCall) => call.card.customerName ?? call.thread.addressLabel ?? call.thread.value ?? call.card.id;

/** The voice bar's call switcher (P-AIFIRST (k8) 5): with more than one call
 *  (live or held), the bar's customer label opens a menu of every call
 *  (name, state, timer). Choosing one selects its card, and the bar follows
 *  it (`useVoiceBarCall` shows the selected card's call). Selection only:
 *  it never holds or resumes a call. */
export function CallSwitcher({ calls, current, onSelect }: { calls: readonly VoiceBarCall[]; current: VoiceBarCall; onSelect: (cardId: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      placement="top"
      align="start"
      showArrow={false}
      bodyPadding={false}
      aria-label="Calls"
      onCloseAutoFocus={(e: Event) => e.preventDefault()}
      content={
        <div data-slot="call-switcher-menu">
          <ClockTick>
            {(tick) => (
              <Menu
                bare
                items={calls.map((call) => ({
                  id: callKey(call),
                  label: callLabel(call),
                  description: `${call.thread.heldByAgent ? "On hold" : "Active"} · ${formatElapsedTime(Math.max(0, tick - call.thread.startTick))}`,
                  active: callKey(call) === callKey(current),
                  onClick: () => {
                    setOpen(false);
                    onSelect(call.card.id);
                  },
                }))}
              />
            )}
          </ClockTick>
        </div>
      }
    >
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${callLabel(current)}, switch call (${calls.length} calls)`}
        aria-expanded={open}
        data-slot="call-switcher"
        className="h-auto max-w-full gap-1 px-1 py-0 lyra-body-sm font-normal text-lyra-fg-primary"
      >
        <span className="truncate">{callLabel(current)}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
      </Button>
    </Popover>
  );
}
