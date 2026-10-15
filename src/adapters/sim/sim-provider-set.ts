import type { ProviderSet } from "../../providers";
import {
  createPlaceholderAssistProvider,
  createPlaceholderCustomerDataProvider,
  createPlaceholderMediaProvider,
} from "../placeholder/placeholder-providers";
import { createSimCustomerClient } from "./sim-customer-client";
import { installScenarioHotkeys } from "./sim-scenario-hotkeys";
import { createSimulatedInteractionProvider, type SimOptions } from "./simulated-interaction-provider";

/** The `?provider=sim` set. Media, CustomerData and Assist stay placeholders
 *  until their phases (P3.1, P1.4, P4.1). */
export function createSimProviderSet(options?: SimOptions): ProviderSet {
  const interaction = createSimulatedInteractionProvider(options);
  if (!import.meta.env.DEV) return withPlaceholders(interaction);

  // Dev-only devtools handle for the customer side, until the P0.6 console,
  // and the scenario hotkeys that play scripts through it (P0.5c).
  const customer = createSimCustomerClient(interaction.sessionId);
  window.__simCustomer = customer;
  const removeHotkeys = installScenarioHotkeys(customer, options?.scripts ?? []);
  return withPlaceholders({
    ...interaction,
    async dispose() {
      removeHotkeys();
      customer.dispose();
      if (window.__simCustomer === customer) delete window.__simCustomer;
      await interaction.dispose();
    },
  });
}

function withPlaceholders(interaction: ProviderSet["interaction"]): ProviderSet {
  return {
    interaction,
    media: createPlaceholderMediaProvider(),
    customerData: createPlaceholderCustomerDataProvider(),
    assist: createPlaceholderAssistProvider(),
  };
}
