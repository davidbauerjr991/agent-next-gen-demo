// P-LAYOUT-F1 A4: what opens after an assignment closes — the top active conversation in the list's order, else Home.
import { describe, expect, it } from "vitest";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import type { ScheduleItem } from "@/providers";
import { nextAfterClose } from "./after-close";
import type { AssignmentEntry } from "./useAssignmentCards";

const conversation = (id: string, offered = false): AssignmentEntry => ({
  type: "conversation",
  key: id,
  interaction: { id, offered } as unknown as Interaction,
});
const kind = (id: string): AssignmentEntry => ({ type: "schedule", key: `schedule:${id}`, item: { id } as unknown as ScheduleItem });

describe("nextAfterClose (P-LAYOUT-F1 A4)", () => {
  it("is the first remaining conversation in the list's order, skipping the one that closed", () => {
    expect(nextAfterClose([conversation("a"), conversation("b"), conversation("c")], "a")).toBe("b");
    expect(nextAfterClose([conversation("c"), conversation("a"), conversation("b")], "a")).toBe("c");
  });

  it("skips an offer (ringing, or waiting for Accept) and kind cards (not designed yet)", () => {
    expect(nextAfterClose([kind("cb"), conversation("ring", true), conversation("b")], "a")).toBe("b");
  });

  it("is Home (null) when nothing active remains", () => {
    expect(nextAfterClose([conversation("a")], "a")).toBeNull();
    expect(nextAfterClose([conversation("ring", true), kind("cb")], "a")).toBeNull();
    expect(nextAfterClose([], "a")).toBeNull();
  });
});
