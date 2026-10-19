import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react";

// Stable portal hosts (P-EXTRACT). A surface that moves between places in the layout (the Copilot composer between
// the panel footer, the hover preview and the AI workspace; the voice bar between the left nav and the bottom; the
// slide-over into the right panel; Marcus's card between overview slots) used to portal into whichever DOM node
// was in state at the time. A different node is a different portal target, so the surface remounted and lost its
// state (a draft, the chips, a measured parent) every time the node changed. Here each surface gets one node for
// the page's lifetime; the layout decides which `HostSlot` holds it. Moving the node never remounts what's in it.

/** One stable node for a surface's portal, created once. `className` styles the host itself (e.g. `contents`, or
 *  `empty:hidden` so an empty host takes no space in a flex gap). */
export function usePortalHost(className?: string): HTMLDivElement {
  const [host] = useState(() => {
    const el = document.createElement("div");
    if (className) el.className = className;
    return el;
  });
  return host;
}

// The slots active for each host, in the order they became active. Two can be active for a moment: the left
// nav's voice slot and the bottom one both activate in the commit that mounts the nav slot, and the bottom one
// deactivates a render later. When the slot holding the host goes, the host moves to the latest one still
// active, so it's never left detached (E1: with the controls in the left nav the bar rendered nowhere).
const activeSlots = new WeakMap<HTMLElement, HTMLElement[]>();

/** A place in the layout that holds `host` while `active`. Renders a `display: contents` wrapper (so it adds no
 *  box), and moves `host` into it; the slot that last became active holds it, and when it stops being active the
 *  host goes back to the latest slot still active. `onMountedChange` reports whether this slot is in the page at
 *  all (a nav slot that only renders while the nav is expanded). */
export function HostSlot({
  host,
  active = true,
  onMountedChange,
  style,
  ...rest
}: { host: HTMLElement; active?: boolean; onMountedChange?: (mounted: boolean) => void } & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const slot = ref.current;
    if (!active || !slot) return;
    const slots = activeSlots.get(host) ?? [];
    activeSlots.set(host, [...slots, slot]);
    slot.appendChild(host);
    return () => {
      const remaining = (activeSlots.get(host) ?? []).filter((s) => s !== slot);
      activeSlots.set(host, remaining);
      if (host.parentNode !== slot) return;
      const next = remaining[remaining.length - 1];
      if (next) next.appendChild(host);
      else slot.removeChild(host);
    };
  }, [host, active]);
  const mountedChange = useRef(onMountedChange);
  mountedChange.current = onMountedChange;
  useLayoutEffect(() => {
    mountedChange.current?.(true);
    return () => mountedChange.current?.(false);
  }, []);
  return <div ref={ref} style={{ display: "contents", ...style }} {...rest} />;
}
