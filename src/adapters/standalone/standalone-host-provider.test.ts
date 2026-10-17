import { describe, expect, it } from "vitest";
import { createStandaloneHostProvider } from "./standalone-host-provider";

describe("standalone host provider", () => {
  it("is standalone, signs in as the workspace's agent, has no host context, and posting resolves", async () => {
    const host = createStandaloneHostProvider();
    expect(host.hostKind).toBe("standalone");
    expect(await host.getSession()).toEqual({ agentId: "johnsmith329202", displayName: "John Smith" });
    expect(await host.getContext()).toEqual({});
    await expect(host.postToHost({ type: "contact-ended" })).resolves.toBeUndefined();
  });

  it("reads a supplied context getter each time", async () => {
    let customerId = "customer-1";
    const host = createStandaloneHostProvider({ getContext: () => ({ customerId }) });
    expect(await host.getContext()).toEqual({ customerId: "customer-1" });
    customerId = "customer-2";
    expect(await host.getContext()).toEqual({ customerId: "customer-2" });
  });
});
