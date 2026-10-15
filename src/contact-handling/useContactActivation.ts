import { useCallback, useEffect, useRef, useState } from "react";
import { threadKey } from "@/adapters/legacy/nav-card-view-model";
import type { InteractionId } from "@/domain";
import { useInteractions } from "@/provider-context";
import type { CardOverlay } from "./nav-card-overlay";

/** How a launched contact should be shown once it's in the store:
 *  - "focus": make its card active with this thread in the main column (new
 *    cards, redials, reopens, notifications);
 *  - "added": a channel added to an already-open card. The page decides
 *    (the docked preview, or with the omnichannel layout the main column,
 *    the voice bar or the async slide-out);
 *  - "none": nothing to show (e.g. the other threads of a restored case). */
export type ActivationMode = "focus" | "added" | "none";

export interface Activation {
  journeyId: string;
  threadKey: string;
  mode: Exclude<ActivationMode, "none">;
  /** The journey had no card on screen before this launch. */
  isNewCard: boolean;
}

interface Pending {
  id: InteractionId;
  mode: ActivationMode;
  isNewCard: boolean;
  overlay?: CardOverlay;
}

/** Activates contacts the provider has accepted only once they're in the
 *  store, so nothing on screen is optimistic (P0.5b.2): a card appears one
 *  round trip after the command, from the same event every other client sees.
 *  `seedOverlay` lets a launch restore page state (e.g. a stored case's live
 *  messages) under the journey id, which is only known at that point. */
export function useContactActivation(
  onActivate: (activation: Activation) => void,
  seedOverlay: (journeyId: string, overlay: CardOverlay) => void,
) {
  const interactions = useInteractions();
  const [pending, setPending] = useState<Pending[]>([]);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    if (pending.length === 0) return;
    const ready = pending.filter((p) => interactions.some((i) => i.id === p.id && i.state !== "offered"));
    if (ready.length === 0) return;
    setPending((prev) => prev.filter((p) => !ready.includes(p)));
    for (const p of ready) {
      const interaction = interactions.find((i) => i.id === p.id)!;
      if (p.overlay) seedOverlay(interaction.journeyId, p.overlay);
      if (p.mode === "none") continue;
      onActivateRef.current({ journeyId: interaction.journeyId, threadKey: threadKey(interaction), mode: p.mode, isNewCard: p.isNewCard });
    }
  }, [interactions, pending, seedOverlay]);

  /** Activates `id` as soon as the store has it (now, if it already does). */
  const activateWhenReady = useCallback(
    (id: InteractionId, mode: ActivationMode, isNewCard: boolean, overlay?: CardOverlay) => {
      setPending((prev) => [...prev, { id, mode, isNewCard, ...(overlay ? { overlay } : {}) }]);
    },
    [],
  );

  return { activateWhenReady };
}
