import { describe, it } from "vitest";
import { expectProviderError } from "../../contract-tests/event-recorder";
import { createPlaceholderProviderSet } from "./placeholder-providers";

// Until a real adapter exists, the placeholder takes no inbound channel, so
// per-agent channels have nothing to gate: setAgentChannels rejects
// "not-supported" (the contract suite's rule for any provider without inbound
// channels), and "invalid-state" once disposed.
describe("placeholder InteractionProvider", () => {
  it("setAgentChannels rejects not-supported, then invalid-state once disposed", async () => {
    const { interaction } = createPlaceholderProviderSet();
    await expectProviderError(interaction.setAgentChannels(["chat"]), "not-supported");
    await interaction.dispose();
    await expectProviderError(interaction.setAgentChannels(["chat"]), "invalid-state");
  });
});
