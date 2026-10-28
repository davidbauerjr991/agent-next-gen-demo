// A schedule item's customer through the directory (P-HOME-1m): every seeded customer with a record resolves to it
// (the record's name wins); one without stays unmatched; a link the agent made wins over the item's own.
import { describe, expect, it } from "vitest";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { seedScheduleDay } from "@/adapters/sim/sim-schedule-seeds";
import { scheduleItemCustomer } from "../contact-identity";

const findRecord = (entityId: string) => CREATE_NEW_CUSTOMERS.find((c) => c.id === entityId);
const NOW = new Date(2026, 9, 28, 10, 30).getTime();

describe("scheduleItemCustomer", () => {
  it("every seeded item with a customer resolves to its directory record, except Sofia Ramirez (no record)", () => {
    const items = (["agent", "supervisor", "sales"] as const).flatMap((role) => seedScheduleDay(role, NOW)).filter((i) => i.customer);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const customer = scheduleItemCustomer(item.customer, findRecord);
      if (item.customer!.name === "Sofia Ramirez") {
        expect(customer).toEqual({ name: "Sofia Ramirez" });
        continue;
      }
      expect(customer?.entityId, item.id).toBe(item.customer!.entityId);
      expect(customer?.record?.name, item.id).toBe(item.customer!.name);
    }
  });

  it("the record's name wins; a link wins over the item's own; no customer, none", () => {
    expect(scheduleItemCustomer({ name: "P. Shah", entityId: "priya-shah-history" }, findRecord)?.name).toBe("Priya Shah");
    expect(scheduleItemCustomer({ name: "Sofia Ramirez" }, findRecord, "nathan-cole-history")).toMatchObject({ name: "Nathan Cole", entityId: "nathan-cole-history" });
    expect(scheduleItemCustomer(undefined, findRecord)).toBeUndefined();
  });
});
