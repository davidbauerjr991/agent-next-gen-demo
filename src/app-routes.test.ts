import { describe, expect, it } from "vitest";
import { PAGE_HASH, resolveHash } from "./app-routes";

describe("hash routes", () => {
  it("each page's hash resolves to it; anything else is login", () => {
    expect(resolveHash("#/agent-advanced")).toEqual({ page: "agent-advanced" });
    expect(resolveHash("#/outboundengagement")).toEqual({ page: "outbound" });
    expect(resolveHash("")).toEqual({ page: "login" });
    expect(resolveHash("#/nope")).toEqual({ page: "login" });
  });

  it("Desk's old route opens Advanced on the Phase 2 profile", () => {
    expect(resolveHash("#/agent-premium")).toEqual({ page: "agent-advanced", redirectTo: "#/agent-advanced", profile: "phase2" });
    expect(Object.values(PAGE_HASH)).not.toContain("#/agent-premium");
  });
});
