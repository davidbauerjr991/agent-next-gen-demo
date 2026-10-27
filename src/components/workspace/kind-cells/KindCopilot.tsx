// Ask Copilot on a kind cell (P-HOME-1f; inline rows P-HOME-1h): as on a
// conversation, each ask is logged in the action area as the transcript's
// instruction row ("AI agent is performing this now…", then the clickable
// row: the question, the time, who asked) with its result card under it, in
// ask order; the result opens in the slide-over once Copilot "finishes", and
// the row reopens it. The item's Real-Time Summary lists each ask as a linked
// line (kind-canvas-cells.tsx). Answers are scoped to the item
// (src/scenarios/schedule-copilot.ts).
import { useEffect, useState, type ReactNode } from "react";
import { AgenticAICard, AgenticSection } from "@nicecxone/lyra-ui";
import { Sparkles } from "lucide-react";
import { CURRENT_AGENT_NAME } from "@/components/agent-next-gen-shared-utils";
import { aiCardIcon as ic, timeLabel } from "@/components/ai-cards/ai-card-icon";
import { CopilotComposer } from "@/components/copilot-composer";
import { InstructionInterstitial } from "@/components/transcript/ai-rows/InstructionInterstitial";
import { AI_PERFORM_MS } from "@/contact-handling/ai-perform";
import { useCopilotResultTimer } from "@/contact-handling/useCopilotAsk";
import { useWorkspaceUiField, type KindCopilotAsk } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import type { DetailPanelContent } from "@/contact-handling/workspace/workspace-types";
import type { ScheduleItem } from "@/providers";
import { scheduleCopilotAnswer, scheduleCopilotFor } from "@/scenarios/schedule-copilot";
import { t } from "@/i18n";

/** The input's placeholder: what the item is, by kind. */
function placeholderFor(item: ScheduleItem): string {
  if (item.kind === "training") return t("Ask Copilot about this module…");
  if (item.kind === "meeting") return t("Ask Copilot about this meeting…");
  if (item.kind === "task") return t("Ask Copilot about this ticket…");
  if (item.kind === "callback") return t("Ask Copilot about this callback…");
  return t("Ask Copilot about this assignment…");
}

/** An ask's result, as the slide-over shows it. */
export const askResult = (ask: KindCopilotAsk): DetailPanelContent => ({ kind: "copilot-result", text: ask.text, time: ask.time, link: ask.link, answer: ask.answer });

/** Opens an ask's result in the slide-over, or closes it when it's the one showing (the row's and the summary line's
 *  toggle, as on a conversation). */
export function useToggleAskResult(): { isOpen: (ask: KindCopilotAsk) => boolean; toggle: (ask: KindCopilotAsk) => void } {
  const { openDetailPanelContent, selectedDetailPanelContent, setSelectedDetailPanelContent } = useWorkspace();
  const isOpen = (ask: KindCopilotAsk) => selectedDetailPanelContent?.kind === "copilot-result" && selectedDetailPanelContent.link === ask.link;
  return { isOpen, toggle: (ask) => (isOpen(ask) ? setSelectedDetailPanelContent(null) : openDetailPanelContent(askResult(ask))) };
}

/** The item's asks, in ask order. */
export function useKindCopilotAsks(itemId: string | undefined): readonly KindCopilotAsk[] {
  const [asks] = useWorkspaceUiField("kindCopilotAsks");
  return (itemId && asks[itemId]) || [];
}

/** Its children once `at` has passed (re-renders itself then, as the instruction row does). */
function AfterPerformed({ at, children }: { at: number; children: ReactNode }) {
  const [, rerender] = useState(0);
  const pending = Date.now() < at;
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => rerender((n) => n + 1), Math.max(0, at - Date.now()));
    return () => window.clearTimeout(timer);
  }, [pending, at]);
  return pending ? null : <>{children}</>;
}

/** The asks as rows in the action area, each with its result card once performed. */
export function KindCopilotRows({ item }: { item: ScheduleItem }) {
  const asks = useKindCopilotAsks(item.id);
  const { isOpen, toggle } = useToggleAskResult();
  if (asks.length === 0) return null;
  return (
    <div className="flex flex-col gap-4" data-kind-copilot-rows="">
      {asks.map((ask) => (
        <div key={ask.id} className="flex flex-col gap-2" data-kind-copilot-ask={ask.id}>
          <InstructionInterstitial
            id={ask.id}
            instruction={{ title: ask.text, by: CURRENT_AGENT_NAME, link: ask.link, performedAt: ask.askedAt + AI_PERFORM_MS }}
            timestamp={ask.time}
            active={isOpen(ask)}
            onOpen={() => toggle(ask)}
          />
          <AfterPerformed at={ask.askedAt + AI_PERFORM_MS}>
            <AgenticAICard title={t("Copilot result")} icon={ic(Sparkles)} status="done" subhead={ask.text} data-kind-copilot-result="">
              <AgenticSection>
                <p className="lyra-body-md text-lyra-fg-default">{ask.answer.summary}</p>
                {ask.answer.points.length > 0 && (
                  <ul className="list-disc ps-5 lyra-body-md text-lyra-fg-default">
                    {ask.answer.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
              </AgenticSection>
            </AgenticAICard>
          </AfterPerformed>
        </div>
      ))}
    </div>
  );
}

/** Ask Copilot about the item: the seed's suggestion chips (a used one drops out). */
export function KindCopilot({ item }: { item: ScheduleItem }) {
  const { openDetailPanelContent } = useWorkspace();
  const [, setAsks] = useWorkspaceUiField("kindCopilotAsks");
  const later = useCopilotResultTimer();
  const [question, setQuestion] = useState("");
  const [used, setUsed] = useState<readonly string[]>([]);
  const ask = (text: string) => {
    const asked = text.trim();
    if (!asked) return;
    const askedAt = Date.now();
    const time = timeLabel(askedAt);
    const id = `kind-copilot-${askedAt}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: KindCopilotAsk = { id, text: asked, time, askedAt, link: `kind-copilot:${item.id}:${id}`, answer: scheduleCopilotAnswer(item, asked) };
    setAsks((all) => ({ ...all, [item.id]: [...(all[item.id] ?? []), entry] }));
    // The row shows Copilot working, then its result opens, as a conversation's free-form ask does.
    later(() => openDetailPanelContent(askResult(entry)), AI_PERFORM_MS);
    setQuestion("");
  };
  return (
    <div className="mx-auto w-full max-w-[768px] shrink-0 px-6 pb-4 pt-2" data-kind-copilot="">
      <CopilotComposer
        placement="inline"
        placeholder={placeholderFor(item)}
        value={question}
        onChange={setQuestion}
        onSubmit={ask}
        suggestions={scheduleCopilotFor(item).suggestions.filter((s) => !used.includes(s))}
        onActivateSuggestion={(s) => {
          setUsed((prev) => [...prev, s]);
          ask(s);
        }}
      />
    </div>
  );
}
