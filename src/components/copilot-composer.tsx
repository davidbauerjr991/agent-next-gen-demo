import React, { useLayoutEffect, useRef, useState } from "react";
import { ActionIconButton, AIInput, Button, Tag } from "@nicecxone/lyra-ui";
import { RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** At most this many Copilot suggestion chips show at once. */
const COPILOT_CHIPS_MAX = 3;
/** The row's `gap-2`. */
const COPILOT_CHIPS_GAP_PX = 8;

const chipIcon = <Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />;

/**
 * Copilot suggestion chips on one line that never wraps: as many as fit
 * beside the refresh button (up to 3, at least 1), measured from the row's
 * own width with a ResizeObserver (not a breakpoint). The refresh button is
 * always there and rotates to the next suggestion(s). An invisible copy of
 * every chip gives their natural widths.
 */
function CopilotChipRow({
  suggestions,
  focusable,
  onActivate,
}: {
  suggestions: string[];
  focusable: boolean;
  onActivate: (suggestion: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(Math.min(COPILOT_CHIPS_MAX, suggestions.length));
  const n = suggestions.length;
  const start = n > 0 ? offset % n : 0;

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const available =
        row.getBoundingClientRect().width -
        (refreshRef.current?.getBoundingClientRect().width ?? 0) -
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
  }, [n, start, suggestions.join("\n")]);

  if (n === 0) return null;
  const visible = Array.from({ length: Math.min(count, n) }, (_, i) => suggestions[(start + i) % n]);

  return (
    <div ref={rowRef} data-slot="copilot-chips" className="relative flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden">
      {visible.map((suggestion) => (
        <Tag
          key={suggestion}
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
      ))}
      <div ref={refreshRef} data-slot="copilot-chips-refresh" className="shrink-0">
        <ActionIconButton
          size="xs"
          title="More suggestions"
          tabIndex={focusable ? 0 : -1}
          onClick={() => setOffset((o) => (o + Math.max(1, Math.min(count, n - 1))) % n)}
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
        </ActionIconButton>
      </div>
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
  onActivateSuggestion,
  takeover,
  focusable = true,
  paneRef,
  className,
  ...rest
}: {
  placement: "inline" | "panel";
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  suggestions: string[];
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

  const setRoot = (el: HTMLDivElement | null) => {
    rootRef.current = el;
    if (typeof paneRef === "function") paneRef(el);
    else if (paneRef) (paneRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  const layout = takeover && !wide ? "stacked" : "row";
  const chips =
    suggestions.length > 0 ? (
      <CopilotChipRow suggestions={suggestions} focusable={focusable} onActivate={onActivateSuggestion} />
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
        placeholder="Ask Copilot about this customer or conversation..."
        helperText=""
        className="w-full"
      />
      {layout === "row" ? (
        (chips || takeover) && (
          <div className="flex items-center justify-between gap-3">
            {chips ?? <span />}
            {takeoverButton(false)}
          </div>
        )
      ) : (
        <>
          {chips}
          {takeoverButton(true)}
        </>
      )}
      {/* The one-line row at its natural width, for the wide/narrow check above. */}
      {/* A zero-size clip so the copy never widens a scroll container. */}
      {takeover && (
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
      )}
    </div>
  );
}
