// VoiceCallControls — the fixed-to-the-bottom-of-the-content-area call
// toolbar for an active VOICE channel (Hold/Mute/Mask/Record/Keypad/Add
// video/Hang Up), per explicit request/reference screenshot. Sits in
// the exact spot `InteractionComposer` occupies for a chat channel — a
// `shrink-0` sibling directly below `InteractionTranscript`, in each of the
// three page components' own "voice has no composer" branch (see that
// branch's own doc comment, AgentNextGenPage.tsx/AgentWorkspace2WithDeskPage
// .tsx/AgentWorkspaceAdvancedPage.tsx) — so a live voice call gets this bar
// in that exact slot instead of nothing.
//
// Every button here except Hang Up is purely decorative/local-state (Hold/
// Mute/Mask/Record/Add video each just toggle their own icon and fire a
// toast; Keypad opens a small popover dialpad) — there's no real telephony
// backing any of this in the prototype, same "fake it with a toast"
// convention every other placeholder control in this app already follows
// (Send Transcript/Download Transcript/Translate Messages, etc.). Hang Up
// is the one exception: it's wired to a real `onHangUp` callback (the
// caller closes this channel, same as picking "Closed" from the status
// popover) since ending the call is the one action here an agent actually
// depends on to move on to logging an outcome.
//
// This bar used to carry THREE renderings — a WIDE two-row centered card, a
// COMPACT icon-only row, and a `stretch` single-row variant of the wide
// buttons for Phase 1/Phase 2 — auto-toggling between wide/compact via a
// `ResizeObserver` self-measuring this bar's own rendered width against a
// 768px breakpoint (a pattern `InteractionTranscript`'s own
// `transcriptNarrow`/`transcriptBubbleFullWidth`, agent-next-gen-
// transcript.tsx, and `ScheduleToolbar`'s own `containerRef`/`isWide`/
// `isCompact`, SchedulePanel.tsx, also use). Per an explicit bug report
// ("opened the details panel with the left nav closed, opened the left
// nav, then closing the details panel again didn't resize the bar back")
// and the explicit follow-up fix request that replaced trying to chase that
// bug further ("just take the existing compact version — stretch it the
// full width of the container and remove media queries"): all of that
// responsive machinery — the `ResizeObserver`/`isCompact` state, the wide
// two-row card, and the `stretch` single-row card — is gone. This bar now
// always renders what used to be the COMPACT (icon-only) JSX, unconditionally,
// stretched to fill whatever width its container gives it (`w-full` on the
// card below AND on the outer full-bleed wrapper — see that wrapper's own
// doc comment for why both levels need it explicitly rather than leaning on
// ambient flex stretch — no `max-w`/`mx-auto` cap) instead of only kicking
// in below a measured breakpoint. Below, every main control still drops its
// visible label for a hover/focus `Tooltip` (`CompactCallControlButton`),
// the timer still shows its "MM:SS" digits next to a Clock icon, and
// Volume/Transcript still trail in their own leading/trailing flex slots —
// none of that content changed, only the "which rendering, and how wide"
// logic around it. `stretch` stays as an accepted prop (default `false`)
// purely so Phase 1/Phase 2's existing call sites don't need to change
// their JSX — it no longer affects anything rendered here.
//
// Per a later explicit follow-up request/reference screenshot ("make the
// voice controls larger and label the buttons again"), every main control
// (Hold/Mask/Record/Keypad/Transcript/Volume/Mute/Add video) switched back
// from that icon-only `CompactCallControlButton` treatment to a labeled
// icon-over-text button instead — bigger tap target, and the label is now
// always-visible text again rather than only surfacing on hover/focus via
// `Tooltip`. This ISN'T a return to the old three-way wide/compact/stretch
// responsive split this file just spent the paragraph above removing —
// there's still exactly one rendering, it's just the LABELED one now
// instead of the icon-only one, still unconditionally stretched to its
// container's width. `WideCallControlButton` (below) — defined back when
// this file had that old wide rendering, but unused since it was removed —
// is what got reactivated for this, reworked to compose as a `Tooltip`/
// `Popover` trigger the same way `CompactCallControlButton` already does
// (see its own doc comment for why that requires `forwardRef`+`...rest`
// rather than a plain named-prop function). `CompactCallControlButton`
// itself is left defined but unused below — nothing left in this file
// calls it now that every control uses the labeled button instead — kept
// rather than deleted in case a genuinely narrow/compact rendering is ever
// wanted again later. Hang Up is the one control excluded from this
// change, per explicit request ("keep the End Call button filled red") —
// it stays the same solid-red `Button` it already was (see that render
// site's own doc comment), just bumped from `size="default"` to `size="lg"`
// so it still reads as proportionate next to the now-taller labeled
// buttons beside it.
//
// Per a later explicit follow-up request/reference screenshot ("make the
// end call button the same height as the mute and add video buttons and add
// the customer avatar. Add the name / number/email above the timer"): the
// trailing dark cluster (Mute/Add video/End Call) switched from
// `items-center` to `items-stretch` and End Call's fixed `size="lg"` height
// (h-9) got overridden to `h-auto`, so it now stretches to match whichever
// of Mute/Add video is tallest (their own `WideCallControlButton` shape is
// already `h-auto`, sized by content) instead of sitting short and centered
// next to them — no hardcoded pixel height to keep in sync if either of
// those buttons' own height ever changes. Separately, the leading slot
// gained an optional avatar chip + identity line (`customerLabel`/
// `customerInitials`, see their own doc comments on `VoiceCallControlsProps`
// below) stacked above the existing elapsed timer, per the reference
// screenshot's small purple circle + phone number/name sitting above the
// call duration. The avatar's purple background reuses this app's own
// existing "Voice channel = purple" accent convention (see
// `CHANNEL_TYPE_TAG_VARIANT`/`CHANNEL_TYPE_ICON_COLOR_CLASS`,
// agent-next-gen-contact-history.tsx and channel-row.tsx, both already
// purple for Voice) rather than inventing a new color. Its glyph is a
// generic `Plus` fallback (this design system's `interaction-nav-item.tsx`
// already falls back to a generic icon — there just a person outline —
// when there's no real contact match; `Plus` reads closer to the reference
// screenshot's unmatched-quickdial-number case, see `Interaction.id`'s own
// `quickdial:<number>` doc comment) shown in white — an explicit follow-up
// clarified this should be white, not the icon's original black/dark
// tone — with real initials (`customerInitials`) taking over instead once a
// caller has a genuine contact match, same "initials over generic icon
// once known" split that avatar convention already uses.
import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  getHoldSeverity,
  KebabMenuButton,
  Menu,
  Popover,
  Slider,
  Spinner,
  Tooltip,
  type MenuEntry,
  type ToastItem,
} from "@nicecxone/lyra-ui";
import {
  Pause,
  Play,
  Mic,
  MicOff,
  AudioLines,
  AudioLinesOff,
  Circle,
  Grid3x3,
  MoreHorizontal,
  Video,
  VideoOff,
  PhoneOff,
  Clock,
  Volume2,
  VolumeX,
  FileText,
} from "lucide-react";
import { formatElapsedTime } from "@/components/agent-next-gen-shared-utils";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";

/** One column: icon on top, visible label underneath — the main control
 *  shape this bar now uses everywhere (see this file's own top doc comment
 *  for the "why now again" history). Was originally used only by a since-
 *  removed wide rendering, unused for a while after that (only tooltip-only
 *  `CompactCallControlButton` remained), then reactivated and reworked
 *  here per a later explicit follow-up request.
 *
 *  Built with `React.forwardRef` and a `...rest` spread — same reasoning as
 *  `CompactCallControlButton`'s own doc comment just below gives for why
 *  that one needs it: this button has to compose correctly as either a
 *  `Popover`'s trigger child (Keypad/Volume both clone their own
 *  click/ref/aria-* props onto their immediate child via Radix's
 *  `asChild`/`Slot`) or a plain button with native attributes
 *  (`disabled` on Record) — a fixed named-prop list would silently drop
 *  whichever of those it didn't explicitly declare. `label` itself no
 *  longer needs to reach a `Tooltip` the way it used to (that's now this
 *  button's own always-visible text, not hover-only content), so unlike
 *  `CompactCallControlButton`, most call sites below no longer wrap this in
 *  one at all — see each call site's own comment for the one exception
 *  (Record, which still has genuinely EXTRA hover content beyond its
 *  label: why it's disabled). */
const WideCallControlButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: React.ReactNode;
    label: string;
    /** Tints icon+label the same blue "selected" treatment lyra-ui's own
     *  active states already use, once this control is toggled on (Hold/
     *  Mute/Mask/Record/Add video). Omit/`false` for the plain gray look. */
    active?: boolean;
    /** Hang Up doesn't use this component at all (see this file's own top
     *  doc comment for why it's excluded) — kept for parity with
     *  `CompactCallControlButton`'s own identical prop in case a future
     *  critical-styled control besides Hang Up ever needs this shape. */
    critical?: boolean;
    /** Same darker-at-rest treatment as `CompactCallControlButton`'s own
     *  `strong` prop — Mute/Add video pass this, matching the reference
     *  screenshot's visibly darker icons for that pair. */
    strong?: boolean;
    /** Same `ghost`/`outline` swap as `CompactCallControlButton`'s own
     *  `variant` prop — Mute/Add video pass `"outline"`, every other
     *  control keeps the default plain `ghost` look. */
    variant?: "ghost" | "outline";
  }
