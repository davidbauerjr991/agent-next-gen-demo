// Contact Details' built-in tabs (P-CANVAS): each tab's one body, mounted by
// the docked panel and its record-header hover preview alike, plus the tab
// row both render from the registry (`src/contact-handling/contact-details-tabs.ts`).
import { Tab, TabList } from "@nicecxone/lyra-ui";
import { ChannelThreadBody } from "@/contact-handling/ChannelThreadPane";
import { LUCAS_THOMAS_ID } from "@/contact-handling/scenario-cases";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import type { ContactDetailsTab, ContactDetailsTabContext } from "@/contact-handling/contact-details-tabs";
import { contactDetailsTab, contactDetailsTabs } from "@/contact-handling/contact-details-tabs";
import { t } from "@/i18n";

const panelOnly = ({ aiInPanel }: ContactDetailsTabContext) => aiInPanel;
const withRecord = ({ realCustomer }: ContactDetailsTabContext) => realCustomer;

/** Panel mode's Overview: Customer Info and the AI feed (unchanged). */
function OverviewBody({ inPreview }: { inPreview: boolean }) {
  return <>{useWorkspace().renderContactDetailsTab("Overview", inPreview)}</>;
}

/** Customer Information, Notes and Detail: the customer record's own bodies
 *  (`useCustomerDetailsInteriorPanel`, its tab driven by this tab). */
function CustomerRecordBody() {
  return <>{useWorkspace().customerInfoOverlayContent.body}</>;
}

/** The thread read-only: its transcript (chat bubbles, or a call's
 *  utterances) without a composer, its AI rows (they're the feed's) or its
 *  current session row (the Session tab is that). The thread the Session tab
 *  follows; with a call beside a scripted chat (Lucas), the call. */
function TranscriptBody() {
  const { activeInteraction, activeChannel, panelVoiceThread, hideAiActions, scenarioKeyOf } = useWorkspace();
  const thread = panelVoiceThread ?? activeChannel;
  if (!activeInteraction || !thread) return null;
  return (
    <div data-slot="contact-details-transcript">
      <ChannelThreadBody
        interaction={activeInteraction}
        thread={thread}
        hideAiActions={hideAiActions}
        hideMockFollowUpMessages={scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID}
        withoutAiActions
        sessionRowInHeader
        onStatusChange={() => {}}
      />
    </div>
  );
}

function SessionBody({ inPreview }: { inPreview: boolean }) {
  return <>{useWorkspace().renderContactDetailsTab("Session", inPreview)}</>;
}

export const DEFAULT_CONTACT_DETAILS_TABS: readonly ContactDetailsTab[] = [
  { id: "Details", label: "Overview", order: 0, applies: panelOnly, Body: OverviewBody },
  { id: "Customer Information", label: "Customer Information", order: 10, applies: withRecord, Body: CustomerRecordBody },
  { id: "Notes", label: "Notes", order: 20, applies: withRecord, Body: CustomerRecordBody },
  { id: "Detail", label: "Detail", order: 30, Body: CustomerRecordBody },
  { id: "Transcript", label: "Transcript", order: 40, Body: TranscriptBody },
  { id: "Session Details", label: "Session", order: 50, Body: SessionBody },
];

/** The tab row, from the registry. */
export function ContactDetailsTabRow() {
  const { aiInPanel, activeInteractionIsRealCustomer, contactDetailsView, setCustomerPanelActiveTab } = useWorkspace();
  return (
    // "compact": collapse into "N More" only when the tabs don't fit (a narrow panel or preview), not below a fixed width.
    <TabList className="px-4" overflowMenu overflowBreakpoint="compact" data-slot="contact-details-tabs">
      {contactDetailsTabs({ aiInPanel, realCustomer: activeInteractionIsRealCustomer }).map((tab) => (
        <Tab key={tab.id} active={contactDetailsView === tab.id} onClick={() => setCustomerPanelActiveTab(tab.id)}>
          {t(tab.label)}
        </Tab>
      ))}
    </TabList>
  );
}

/** The selected tab's body (nothing for a sub-page: the panel renders those).
 *  In the hover preview an action in any tab's body (a button or link; not an
 *  expand toggle) hands off to the docked panel: the action runs, then the
 *  preview closes and Contact Details opens (k5 G). After the click (k6 6):
 *  closing it in the capture phase unmounts the target before its own onClick
 *  in a real browser. */
export function ContactDetailsTabBody({ inPreview = false }: { inPreview?: boolean }) {
  const { contactDetailsView, showContactDetails } = useWorkspace();
  const tab = contactDetailsTab(contactDetailsView as never);
  if (!tab) return null;
  const { Body } = tab;
  if (!inPreview) return <Body inPreview={false} />;
  return (
    <div
      className="contents"
      onClickCapture={(e) => {
        const action = (e.target as Element).closest("button, a, [role=button], [role=link]");
        if (action && !action.hasAttribute("aria-expanded")) window.setTimeout(showContactDetails);
      }}
    >
      <Body inPreview />
    </div>
  );
}
