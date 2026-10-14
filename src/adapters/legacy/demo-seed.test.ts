// @vitest-environment jsdom
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { describe, expect, it } from "vitest";
import { INITIAL_NOTIFICATIONS, NOTIFICATION_CHANNEL } from "@/components/agent-next-gen-interaction-dashboard";
import { SIM_DEMO_SEED } from "../sim/sim-fixtures";

// The sim's demo seed is plain data (adapters import nothing from the UI),
// so this guards it against drifting from what the pages build today when a
// notification is opened (handleOpenAssignmentFromNotification).

describe("SIM_DEMO_SEED", () => {
  const assignmentNotifications = INITIAL_NOTIFICATIONS.filter((n) => n.type === "new-case" || n.type === "escalation");

  it("has one seed per assignment notification, by id", () => {
    expect(SIM_DEMO_SEED.map((s) => s.id)).toEqual(assignmentNotifications.map((n) => `seed-notification-${n.id}`));
  });

  it.each(assignmentNotifications.map((n) => [n.id, n] as const))("notification %s: same name, channel and linked record", (id, n) => {
    const seed = SIM_DEMO_SEED.find((s) => s.id === `seed-notification-${id}`);
    expect(seed?.contactName).toBe(n.subtitle);
    expect(seed?.channel).toBe(NOTIFICATION_CHANNEL[id] ?? "email");
    expect(seed?.entityId).toBe(CREATE_NEW_CUSTOMERS[Number(id) % CREATE_NEW_CUSTOMERS.length].id);
    expect(seed?.ageMinutes).toBe(Number.parseInt(n.timestamp, 10));
  });
});