>(({ icon, label, active, critical, strong, variant = "ghost", className, ...rest }, ref) => {
  return (
    <Button
      ref={ref}
      variant={variant}
      className={cn(
        // Per explicit follow-up request/reference screenshot ("make the
        // voice controls larger"): `h-auto w-20` (unchanged from this
        // component's original wide-rendering sizing) plus `gap-1.5`/
        // `py-2` (was `gap-1`/`py-1.5`) for a bit more breathing room
        // around the now-larger icon (`h-5 w-5` at each call site below,
        // was `h-4 w-4` to match `CompactCallControlButton`'s icon-only
        // sizing) and the visible label text beneath it.
        "h-auto w-20 shrink-0 flex-col gap-1.5 rounded-lyra-sm px-1 py-2",
        critical
          ? "text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:text-lyra-status-critical-strong active:bg-lyra-status-critical-medium"
          : active
          ? "text-lyra-fg-active-strong bg-lyra-bg-active-subtle hover:text-lyra-fg-active-strong"
          : strong
          ? "text-lyra-fg-default hover:text-lyra-fg-default"
          : "text-lyra-fg-secondary hover:text-lyra-fg-default",
        className
      )}
      {...rest}
    >
      {icon}
      <span className="lyra-body-xs w-full truncate text-center">{label}</span>
    </Button>
  );
});
WideCallControlButton.displayName = "WideCallControlButton";

/** Plain 40×40px icon-only button — the icon-only
 *  rendering of Hold/Mask/Record/Keypad/Transcript/Volume/Mute/Add video/
 *  End Call once this bar's own measured width drops below the relevant
 *  breakpoint (`controlsCompact`/`controlsIconOnly`, this file's own top
 *  doc comment). `label` is still required on most call sites, it's just
 *  surfaced via a `Tooltip` at the call site instead of rendered directly
 *  here (Keypad's call site wraps `Tooltip` around the whole `Popover`
 *  instead, per that render site's own comment, since Keypad also needs to
 *  be a `Popover` trigger).
 *
 *  Was briefly UNUSED (every call site had switched to the labeled
 *  `WideCallControlButton` per an earlier follow-up request) — reactivated
 *  per the later request that added the two width-driven breakpoints
 *  above, at a bumped 40px box (was 32px/`h-8 w-8`) matching that
 *  request's own explicit sizing ask.
 *
 *  Built with `React.forwardRef` and a `...rest` spread (rather than a
 *  fixed named-prop list) specifically so it composes correctly as either a
 *  `Tooltip`'s or a `Popover`'s trigger child: both clone extra props
 *  (event handlers, a `ref` for position measurement, `aria-*` state) onto
 *  their immediate child via Radix's `asChild`/`Slot` mechanism, which only
 *  reaches the real DOM `<button>` if this component actually forwards a
 *  `ref` and spreads through whatever it's handed — a plain, non-forwardRef
 *  function component only works for `onClick` because that name happens
 *  to already be a named prop; a hover-only prop like `onPointerEnter`
 *  (which `Tooltip` needs) would be silently dropped the same way a `ref`
 *  would. */
const CompactCallControlButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: React.ReactNode;
    active?: boolean;
    critical?: boolean;
    /**
     * Per explicit request ("make the mute and video icons darker"): swaps
     * this button's own DEFAULT (non-active, non-critical) resting color
     * from `fg-secondary` (60% opacity — this bar's usual resting-state
     * gray, still used by every other control here) to `fg-default` (80%
     * opacity) — the SAME token every one of these buttons already promotes
     * to on hover/focus (see the plain `else` branch below), just applied
     * at rest instead of only on interaction. Both are existing lyra-ui
     * neutral-text tiers (see lyra-tokens.css), not one-off colors, so this
     * stays inside the request's own "keep the same styling for lyra-ui"
     * instruction. Ignored once `active`/`critical` is true — those already
     * render in their own (even stronger) blue/red, so there's nothing left
     * for this to darken further. Mute and Video are the two call sites
     * that pass this below; every other control keeps the plain resting
     * `secondary` gray unchanged.
     */
    strong?: boolean;
    /**
     * Per explicit request ("make the mute / video buttons outline icon
     * buttons"): lets Mute/Video opt into `Button`'s real `"outline"`
     * variant (a bordered, `bg-lyra-bg-control` surface) instead of this
     * component's own default `"ghost"` (transparent until hover) — every
     * other control here (Hold/Mask/Record/Keypad/Transcript) omits this
     * and keeps the existing plain `ghost` look unchanged. The `active`/
     * `critical`/`strong` tint classes above are unaffected either way —
     * they already override `outline`'s own default `bg`/`text` tokens via
     * `cn()`'s tailwind-merge the same way they already override `ghost`'s.
     */
    variant?: "ghost" | "outline";
  }
>(({ icon, active, critical, strong, variant = "ghost", className, ...rest }, ref) => {
  return (
    <Button
      ref={ref}
      variant={variant}
      size="icon"
      aria-pressed={critical ? undefined : active}
      className={cn(
        // 40px (`Button`'s own "icon-xl" size token) — per explicit
        // request ("...icon only buttons and 40px").
        "h-10 w-10 shrink-0 rounded-lyra-sm",
        critical
          ? "text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:text-lyra-status-critical-strong active:bg-lyra-status-critical-medium"
          : active
          ? "text-lyra-fg-active-strong bg-lyra-bg-active-subtle hover:text-lyra-fg-active-strong"
          : strong
          ? "text-lyra-fg-default hover:text-lyra-fg-default"
          : "text-lyra-fg-secondary hover:text-lyra-fg-default",
        className
      )}
      {...rest}
    >
      {icon}
    </Button>
  );
});
CompactCallControlButton.displayName = "CompactCallControlButton";

/** Plain 3x4 dialpad — Keypad's own popover body, shared by both the wide
 *  and compact renderings. Each digit press just appends to this popover's
 *  own local display (no real DTMF tone/signal to send in this prototype);
 *  `Clear` resets it. Closes on outside click/Escape like any other plain,
 *  uncontrolled `Popover`. */
