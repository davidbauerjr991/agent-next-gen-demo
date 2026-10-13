// Video call UI opened by `VoiceCallControls`'s own "Add video" button (see
// that file's own `onToggleVideo` doc comment) via each tier page's own
// `voiceVideoWindowOpen`/`voiceVideoFullScreen` state. Two components, one
// per mode:
//
//   - `VideoCallWindow` — the small, freely draggable floating window
//     (built directly on lyra-ui's `Draggable`, not `DraggablePanel` — see
//     that choice's own doc comment below). Both feeds shown STACKED
//     (customer on top, you on bottom), each at a real 16:9 "standard
//     video" aspect ratio via Tailwind's `aspect-video`, per explicit
//     request.
//   - `VideoCallFullScreen` — rendered by the tier page directly inside the
//     transcript column's own content area (NOT floating — see that
//     render site's own doc comment for why), taking over just that area:
//     the record header above and the call-controls bar below stay
//     visible, untouched. Per explicit follow-up request, this mode goes
//     back to the ORIGINAL "one big main feed + a small inset self-view
//     PIP" layout instead of the stacked one — stacking two full 16:9
//     feeds only reads right at the small window's own size.
//
// Purely decorative, same "fake it with a toast/placeholder, no real
// backing" convention every other placeholder control in this app already
// follows (see agent-next-gen-voice-call-controls.tsx's own top doc
// comment) — there's no real camera/stream in this prototype, just dark
// placeholder areas standing in for one.
import { ContainerHeader, Draggable, Tooltip } from "@nicecxone/lyra-ui";
import { GripVertical, Maximize2, Minimize2, Video, X } from "lucide-react";

/** One 16:9 video tile — shared shape for both the customer and "You" feeds
 *  in the stacked (small window) layout below. `label` renders bottom-left
 *  like the main feed's own customer-name caption already did; `live`
 *  additionally shows the red-dot "Live" indicator (customer's feed only —
 *  there's only one call to be "live", no need to repeat it on the self-
 *  view tile). */
function VideoTile({ label, live }: { label: string; live?: boolean }) {
  return (
    <div className="relative w-full aspect-video shrink-0 flex items-center justify-center rounded-lyra-sm bg-lyra-bg-surface-inverse">
      <Video className="h-6 w-6 text-lyra-fg-inverse opacity-50" strokeWidth={1.5} aria-hidden="true" />
      {live && (
        <span className="absolute left-2 top-2 flex items-center gap-1 lyra-body-xs text-lyra-fg-inverse">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-lyra-status-critical-strong" />
          Live
        </span>
      )}
      <span className="absolute left-2 bottom-2 lyra-body-xs text-lyra-fg-inverse opacity-80">
        {label}
      </span>
    </div>
  );
}

export interface VideoCallWindowProps {
  /** Rendered as the header title, same as every other draggable panel in
   *  this app titling by whatever the panel is "of". Falls back to
   *  "Customer" when the interaction has no name on file. */
  customerName?: string;
  onClose: () => void;
  /** Fires when the header's fullscreen button is clicked — the caller
   *  swaps this floating window out for `VideoCallFullScreen` (see this
   *  file's own top doc comment); this component has no fullscreen concept
   *  of its own. */
  onFullScreen: () => void;
}

/**
 * Built directly on lyra-ui's `Draggable`, not the higher-level
 * `DraggablePanel` — `DraggablePanel` hardcodes its header's action button
 * as a float/dock TOGGLE (see draggable-panel.tsx's own `renderHeaderControls`),
 * and "docked" (pinned to a layout sibling's edge) means nothing for a
 * floating video call window with no docking destination. Per explicit
 * request, that same button/spot instead becomes a FULLSCREEN toggle here —
 * `Draggable`'s own `renderHeaderControls` render-prop gives direct control
 * over the header to swap that button in place of the dock one, so this
 * builds its own thin `ContainerHeader` wrapper instead of going through
 * `DraggablePanel`. `lockVariant` + always `variant="float"` — the built-in
 * dock/undock toggle is gone entirely now, not just relabeled, so there's
 * no path left that could ever switch this into "docked".
 */
