import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/settings/settings-schema";
import { contactDetailsButtonShown } from "./contact-details-button";

describe("the Contact Details button (P-LAYOUT-F4 18)", () => {
  it("shows only when the setting is on AND the contact is identified", () => {
    expect(contactDetailsButtonShown({ enabled: true, identified: true })).toBe(true);
    expect(contactDetailsButtonShown({ enabled: false, identified: true })).toBe(false);
    expect(contactDetailsButtonShown({ enabled: true, identified: false })).toBe(false);
    expect(contactDetailsButtonShown({ enabled: false, identified: false })).toBe(false);
  });

  it("the setting defaults on", () => {
    expect(defaultSettings().workspace.showContactDetailsButton).toBe(true);
  });
});