function DialPad({ onDigit }: { onDigit?: (digit: string) => void }) {
  const [digits, setDigits] = useState("");
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  return (
    <div className="flex flex-col gap-3 p-3 w-[220px]">
      <div className="lyra-body-md-emphasis text-lyra-fg-default text-center min-h-[24px] tracking-wider">
        {digits || <span className="text-lyra-fg-secondary">Enter digits</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <Button
            key={key}
            variant="outline"
            className="h-10 w-full lyra-body-md-emphasis"
            onClick={() => {
              setDigits((d) => d + key);
              onDigit?.(key);
            }}
          >
            {key}
          </Button>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={() => setDigits("")} disabled={!digits}>
        Clear
      </Button>
    </div>
  );
}

/** The collapsed volume trigger — compact rendering only (see this file's
 *  own top doc comment for why the wide rendering keeps its own separate
 *  icon instead). A single icon button (the live volume glyph, same
 *  `Volume2`/`VolumeX` swap the wide trigger uses) opens a small popover
 *  holding just the volume slider.
 *
 *  Per explicit follow-up request ("take the transcript button out of the
 *  volume dropdown and put it to the left of the volume button"): this used
 *  to also fold a "Show/Hide transcript" row into this same popover
 *  (`CompactVolumeAndTranscriptButton`, see this file's own git history) —
 *  transcript is back to being its own separate `WideCallControlButton`
 *  (was `CompactCallControlButton` — see this file's own top doc comment
 *  for that later rename-in-place) at this component's own call site
 *  instead, so this trigger is volume-only again.
 *
 *  `volume`/`onVolumeChange` are lifted to the OUTER `VoiceCallControls`
 *  component rather than local state here — see this file's own top doc
 *  comment for why (the value has to survive a resize back across the
 *  breakpoint into the wide rendering's own separate volume trigger). */
function CompactVolumeButton({
  volume,
  onVolumeChange,
  disabled,
  compact,
}: {
  volume: number;
  onVolumeChange: (volume: number) => void;
  /** Per explicit request ("when end call is clicked ... disable the
   *  other buttons at the same time"): disables the trigger itself
   *  (forwarded to `WideCallControlButton` below, same as every other
   *  control in this bar) and forces the popover closed/unopenable rather
   *  than leaving an already-open volume slider live while the call is
   *  hanging up — same "force off a conflicting open state" convention
   *  the Mask/Record pair above already follows. */
  disabled?: boolean;
  /** Mirrors `VoiceCallControls`'s own `controlsCompact` (see that file's
   *  top doc comment / `CompactCallControlButton`'s) — swaps this trigger
   *  from `WideCallControlButton` to the icon-only 40px
   *  `CompactCallControlButton` below the 991px breakpoint, same as every
   *  other control in the centered cluster. Uses a native `title` rather
   *  than `Tooltip` for the same reason Keypad's own call site does — see
   *  that comment. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    // No more wrapping `Tooltip` — per later explicit follow-up request
    // ("label the buttons again"), the trigger below is now a labeled
    // `WideCallControlButton` (visible "Volume" text) rather than the old
    // hand-rolled icon-only `<button>` a hover `Tooltip` used to be the
    // only way to name, so there's nothing left for a tooltip to add here.
    // `Popover`'s trigger still clones its own click/ref/aria props onto
    // its immediate child via Radix's `asChild`/`Slot` mechanism — that's
    // exactly what `WideCallControlButton`'s own `forwardRef`+`...rest`
    // are for (see that component's own doc comment).
    <Popover
      open={open && !disabled}
      onOpenChange={(next: boolean) => {
        if (!disabled) setOpen(next);
      }}
      placement="top"
      content={
        <div className="flex items-center gap-2 p-3 w-[200px]">
          <button
            type="button"
            onClick={() => onVolumeChange(volume === 0 ? 70 : 0)}
            aria-label={volume === 0 ? "Unmute" : "Mute"}
            className="shrink-0 text-lyra-fg-secondary hover:text-lyra-fg-default"
          >
            {volume === 0 ? (
              <VolumeX className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
          <Slider
            value={volume}
            onChange={onVolumeChange}
            min={0}
            max={100}
            step={1}
            showTicks={false}
            label="Call volume"
            className="flex-1 min-w-0 [&>label]:sr-only"
          />
        </div>
      }
    >
      {compact ? (
        <CompactCallControlButton
          icon={
            volume === 0 ? (
              <VolumeX className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Volume2 className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            )
          }
          active={open}
          disabled={disabled}
          aria-label="Volume"
          title="Volume"
          aria-pressed={open}
        />
      ) : (
        <WideCallControlButton
          icon={
            volume === 0 ? (
              <VolumeX className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Volume2 className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            )
          }
          label="Volume"
          active={open}
          disabled={disabled}
          aria-label="Volume"
          aria-pressed={open}
        />
      )}
    </Popover>
  );
}


export interface VoiceCallControlsProps {
  /** Ends the call — the caller closes this channel (same as picking
   *  "Closed" from the status popover). The only real, non-decorative
   *  action in this whole bar — see this file's own top doc comment. */
  onHangUp: () => void;
  /** Controlled mute, same "controlled once the handler is wired, else local
   *  state" split as `onHold`/`onHoldChange` (P0.5d.1). */
  muted?: boolean;
  onMuteChange?: (muted: boolean) => void;
  /** Controlled recording; same split. */
  recording?: boolean;
  onRecordingChange?: (recording: boolean) => void;
  /** Controlled masking; same split. Turning masking on also turns
   *  recording off through `onRecordingChange`. */
  masked?: boolean;
  onMaskedChange?: (masked: boolean) => void;
  /** Each keypad press, for sending a tone into the call. */
  onSendDtmf?: (digit: string) => void;
  /** Hide (not disable) a control the provider can't do. Default `true`. */
  showHold?: boolean;
  showMute?: boolean;
  showRecord?: boolean;
  showMask?: boolean;
  showKeypad?: boolean;
  /** Page-clock tick this call started at (`Thread.startTick`, same tick
   *  source every other timer in this app reads off). The duration
   *  (page clock now − this) ticks inside its own `<ClockTick>`, so only
   *  the timer text re-renders each second, not the bar — rendered as a
   *  running "MM:SS" (`formatElapsedTime`, same format/helper
   *  `InteractionNavItem`'s own per-channel elapsed timer uses) above the
   *  768px breakpoint, or a plain clock glyph with the same duration on a
   *  `Tooltip` below it — see this file's own top doc comment. Optional so
   *  an existing caller that hasn't wired this through yet still renders
   *  (just without the timer) instead of crashing. */
  callStartTick?: number;
  /** Same shared toast surface every other mock/placeholder control in
   *  this app already fires through (`agent-next-gen-customer-info-
   *  panel.tsx`'s own `onAddToast`, etc.) — omit to silently no-op instead
   *  of throwing on a caller that hasn't wired toasts through yet. */
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /** The Transcript button's menu (download, email a copy). The button is a
   *  popover trigger, not a toggle; omit it to hide the button entirely. */
  transcriptMenu?: MenuEntry[];
  /**
   * Opens/closes the small draggable video window (a `DraggablePanel`) the
   * caller renders elsewhere in the page — replaces this button's old
   * decorative-only "toggle local icon + toast" behavior with a real
   * window when wired. Omit to keep that old decorative fallback (still
   * toggles the icon and fires a toast, same as every other placeholder
   * control here) for a caller that hasn't wired a video window through
   * yet.
   */
  onToggleVideo?: () => void;
  /** Whether the caller's floating video window is currently open — only
   *  read when `onToggleVideo` is provided (otherwise this button tracks
   *  its own local decorative state instead, see `onToggleVideo`'s own
   *  doc comment). */
  videoOpen?: boolean;
  /** Whether this call is currently on hold — controlled from the caller
   *  once `onHoldChange` is wired, same "read the caller's real state once
   *  wired, else track local decorative state" split `videoOpen`/
   *  `onToggleVideo` above already establishes. Per explicit request
   *  ("putting an active call on hold from the call controls should ...
   *  add an on hold chip to the interactionNavItem"): unlike every other
   *  decorative toggle in this bar (Mute/Mask/Record), Hold now needs to
   *  survive this whole bar unmounting/remounting (it only renders for
   *  whichever interaction is currently ACTIVE — see each page's own
   *  `activeInteractionVoiceThread` render site) — a plain local `useState`
   *  can't do that on its own, so the caller lifts it onto the underlying
   *  `Thread` instead. Ignored (this button falls back to its own old local
   *  state) while `onHoldChange` is omitted. */
  onHold?: boolean;
  /** Fired with the NEW hold state whenever the Hold/Resume button is
   *  pressed. Only takes effect (makes `onHold` above controlled) when
   *  provided — omit to leave this button exactly as before (a purely
   *  local, decorative toggle with no effect outside this component). */
  onHoldChange?: (onHold: boolean) => void;
  /** Per explicit request ("when a call is placed on hold, add an on hold
   *  timer below the call timer in the call controls and in the
   *  interaction nav item") — page-clock tick this call was put on hold
   *  at (`Thread.heldSinceTick`); the time since then ticks in its own
   *  `<ClockTick>` and is rendered as a second "On hold MM:SS" line directly below the running
   *  call-duration timer, in the same red/critical color every other
   *  "needs attention" reading in this app uses, whenever `onHold` is also
   *  true. Only meaningful (and only rendered) while `onHold` is true;
   *  ignored otherwise. Omit to render nothing extra — same "renders fine
   *  without it" fallback every other optional prop here already follows.
   *  Mirrors lyra-ui's own identical `VoiceCallControls` prop
   *  (voice-call-controls.tsx) — kept in sync per this file's own
   *  established "app-local twin" convention (lyra's takes seconds; this
   *  one takes the start tick so the bar doesn't re-render every second). */
  holdStartTick?: number;
  /** Per explicit request (Agent Workspace 2.0 Phase 1 only): hides the
   *  "Add video" button entirely. This bar's own divider just before it
   *  stays either way — it still separates the call-feature cluster from
   *  Hang Up whether or not "Add video" sits between them (see that
   *  divider's own comment). Defaults `true`; every other tier/call site
   *  keeps the button exactly as before. */
  showAddVideo?: boolean;
  /**
   * No longer used — this bar dropped its wide/compact/stretch responsive
   * toggle entirely (see this file's own top doc comment: "just take the
   * existing compact version — stretch it the full width of the container
   * and remove media queries"), so there's only one rendering left and
   * nothing for this prop to switch between anymore. Kept, accepted, and
   * ignored purely so Phase 1/Phase 2's existing call sites (the only two
   * that ever passed it) don't need their own JSX touched.
   */
  stretch?: boolean;
  /** Customer's display name, phone number, or email — shown as a small
   *  identity line above the elapsed-call timer in this bar's leading slot,
   *  next to a small avatar chip, per explicit request/reference screenshot
   *  ("add the customer avatar. Add the name / number/email above the
   *  timer"). Pass whichever identifier the caller already resolved for
   *  this call (a real name when known, else the raw number/email a
   *  `Thread`'s own value holds — see this repo's `Interaction.id` doc
   *  comment for the `quickdial:<number>` id pattern used when no contact
   *  record matches a dialed number). Omit entirely to render neither the
   *  avatar nor this line — same "renders fine without it" fallback every
   *  other optional prop here already follows (see `callStartTick`'s own
   *  doc comment) — for a caller that hasn't wired customer identity
   *  through yet. */
  customerLabel?: React.ReactNode;
  /** Initials to show inside the avatar chip instead of the generic
   *  fallback glyph, once the caller has a real contact match (the same
   *  initials a caller would derive the same way `interaction-nav-item.tsx`
   *  's own avatar already does via `getInitials`). Only meaningful while
   *  `customerLabel` is also set — without a real contact match this avatar
   *  instead shows a plain white `Plus` glyph, per the reference
   *  screenshot's unmatched-quickdial-number case (see this file's own top
   *  doc comment). */
  customerInitials?: string;
  /** Vertical layout for a narrow column such as the left nav (Settings →
   *  Voice controls location "Top of left nav"; ported from v3): identity +
   *  timer on top, an icon-only strip of Hold/Mask/Record/Keypad/Transcript/
   *  Volume, then Mute and End Call side by side. Ignores the width
   *  breakpoints. */
  stacked?: boolean;
  className?: string;
}

export function VoiceCallControls({
  onHangUp,
  muted: mutedControlled,
  onMuteChange,
  recording: recordingControlled,
  onRecordingChange,
  masked: maskedControlled,
  onMaskedChange,
  onSendDtmf,
  showHold = true,
  showMute = true,
  showRecord = true,
  showMask = true,
  showKeypad = true,
  callStartTick,
  onAddToast,
  transcriptMenu,
  onToggleVideo,
  videoOpen,
  onHold: onHoldControlled,
  onHoldChange,
  holdStartTick,
  showAddVideo = true,
  stretch = false,
  customerLabel,
  customerInitials,
  stacked = false,
  className,
}: VoiceCallControlsProps) {
  // Decorative-only fallback for a caller that hasn't wired `onHoldChange`
  // through yet — see that prop's own doc comment (same `localVideoAdded`/
  // `onToggleVideo` split just below).
  const [localOnHold, setLocalOnHold] = useState(false);
  const onHold = onHoldChange ? !!onHoldControlled : localOnHold;
  const setOnHold = onHoldChange ?? setLocalOnHold;
  // Mute/Mask/Record: controlled once the caller wires the handler (the
  // provider's state, arriving as events), else local decorative state.
  const [localMuted, setLocalMuted] = useState(false);
  const muted = onMuteChange ? !!mutedControlled : localMuted;
  const setMuted = onMuteChange ?? setLocalMuted;
  const [localMasked, setLocalMasked] = useState(false);
  const masked = onMaskedChange ? !!maskedControlled : localMasked;
  const setMasked = onMaskedChange ?? setLocalMasked;
  const [localRecording, setLocalRecording] = useState(false);
  const recording = onRecordingChange ? !!recordingControlled : localRecording;
  const setRecording = onRecordingChange ?? setLocalRecording;
  // Decorative-only fallback for a caller that hasn't wired a real video
  // window through `onToggleVideo` yet — see that prop's own doc comment.
  const [localVideoAdded, setLocalVideoAdded] = useState(false);
  const videoAdded = onToggleVideo ? !!videoOpen : localVideoAdded;
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [transcriptMenuOpen, setTranscriptMenuOpen] = useState(false);
  // Volume slider — purely local/decorative, same "no real telephony
  // backing this" convention as Hold/Mute/Mask/Record (see this file's own
  // top doc comment).
  const [volume, setVolume] = useState(70);
  const [volumeOpen, setVolumeOpen] = useState(false);

  // Per explicit request ("when end call is clicked transition the end
  // call button to a hanging up state (disabled) then disable the other
  // buttons at the same time and animate the call controls out (down)"),
  // refined by a later explicit follow-up ("wait one second after the
  // call is ended before animating out the controls"): two states, not
  // one, so the disabled "hanging up" look and the slide-out animation
  // don't happen in the same instant. `isEnding` flips immediately on
  // click and gates the disabling half — every other control below reads
  // `disabled={isEnding}` (or ORs it into a disabled expression it already
  // had, e.g. Record/masked) and the End Call button itself swaps to its
  // disabled "Hanging Up..." look right away. `isExiting` only flips a
  // full second later (`HANG_UP_HOLD_MS` below) and is what the outer
  // card's own transition classes (see that div's doc comment below)
  // actually key off of — so an agent sees the "hanging up" state hold for
  // a beat before the bar starts sliding away, instead of both happening
  // at once. The real `onHangUp` callback — the one thing here that
  // actually closes the channel (see this file's own top doc comment) —
  // is deliberately DEFERRED past both delays (the 1s hold plus the exit
  // transition's own duration) rather than fired on click: this whole bar
  // unmounts the instant the caller closes the channel (see each tier
  // page's own "voice has no composer" branch), which would cut the
  // hold/exit sequence short if `onHangUp` ran synchronously.
  const HANG_UP_HOLD_MS = 1000;
  const HANG_UP_EXIT_MS = 300;
  const [isEnding, setIsEnding] = useState(false);
  // Per a real, reported ADA/accessibility gap (found while reviewing this
  // component for a lyra-ui port): Record used to be natively `disabled`
  // while `masked` was on, which — combined with `Button`'s own shared
  // `disabled:pointer-events-none`/`disabled:opacity-40` styling and the
  // native `disabled` attribute's own focus removal — made the `Tooltip`
  // explaining WHY it's disabled ("Recording disabled while masking is
  // on") completely unreachable for everyone: a mouse user can't hover a
  // `pointer-events-none` element to trigger it, and a keyboard/screen-
  // reader user can't tab to an element the browser has removed from the
  // tab order at all. `recordDisabled` now backs an `aria-disabled`
  // instead (see the Record button's own call site below) — the button
  // stays hoverable/focusable, Radix's `Tooltip.Trigger` opens on either,
  // and this same boolean still blocks the actual click/keyboard-activate
  // behavior and paints the same dimmed look, so it reads and behaves as
  // disabled without hiding why.
  const recordDisabled = masked || isEnding;
  const [isExiting, setIsExiting] = useState(false);
  const hangUpTimeoutsRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      hangUpTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);
  // Per explicit follow-up bug report ("when the call controls animate out
  // the main container drops instantly instead of animating with the
  // controls"): the slide/fade transition above only ever moved this bar
  // visually — it never shrank the actual space this bar RESERVES in the
  // caller's flex column (see this file's own top doc comment: this whole
  // component is a `shrink-0` flex sibling of `InteractionTranscript`), so
  // that space stayed put for the full exit transition and only vanished
  // the instant this component actually unmounts (once `onHangUp` fires
  // and the caller closes the channel) — a hard one-frame snap for
  // whatever sits above it, landing right as the slide/fade was still
  // finishing. Collapsing this bar's own rendered height to 0 in lock-step
  // with that same transition means the transcript column above grows
  // into the vacated space gradually, over the same 300ms, instead of
  // jumping the instant this bar disappears.
  //
  // `collapseHeight` is `null` while this bar is in its normal (or merely
  // "hanging up"/disabled) state — no inline height override, sized by its
  // own content exactly as it always was. It's only ever set once
  // `isExiting` flips: first to this bar's OWN just-measured rendered
  // height (a CSS `height` transition can't animate from `auto`, only
  // between two concrete pixel values — setting it to the height it
  // already visually has causes no jump), then, one animation frame later,
  // down to `0` — that second state change is what the outer div's own
  // `transition-all` class (below) actually animates. `overflow-hidden`
  // rides along with the collapse (see that div's own style/className) so
  // the padding/content don't visibly poke out past the shrinking box.
  const barRef = useRef<HTMLDivElement>(null);
  const [collapseHeight, setCollapseHeight] = useState<number | null>(null);

  // Per an explicit follow-up request ("when the width of the call
  // controls goes below 991px make the hold/mask/record/keypad/transcript/
  // volume icon only buttons and 40px", then "when the call controls go
  // below 768px make the mute/video/end call buttons icon buttons 40px"):
  // this bar regains a measured, self-width-driven responsive split — NOT
  // the old three-way wide/compact/stretch toggle this file's own top doc
  // comment describes removing (that one swapped the WHOLE bar between
  // renderings at a single 768px threshold and got removed over a real
  // resize bug). This is two independent, narrower thresholds layered on
  // top of the current single (labeled) rendering: Hold through Volume
  // drop to icon-only `CompactCallControlButton` + `Tooltip` first, at
  // 991px, while Mute/Add video/End Call keep their labels down to a
  // second, narrower 768px threshold — matching the reference screenshot,
  // which still shows "Mute"/"Add video"/"End Call" as visible text at a
  // width where Hold-through-Volume have already gone icon-only. Both
  // thresholds are measured off the same `ResizeObserver`, watching
  // `cardRef` (the actual bordered card below, not the outer full-bleed
  // wrapper `barRef` tracks — that wrapper carries its own `px-6` padding,
  // which would push the effective trigger width off by that inset) —
  // same "measure my own container, not the viewport" pattern
  // `ScheduleToolbar`'s own `containerRef`/`isWide`/`isCompact`
  // (SchedulePanel.tsx) already uses, and the same one this file's own
  // now-removed `isCompact` used to use before it was dropped.
  // A THIRD, narrower breakpoint (ported from lyra-ui's own identical
  // fix, voice-call-controls.tsx -- per the same explicit follow-up
  // request, "as the call controls goes below 600px add a more (3 dots)
  // button and put transcript, keypad, mask and record in the menu"):
  // those four controls (already icon-only since the first breakpoint)
  // collapse further, out of the row entirely, into a single
  // `KebabMenuButton` "more" trigger -- Hold and Volume stay in the row
  // as their own icon-only buttons; only Mask/Record/Keypad/Transcript
  // move into the menu. Keypad's own dialpad body reuses `MenuItemDef`'s
  // `submenuContent` escape hatch rather than a separate `Popover`, for
  // the same reason lyra-ui's own version does (see that file's own top
  // doc comment): a `Popover` trigger nested inside `KebabMenuButton`'s
  // own Radix dropdown would fight that dropdown for the same
  // outside-click/Escape handling.
  const CONTROLS_COMPACT_BREAKPOINT = 991;
  const CONTROLS_ICON_ONLY_BREAKPOINT = 768;
  const CONTROLS_MENU_BREAKPOINT = 600;
  const cardRef = useRef<HTMLDivElement>(null);
  const [measuredCompact, setControlsCompact] = useState(false);
  const [measuredIconOnly, setControlsIconOnly] = useState(false);
  const [measuredMenu, setControlsMenu] = useState(false);
  // Stacked (left nav): the strip is always icon-only, never collapses into
  // the overflow menu, and Mute/End Call keep their labels.
  const controlsCompact = stacked || measuredCompact;
  const controlsIconOnly = stacked ? false : measuredIconOnly;
  const controlsMenu = stacked ? false : measuredMenu;
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setControlsCompact(width < CONTROLS_COMPACT_BREAKPOINT);
      setControlsIconOnly(width < CONTROLS_ICON_ONLY_BREAKPOINT);
      setControlsMenu(width < CONTROLS_MENU_BREAKPOINT);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!isExiting) return;
    const el = barRef.current;
    if (!el) return;
    setCollapseHeight(el.getBoundingClientRect().height);
    const raf = requestAnimationFrame(() => setCollapseHeight(0));
    return () => cancelAnimationFrame(raf);
  }, [isExiting]);
  // Mask/Record/Keypad/Transcript's own menu-item equivalents, built once
  // per render for the `controlsMenu` (<600px) overflow `KebabMenuButton`
  // just below -- see that render site's own doc comment. Ported from
  // lyra-ui's identical array (voice-call-controls.tsx); Mask's icon here
  // swaps between `AudioLines`/`AudioLinesOff` (this file's own existing
  // two-icon convention -- see the Mask button's own doc comment further
  // down) rather than lyra-ui's single-icon/tint-only version, since v3's
  // pinned lucide-react actually has `AudioLinesOff` available. `useMemo`
  // isn't used here -- this array is cheap to rebuild and only matters
  // while `controlsMenu` is actually true.
  const allOverflowMenuItems: MenuEntry[] = [
    {
      id: "mask",
      label: "Mask",
      icon: masked ? (
        <AudioLinesOff className="h-4 w-4" strokeWidth={1.5} />
      ) : (
        <AudioLines className="h-4 w-4" strokeWidth={1.5} />
      ),
      active: masked,
      disabled: isEnding,
      onClick: () => {
        const next = !masked;
        setMasked(next);
        if (next && recording) {
          setRecording(false);
        }
      },
    },
    {
      id: "record",
      label: recording ? "Stop" : "Record",
      icon: (
        <Circle
          className={cn("h-4 w-4", recording && "fill-lyra-status-critical-strong text-lyra-status-critical-strong")}
          strokeWidth={1.5}
        />
      ),
      active: recording,
      disabled: recordDisabled,
      onClick: () => {
        if (recordDisabled) return;
        const next = !recording;
        setRecording(next);
      },
    },
    {
      id: "keypad",
      label: "Keypad",
      icon: <Grid3x3 className="h-4 w-4" strokeWidth={1.5} />,
      active: keypadOpen,
      disabled: isEnding,
      submenuContent: <DialPad onDigit={onSendDtmf} />,
    },
    ...(transcriptMenu
      ? [
          {
            id: "transcript",
            label: "Transcript",
            icon: <FileText className="h-4 w-4" strokeWidth={1.5} />,
            disabled: isEnding,
            submenu: transcriptMenu,
          } satisfies MenuEntry,
        ]
      : []),
  ];
  // Capability-hidden controls leave the menu too (hide, don't disable).
  const hiddenMenuIds = new Set([!showMask && "mask", !showRecord && "record", !showKeypad && "keypad"]);
  const overflowMenuItems = allOverflowMenuItems.filter(
    (item) => typeof item === "string" || !("id" in item) || !hiddenMenuIds.has(item.id)
  );

  const handleHangUp = () => {
    // Guards against a double-fire (e.g. a stray extra click before the
    // button's own `disabled` re-renders) from scheduling `onHangUp` twice.
    if (isEnding) return;
    setIsEnding(true);
    // Force-close the Keypad popover too — same "don't leave a conflicting
    // open state showing" reasoning `CompactVolumeButton`'s own `disabled`
    // prop doc comment gives for the volume popover.
    setKeypadOpen(false);
    hangUpTimeoutsRef.current.push(
      window.setTimeout(() => {
        setIsExiting(true);
        hangUpTimeoutsRef.current.push(
          window.setTimeout(() => {
            onHangUp();
          }, HANG_UP_EXIT_MS)
        );
      }, HANG_UP_HOLD_MS)
    );
  };

  return (
    // Per explicit request/reference screenshot: this bar floats as its own
    // bordered, rounded, shadowed white card rather than an edge-to-edge
    // strip — this OUTER div is a static (no conditional className of its
    // own) full-bleed wrapper that just supplies the horizontal inset the
    // card floats within and stays `shrink-0` in the composer/
    // `VoiceCallControls`-bar flex slot exactly as this whole component
    // already did. `className` (this component's own prop) lands here
    // rather than on the card below — no caller passes it today, but this
    // is the more useful target for a future one (positioning/spacing
    // overrides for the whole bar's slot, not the card's own look).
    // `w-full` explicit here (not just relied on as this flex item's own
    // implicit cross-axis stretch from a `flex-col` ancestor) — per an
    // explicit follow-up bug report/screenshot ("it's not full width")
    // after the compact-card-stretch fix above: `shrink-0` alone left this
    // wrapper's own WIDTH sized to content in practice once Phase 1/Phase
    // 2 pass their own `className="px-0 py-0 bg-transparent"` override
    // here (neutralizing this div's padding/background so the CALLER's own
    // wrapping row supplies those instead) — same "don't lean on ambient
    // stretch actually being definite" fix as `SidePanel`'s own `h-full`
    // doc comment (side-panel.tsx) describes for its pinned branch.
    <div
      ref={barRef}
      style={collapseHeight !== null ? { height: collapseHeight } : undefined}
      className={cn(
        "w-full shrink-0 bg-lyra-bg-surface-base px-6 py-3",
        // Per explicit request ("animate the call controls out (down)"),
        // refined by a later follow-up ("wait one second after the call is
        // ended before animating out the controls"): this keys off
        // `isExiting`, NOT `isEnding` — see `isEnding`'s own doc comment
        // above for why those two are separate states. `isExiting` only
        // flips a second after click, so the disabled "hanging up" look
        // holds for that beat before this transition (slide down + fade)
        // actually starts. `onHangUp` itself is deferred behind BOTH the
        // 1s hold and this transition's own duration, so it finishes
        // playing before the caller unmounts this bar entirely.
        "transition-all duration-300 ease-in-out",
        isExiting && "pointer-events-none translate-y-4 opacity-0",
        // `overflow-hidden` only once a height collapse is actually in
        // flight (`collapseHeight` non-null — see that state's own doc
        // comment above) — normal/"hanging up" rendering keeps this bar's
        // default visible overflow rather than clipping anything
        // unnecessarily the rest of the time.
        collapseHeight !== null && "overflow-hidden",
        className
      )}
    >
      {/* This card used to be one of three branches (wide two-row centered
          card / compact icon-only row / `stretch` single-row wide) picked
          by `stretch`+`isCompact` — see this file's own top doc comment
          ("just take the existing compact version — stretch it the full
          width of the container and remove media queries"). What's left is
          just the former COMPACT rendering's own look, made to fill its
          container instead of sizing to its own content: `w-full`, no
          `max-w`/`mx-auto` cap (those centered/capped this card within the
          outer full-bleed wrapper above — no longer wanted now that this is
          the only rendering), same flat 8px radius / tight padding /
          no-shadow treatment the compact branch always had. */}
      <div
        ref={cardRef}
        role="group"
        aria-label="Call controls"
        className={cn(
          // `bg-lyra-bg-surface-container-subtle` — per explicit request
          // ("make the background of the call controls the neutral
          // color"): was `bg-lyra-bg-surface-overlay` (a prior explicit
          // request to stand out from the page in dark mode — see this
          // file's own git history for that reasoning). `surface-
          // container-subtle` is this design system's actual "neutral"
          // surface token — the same one `Icon`'s own `background="neutral"`
          // variant maps to (icon.tsx) and the same one `SidePanel` uses
          // for its own panel surface (side-panel.tsx) — a plain neutral
          // gray container (`#fbfcfe` light / `#262626` dark) rather than
          // the lighter, "stands out" white/near-white treatment
          // `surface-overlay` gave it.
          "border border-lyra-border-subtle bg-lyra-bg-surface-container-subtle",
          // `px-3 py-2` (was `px-2 py-1`) — per later explicit follow-up
          // request/reference screenshot ("make the voice controls
          // larger"): a little more breathing room around the now-taller
          // icon+label `WideCallControlButton`s (each roughly h-16 now,
          // was h-8) so they don't sit flush against this card's own
          // border.
          stacked
            ? "flex w-full flex-col items-stretch gap-3 rounded-lg !bg-lyra-bg-surface-base px-3 py-3"
            : "w-full grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg px-3 py-2"
        )}
      >
        {/* Three real slots (customer identity+timer / main buttons+
            volume / dark mute+video+End Call), replacing the former
            two-slot layout — per explicit request/reference screenshot
            ("update the call control button order to be like the attached
            screenshot"). The screenshot's own left-to-right shape is: a
            timer alone at the far left with a large gap after it, a
            centered cluster of lighter/decorative controls, a divider, a
            visibly DARKER mute+video pair, then a large red "End Call"
            button anchored to the far right.

            This row used to be a plain `flex justify-between` with
            `shrink-0` leading/trailing slots and a `flex-1` middle one —
            per a LATER explicit follow-up request/bug report ("the middle
            buttons shift position when the name is longer... this
            requires those containers to be equal width and not dependent
            on the length of the customer name"), that's a CSS grid
            instead (ported from lyra-ui's own identical fix,
            voice-call-controls.tsx): `grid-cols-[1fr_auto_1fr]` forces the
            leading and trailing columns to the SAME width (whichever
            needs more room) regardless of either one's own content, so
            the `auto` middle column — and the decorative cluster centered
            within it — stays genuinely fixed at the bar's true center
            instead of drifting right as `customerLabel` grows. Under the
            old `flex`, only the middle slot's own CONTENTS were centered
            within a box whose left edge tracked the (variable-width)
            identity slot next to it — never actually centered on the bar
            as a whole. Each of the three columns keeps its own `min-w-0`
            (grid items default to `min-width: auto`, sized to fit their
            content, same overflow footgun flex has) so the identity
            slot's existing name `truncate` can still do its job if its
            equal share ever runs short, rather than forcing the whole bar
            wider. */}
        <div className="flex min-w-0 items-center gap-2">
          {/* Avatar chip + identity line — added per explicit request/
              reference screenshot ("add the customer avatar. Add the name /
              number/email above the timer"). Only renders while the caller
              has passed `customerLabel` through (see that prop's own doc
              comment) — same "omit to render nothing extra" fallback the
              rest of this bar's optional props already follow, so an
              existing caller that hasn't wired customer identity through
              yet is unaffected. Purple background reuses this app's own
              existing "Voice channel = purple" accent convention (see this
              file's own top doc comment); the fallback glyph is explicitly
              `text-white` per a follow-up clarification ("keep it white
              though not black") rather than this design system's default
              (dark) icon color. */}
          {customerLabel && (
            // Per explicit follow-up request ("add a story to the avatar
            // component ... use it in agent-next-gen-v3"): now built on
            // lyra-ui's shared `Avatar` (avatar.tsx) instead of this
            // hand-rolled circle — that component generalizes exactly this
            // "initials over a generic fallback glyph" shape, and its own
            // initials text class fixes a bug this hand-rolled version had
            // (`lyra-label-sm`, which doesn't exist in this design
            // system's type scale — `Avatar` uses plain `lyra-label`
            // instead, the same size `ContactOverview`'s own identity-card
            // avatar already uses at this same 36px circle). Same
            // `bg-lyra-bg-primary`/`text-lyra-fg-on-primary` "primary"
            // look via `color="primary"`, same generic `User` outline
            // fallback (now `Avatar`'s own built-in default, so `icon`
            // isn't even passed here) when `customerInitials` isn't set.
            <Avatar initials={customerInitials} color="primary" size="md" />
          )}
          <div className="flex min-w-0 flex-col justify-center">
            {customerLabel && (
              <span className="lyra-body-sm truncate text-lyra-fg-primary">{customerLabel}</span>
            )}
            {/* Timer — moved here from its old trailing position (see this
              bar's own git history: "move the timer to the far right after
              volume") per the reference screenshot, which shows the
              timer/status leading the WHOLE bar on the far left instead.
              Digits/width behavior unchanged (see the comment that used to
              sit here for the "why" of the fixed `w-[34px]` digit width and
              `tabular-nums`) — only its position moved, and its own
              trailing divider is dropped since it's now alone in the
              leftmost slot with nothing to its left to separate from.
              Per explicit follow-up request ("when record is enabled make
              the clock icon on the left of the timer a red badge"): the
              leading glyph now swaps from the plain `Clock` outline to a
              solid red `Circle` — the SAME icon+fill/text color pair
              (`fill-lyra-status-critical-strong text-lyra-status-critical-
              strong`) the Record button below already uses for its own
              filled/active state, so this reuses an existing "recording"
              treatment instead of inventing a new badge style — whenever
              `recording` is on, reverting to the plain clock the instant
              recording stops. Per an explicit follow-up request ("make the
              red dot next to the timer pulse or animate when recording"):
              `animate-pulse` (Tailwind's own built-in fade in/out keyframe,
              already relied on elsewhere in this app for "something's
              live" affordances) is added here so the dot itself breathes
              while recording, on top of its plain solid-red look — the
              Record button's own filled-red `Circle` (just below, in the
              decorative cluster) intentionally keeps its plain static fill:
              this pulsing is specific to the badge this request named, not
              a blanket "recording" treatment applied everywhere red shows
              up in this bar. */}
          {callStartTick !== undefined && (
            <ClockTick>
              {(clockTick) => (
            <span
              className="flex items-center gap-1 lyra-body-sm text-lyra-fg-secondary"
              aria-label={`Call duration ${formatElapsedTime(clockTick - callStartTick)}`}
            >
              {recording ? (
                <Circle
                  className="h-4 w-4 shrink-0 fill-lyra-status-critical-strong text-lyra-status-critical-strong animate-pulse"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              ) : (
                <Clock className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              )}
              <span className="w-[34px] shrink-0 text-right tabular-nums">{formatElapsedTime(clockTick - callStartTick)}</span>
            </span>
              )}
            </ClockTick>
          )}
          {/* On-hold timer — see `holdStartTick`'s own doc comment.
              A second line directly below the call timer above, not a
              replacement for it. */}
          {onHold && holdStartTick !== undefined && (
            <ClockTick>
              {(clockTick) => (
            <Badge
              shape="pill"
              color={getHoldSeverity(clockTick - holdStartTick)}
              variant="subtle"
              fontSize={12}
              icon={<Pause strokeWidth={2} />}
              aria-label={`On hold ${formatElapsedTime(clockTick - holdStartTick)}`}
            >
              On hold {formatElapsedTime(clockTick - holdStartTick)}
            </Badge>
              )}
            </ClockTick>
          )}
          </div>
        </div>
        <div
          className={cn(
            "flex min-w-0 items-stretch gap-1",
            stacked ? "justify-between rounded-lyra-sm bg-lyra-bg-surface-container-subtle px-1" : "justify-center"
          )}
        >
          {/* Decorative cluster — Hold/Mask/Record/Keypad/Transcript/Volume,
              unchanged in behavior/styling from before, just relocated out
              of the old leading `justify-start` slot into this slot
              (originally `justify-center`, then briefly `justify-end` per
              an explicit follow-up request — "move the middle buttons to
              the right" — so this cluster sat flush against the divider/
              dark-cluster/End Call group that follows it). Per a LATER
              explicit follow-up request/reference screenshot ("center the
              hold through volume buttons when the call controls expand and
              add separators to the left and right around these buttons"):
              back to `justify-center` — so this cluster centers within
              whatever open space the leading/trailing `shrink-0` slots
              leave it once this bar is wider than its own contents need —
              now bracketed by its own leading/trailing dividers (the first
              child below, and the one right after `CompactVolumeButton`
              further down) instead of relying on the trailing dark
              cluster's divider to read as this group's right edge. Those
              two dividers are deliberately INSIDE this centered flex item
              (not floated at the leading/trailing slot boundaries) so they
              travel with the cluster as it centers, staying flush against
              Hold/Volume at any container width rather than drifting away
              from them into the open space `justify-center` creates on
              either side. `items-stretch` (was `items-center`) is what lets
              those two divider `span`s reach this row's full height via
              their own `self-center`, same reasoning as the trailing dark
              cluster's own divider (see that slot's own comment) — every
              `WideCallControlButton` here is already `h-auto`/content-sized
              regardless of the row's own `align-items`, so this doesn't
              change their height. Mute itself is still OUT of this cluster,
              in the trailing dark group below — see that slot's own
              comment for why. */}
          {/* Left separator — see this slot's own doc comment just above
              for why it lives here (inside the centered flex item) rather
              than at the slot boundary. */}
          <span aria-hidden="true" className={cn("h-4 w-px shrink-0 self-center bg-lyra-border-subtle", stacked && "hidden")} />
          {/* No more wrapping `Tooltip` on this or the next several
              controls — per later explicit follow-up request ("label the
              buttons again"), `WideCallControlButton`'s own label is now
              always-visible text, so a hover-only tooltip repeating the
              same word would be pure redundancy. The one exception is
              Record just below, which still wraps a `Tooltip` — its hover
              content is genuinely EXTRA information ("why is this
              disabled") beyond what a two-word label can hold. */}
          {showHold && (controlsCompact ? (
            <Tooltip content={onHold ? "Resume" : "Hold"} placement="top">
              <CompactCallControlButton
                icon={onHold ? <Play className="h-5 w-5" strokeWidth={1.5} /> : <Pause className="h-5 w-5" strokeWidth={1.5} />}
                active={onHold}
                aria-label={onHold ? "Resume" : "Hold"}
                className={
                  onHold
                    ? "text-lyra-status-warning-strong bg-lyra-status-warning-subtle hover:text-lyra-status-warning-strong"
                    : undefined
                }
                onClick={() => {
                  const next = !onHold;
                  setOnHold(next);
                }}
                disabled={isEnding}
              />
            </Tooltip>
          ) : (
            <WideCallControlButton
              icon={onHold ? <Play className="h-5 w-5" strokeWidth={1.5} /> : <Pause className="h-5 w-5" strokeWidth={1.5} />}
              label={onHold ? "Resume" : "Hold"}
              active={onHold}
              className={
                onHold
                  ? "text-lyra-status-warning-strong bg-lyra-status-warning-subtle hover:text-lyra-status-warning-strong"
                  : undefined
              }
              onClick={() => {
                const next = !onHold;
                setOnHold(next);
              }}
              disabled={isEnding}
            />
          ))}
          {/* Below 600px (`controlsMenu`, this file's own top doc
              comment): Mask/Record/Keypad/Transcript disappear from the
              row entirely and move into a single `KebabMenuButton`
              overflow trigger instead -- Hold and Volume stay put as
              their own icon-only buttons either side of it. Ported from
              lyra-ui's identical fix (voice-call-controls.tsx). */}
          {controlsMenu ? (
            overflowMenuItems.length > 0 && (
            <KebabMenuButton
              items={overflowMenuItems}
              ariaLabel="More call controls"
              icon={<MoreHorizontal className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
              className="h-10 w-10 rounded-lyra-sm text-lyra-fg-secondary hover:text-lyra-fg-default"
              disabled={isEnding}
            />
            )
          ) : (
            <>
            {showMask && (controlsCompact ? (
            <Tooltip content="Mask" placement="top">
              <CompactCallControlButton
                icon={
                  masked ? (
                    <AudioLinesOff className="h-5 w-5" strokeWidth={1.5} />
                  ) : (
                    <AudioLines className="h-5 w-5" strokeWidth={1.5} />
                  )
                }
                active={masked}
                aria-label="Mask"
                onClick={() => {
                  const next = !masked;
                  setMasked(next);
                  if (next && recording) {
                    setRecording(false);
                  }
                }}
                disabled={isEnding}
              />
            </Tooltip>
          ) : (
            <WideCallControlButton
              // Per explicit request ("use audio lines and audio lines off
              // for the masking icon"): swaps between `AudioLines`/
              // `AudioLinesOff` on `masked`, mirroring the existing
              // `Mic`/`MicOff` toggle just below (`muted ? MicOff : Mic`) —
              // the slashed icon shows while the effect (masking the real
              // voice signal) is actively engaged. Requires
              // lucide-react >=1.33.0 (bumped in package.json), the first
              // published version that includes `AudioLinesOff` — it does
              // not exist in the 0.468.0 that was previously pinned.
              icon={
                masked ? (
                  <AudioLinesOff className="h-5 w-5" strokeWidth={1.5} />
                ) : (
                  <AudioLines className="h-5 w-5" strokeWidth={1.5} />
                )
              }
              label="Mask"
              active={masked}
              onClick={() => {
                const next = !masked;
                setMasked(next);
                // Per explicit request ("when voice masking is on
                // recording must turn off and become disabled"): masking
                // the real voice signal and recording it are mutually
                // exclusive, so turning masking ON forces any in-progress
                // recording off — the Record button itself is disabled
                // just below for as long as masking stays on, so there's
                // no way to start a new one until masking is turned back
                // off.
                if (next && recording) {
                  setRecording(false);
                }
              }}
              // See `isEnding`'s own doc comment above.
              disabled={isEnding}
            />
          ))}
          {/* Record — `Tooltip`'s `content` now covers two reasons to
              show it: the existing masked-explanation text (unchanged), OR,
              once icon-only below 991px (`controlsCompact`), the button's
              own label (there's no visible label text left to read it off
              in that rendering). `disabled` only suppresses it when
              NEITHER applies. `recordDisabled` (see its own doc comment
              above) drives BOTH renderings' actual disabled behavior now,
              via `aria-disabled` rather than native `disabled` — the ADA
              fix this whole block exists for. */}
          {showRecord && (
          <Tooltip
            content={masked ? "Recording disabled while masking is on" : recording ? "Stop" : "Record"}
            placement="top"
            disabled={!masked && !controlsCompact}
          >
            {controlsCompact ? (
              <CompactCallControlButton
                icon={
                  <Circle
                    className={cn("h-5 w-5", recording && "fill-lyra-status-critical-strong text-lyra-status-critical-strong")}
                    strokeWidth={1.5}
                  />
                }
                active={recording}
                aria-label={recording ? "Stop" : "Record"}
                aria-disabled={recordDisabled}
                className={recordDisabled ? "opacity-40" : undefined}
                onClick={() => {
                  if (recordDisabled) return;
                  const next = !recording;
                  setRecording(next);
                }}
                onKeyDown={(e) => {
                  if (recordDisabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                  }
                }}
              />
            ) : (
              <WideCallControlButton
                icon={
                  <Circle
                    className={cn("h-5 w-5", recording && "fill-lyra-status-critical-strong text-lyra-status-critical-strong")}
                    strokeWidth={1.5}
                  />
                }
                label={recording ? "Stop" : "Record"}
                active={recording}
                aria-disabled={recordDisabled}
                className={recordDisabled ? "opacity-40" : undefined}
                onClick={() => {
                  if (recordDisabled) return;
                  const next = !recording;
                  setRecording(next);
                }}
                onKeyDown={(e) => {
                  if (recordDisabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                  }
                }}
              />
            )}
          </Tooltip>
          )}
          {/* Keypad — no more wrapping `Tooltip` (see the block comment a
              few controls up for why) — `Popover`'s own Radix trigger
              still clones its click/ref/aria props straight onto its
              immediate child, which is exactly what `WideCallControlButton`
              being `forwardRef`+`...rest` is for (see that component's own
              doc comment). `aria-label` set directly on it (flows through
              its own `...rest` spread) is now redundant with its own
              visible label text, but harmless to leave. */}
          {showKeypad && (
          <Popover
            open={keypadOpen && !isEnding}
            onOpenChange={(next: boolean) => {
              if (!isEnding) setKeypadOpen(next);
            }}
            placement="top"
            bodyPadding={false}
            content={<DialPad onDigit={onSendDtmf} />}
          >
            {controlsCompact ? (
              // Native `title` (not `Tooltip`) — `Tooltip`'s own
              // `asChild`/`Slot` cloning and `Popover`'s do the same thing
              // to the same immediate child, so nesting one inside the
              // other here silently drops whichever one's props land on a
              // plain (non-forwardRef, non-rest-spreading) wrapper
              // component instead of the real `<button>`. A native title
              // attribute needs no such wiring and still names the button
              // for anyone hovering it.
              <CompactCallControlButton
                icon={<Grid3x3 className="h-5 w-5" strokeWidth={1.5} />}
                active={keypadOpen}
                aria-label="Keypad"
                title="Keypad"
                disabled={isEnding}
              />
            ) : (
              <WideCallControlButton
                icon={<Grid3x3 className="h-5 w-5" strokeWidth={1.5} />}
                label="Keypad"
                active={keypadOpen}
                aria-label="Keypad"
                // See `isEnding`'s own doc comment above — `handleHangUp`
                // also force-closes this popover directly (`setKeypadOpen
                // (false)`) rather than relying on this alone, since
                // `disabled` only blocks NEW opens, not one already open.
                disabled={isEnding}
              />
            )}
          </Popover>
          )}
          {/* Transcript: a popover trigger over `transcriptMenu`, not a toggle; no menu, no button. */}
          {transcriptMenu && (
            <Popover
              open={transcriptMenuOpen}
              onOpenChange={setTranscriptMenuOpen}
              placement="top"
              bodyPadding={false}
              content={<Menu items={transcriptMenu} bare />}
            >
              {controlsCompact ? (
                <CompactCallControlButton
                  icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
                  active={transcriptMenuOpen}
                  aria-label="Transcript"
                  disabled={isEnding}
                />
              ) : (
                <WideCallControlButton
                  icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
                  label="Transcript"
                  active={transcriptMenuOpen}
                  // See `isEnding`'s own doc comment above.
                  disabled={isEnding}
                />
              )}
            </Popover>
          )}
            </>
          )}
          <CompactVolumeButton volume={volume} onVolumeChange={setVolume} disabled={isEnding} compact={controlsCompact} />
          {/* Right separator — see the leading one's own doc comment
              (this slot's opening `<div>`, above) for why this lives here,
              right after `CompactVolumeButton`, rather than at this slot's
              trailing boundary. */}
          <span aria-hidden="true" className={cn("h-4 w-px shrink-0 self-center bg-lyra-border-subtle", stacked && "hidden")} />
        </div>
        <div className={cn("flex min-w-0 items-stretch gap-2", stacked ? "justify-stretch" : "justify-end")}>
          {/* Mute — moved out of the centered cluster above and given
              `strong` (see `WideCallControlButton`'s own doc comment for
              what that darkens) per the reference screenshot, which shows
              this icon visibly darker than the rest of the bar. Behavior
              unchanged; no more wrapping `Tooltip` (see the block comment
              a few controls up for why). */}
          {showMute && (stacked ? (
            <Button
              variant="outline"
              size="md"
              className="min-w-0 flex-1 gap-1.5"
              onClick={() => setMuted(!muted)}
              disabled={isEnding}
              aria-pressed={muted}
            >
              {muted ? <MicOff className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" /> : <Mic className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
              {muted ? "Unmute" : "Mute"}
            </Button>
          ) : controlsIconOnly ? (
            <Tooltip content={muted ? "Unmute" : "Mute"} placement="top">
              <CompactCallControlButton
                icon={muted ? <MicOff className="h-5 w-5" strokeWidth={1.5} /> : <Mic className="h-5 w-5" strokeWidth={1.5} />}
                active={muted}
                strong
                variant="outline"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => setMuted(!muted)}
                disabled={isEnding}
              />
            </Tooltip>
          ) : (
            <WideCallControlButton
              icon={muted ? <MicOff className="h-5 w-5" strokeWidth={1.5} /> : <Mic className="h-5 w-5" strokeWidth={1.5} />}
              label={muted ? "Unmute" : "Mute"}
              active={muted}
              strong
              // Per explicit request ("make the mute / video buttons
              // outline icon buttons") — see `WideCallControlButton`'s own
              // `variant` doc comment.
              variant="outline"
              onClick={() => setMuted(!muted)}
              // See `isEnding`'s own doc comment above.
              disabled={isEnding}
            />
          ))}
          {/* Add video — same `strong` darkening as Mute per the reference
              screenshot (only visible in practice where `showAddVideo` is
              true, i.e. Phase 2 — Phase 1 hides this button entirely, see
              `showAddVideo`'s own doc comment above).
              Per an explicit bug report ("the video button state is
              backwards - a line through it indicates no video"): the
              icon swap here had the slashed/plain `VideoOff`/`Video` pair
              inverted relative to every other toggle in this bar (compare
              Mute just above: the SLASHED `MicOff` shows when muted is
              OFF-state, the plain `Mic` when it's on) — this button was
              instead showing the slashed `VideoOff` glyph while video WAS
              added (the on-state) and the plain camera while it wasn't.
              Swapped so slashed = off (no video), plain = on (video added),
              matching Mute's own convention; `active`/label/click behavior
              below are unchanged, only which icon renders for which state,
              and (per the same "label the buttons again" request as every
              other control here) a visible label instead of a hover-only
              `Tooltip`. */}
          {showAddVideo && (controlsIconOnly ? (
            <Tooltip content={videoAdded ? "Remove video" : "Add video"} placement="top">
              <CompactCallControlButton
                icon={videoAdded ? <Video className="h-5 w-5" strokeWidth={1.5} /> : <VideoOff className="h-5 w-5" strokeWidth={1.5} />}
                active={videoAdded}
                strong
                variant="outline"
                aria-label={videoAdded ? "Remove video" : "Add video"}
                onClick={() => {
                if (onToggleVideo) {
                  onToggleVideo();
                  return;
                }
                const next = !localVideoAdded;
                setLocalVideoAdded(next);
                onAddToast?.({ variant: "info", title: next ? "Video added to call" : "Video removed from call" });
              }}
                disabled={isEnding}
              />
            </Tooltip>
          ) : (
            <WideCallControlButton
              icon={videoAdded ? <Video className="h-5 w-5" strokeWidth={1.5} /> : <VideoOff className="h-5 w-5" strokeWidth={1.5} />}
              label={videoAdded ? "Remove video" : "Add video"}
              active={videoAdded}
              strong
              // Per explicit request ("make the mute / video buttons
              // outline icon buttons") — see `WideCallControlButton`'s own
              // `variant` doc comment.
              variant="outline"
              onClick={() => {
                if (onToggleVideo) {
                  onToggleVideo();
                  return;
                }
                const next = !localVideoAdded;
                setLocalVideoAdded(next);
                onAddToast?.({ variant: "info", title: next ? "Video added to call" : "Video removed from call" });
              }}
              // See `isEnding`'s own doc comment above.
              disabled={isEnding}
            />
          ))}
          {/* End Call — per explicit request ("make the leave button big
              and red and have it say 'end call'"): this used to be a plain
              icon-only `CompactCallControlButton` with `critical` styling
              (a small red PhoneOff glyph, label only reachable via
              `Tooltip`) same as every other control in this bar. It's now a
              real lyra-ui `Button` instead — `variant="destructive"` is
              this design system's own solid-red/filled treatment (see
              button.tsx: `bg-lyra-bg-destructive` + `text-lyra-fg-on-
              primary`, the same token pair every other destructive action
              in this app already uses). Label is now always-visible text
              ("End Call") next to the icon instead of hidden behind a hover
              `Tooltip`, so no `Tooltip` wrapper here anymore — a `Button`
              with visible text content already has its own accessible
              name. Size was originally `lg` (h-9) to read as "big" against
              the surrounding h-8 icon buttons; per an explicit follow-up
              request ("make the red button smaller") this became `default`
              (h-8) instead, matching the row's own then-h-8 icon buttons
              exactly. Bumped back to `lg` (h-9) here per a later explicit
              follow-up request/reference screenshot ("make the voice
              controls larger... keep the End Call button filled red") —
              every OTHER control in this bar just grew from a flat h-8
              icon-only button to a taller icon+label column
              (`WideCallControlButton`, `h-auto` with `py-2` — roughly h-16
              in practice), so `default` would now read as visibly SMALLER
              than its neighbors instead of matching them. Still
              `variant="destructive"` (filled red, unchanged) and still its
              own real `Button` with a visible label — only the size moved,
              exactly as asked.
              Per a later explicit follow-up request ("make the end call
              button the same height as the mute and add video buttons"):
              `size="lg"`'s own fixed `h-9` is overridden here to `h-auto`
              (via `cn()`'s tailwind-merge, same "last one wins" mechanism
              `wrap`'s own doc comment in button.tsx describes) so this
              button no longer sits at a fixed height while its neighbors
              have grown taller — instead it now stretches to match
              whichever of Mute/Add video is tallest, via this row's own
              `items-stretch` (see the divider's own comment just above for
              why it needed an explicit `self-center` once the row stopped
              using `items-center`). `size="lg"` is still passed for its
              padding/typography, just no longer for its height.
              Per explicit follow-up request ("when end call is clicked
              transition the end call button to a hanging up state
              (disabled)"): once `isEnding` is set (`handleHangUp` above),
              this button disables itself (lyra-ui's own `disabled:opacity-
              40`/`disabled:pointer-events-none`, same dimmed-and-inert look
              every other disabled control in this bar already gets — see
              button.tsx) and swaps its icon+label for an inverse `Spinner`
              + "Hanging Up..." — the one visible cue (besides the rest of
              the bar disabling alongside it) that the click registered
              while `onHangUp` itself is deferred behind the exit
              animation (see `isEnding`'s own doc comment above). */}
          {/* Below 768px (`controlsIconOnly`, this file's own top doc
              comment): same `variant="destructive"` `Button`, just
              icon-only at a fixed 40px (`h-10 w-10`, matching every other
              icon-only control at this width — `CompactCallControlButton`
              itself isn't reused here since End Call is deliberately a
              plain `Button`, not part of that shared icon-button
              component, per this block's own doc comment above) instead
              of the icon+"End Call"/"Hanging Up..." text column, with a
              `Tooltip` standing in for the now-hidden label. */}
          {controlsIconOnly ? (
            <Tooltip content={isEnding ? "Hanging Up..." : "End Call"} placement="top">
              <Button
                variant="destructive"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleHangUp}
                disabled={isEnding}
                aria-label={isEnding ? "Hanging Up..." : "End Call"}
              >
                {isEnding ? (
                  <Spinner variant="circle" size="sm" color="inverse" label="Hanging up" />
                ) : (
                  <PhoneOff className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                )}
              </Button>
            </Tooltip>
          ) : (
            <Button
              variant="destructive"
              size={stacked ? "md" : "lg"}
              className={cn("shrink-0 gap-1.5", stacked ? "min-w-0 flex-1" : "h-auto")}
              onClick={handleHangUp}
              disabled={isEnding}
            >
              {isEnding ? (
                <Spinner variant="circle" size="sm" color="inverse" label="Hanging up" />
              ) : (
                <PhoneOff className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              )}
              {isEnding ? "Hanging Up..." : "End Call"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
