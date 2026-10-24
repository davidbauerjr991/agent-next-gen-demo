import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Menu, Popover } from "@nicecxone/lyra-ui";

interface ChannelThreadMenuEntry {
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
  /** The thread on screen (its tab, or the panel's): marked current. */
  activeKey?: string;
  onSelect: (key: string) => void;
  /** Hovering the menu keeps a hover-opened menu open (k8 10). */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/** How long a hover-opened menu waits after the pointer leaves the icon or
 *  the menu, so it can cross the gap between them. */
const HOVER_CLOSE_MS = 150;

/** The channel thread menu's state (P-AIFIRST (k8) 7, 10): which channel's
 *  menu is open and the icon it hangs from. It opens on hover and on click;
 *  leaving the icon and the menu closes it after a moment. The anchor is the
 *  channel's icon wrapper, which keeps its element while threads come and
 *  go (keyed by channel), so the menu never measures a detached node. */
export function useChannelThreadMenu() {
  const anchorRef = useRef<HTMLElement | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelClose = useCallback(() => clearTimeout(timer.current), []);
  const openFor = useCallback((type: string, anchor: HTMLElement) => {
    clearTimeout(timer.current);
    anchorRef.current = anchor;
    setChannel(type);
  }, []);
  const close = useCallback(() => {
    clearTimeout(timer.current);
    setChannel(null);
  }, []);
  const scheduleClose = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setChannel(null), HOVER_CLOSE_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { channel, anchorRef, openFor, close, scheduleClose, cancelClose };
}

/** One icon per channel with a thread picker (P-AIFIRST (k6) 4, k8 10):
 *  when a channel has more than one thread, its header icon opens this menu
 *  (on hover, in place of the preview, and on click), one row per thread
 *  (address, last message time, unread); choosing one activates it (its
 *  tab, or the panel's thread under "main"). A lyra `Menu` in a `Popover`
 *  anchored on the icon (`virtualAnchorRef`), `bodyPadding` off as every
 *  Menu-in-Popover. */
export function ChannelThreadMenu({ open, onOpenChange, anchorRef, threads, activeKey, onSelect, onMouseEnter, onMouseLeave }: ChannelThreadMenuProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      virtualAnchorRef={anchorRef}
      placement="bottom"
      align="end"
      showArrow={false}
      bodyPadding={false}
      aria-label="Threads"
      onOpenAutoFocus={(e: Event) => e.preventDefault()}
      onCloseAutoFocus={(e: Event) => e.preventDefault()}
      content={
        <div data-slot="channel-thread-menu" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
          <Menu
            bare
            items={threads.map((t) => ({
              id: t.key,
              label: t.label,
              description:
                [t.key === activeKey ? "Current" : undefined, t.time, t.unread ? `${t.unread} unread` : undefined].filter(Boolean).join(" · ") ||
                undefined,
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
