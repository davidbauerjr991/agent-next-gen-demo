import { describe, expect, it } from "vitest";
import { ACKNOWLEDGE_QUICK_REPLY_RESPONSE, CUSTOMER_AUTO_REPLY_POOL, simCustomerAutoReply } from "./sim-auto-replies";
import { resolveCustomerAutoReply } from "@/contact-handling/customer-auto-reply";
import { QUICK_REPLIES } from "@/components/transcript/composer/quick-replies";

describe("simulated customer replies", () => {
  it("the Acknowledge quick reply gets its scripted response; anything else a pool pick", () => {
    expect(simCustomerAutoReply("Hi", "Hi")).toBe(ACKNOWLEDGE_QUICK_REPLY_RESPONSE);
    expect(CUSTOMER_AUTO_REPLY_POOL).toContain(simCustomerAutoReply("Something else", "Hi"));
    expect(CUSTOMER_AUTO_REPLY_POOL).toContain(simCustomerAutoReply("Hi", undefined));
  });

  it("the page's resolver knows the Acknowledge quick reply's text", () => {
    const acknowledge = QUICK_REPLIES.find((r) => r.id === "acknowledge")!.template;
    expect(resolveCustomerAutoReply(acknowledge)).toBe(ACKNOWLEDGE_QUICK_REPLY_RESPONSE);
  });
});
