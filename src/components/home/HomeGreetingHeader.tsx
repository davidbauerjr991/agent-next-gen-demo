// Home's greeting header (P0.5d.2), moved out of home-dashboard.tsx for
// P-HOME-1. oneColumn shows it as before; twoColumn makes it the welcome
// header in the record header's form (P-CANVAS: lyra `PageHeader`,
// compact, with its bottom border): the greeting, the user-name line (as
// oneColumn's; the counts are on the view buttons, P-HOME-1h) and the
// header's actions (P-HOME-1e, -1f).
import * as React from "react";
import { PageHeader } from "@nicecxone/lyra-ui";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_ID } from "@/components/agent-next-gen-shared-utils";
import { homeIsTwoColumn, homeSideSections } from "@/contact-handling/home/home-layout";
import { useSettings } from "@/settings";
import { t } from "@/i18n";
import { HomeCardsToggle } from "./HomeTwoColumn";

/** Home's page header, above the Home tabs (P-HOME-1m: the header, then the tab row, then the dashboard, in one
 *  column and two). Settings → Home "Show header" hides it. One column: its old place's spacing, centred like the
 *  dashboard; two columns: the welcome header, with the right column's Cards toggle when that column has cards and
 *  Dashboard is the tab showing (`dashboard`: the other tabs have no right column). */
export function HomePageHeader({ actions, dashboard }: { actions: React.ReactNode; dashboard: boolean }) {
  const [home] = useSettings("home");
  if (!home.showHeader) return null;
  if (homeIsTwoColumn(home)) {
    return (
      <div className="shrink-0" data-home-header="">
        <HomeGreetingHeader
          welcome
          actions={
            <>
              {actions}
              {dashboard && homeSideSections(home).length > 0 && <HomeCardsToggle />}
            </>
          }
        />
      </div>
    );
  }
  return (
    <div className="shrink-0 px-6 pt-6" data-home-header="">
      <div className="mx-auto w-full max-w-[1024px]">
        <div className="-mx-6">
          <HomeGreetingHeader actions={actions} welcome={false} />
        </div>
      </div>
    </div>
  );
}

export function HomeGreetingHeader({ actions, welcome }: { actions: React.ReactNode; welcome: boolean }) {
  const [home] = useSettings("home");
  const title = `${home.greeting.trim() || "Hello"}${home.showFirstName ? ` ${CURRENT_AGENT_FIRST_NAME}` : ""}`;
  const subtitle = t("User Name: {id}", { id: CURRENT_AGENT_ID });
  if (!welcome) {
    return <PageHeader title={title} subtitle={subtitle} bordered={false} titleSize="2xl" actions={actions} />;
  }
  // The record header's own bottom border (RecordHeader: compact, one line under the whole header). Presence is the
  // header's presence menu, not a button here (P-HOME-1f).
  return (
    <PageHeader
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
