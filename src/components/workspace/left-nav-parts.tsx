// Small presentational pieces of the agent workspace (P-EXTRACT C8a, from
// AgentWorkspaceAdvancedPage.tsx): the Screen Pop mock login card, the
// left-nav footer wrappers, and one nav card.
import React from "react";
import { InteractionNavItem, type ChannelType, type InteractionNavItemProps } from "@nicecxone/lyra-ui";
import { CollapsedChannelBadge } from "@/components/CollapsedChannelBadge";
import { useOutcomeClaims } from "@/contact-handling/useOutcomeClaim";

// Screen Pop — visual mock of an external app's login screen, shown in
// place of a real embed. Real screen-pop targets like Salesforce/Zendesk
// send clickjack-protection headers (X-Frame-Options / CSP frame-ancestors)
// on their login and app pages specifically to refuse cross-origin
// iframing — that protection lives on THEIR side and can't be relaxed from
// a consumer/embedding page no matter how it's built (see
// support.zendesk.com's own "Embedding Zendesk into an iframe is not
// allowed" article, and the equivalent Salesforce clickjack protection on
// login.salesforce.com). So rather than a broken/blank iframe, each app
// gets a hand-rolled, obviously-fake login card instead — every field is
// `disabled` and the button/links are non-interactive, and the badge under
// the card spells out that it's a mock, so it can never be mistaken for a
// real login prompt (or an actual authentication surface asking for real
// credentials).
export function MockLoginCard({
  appName,
  accent,
  logo,
  usernameLabel = "Username",
  usernamePlaceholder = "username@company.com",
  buttonLabel = "Log In",
  footerLink = "Forgot Your Password?",
  rememberMe = true,
}: {
  appName: string;
  accent: string;
  logo: React.ReactNode;
  usernameLabel?: string;
  usernamePlaceholder?: string;
  buttonLabel?: string;
  footerLink?: string;
  rememberMe?: boolean;
}) {
  return (
    <div className="overflow-y-auto flex-1 flex flex-col items-center bg-[#f4f6f9] px-4 pt-10 pb-6 gap-4">
      <div className="w-full max-w-[280px] bg-white rounded-lg shadow-md border border-[#e5e5e5] flex flex-col items-center px-7 py-8">
        {logo}
        <div className="flex flex-col gap-1 w-full mb-3 mt-1">
          <label className="text-xs text-[#3e3e3c]">{usernameLabel}</label>
          <input
            type="text"
            disabled
            placeholder={usernamePlaceholder}
            className="border border-[#c9c9c9] rounded px-2.5 py-2 text-sm text-[#3e3e3c] placeholder:text-[#aeaeae] bg-white disabled:opacity-100 disabled:cursor-not-allowed focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1 w-full mb-3">
          <label className="text-xs text-[#3e3e3c]">Password</label>
          <input
            type="password"
            disabled
            placeholder="••••••••"
            className="border border-[#c9c9c9] rounded px-2.5 py-2 text-sm text-[#3e3e3c] bg-white disabled:opacity-100 disabled:cursor-not-allowed focus:outline-none"
          />
        </div>
        {rememberMe && (
          <label className="flex items-center gap-2 text-xs text-[#3e3e3c] w-full mb-4">
            <input type="checkbox" disabled defaultChecked className="disabled:cursor-not-allowed" />
            Remember me
          </label>
        )}
        <button
          type="button"
          disabled
          style={{ backgroundColor: accent }}
          className="w-full text-white text-sm font-medium rounded px-4 py-2 mb-3 disabled:opacity-100 cursor-not-allowed"
        >
          {buttonLabel}
        </button>
        <a className="text-xs pointer-events-none" style={{ color: accent }}>{footerLink}</a>
      </div>
      <span className="lyra-body-xs text-lyra-fg-disabled bg-lyra-bg-surface-container-subtle border border-lyra-border-subtle rounded-full px-2.5 py-1">
        Mock preview — not a live {appName} session
      </span>
    </div>
  );
}

// LeftNav's overlay (responsive) mode expands on hover by cloning
// `expanded={hoverOpen}` onto the TOP-LEVEL children of its slots
// (`injectExpanded`, lyra left-nav.tsx); anything nested deeper keeps its own
// `expanded={navOpen}` and stays collapsed. These two keep the slots in the
// shape lyra's "Agent Next Gen Left Nav" story uses, so the cards, the rail
// and the launcher all follow hover together. (`header`'s cards get theirs
// through the left-nav `<Slot>`, P-LAYOUT.)

/** A top-level `footer` child with the rail's spacing above it (Settings →
 *  "New Outbound at the bottom"); passes LeftNav's injected `expanded` on to
 *  the launcher. */
export function LeftNavFooterSpacer({ expanded, children }: { expanded?: boolean; children: React.ReactElement<{ expanded?: boolean }> }) {
  return <div className="w-full pt-2">{expanded === undefined ? children : React.cloneElement(children, { expanded })}</div>;
}

/** Stacks the left-nav footer's pieces (the rail, then New Outbound) in a
 *  column: lyra's footer slot is a centered flex row, so loose siblings sit
 *  side by side. Forwards the overlay hover's `expanded` to each child, as
 *  lyra's `injectExpanded` would for top-level children. */
