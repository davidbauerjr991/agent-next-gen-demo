import type { ProviderSet } from "../../providers";
import { createPlaceholderCustomerDataProvider, createPlaceholderMediaProvider } from "../placeholder/placeholder-providers";
import { createSimAssistProvider } from "./sim-assist-provider";
import { createSimCustomerClient } from "./sim-customer-client";
import { installScenarioHotkeys } from "./sim-scenario-hotkeys";
import { createBroadcastTransport, DEFAULT_LATENCY, withLatency } from "./sim-transport";
import { createSimulatedInteractionProvider, type SimOptions } from "./simulated-interaction-provider";

/** The `?provider=sim` set. Media and CustomerData stay placeholders until
 *  their phases (P3.1, P1.4); Assist relays the engine's guidance cards
 *  (P-CANVAS) and its on-demand calls stay unconnected until P4.1. */
export function createSimProviderSet(options?: SimOptions): ProviderSet {
  const createTransport = options?.createTransport ?? (() => createBroadcastTransport());
  const interaction = createSimulatedInteractionProvider({ ...options, createTransport });
  const assist = createSimAssistProvider({
    sessionId: interaction.sessionId,
    transport: withLatency(createTransport(), options?.latency ?? DEFAULT_LATENCY),
    ...(options?.commandTimeoutMs !== undefined ? { commandTimeoutMs: options.commandTimeoutMs } : {}),
  });
  if (!import.meta.env.DEV) return withPlaceholders(interaction, assist);

  // Dev-only devtools handle for the customer side, until the P0.6 console,
  // and the scenario hotkeys that play scripts through it (P0.5c).
  const customer = createSimCustomerClient(interaction.sessionId);
  window.__simCustomer = customer;
  const removeHotkeys = installScenarioHotkeys(customer, options?.scripts ?? []);
  return withPlaceholders(
    {
      ...interaction,
      async dispose() {
        removeHotkeys();
        customer.dispose();
        if (window.__simCustomer === customer) delete window.__simCustomer;
        await interaction.dispose();
      },
    },
    assist,
  );
}

function withPlaceholders(interaction: ProviderSet["interaction"], assist: ProviderSet["assist"]): ProviderSet {
  return {
    interaction,
    media: createPlaceholderMediaProvider(),
    customerData: createPlaceholderCustomerDataProvider(),
    assist,
  };
}
