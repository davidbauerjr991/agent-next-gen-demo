// Settings page (P-SETTINGS). Every control reads and writes the settings
// store through hooks and applies immediately; there's no save button.
// Settings with no target in the workspace yet stay toggleable (they count
// toward the profile) and carry a tag saying which step brings them.
// Grouped (P-HOME-1n) into Workspace, Layout (P-LAYOUT), Assignments, Home,
// Notifications, Appearance, Channels, Voice, Phone and Connections, one file
// each under `sections/`; the grouping is presentation only (no store section
// moves).
import * as React from "react";
import { Button, Modal, PageHeader, WarningIcon } from "@nicecxone/lyra-ui";
import { useResetSettings } from "@/settings";
import { WorkspaceSection } from "./sections/WorkspaceSection";
import { LayoutSection } from "./sections/LayoutSection";
import { AssignmentsSection } from "./sections/AssignmentsSection";
import { HomeSection } from "./sections/HomeSection";
import { NotificationsSection } from "./sections/NotificationsSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { ChannelsSection } from "./sections/ChannelsSection";
import { PhoneSection, VoiceSection } from "./sections/VoicePhoneSections";
import { ConnectionsSection } from "./sections/ConnectionsSection";

export function SettingsView({ showPageHeader = true }: { showPageHeader?: boolean }) {
  const resetSettings = useResetSettings();
  const [resetOpen, setResetOpen] = React.useState(false);

  return (
    <>
      {showPageHeader && (
        <PageHeader
          title="Settings"
          // In the header's action slot, reachable without scrolling; opens
          // the confirm dialog below.
          actions={
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              Reset to defaults
            </Button>
          }
        />
      )}
      <div className="flex-1 overflow-y-auto p-6" data-testid="settings-view">
        <WorkspaceSection first />
        <LayoutSection />
        <AssignmentsSection />
        <HomeSection />
        <NotificationsSection />
        <AppearanceSection />
        <ChannelsSection />
        <VoiceSection />
        <PhoneSection />
        <ConnectionsSection />

        {/* lyra `Modal` as an alert dialog — same shape as its "Alert Dialog
            (Destructive)" story (Modal.variants.stories.tsx): header title +
            warning icon, footer buttons through `footerActions` (lyra's
            `ContainerFooter` spaces them), focus starting on Cancel
            (`data-modal-cancel`). The body wrapper and the 360px width are
            the story's own (`ToneContent`, `widths.sm`): `Modal` has no body
            slot of its own. */}
        <Modal
          open={resetOpen}
          onClose={() => setResetOpen(false)}
          closeOnBackdropClick
          alert
          description="Every setting on this page goes back to its default."
          headerTitle="Reset to defaults?"
          headerIcon={<WarningIcon className="h-5 w-5" />}
          footerActions={
            <>
              <Button variant="outline" data-modal-cancel onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  resetSettings();
                  setResetOpen(false);
                }}
              >
                Reset
              </Button>
            </>
          }
          className="w-[360px]"
        >
          <div className="flex flex-col gap-2 px-5 pb-2">
            <p className="lyra-body-md text-lyra-fg-default">
              Every setting on this page goes back to its default (Phase 1), and any profile locks are lifted. Your
              saved profiles are kept. This can't be undone.
            </p>
          </div>
        </Modal>
      </div>
    </>
  );
}
