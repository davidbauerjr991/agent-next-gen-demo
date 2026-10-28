// Contact Details' header control (P-HOME-1m, out of RecordHeader): the
// IdCard button that toggles the docked Contact Details panel, with its hover
// preview (the panel's own tab row and bodies). The conversation's record
// header and a kind cell's header both render it, for the controller's
// Contact Details subject (`contactSubject`: the conversation, or the
// schedule item's customer). The preview shows only while Contact Details
// isn't the panel's content (`openCustomerInfoPreview`); the wrapping div's
// hover handlers open and close it, so the pointer can cross into the
// portaled popover without it flickering shut.
import { Button, Link, PanelHeader, Popover, Tooltip } from "@nicecxone/lyra-ui";
import { IdCard } from "lucide-react";
import { HOVER_PREVIEW_POPOVER_CLASS, HoverPreviewFrame, panelToggleClass } from "@/contact-handling";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { ContactDetailsTabBody, ContactDetailsTabRow } from "./contact-details-tab-bodies";

/** `compact`: icon only (the record header under 768px). */
export function ContactDetailsControl({ compact = false }: { compact?: boolean }) {
  const {
    activeInteractionIsRealCustomer, aiInPanel, contactDetailsShowing, contactDetailsView, contactSubject, copilotHost, copilotSlot,
    customerInfoPreviewOpen, focusCustomerPanelTab, openCustomerInfoPreview, scheduleCloseCustomerInfoPreview, selectPanel,
    setHoverDockMounted, sidePanelToggleLabel,
  } = useWorkspace();
  if (!contactSubject) return null;
  const name = contactSubject.customerName;
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
            {/* AI display "panel": the Copilot composer docks here while the preview is open, as in the docked
                panel's footer (one on screen). A kind cell keeps its own Copilot input: no thread, no dock. */}
            {aiInPanel && contactSubject.hasThread && contactDetailsView === "Details" && (
              <div className="relative shrink-0 px-4 pb-3 pt-2">
                <div data-slot="copilot-dock" className="w-full">
                  <HostSlot host={copilotHost} active={copilotSlot === "hover-footer"} onMountedChange={setHoverDockMounted} />
                </div>
              </div>
            )}
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
