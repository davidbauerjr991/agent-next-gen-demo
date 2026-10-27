import React, { useLayoutEffect, useRef, useState } from "react";
import { ActionIconButton, AIInput, Button, Tag } from "@nicecxone/lyra-ui";
import { RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** At most this many Copilot suggestion chips show at once. */
const COPILOT_CHIPS_MAX = 3;
/** The row's `gap-2`. */
const COPILOT_CHIPS_GAP_PX = 8;

const chipIcon = <Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />;
/** AIInput's default `maxRows`. */
const AI_INPUT_MAX_ROWS = 6;

/** AIInput's own auto-size (ai-input.tsx `resize`): its rows up to `maxRows`, padding included. */
function fitTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  const cs = getComputedStyle(el);
  const lineHeight = parseFloat(cs.lineHeight) || 20;
  const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const maxHeight = lineHeight * AI_INPUT_MAX_ROWS + padding;
  el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
}

/**
 * Copilot suggestion chips on one line: as many as fit
 * beside the refresh button (up to 3, at least 1; the row wraps rather than
 * clipping when even that doesn't fit, as in the 308px panel), measured from the row's
 * own width with a ResizeObserver (not a breakpoint). The refresh button is
 * always there and rotates to the next suggestion(s). An invisible copy of
 * every chip gives their natural widths.
 */
function CopilotChipRow({
  suggestions,
  pinned,
  focusable,
  onActivate,
}: {
  suggestions: string[];
  /** A chip that always shows, after the rotating ones (P-CANVAS: "What should I do next?"). */
  pinned?: string;
  focusable: boolean;
  onActivate: (suggestion: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(Math.min(COPILOT_CHIPS_MAX, suggestions.length));
  const n = suggestions.length;
  const start = n > 0 ? offset % n : 0;

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const pinnedWidth = pinnedRef.current ? pinnedRef.current.getBoundingClientRect().width + COPILOT_CHIPS_GAP_PX : 0;
      const available =
        row.getBoundingClientRect().width -
        (refreshRef.current?.getBoundingClientRect().width ?? 0) -
        pinnedWidth -
        COPILOT_CHIPS_GAP_PX;
      const widths = [...(measureRef.current?.children ?? [])].map((el) => el.getBoundingClientRect().width);
      let used = 0;
      let fit = 0;
      for (let i = 0; i < Math.min(COPILOT_CHIPS_MAX, n); i += 1) {
        const w = widths[(start + i) % n] ?? 0;
        const next = used + (fit > 0 ? COPILOT_CHIPS_GAP_PX : 0) + w;
        if (next > available) break;
        used = next;
        fit += 1;
      }
      setCount(Math.max(1, fit));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
    // Keyed on the suggestions' text, not the array (a new one each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, start, suggestions.join("\n"), pinned]);

  if (n === 0 && !pinned) return null;
  const visible = n > 0 ? Array.from({ length: Math.min(count, n) }, (_, i) => suggestions[(start + i) % n]) : [];
  const chip = (suggestion: string, extra?: { ref?: React.Ref<HTMLSpanElement>; slot?: string }) => (
    <Tag
      key={suggestion}
      ref={extra?.ref}
      data-slot={extra?.slot}
      label={suggestion}
      variant="purple"
      icon={chipIcon}
      shape="pill"
      role="button"
      tabIndex={focusable ? 0 : -1}
      className="shrink-0 cursor-pointer"
      onClick={() => onActivate(suggestion)}
      onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(suggestion);
        }
      }}
    />
  );

  return (
    <div ref={rowRef} data-slot="copilot-chips" className="relative flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {visible.map((suggestion) => chip(suggestion))}
      {pinned && chip(pinned, { ref: pinnedRef, slot: "copilot-chip-pinned" })}
      {n > 0 && <div ref={refreshRef} data-slot="copilot-chips-refresh" className="shrink-0">
        <ActionIconButton
          size="xs"
          title="More suggestions"
          tabIndex={focusable ? 0 : -1}
          onClick={() => setOffset((o) => (o + Math.max(1, Math.min(count, n - 1))) % n)}
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
        </ActionIconButton>
      </div>}
      {/* Natural widths of every chip, for the fit above. */}
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex gap-2 whitespace-nowrap">
        {suggestions.map((suggestion) => (
          <Tag key={suggestion} label={suggestion} variant="purple" icon={chipIcon} shape="pill" data-chip-measure="" className="shrink-0" />
        ))}
      </div>
    </div>
  );
}

