// @vitest-environment jsdom
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { describe, expect, it } from "vitest";
import { INITIAL_NOTIFICATIONS, NOTIFICATION_CHANNEL, NOTIFICATION_INTERACTION_ID } from "@/components/agent-next-gen-interaction-dashboard";
import { CONTACT_HISTORY } from "@/components/agent-next-gen-contact-history";
import { SIM_DEMO_DIRECTORY, SIM_DEMO_LAST_CONTACT_IDS } from "../sim/sim-demo-directory";
import { SIM_DEMO_SEED } from "../sim/sim-fixtures";

// The sim's demo seed is plain data (adapters import nothing from the UI),
// so this guards it against drifting from what the pages build today when a
// notification is opened (handleOpenAssignmentFromNotification).

describe("SIM_DEMO_SEED", () => {
  const assignmentNotifications = INITIAL_NOTIFICATIONS.filter((n) => n.type === "new-case" || n.type === "escalation");

  it("has one seed per assignment notification, by id", () => {
    expect(SIM_DEMO_SEED.map((s) => s.id)).toEqual(assignmentNotifications.map((n) => `seed-notification-${n.id}`));
  });

  it("NOTIFICATION_INTERACTION_ID points each assignment notification at its seed", () => {
    expect(NOTIFICATION_INTERACTION_ID).toEqual(
      Object.fromEntries(assignmentNotifications.map((n) => [n.id, `seed-notification-${n.id}`])),
    );
  });

  it.each(assignmentNotifications.map((n) => [n.id, n] as const))("notification %s: same name, channel and linked record", (id, n) => {
    const seed = SIM_DEMO_SEED.find((s) => s.id === `seed-notification-${id}`);
    expect(seed?.contactName).toBe(n.subtitle);
    expect(seed?.channel).toBe(NOTIFICATION_CHANNEL[id] ?? "email");
    expect(seed?.entityId).toBe(CREATE_NEW_CUSTOMERS[Number(id) % CREATE_NEW_CUSTOMERS.length].id);
    expect(seed?.ageMinutes).toBe(Number.parseInt(n.timestamp, 10));
  });
});

describe("SIM_DEMO_DIRECTORY", () => {
  const ageMinutes = (timeAgo: string) => {
    const [, n, unit] = /^(\d+)([mhd]) ago$/.exec(timeAgo)!;
    return Number(n) * { m: 1, h: 60, d: 1440 }[unit as "m" | "h" | "d"];
  };

  it("has every customer record, matchable by its phones and email", () => {
    expect(SIM_DEMO_DIRECTORY.map((e) => e.entityId)).toEqual(CREATE_NEW_CUSTOMERS.map((c) => c.id));
    const lauren = SIM_DEMO_DIRECTORY.find((e) => e.entityId === "lauren-briggs-history");
    expect(lauren?.phones).toContain("(312) 555-0164");
    expect(lauren?.emails).toEqual(["lauren.briggs@example.com"]);
  });

  it.each(CONTACT_HISTORY.filter((row) => row.customerId).map((row) => [row.name, row] as const))(
    "%s: last contact matches the Contact History row",
    (_name, row) => {
      const last = SIM_DEMO_DIRECTORY.find((e) => e.entityId === row.customerId)?.lastContact;
      expect(last).toMatchObject({ channel: row.channelType, caseId: row.caseId, caseStatus: row.statusLabel, ageMinutes: ageMinutes(row.timeAgo) });
    },
  );

  it("has a last contact only for the Contact History customers", () => {
    expect(SIM_DEMO_LAST_CONTACT_IDS.sort()).toEqual(CONTACT_HISTORY.flatMap((row) => row.customerId ?? []).sort());
  });
});
