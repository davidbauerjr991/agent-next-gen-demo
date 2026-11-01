import { describe, expect, it } from "vitest";
import { homeHeaderCentred } from "./home-header-width";

describe("Home's header width follows the active tab (P-LAYOUT-F2 3)", () => {
  it("centred on the one-column Dashboard only; full width on an app tab, a customer tab and in two columns", () => {
    expect(homeHeaderCentred(false, "dashboard")).toBe(true);
    expect(homeHeaderCentred(false, "customers")).toBe(false);
    expect(homeHeaderCentred(false, "customer:cust-0001")).toBe(false);
    expect(homeHeaderCentred(true, "dashboard")).toBe(false);
  });
});
