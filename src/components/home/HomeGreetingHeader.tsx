// Home's greeting header (P0.5d.2), moved out of home-dashboard.tsx for
// P-HOME-1. oneColumn shows it as before; twoColumn makes it the welcome
// header in the record header's form (P-CANVAS: lyra `PageHeader`,
// compact, with its bottom border): the greeting, the user-name line (as
// oneColumn's; the counts are on the view buttons, P-HOME-1h) and the
// header's actions (P-HOME-1e, -1f).
import * as React from "react";
import { WorkspacePageHeader } from "@/components/workspace/WorkspacePageHeader";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_ID } from "@/components/agent-next-gen-shared-utils";
import { homeIsTwoColumn } from "@/contact-handling/home/home-layout";
import { useSettings } from "@/settings";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { HOME_DASHBOARD_WIDTH_CLASS, homeHeaderCentred } from "./home-header-width";

/** Home's page header, above the Home tabs (P-HOME-1m: the header, then the tab row, then the dashboard, in one
 *  column and two). Settings → Home "Show header" hides it. One column: its old place's spacing, at the active tab's
 *  body width (`homeHeaderCentred`: centred like the dashboard on Dashboard, full width on an app or customer tab,
 *  P-LAYOUT-F2 3); two columns: the welcome header. (The right column's Cards toggle is in the feed's switcher row.) */
export function HomePageHeader({ actions, activeTab }: { actions: React.ReactNode; activeTab: string }) {
  const [home] = useSettings("home");
  const [{ parts }] = useSettings("layout");
  if (!home.showHeader) return null;
  const twoColumn = homeIsTwoColumn(home, parts);
  if (twoColumn) {
    return (
      <div className="shrink-0" data-home-header="">
        <HomeGreetingHeader welcome actions={actions} />
      </div>
    );
  }
  const centred = homeHeaderCentred(twoColumn, activeTab);
  return (
    <div className={cn("shrink-0 pt-6", centred && "px-6")} data-home-header="" data-home-header-width={centred ? "centred" : "full"}>
      <div className={cn(centred && "mx-auto w-full", centred && HOME_DASHBOARD_WIDTH_CLASS)}>
        <div className={cn(centred && "-mx-6")}>
          <HomeGreetingHeader actions={actions} welcome={false} />
        </div>
      </div>
    </div>
  );
}

function HomeGreetingHeader({ actions, welcome }: { actions: React.ReactNode; welcome: boolean }) {
  const [home] = useSettings("home");
  const title = `${home.greeting.trim() || "Hello"}${home.showFirstName ? ` ${CURRENT_AGENT_FIRST_NAME}` : ""}`;
  const subtitle = t("User Name: {id}", { id: CURRENT_AGENT_ID });
  if (!welcome) {
    return <WorkspacePageHeader title={title} subtitle={subtitle} bordered={false} titleSize="2xl" actions={actions} />;
  }
  // The record header's own bottom border (RecordHeader: compact, one line under the whole header). Presence is the
  // header's presence menu, not a button here (P-HOME-1f).
  return (
    <WorkspacePageHeader
      title={title}
      subtitle={subtitle}
      bordered={false}
      compact
      className="border-b border-lyra-border-subtle pb-3"
      data-home-page-header=""
      actions={<div className="flex items-center gap-2">{actions}</div>}
    />
  );
}