export function LeftNavFooterColumn({ expanded, children }: { expanded?: boolean; children: React.ReactNode }) {
  return (
    <div data-slot="left-nav-footer" className="flex w-full flex-col">
      {expanded === undefined
        ? children
        : React.Children.map(children, (child) =>
            React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{ expanded?: boolean }>, { expanded }) : child
          )}
    </div>
  );
}

// Wraps a single `InteractionNavItem` (plus its collapsed-rail-only
// `CollapsedChannelBadge` overlay) behind ONE stable top-level element,
// rather than the `.map()` callback below returning two structurally
// different shapes (a bare `InteractionNavItem` when expanded vs. a
// wrapping `<div className="relative">` around it + the badge when
// collapsed) depending on `navOpen`. That structural split is what broke
// `LeftNav`'s own hover-to-expand overlay mode (left-nav.tsx's
// `injectExpanded`) — per explicit bug report/screenshot: hovering the
// collapsed rail open visibly widened it to the full 256px panel (New
// Outbound's full label, "Assignments (N active)"'s full text — both
// plain top-level children of `header`, correctly re-cloned with
// `expanded={hoverOpen}`), but each interaction card stayed stuck as its
// small collapsed avatar tile instead of also switching to the full card.
// `injectExpanded` only clones `expanded` onto `header`'s own TOP-LEVEL
// children — with the collapsed-mode wrapper div in the way, that clone
// landed on a plain `<div>` (which just ignores an unknown `expanded`
// prop) instead of ever reaching the real `InteractionNavItem` nested
// inside it, which was left stuck on whatever `expanded={navOpen}` value
// `AgentNextGenPage` had explicitly hardcoded onto it (the PINNED
// open/closed state, not hover state) — so it never flipped along with
// hovering, no matter how wide the rail visibly got.
//
// This component is the fix: the `.map()` below now always returns ONE
// `<InteractionNavCard>` per card, unconditionally, so `injectExpanded`
// always has a single real element to clone `expanded` onto. Internally,
// THIS component (not the caller) decides whether to render the plain
// expanded card or the collapsed tile + badge, based on whatever
// `expanded` value it actually received — which is exactly the value
// `injectExpanded` just overwrote when hovering open in overlay mode, so
// the decision now correctly follows hover state, not just `navOpen`.
interface InteractionNavCardProps extends InteractionNavItemProps {
  /** This interaction's current channel type — only used for the
   *  collapsed-rail badge (see `showChannelBadge` below); ignored once
   *  `expanded` is true, since the expanded card already shows a per-
   *  channel chip for each open channel. */
  currentChannelType?: ChannelType;
  /** Whether the collapsed-rail badge should render at all — false once a
   *  card has more than one open channel, since `InteractionNavItem`
   *  already renders its own multi-channel count badge in that exact same
   *  corner (see `CollapsedChannelBadge`'s own doc comment for why the two
   *  are mutually exclusive). */
  showChannelBadge: boolean;
  /** Same "success"/"warning"/"critical" SLA tier the expanded card's own
   *  `awaitingSeverity` prop already resolves — passed straight through to
   *  `CollapsedChannelBadge` so the collapsed badge escalates in lockstep
   *  with the rest of the card. */
  badgeSeverity?: "success" | "warning" | "critical";
  /** Per explicit request ("in the interactionNavItem when a call is put
   *  on hold and the panel is collapsed make the channel badge a pause
   *  icon and change the color to warning") — true when this card's live
   *  voice thread is currently held (`c.heldByAgent`, same field the
   *  expanded card's own on-hold timer reads — see that render site's own
   *  doc comment). Passed straight through to `CollapsedChannelBadge`'s own
   *  `onHold` prop. */
  cardOnHold?: boolean;
  /** Hold SLA tier for the collapsed badge (15s warning / 30s critical). */
  cardHoldSeverity?: "success" | "warning" | "critical";
  /** True while the tile animates out (e.g. a declined incoming call). */
  leaving?: boolean;
}
export function InteractionNavCard({
  leaving,
  currentChannelType,
  showChannelBadge,
  badgeSeverity,
  cardOnHold,
  cardHoldSeverity,
  expanded,
  ...itemPropsIn
}: InteractionNavCardProps) {
  // Each channel row's Outcome opens only from the row that was clicked (P-EXTRACT, Bug 1): the store names
  // the channel, this card's rows hold the claim, so the thread's session row doesn't open with it.
  const channels = useOutcomeClaims(itemPropsIn.channels ?? [], (ch, i) => ch.id ?? `${ch.type}:${i}`);
  const itemProps = itemPropsIn.channels ? { ...itemPropsIn, channels } : itemPropsIn;
  // The outer wrapper is stable across expanded/collapsed, so the entrance (slight fade in from the left) plays once when
  // the tile first appears and not again when the rail expands or collapses.
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-in ${
        leaving
          ? "pointer-events-none grid-rows-[0fr] -translate-x-4 opacity-0"
          : "animate-in fade-in-0 slide-in-from-left-2 grid-rows-[1fr]"
      }`}
    >
     <div className="min-h-0 overflow-hidden">
      {/* One tree position either way: a different wrapper per state would remount the card and reset its expanded state. */}
      <div className={expanded ? undefined : "relative"}>
        <InteractionNavItem expanded={expanded} {...itemProps} />
        {!expanded && currentChannelType && showChannelBadge && (
          <CollapsedChannelBadge type={currentChannelType} severity={badgeSeverity} onHold={cardOnHold} holdSeverity={cardHoldSeverity} />
        )}
      </div>
     </div>
    </div>
  );
}
