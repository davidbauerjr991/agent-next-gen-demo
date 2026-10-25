// Home's greeting header (P0.5d.2), moved out of home-dashboard.tsx for
// P-HOME-1. oneColumn shows it as before; twoColumn makes it the welcome
// header: the day's counts under the greeting and Go Available beside it.
import * as React from "react";
import { Button, PageHeader } from "@nicecxone/lyra-ui";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_ID } from "@/components/agent-next-gen-shared-utils";
import { useActivityFeed } from "@/contact-handling/home/useActivityFeed";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useSettings } from "@/settings";
import { t } from "@/i18n";

/** The day's counts, as the welcome line reads them (they follow the chips, as the feed does). */
function WelcomeCounts() {
  const { feed } = useActivityFeed();
  const c = feed.counts;
  return (
    <span data-welcome-counts>
      {t("{decide} to decide · {now} now · {today} more today · {week} this week · {history} in history", {
        decide: feed.showAssignments ? c.needsDecision : 0,
        now: feed.showAssignments ? c.now : 0,
        today: feed.showAssignments ? c.today : 0,
        week: feed.showAssignments ? c.thisWeek : 0,
        history: c.history,
      })}
    </span>
  );
}

export function HomeGreetingHeader({ actions, welcome }: { actions: React.ReactNode; welcome: boolean }) {
  const [home] = useSettings("home");
  const { agentStatus, handleStatusChange } = useWorkspace();
  const title = `${home.greeting.trim() || "Hello"}${home.showFirstName ? ` ${CURRENT_AGENT_FIRST_NAME}` : ""}`;
  return (
    <PageHeader
      title={title}
      subtitle={welcome ? <WelcomeCounts /> : `User Name: ${CURRENT_AGENT_ID}`}
      bordered={false}
      titleSize="2xl"
      actions={
        welcome && agentStatus !== "available" ? (
          <div className="flex items-center gap-2">
            <Button variant="success" size="md" onClick={() => handleStatusChange("available")}>
              {t("Go Available")}
            </Button>
            {actions}
          </div>
        ) : (
          actions
        )
      }
    />
  );
}
