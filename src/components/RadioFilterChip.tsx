// A filter chip whose popover is one radio list (P-HOME-1h, out of
// agent-next-gen-contact-history.tsx): the date chips — Contact History's,
// Home's Assignments range. The trigger reads "{label}: {selected}", with
// the compact kebab below 480px of the header's width.
import { useState } from "react";
import { Button, Popover, RadioGroup, RadioGroupItem, Tooltip, filterChipVariants } from "@nicecxone/lyra-ui";
import { ChevronDown, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

export function RadioFilterChip<T extends string>({
  label,
  options,
  value,
  onValueChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onValueChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const description = t("{label} filter: {value}", { label, value: selectedLabel });

  return (
    // The Tooltip wraps the Popover from outside (CONTRIBUTING.md §16), as `DateFilterChip` does.
    <Tooltip content={description} placement="bottom" disabled={open}>
      <span className="inline-flex">
        <Popover
          open={open}
          onOpenChange={setOpen}
          placement="bottom"
          content={
            <div className="flex flex-col gap-3 p-3 w-[260px]">
              <RadioGroup value={value} onValueChange={(v) => onValueChange(v as T)}>
                {options.map((option) => (
                  <RadioGroupItem key={option.value} value={option.value} label={option.label} />
                ))}
              </RadioGroup>
            </div>
          }
        >
          <Button
            variant="ghost"
            aria-label={open ? t("Close {label} filter", { label: label.toLowerCase() }) : description}
            className={cn(filterChipVariants({ variant: "default" }), "rounded-lyra-md lyra-container-header-filter-trigger")}
          >
            {/* The full label, hidden below 480px of the header's width (lyra-tokens.css's "Filter chip icon
                collapse") in favor of the compact kebab, both on this trigger. */}
            <span className="lyra-container-header-filter-full inline-flex items-baseline gap-1">
              <span className="lyra-body-md-emphasis whitespace-nowrap">{label}:</span>
              <span className="lyra-body-md truncate">{selectedLabel}</span>
            </span>
            <ChevronDown className={cn("lyra-container-header-filter-full h-3.5 w-3.5 flex-shrink-0 transition-transform", open && "rotate-180")} strokeWidth={1.5} aria-hidden="true" />
            <MoreVertical className="lyra-container-header-filter-compact h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </Popover>
      </span>
    </Tooltip>
  );
}
