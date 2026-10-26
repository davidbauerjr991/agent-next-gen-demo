// Home's greeting header (P0.5d.2), moved out of home-dashboard.tsx for
// P-HOME-1. oneColumn shows it as before; twoColumn makes it the welcome
// header in the record header's form (P-CANVAS: lyra `PageHeader`,
// unbordered, compact): the greeting, the day's counts as the subtitle line,
// and Go Available beside the header's actions (P-HOME-1e).
import * as React from "react";
import { Button, PageHeader } from "@nicecxone/lyra-ui";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_ID } from "@/components/agent-next-gen-shared-utils";
import { useActivityFeed } from "@/contact-handling/home/useActivityFeed";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useSettings } from "@/settings";
import { t } from "@/i18n";

/** The day's counts, whichever view the feed shows. */
function WelcomeCounts() {
  const c = useActivityFeed().feed.counts;
  return (
    <span data-welcome-counts>
      {t("{decide} to decide · {now} now · {today} more today · {week} this week · {history} in history", {
        decide: c.needsDecision,
        now: c.now,
        today: c.today,
        week: c.thisWeek,
        history: c.history,
      })}
    </span>
  );
}

export function HomeGreetingHeader({ actions, welcome }: { actions: React.ReactNode; welcome: boolean }) {
  const [home] = useSettings("home");
  const { agentStatus, handleStatusChange } = useWorkspace();
  const title = `${home.greeting.trim() || "Hello"}${home.showFirstName ? ` ${CURRENT_AGENT_FIRST_NAME}` : ""}`;
  if (!welcome) {
    return <PageHeader title={title} subtitle={`User Name: ${CURRENT_AGENT_ID}`} bordered={false} titleSize="2xl" actions={actions} />;
  }
  return (
    <PageHeader
      title={title}
      subtitle={<WelcomeCounts />}
      bordered={false}
      compact
      className="pb-3"
      data-home-page-header=""
      actions={
        <div className="flex items-center gap-2">
          {agentStatus !== "available" && (
            <Button variant="success" size="md" onClick={() => handleStatusChange("available")}>
              {t("Go Available")}
            </Button>
          )}
          {actions}
        </div>
      }
    />
  );
}
