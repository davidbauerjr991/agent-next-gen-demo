import * as React from "react";
import { TriangleAlert, CircleAlert, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, type ChannelType, CHANNEL_TYPE_META as CHANNEL_ICON_META } from "@nicecxone/lyra-ui";

/**
 * PROTOTYPE — local to agent-next-gen-v2 only. NOT in lyra-ui yet.
 *
 * Overlays the interaction's current channel icon on the top-left corner
 * of a collapsed (icon-rail) `InteractionNavItem` tile, so a collapsed
 * LeftNav still communicates which channel a card is on without expanding
 * it.
 *
 * Built on lyra-ui's own `Badge` (`shape="circle"`) — the same "status icon
 * on an avatar corner" pattern `Badge.stories.tsx`'s "On an avatar (status
 * icon — matches AgentProfile's StatusIcon)" story documents, just resized
 * from that story's `size="sm"` (16px) to a custom 18x18 (`h-[18px]
 * w-[18px]` override — none of `Badge`'s own sm/md/lg tokens land on 18px)
 * to match `InteractionNavItem`'s own channel-count badge (the "2" on a
 * multi-channel card, `interaction-nav-item.tsx`) exactly, since the two
 * occupy the same top-left corner (see this component's call sites —
 * `AgentWorkspaceAdvancedPage.tsx`/`AgentWorkspace2WithDeskPage.tsx` — each
 * of which skips rendering this one at all once that count badge is
 * showing instead — a card can only show one or the other).
 * Rule zero: reuse `Badge`, don't hand-roll the circle as a bare `<span>`.
 *
 * Colors follow lyra-ui's own canonical channel-type convention
 * (`CONTRIBUTING.md`'s "Channel type colors (canonical reference)"):
 * Voice = purple, Chat/SMS/WhatsApp = teal, Email = pink — the same
 * soft-bg/strong-icon pairing `Tag`'s subtle channel-type chips use (see
 * `tag.tsx`'s `purple`/`teal`/`pink` variants), including its tinted
 * `color-mix()` border (`CHANNEL_TYPE_ACCENT` below). `Badge`'s circle
 * `variant` only covers 6 semantic roles (no true purple/teal/pink), so
 * these are applied as a `className` override on top of it instead. A
 * solid `-strong`-fill/white-icon "status badge" look was tried first, but
 * reverted: `accent-*-strong` inverts to pastel/light in dark mode (by
 * design, since it's meant to pair with each color's own `-soft`
 * background as FOREGROUND text, not serve as a background itself), which
 * broke white-icon contrast badly in dark mode — this soft/strong pairing
 * is the one lyra-ui actually built (and tested) for this exact combo, and
 * it stays WCAG-safe in both themes for free. The real source of truth for
 * the type→color mapping is `CHANNEL_TYPE_TAG_VARIANT` (`channel-row.tsx`),
 * but it isn't exported from lyra-ui's public index today — re-derived
 * here rather than reached into internally. Once this promotes into
 * lyra-ui proper, wire straight to that export instead of this local copy.
 *
 * Positioning is an external CSS overlay since `InteractionNavItem`'s
 * compact tile has no slot for this today — the consumer wraps the tile in
 * a `relative` container and drops this in as an absolutely-positioned
 * sibling. That wrapper coincides exactly with the tile's own outer box
 * (Radix's `Popover.Trigger asChild` — the tile's only ancestor inside
 * `InteractionNavItem` — clones its child rather than adding a wrapper
 * element, and the LeftNav header row it sits in is `items-center`, i.e.
 * shrink-wrapped, not stretched, so no extra sizing is introduced either).
 * The internal "2" count badge (interaction-nav-item.tsx), by contrast, is
 * positioned `-left-1.5 -top-1.5` against the AVATAR SPAN specifically,
 * which itself sits inset by the tile's own `p-1.5` (6px) padding — so its
 * -6px offset exactly cancels that 6px inset and lands flush on the tile's
 * true outer corner. This component's wrapper has no such padding to
 * cancel out, so matching that same final on-screen position takes `left-0
 * top-0` here, not a copy of that same `-left-1.5 -top-1.5` value. Once
 * promoted into lyra-ui proper, this should become a real prop on
 * `InteractionNavItem` itself (rendered from inside, against the avatar
 * span directly) rather than a sibling reasoning about someone else's
 * padding from outside — see `../../CLAUDE.md`'s lyra-ui rules for why
 * this stays local until then.
 */
// `border` (color) values are copied verbatim from `tag.tsx`'s own
// `tagVariants` — the exact 30%-opacity `color-mix()` outline every
// purple/teal/pink channel-type `Tag`/chip already uses (see that file's
// own doc comment for why this needs a `color-mix()` arbitrary value
// rather than Tailwind's slash-opacity syntax: the design tokens are CSS
// custom properties holding full color strings, not raw RGB/HSL channels,
// so a slash modifier on them silently generates no CSS at all). `-soft`/
// `-strong` both invert together correctly across light/dark themes (see
// this file's own top doc comment), so this pairing is WCAG-safe in both
// without any extra handling.
const CHANNEL_TYPE_ACCENT: Record<ChannelType, { bg: string; fg: string; border: string }> = {
  voice: {
    bg: "bg-lyra-accent-purple-soft",
    fg: "text-lyra-accent-purple-strong",
    border: "border-[color-mix(in_srgb,var(--lyra-color-accent-purple-strong)_30%,transparent)]",
  },
  chat: {
    bg: "bg-lyra-accent-teal-soft",
    fg: "text-lyra-accent-teal-strong",
    border: "border-[color-mix(in_srgb,var(--lyra-color-accent-teal-strong)_30%,transparent)]",
  },
  sms: {
    bg: "bg-lyra-accent-teal-soft",
    fg: "text-lyra-accent-teal-strong",
    border: "border-[color-mix(in_srgb,var(--lyra-color-accent-teal-strong)_30%,transparent)]",
  },
  whatsapp: {
    bg: "bg-lyra-accent-teal-soft",
    fg: "text-lyra-accent-teal-strong",
    border: "border-[color-mix(in_srgb,var(--lyra-color-accent-teal-strong)_30%,transparent)]",
  },
  email: {
    bg: "bg-lyra-accent-pink-soft",
    fg: "text-lyra-accent-pink-strong",
    border: "border-[color-mix(in_srgb,var(--lyra-color-accent-pink-strong)_30%,transparent)]",
  },
};

