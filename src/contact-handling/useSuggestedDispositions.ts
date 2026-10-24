import { useEffect, useRef } from "react";
import type { ScenarioCases } from "./scenario-cases";
import { outcomeDraftKey, type OutcomeDraft } from "./useChannelOutcomeDrafts";

type UpdateDraft = (key: string, change: (draft: OutcomeDraft) => OutcomeDraft) => void;

/** A scripted event that suggests the Outcome disposition (`sets.disposition`, P-SHRINK) fills its thread's
 *  Outcome draft once, unless the agent already picked one. The agent still saves the Outcome. */
export function useSuggestedDispositions(scenarioCases: ScenarioCases, updateDraft: UpdateDraft) {
  const applied = useRef(new Set<string>());
  useEffect(() => {
    for (const c of Object.values(scenarioCases.byKey)) {
      if (!c?.cardId || !c.threadKey) continue;
      for (const m of c.messages) {
        const disposition = m.suggestedDisposition;
        if (!disposition || applied.current.has(m.id)) continue;
        applied.current.add(m.id);
        updateDraft(outcomeDraftKey(c.cardId, c.threadKey), (d) => (d.dispositionCode ? d : { ...d, dispositionCode: disposition }));
      }
    }
  }, [scenarioCases.byKey, updateDraft]);
}
