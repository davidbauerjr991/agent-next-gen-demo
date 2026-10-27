// Home's greeting header (P0.5d.2), moved out of home-dashboard.tsx for
// P-HOME-1. oneColumn shows it as before; twoColumn makes it the welcome
// header in the record header's form (P-CANVAS: lyra `PageHeader`,
// compact, with its bottom border): the greeting, the user-name line (as
// oneColumn's; the counts are on the view buttons, P-HOME-1h) and the
// header's actions (P-HOME-1e, -1f).
import * as React from "react";
import { PageHeader } from "@nicecxone/lyra-ui";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_ID } from "@/components/agent-next-gen-shared-utils";
import { useSettings } from "@/settings";

export function HomeGreetingHeader({ actions, welcome }: { actions: React.ReactNode; welcome: boolean }) {
  const [home] = useSettings("home");
  const title = `${home.greeting.trim() || "Hello"}${home.showFirstName ? ` ${CURRENT_AGENT_FIRST_NAME}` : ""}`;
  const subtitle = `User Name: ${CURRENT_AGENT_ID}`;
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
