import { useEffect, useRef } from "react";
import { useInteractions } from "@/provider-context";

const LIVE = new Set(["connecting", "active"]);

/** When a live call ends while another call is on hold, selection moves to
 *  the held call's card (P-AIFIRST (k8) 9). Selection only: the held call
 *  stays held and the bar shows it with Resume (no auto-resume, P0.5d.1);
 *  the ended call's row keeps its "Needs outcome" chip. */
export function useFollowHeldCall(onSelect: (journeyId: string) => void) {
  const contacts = useInteractions();
  const states = useRef(new Map<string, string>());
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const before = states.current;
    states.current = new Map(contacts.map((c) => [c.id, c.state]));
    const ended = contacts.find(
      (c) => c.channel === "voice" && LIVE.has(before.get(c.id) ?? "") && (c.state === "wrap-up" || c.state === "ended"),
    );
    if (!ended) return;
    const held = contacts.find((c) => c.channel === "voice" && c.state === "held" && c.id !== ended.id);
    if (held) select.current(held.journeyId);
  }, [contacts]);
}
