import type { ProviderSet } from "../../providers";
import { createPlaceholderCustomerDataProvider, createPlaceholderMediaProvider } from "../placeholder/placeholder-providers";
import { createSimAssistProvider } from "./sim-assist-provider";
import { createSimCustomerClient } from "./sim-customer-client";
import { installScenarioHotkeys } from "./sim-scenario-hotkeys";
import { createSimScheduleProvider } from "./sim-schedule-source";
import { createSimTranscriptExportProvider } from "./sim-transcript-export-provider";
import { createBroadcastTransport, DEFAULT_LATENCY, withLatency, type LatencyRange } from "./sim-transport";
import { createSimulatedInteractionProvider, type SimOptions } from "./simulated-interaction-provider";

/** The `?provider=sim` set. Media and CustomerData stay placeholders until
 *  their phases (P3.1, P1.4); Assist relays the engine's guidance cards
 *  (P-CANVAS) and its on-demand calls stay unconnected until P4.1; the
 *  schedule is the stub source with one seeded day per role (P-HOME-1). */
export function createSimProviderSet(options?: SimOptions & {
  /** The scenario hotkeys (`installScenarioHotkeys`). The app's sim factory turns them on in every build: they
   *  come with the sim as the active provider. Default off (tests that build a set directly). */
  scenarioHotkeys?: boolean;
}): ProviderSet {
  const createTransport = options?.createTransport ?? (() => createBroadcastTransport());
  const interaction = createSimulatedInteractionProvider({ ...options, createTransport });
  const assist = createSimAssistProvider({
    sessionId: interaction.sessionId,
    transport: withLatency(createTransport(), options?.latency ?? DEFAULT_LATENCY),
    ...(options?.commandTimeoutMs !== undefined ? { commandTimeoutMs: options.commandTimeoutMs } : {}),
  });
  const hotkeys = !!options?.scenarioHotkeys;
  if (!import.meta.env.DEV && !hotkeys) return withPlaceholders(interaction, assist, options?.latency);

  // The customer side, until the P0.6 console: the scenario hotkeys play scripts through it (P0.5c; any build,
  // in-app only), and in dev it's also the `__simCustomer` devtools handle (never a global in production).
  const customer = createSimCustomerClient(interaction.sessionId);
  if (import.meta.env.DEV) window.__simCustomer = customer;
  const removeHotkeys = hotkeys ? installScenarioHotkeys(customer, options?.scripts ?? []) : () => {};
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
    options?.latency,
  );
}

function withPlaceholders(
  interaction: ProviderSet["interaction"],
  assist: ProviderSet["assist"],
  latency: LatencyRange | undefined,
): ProviderSet {
  return {
    interaction,
    media: createPlaceholderMediaProvider(),
    customerData: createPlaceholderCustomerDataProvider(),
    assist,
    transcriptExport: createSimTranscriptExportProvider({ latency }),
    schedule: createSimScheduleProvider({ latency }),
  };
}
