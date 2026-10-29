// @vitest-environment jsdom
// (jsdom: the customer-info barrel loads lyra, whose local install a node-environment run can't resolve — Known gaps.)
import { describe, expect, it } from "vitest";
import { buildCustomerInfoFields } from "@/components/customer-info";
import { contactDetailsFor } from "./contact-details-model";

describe("contactDetailsFor (P-HOME-1n: the one Contact Details view-model)", () => {
  it("no subject: nothing to show", () => {
    expect(contactDetailsFor(null)).toBeNull();
  });

  it("the subject's name, its record's fields (the same builder the record tabs edit) and whether it has a thread", () => {
    const subject = { key: "j1", customerName: "Noah Patel", customerId: "C-1", threads: [], hasThread: false };
    const model = contactDetailsFor(subject)!;
    expect(model.key).toBe("j1");
    expect(model.name).toBe("Noah Patel");
    expect(model.hasThread).toBe(false);
    expect(model.fields).toEqual(buildCustomerInfoFields("Noah Patel", "C-1", []));
  });
});