export interface CopilotTakeover {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * The Ask Copilot composer, one component inline (the main column) and
 * docked (the Contact Details footer): the input, then the chips.
 * - Wide: below the input, one row with the chips + refresh on the left and
 *   Takeover on the right.
 * - Narrow: the chips row (as many as fit, at least one + refresh), then
 *   Takeover full width.
 * Wide means the full chips row (up to 3 chips, refresh) and Takeover fit on
 * one line: measured from the composer's own width with a ResizeObserver
 * against an invisible copy of that row, not a breakpoint.
 */
export function CopilotComposer({
  placement,
  value,
  onChange,
  onSubmit,
  suggestions,
  pinnedSuggestion,
  onActivateSuggestion,
  takeover,
  focusable = true,
  paneRef,
  className,
  placeholder = "Ask Copilot about this customer or conversation...",
  ...rest
}: {
  placement: "inline" | "panel";
  /** The input's placeholder; a kind cell names its kind (P-HOME-1h). */
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  suggestions: string[];
  /** A chip that always shows after the rotating ones. */
  pinnedSuggestion?: string;
  onActivateSuggestion: (suggestion: string) => void;
  takeover?: CopilotTakeover;
  /** Off while the inline pane is hidden behind the chat input. */
  focusable?: boolean;
  paneRef?: React.Ref<HTMLDivElement>;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "onSubmit">) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  const chipsForMeasure = suggestions.slice(0, COPILOT_CHIPS_MAX);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !takeover) return;
    const measure = () => {
      const needed = measureRef.current?.getBoundingClientRect().width ?? 0;
      setWide(needed <= root.getBoundingClientRect().width);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!takeover, takeover?.label, chipsForMeasure.join("\n")]);

  // Both of the inline composer's panes stay mounted (InteractionComposer); lyra's AIInput sizes its textarea from
  // `scrollHeight`, which reads 0 while this pane is hidden, so the textarea came back collapsed (the placeholder low
  // and clipped in the pill). Each time the pane becomes visible, measure it again with AIInput's own metrics.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let shown = false;
    const ro = new ResizeObserver(() => {
      const visible = root.getClientRects().length > 0;
      if (visible && !shown) fitTextarea(root.querySelector("textarea"));
      shown = visible;
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const setRoot = (el: HTMLDivElement | null) => {
    rootRef.current = el;
    if (typeof paneRef === "function") paneRef(el);
    else if (paneRef) (paneRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  const layout = takeover && !wide ? "stacked" : "row";
  const chips =
    suggestions.length > 0 || pinnedSuggestion ? (
      <CopilotChipRow suggestions={suggestions} pinned={pinnedSuggestion} focusable={focusable} onActivate={onActivateSuggestion} />
    ) : null;
  const takeoverButton = (stacked: boolean) =>
    takeover && (
      <Button
        data-slot="copilot-takeover"
        variant="destructive"
        size="md"
        className={stacked ? "w-full" : "shrink-0"}
        onClick={takeover.onClick}
        disabled={takeover.disabled}
        title={takeover.disabled ? takeover.disabledReason : undefined}
        tabIndex={focusable ? 0 : -1}
      >
        {takeover.label}
      </Button>
    );

  // The one-line row (chips + refresh + Takeover) at its natural width, for the wide/narrow check above. A
  // zero-size clip so the copy never widens a scroll container; positioned against the composer root.
  const rowMeasure = takeover && (
    <div aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
      <div ref={measureRef} data-slot="copilot-row-measure" className="flex w-max gap-3 whitespace-nowrap">
        <div className="flex gap-2">
          {chipsForMeasure.map((s) => (
            <Tag key={s} label={s} variant="purple" icon={chipIcon} shape="pill" className="shrink-0" />
          ))}
          <ActionIconButton size="xs" title="" tabIndex={-1}>
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
          </ActionIconButton>
        </div>
        <Button variant="destructive" size="md" tabIndex={-1}>
          {takeover.label}
        </Button>
      </div>
    </div>
  );

  return (
    <div
      ref={setRoot}
      data-slot="copilot-composer"
      data-placement={placement}
      data-layout={layout}
      // `min-w-0`: inline it's a grid item, whose `auto` minimum (its
      // min-content, the one-line chips row) would push it past the column.
      className={cn("relative flex w-full min-w-0 flex-col gap-3", className)}
      {...rest}
    >
      <AIInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={placeholder}
        helperText=""
        // lyra's single-line pill (+ left, mic right), as v3: every dock this composer portals into.
        singleLine
        rounded
        className="w-full"
      />
      {/* The rows under the input, only when there's something in them, so the composer ends at its last visible
          row (P-CANVAS browser pass). The invisible measuring copy rides at the end of that element: after the real
          Takeover in the DOM, and absolutely positioned (no space, no gap). */}
      {(chips || takeover) && (
        <div className={layout === "row" ? "flex items-center justify-between gap-3" : "flex flex-col gap-3"}>
          {layout === "row" ? (chips ?? <span />) : chips}
          {takeoverButton(layout === "stacked")}
          {rowMeasure}
        </div>
      )}
    </div>
  );
}