export function VideoCallWindow({ customerName = "Customer", onClose, onFullScreen }: VideoCallWindowProps) {
  return (
    <Draggable
      variant="float"
      lockVariant
      defaultWidth={300}
      defaultHeight={400}
      minWidth={240}
      minHeight={280}
      maxWidth={480}
      className="rounded-lyra-lg border border-lyra-border-subtle bg-lyra-bg-surface-base shadow-lg"
      renderHeaderControls={({ gripProps }) => (
        <ContainerHeader
          title={customerName}
          icon={
            <div {...gripProps}>
              <GripVertical className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </div>
          }
          actions={
            <Tooltip content="Full screen" placement="bottom" asLabel>
              <button
                type="button"
                aria-label="Full screen"
                onClick={onFullScreen}
                className="flex h-8 w-8 items-center justify-center rounded-lyra-sm text-lyra-fg-secondary hover:bg-lyra-state-hover hover:text-lyra-fg-default transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus focus-visible:ring-offset-2"
              >
                <Maximize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </Tooltip>
          }
          onClose={onClose}
        />
      )}
    >
      {/* Both feeds stacked, each a real 16:9 tile (`aspect-video`) rather
          than a fixed pixel height — "standard video dimensions" per
          explicit request, and one that stays correct through a corner
          resize (the tile's height recalculates off whatever width the
          drag lands on) instead of drifting out of proportion. `flex-1
          overflow-y-auto` on the wrapper is a safety net, not the primary
          sizing mechanism — `Draggable`'s own default height already
          approximates two stacked 16:9 tiles at `defaultWidth`, so this
          only kicks in if a manual resize ever lands short. */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        <VideoTile label={customerName} live />
        <VideoTile label="You" />
      </div>
    </Draggable>
  );
}

export interface VideoCallFullScreenProps {
  /** Falls back to "Customer" when the interaction has no name on file. */
  customerName?: string;
  /** Restores the small floating `VideoCallWindow` — the header's
   *  `Minimize2` button, mirroring `InteriorPanel`'s own full-screen
   *  toggle icon convention (Maximize2 to enter, Minimize2 to exit). */
  onExitFullScreen: () => void;
  /** Per explicit follow-up request, reinstated — a prior pass here briefly
   *  replaced this with a "stop video"/self-view-only toggle, but that's
   *  reverted for now ("just keep the close button for now"); this closes
   *  the whole video feature the same way it always did, just from the new
   *  overlaid top-right control cluster instead of a `ContainerHeader`. */
  onClose: () => void;
  /** Used to gate a top gradient scrim behind the overlaid controls, hidden
   *  for an "unknown" contact (an ad-hoc/quickdial/redial channel with no
   *  real backing customer record) — same "reduce decorative chrome for a
   *  contact with no real identity behind it" precedent this app already
   *  established for Contact Overview (`activeInteractionIsRealCustomer`,
   *  each tier page's own doc comment) and `customerIdentified` (avatar vs.
   *  generic icon, `InteractionNavItem`). Per explicit follow-up request,
   *  that scrim is gone now (see this component's own render, below) — kept
   *  as a prop (every call site still threads it through) rather than
   *  pulled out everywhere, in case a future pass brings the scrim back for
   *  a real (non-placeholder) video feed, where legibility over an actual
   *  moving image matters more than it does over this static placeholder. */
  customerIdentified?: boolean;
}

/**
 * Renders as an `absolute inset-0` overlay inside the tier page's own
 * transcript-column wrapper (see that render site's own doc comment for
 * why it has to be a sibling positioned there rather than anything
 * `Draggable`-based) — covers exactly that column's content area and
 * nothing else, so the record header above and the `VoiceCallControls` bar
 * below (both outside that wrapper) stay visible. Per explicit request,
 * goes back to the ORIGINAL single-main-feed-plus-inset-PIP layout for
 * this mode specifically (only the small floating window stacks the two
 * feeds) — a full-bleed feed plus a small self-view corner reads as the
 * "real fullscreen video call" layout; two stacked 16:9 feeds at this much
 * larger size would waste most of the screen as letterboxing.
 *
 * No `ContainerHeader` bar anymore — per explicit follow-up request/
 * reference screenshot, a separate light-background title bar sitting
 * above a full-bleed dark video read as visually disjointed (a "real"
 * fullscreen video call has no chrome above the feed at all). "Exit full
 * screen" and "Close" now float directly over the video's own top-right
 * corner instead, both plain icon buttons colored `text-lyra-fg-inverse`
 * (the same light/white token the "Live" indicator and customer-name
 * caption already use here) rather than a boxed/bordered button, so they
 * read as part of the video chrome, not a floating card.
 */
export function VideoCallFullScreen({ customerName = "Customer", onExitFullScreen, onClose, customerIdentified = true }: VideoCallFullScreenProps) {
  return (
    // No explicit z-index on this root (back to relying on plain
    // z-index:auto/DOM-order stacking) — per explicit follow-up bug report,
    // an earlier pass here added `z-[3]` so this overlay would paint ABOVE
    // the transcript's own sticky session separator (`TranscriptSessionSeparator`,
    // agent-next-gen-transcript.tsx — a SIBLING of this whole overlay,
    // `sticky top-0 z-[1]`), which had been hiding this box's own "Live"
    // indicator/button cluster when both landed in the same top strip of
    // screen space. That fixed the buttons but traded in a WORSE bug: the
    // separator itself (the "# contactId · date | View Details" row) is
    // the agent's only way to see which session this call belongs to or
    // reach the rest of the record header's own affordances, and `z-[3]`
    // buried it completely behind the video for as long as full screen was
    // active. Per this explicit follow-up ("don't cut off the session row,
    // but keep close/exit working"), the real fix is to stop the two from
    // occupying the same space at all rather than picking a winner: this
    // root goes back to no z-index (so the separator's own explicit `z-[1]`
    // wins on any residual overlap, same as before either bug), and the
    // "Live" indicator/button cluster/gradient scrim below are pushed down
    // to `top-14` (56px) — comfortably past the separator's own single-row
    // height (`compactHeader` keeps it single-row at every width) — so
    // there's no overlap left for a z-index to have to resolve either way.
    <div className="absolute inset-0 flex flex-col bg-lyra-bg-surface-inverse">
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 flex items-center justify-center">
          <Video className="h-16 w-16 text-lyra-fg-inverse opacity-50" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <span className="absolute left-3 top-14 flex items-center gap-1.5 lyra-body-sm text-lyra-fg-inverse">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-lyra-status-critical-strong" />
          Live
        </span>
        {/* "Exit full screen" + "Close" — see this component's own top doc
            comment for why these float directly over the video now
            instead of living in a separate header bar, and for why they
            start at `top-14` rather than flush with this box's own top
            edge. */}
        <div className="absolute right-3 top-14 flex items-center gap-1">
          <Tooltip content="Exit full screen" placement="bottom" asLabel>
            <button
              type="button"
              aria-label="Exit full screen"
              onClick={onExitFullScreen}
              className="flex h-8 w-8 items-center justify-center rounded-lyra-sm text-lyra-fg-inverse hover:bg-white/10 active:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus focus-visible:ring-offset-2"
            >
              <Minimize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Close" placement="bottom" asLabel>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lyra-sm text-lyra-fg-inverse hover:bg-white/10 active:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus focus-visible:ring-offset-2"
            >
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
        <span className="absolute left-3 bottom-3 lyra-body-sm text-lyra-fg-inverse opacity-80">
          {customerName}
        </span>
        {/* Agent's own self-view — the same small inset-corner PIP
            treatment the compact window used before it switched to
            stacking (see this file's own top doc comment); kept here since
            fullscreen is the one mode that still wants a single dominant
            feed rather than two equal ones. */}
        <div className="absolute right-3 bottom-3 flex h-24 w-40 items-center justify-center rounded-lyra-sm border border-lyra-border-inverse bg-lyra-bg-surface-inverse shadow-md">
          <Video className="h-6 w-6 text-lyra-fg-inverse opacity-50" strokeWidth={1.5} aria-hidden="true" />
          <span className="absolute left-2 bottom-1.5 lyra-body-xs text-lyra-fg-inverse opacity-80">
            You
          </span>
        </div>
      </div>
    </div>
  );
}
