import type { RefObject } from "react";
import { Menu, Popover } from "@nicecxone/lyra-ui";

export interface ChannelThreadMenuEntry {
  key: string;
  /** The thread's address (or subject). */
  label: string;
  /** Its last message's time, if any. */
  time?: string;
  unread?: number;
}

export interface ChannelThreadMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The channel's header icon the menu hangs from. */
  anchorRef: RefObject<HTMLElement | null>;
  threads: readonly ChannelThreadMenuEntry[];
  /** The thread on screen (its tab, or the panel's). */
  activeKey?: string;
  onSelect: (key: string) => void;
}

/** One icon per channel with a thread picker (P-AIFIRST (k6) 4): when a
 *  channel has more than one thread, its header icon opens this menu, one
 *  row per thread (address, last message time, unread); choosing one
 *  activates it (its tab, or the panel's thread under "main"). A lyra `Menu`
 *  in a `Popover` anchored on the icon (`virtualAnchorRef`), `bodyPadding`
 *  off as every Menu-in-Popover. */
export function ChannelThreadMenu({ open, onOpenChange, anchorRef, threads, activeKey, onSelect }: ChannelThreadMenuProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      virtualAnchorRef={anchorRef}
      placement="bottom"
      align="end"
      showArrow={false}
      bodyPadding={false}
      onCloseAutoFocus={(e: Event) => e.preventDefault()}
      content={
        <div data-slot="channel-thread-menu">
          <Menu
            bare
            items={threads.map((t) => ({
              id: t.key,
              label: t.label,
              description: [t.time, t.unread ? `${t.unread} unread` : undefined].filter(Boolean).join(" · ") || undefined,
              active: t.key === activeKey,
              onClick: () => {
                onOpenChange(false);
                onSelect(t.key);
              },
            }))}
          />
        </div>
      }
    >
      <span aria-hidden="true" className="sr-only" />
    </Popover>
  );
}
