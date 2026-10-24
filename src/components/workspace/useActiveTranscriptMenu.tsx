import type { MenuEntry } from "@nicecxone/lyra-ui";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import { LUCAS_THOMAS_ID } from "@/contact-handling/scenario-cases";
import { useTranscriptMenu } from "@/contact-handling/useTranscriptMenu";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";

/** The transcript menu for a thread of a card: the customer's email from the card's contact methods, and the
 *  "emailed" toast. */
export function useActiveTranscriptMenu(interaction: Interaction | undefined, thread: Thread | undefined): MenuEntry[] | undefined {
  const { addToast, cardContactMethodsOf, scenarioKeyOf } = useWorkspace();
  return useTranscriptMenu({
    interaction,
    thread,
    emailAddress: interaction ? cardContactMethodsOf(interaction).methods.emails[0] : undefined,
    hideMockFollowUpMessages: !!interaction && scenarioKeyOf(interaction.id) === LUCAS_THOMAS_ID,
    onEmailed: (address) => addToast({ variant: "success", title: t("Transcript emailed to {address}", { address }), duration: 4000 }),
  });
}
