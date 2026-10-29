// Contact Details' header control (P-HOME-1m, out of RecordHeader): the
// IdCard button that toggles Contact Details — since P-HOME-1n the reference
// slide-over, not the docked panel — with its hover preview (the same tab row
// and bodies). The conversation's record header and a kind cell's header both
// render it, for the controller's Contact Details subject (`contactSubject`:
// the conversation, or the schedule item's customer). The preview shows only
// while Contact Details isn't open (`openCustomerInfoPreview`); the wrapping
// div's hover handlers open and close it, so the pointer can cross into the
// portaled popover without it flickering shut.
import { Button, Link, PanelHeader, Popover, Tooltip } from "@nicecxone/lyra-ui";
import { IdCard } from "lucide-react";
import { HOVER_PREVIEW_POPOVER_CLASS, HoverPreviewFrame, panelToggleClass } from "@/contact-handling";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { ContactDetailsTabBody, ContactDetailsTabRow } from "./contact-details-tab-bodies";

/** `compact`: icon only (the record header under 768px). */
export function ContactDetailsControl({ compact = false }: { compact?: boolean }) {
  const {
    activeInteractionIsRealCustomer, contactDetails, contactDetailsShowing, contactSubject,
    customerInfoPreviewOpen, focusCustomerPanelTab, openCustomerInfoPreview, scheduleCloseCustomerInfoPreview, selectPanel,
    sidePanelToggleLabel,
  } = useWorkspace();
  if (!contactSubject || !contactDetails) return null;
  // The one view-model (`contactDetailsFor`): the slide-over's header reads the same name.
  const name = contactDetails.name;
  return (
    <div onMouseEnter={openCustomerInfoPreview} onMouseLeave={scheduleCloseCustomerInfoPreview}>
      <Popover
        open={customerInfoPreviewOpen}
        placement="bottom"
        align="end"
        showArrow={false}
        bodyPadding={false}
        className={HOVER_PREVIEW_POPOVER_CLASS}
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
        onInteractOutside={(e: Event) => {
          if ((e.target as Element)?.closest?.("[data-radix-popper-content-wrapper], [data-floating-layer]")) {
            e.preventDefault();
          }
        }}
        content={
          <HoverPreviewFrame
            onMouseEnter={openCustomerInfoPreview}
            onMouseLeave={scheduleCloseCustomerInfoPreview}
            header={
              <PanelHeader
                title={t("Contact Details")}
                // The customer's name opens the docked panel's Customer Info drill-in, as its own header's does
                // (`focusCustomerPanelTab` closes this preview).
                subhead={
                  activeInteractionIsRealCustomer && name ? (
                    <Tooltip content={t("View Customer Info")} placement="bottom">
                      <Link onClick={focusCustomerPanelTab} className="lyra-body-sm">
                        {name}
                      </Link>
                    </Tooltip>
                  ) : (
                    name
                  )
                }
                tabs={<ContactDetailsTabRow />}
              />
            }
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* The docked panel's own tab bodies, from the registry (P-CANVAS). */}
              <ContactDetailsTabBody inPreview />
            </div>
          </HoverPreviewFrame>
        }
      >
        {/* `IdCard` + "Contact Details" (icon-only when compact); selected while the panel shows Contact Details. */}
        <Button
          variant="outline"
          size="md"
          className={cn(
            "shrink-0 animate-in fade-in-0 duration-200",
            compact && "w-8 gap-0 px-0",
            panelToggleClass({ active: contactDetailsShowing, previewOpen: customerInfoPreviewOpen }),
          )}
          data-contact-details=""
          data-preview-open={(customerInfoPreviewOpen && !contactDetailsShowing) || undefined}
          aria-pressed={contactDetailsShowing}
          onClick={() => selectPanel({ kind: "details" })}
          aria-label={contactDetailsShowing ? t("Close Contact Details") : sidePanelToggleLabel ?? t("Open Contact Details")}
        >
          <IdCard className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          {!compact && <span>{t("Contact Details")}</span>}
        </Button>
      </Popover>
    </div>
  );
}