export interface CollapsedChannelBadgeProps {
  /** Which open channel to badge — pass the interaction's current channel. */
  type: ChannelType;
  /**
   * Same "success"/"warning"/"critical" SLA-wait escalation
   * `InteractionNavItem`'s own multi-channel count badge and `ChannelTab`'s
   * `tabIcon` already key off (see either one's own doc comment,
   * interaction-nav-item.tsx / channel-row.tsx) — per explicit follow-up
   * request, a single-channel card's badge needs the exact same "swap to
   * an alert glyph once overdue" treatment those two already get, not just
   * stay a neutral channel-type icon no matter how late it's gotten. Only
   * "warning"/"critical" actually change anything here (a triangle /
   * circled "!" glyph, recolored to match); "success" (a reply just
   * landed, still well within SLA) and `undefined` (not awaiting at all)
   * both render the plain channel-type icon, same as before this prop
   * existed. */
  severity?: "success" | "warning" | "critical";
  /** Per explicit request ("in the interactionNavItem when a call is put
   *  on hold and the panel is collapsed make the channel badge a pause
   *  icon and change the color to warning") — swaps this badge to a solid
   *  warning-filled `Pause` glyph, the same "on hold" signal
   *  `VoiceCallControls`'/the expanded card's own on-hold treatment
   *  already shows, just condensed into this one corner badge. Takes
   *  priority over `severity` below (a held call reads as "on hold," not
   *  as an overdue-reply alert, even if it also happens to be past its own
   *  SLA) — the two aren't expected to fire together in practice (a call
   *  the agent put on hold isn't "awaiting a reply" in the same sense a
   *  text channel is), but this ordering is the safe one if they ever did.
   *  Defaults to false/unset — every other consumer (nothing on hold) is
   *  unaffected. */
  onHold?: boolean;
  /** Hold SLA tier (15s warning / 30s critical, lyra-ui's `getHoldSeverity`).
   *  Colors the pause badge to match the hold counter next to it; defaults
   *  to the old amber when omitted. */
  holdSeverity?: "success" | "warning" | "critical";
  className?: string;
}

export function CollapsedChannelBadge({ type, severity, onHold, holdSeverity, className }: CollapsedChannelBadgeProps) {
  const accent = CHANNEL_TYPE_ACCENT[type];
  const meta = CHANNEL_ICON_META[type];
  // `meta.icon` arrives with its own fixed size class (e.g. `h-4 w-4`) —
  // sized for wherever lyra-ui's other `CHANNEL_TYPE_META` consumers use
  // it, not this badge. Sized here to `h-full w-full` instead, so it fills
  // whatever room the badge's own `p-0.5` (2px) padding below leaves —
  // 18px badge minus 2px padding each side = a 14px icon, same effective
  // size as before, just derived from real padding instead of a hardcoded
  // icon dimension that would silently stop matching if the badge's own
  // size ever changed. The alert glyphs (below) use the same sizing
  // reasoning, just via an explicit class rather than a clone, since
  // they're not coming from `meta.icon` in the first place.
  const icon = React.isValidElement(meta.icon)
    ? React.cloneElement(meta.icon as React.ReactElement<{ className?: string; strokeWidth?: number }>, {
        className: "h-full w-full",
        strokeWidth: 2,
      })
    : meta.icon;
  return (
    <Badge
      shape="circle"
      size="sm"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-0 top-0 z-10 border p-0.5",
        // Overrides `size="sm"`'s own `min-w-[16px] h-[16px]` — see this
        // file's own top doc comment for why 18px specifically.
        "h-[18px] w-[18px] min-w-0",
        // Once actually overdue, this badge switches off the channel-
        // type's own soft/strong accent pairing entirely and onto the same
        // solid warning/critical fill + white icon `InteractionNavItem`'s
        // own count badge uses for the identical tier — same reasoning:
        // a card that needs attention shouldn't still read as a calm,
        // themed teal/pink/purple chip.
        onHold
          ? holdSeverity === "success"
            ? "border-transparent bg-lyra-status-success-strong text-lyra-fg-on-primary"
            : holdSeverity === "critical"
            ? "border-transparent bg-lyra-status-critical-strong text-lyra-fg-on-primary"
            : "border-transparent bg-lyra-status-warning-strong text-lyra-fg-on-primary"
          : severity === "critical"
          ? "border-transparent bg-lyra-bg-destructive text-lyra-fg-on-primary"
          : severity === "warning"
          ? "border-transparent bg-lyra-status-warning-strong text-lyra-fg-on-primary"
          : [accent.bg, accent.fg, accent.border],
        className
      )}
    >
      {onHold ? (
        <Pause className="h-full w-full" strokeWidth={2.25} />
      ) : severity === "critical" ? (
        <CircleAlert className="h-full w-full" strokeWidth={2.25} />
      ) : severity === "warning" ? (
        <TriangleAlert className="h-full w-full" strokeWidth={2.25} />
      ) : (
        icon
      )}
    </Badge>
  );
}
