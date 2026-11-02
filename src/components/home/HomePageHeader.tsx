// Home's page header (P-LAYOUT-F3 2): the same lyra PageHeader every page uses (`WorkspacePageHeader`), in one form
// under every Home layout — the greeting as its title, the user name as its subtitle, the queue chip in its actions,
// and Home's tabs (Dashboard, the apps placed as tabs, the customer tabs) as its tabs row (lyra F3-L1). It always
// spans the page's full width; only the body's width is a setting (`home.contentWidth`). Reverses P-LAYOUT-F2 4
// (`2e49620`, the header following the tab's width) and P-LAYOUT-F1 8 (`ce1f660`, C).
import * as React from "react";
import { WorkspacePageHeader } from "@/components/workspace/WorkspacePageHeader";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_ID } from "@/components/agent-next-gen-shared-utils";
import { useSettings } from "@/settings";
import { t } from "@/i18n";

/** `tabs`: Home's TabList, when any app is placed as a tab. With Settings → Home "Show header" off, the tabs still
 *  show on their own, so the views stay reachable. */
export function HomePageHeader({ actions, tabs }: { actions: React.ReactNode; tabs?: React.ReactNode }) {
  const [home] = useSettings("home");
  if (!home.showHeader) {
    return tabs ? (
      <div className="shrink-0 bg-lyra-bg-surface-base" data-home-tabs-row="">
        {tabs}
      </div>
    ) : null;
  }
  const title = `${home.greeting.trim() || "Hello"}${home.showFirstName ? ` ${CURRENT_AGENT_FIRST_NAME}` : ""}`;
  return (
    <div className="shrink-0 bg-lyra-bg-surface-base" data-home-header="">
      <WorkspacePageHeader
        title={title}
        subtitle={t("User Name: {id}", { id: CURRENT_AGENT_ID })}
        actions={actions}
        tabs={tabs}
        data-home-page-header=""
      />
    </div>
  );
}
