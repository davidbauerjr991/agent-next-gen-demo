import type { DatabaseHandle } from "../data/database-handle";
import type { ContactCenterProfile } from "../profiles/contact-center-profile";
import type { ProviderSet } from "../providers";
import { createPlaceholderProviderSet } from "../adapters/placeholder/placeholder-providers";
import { SIM_DEMO_SEED } from "../adapters/sim/sim-fixtures";
import { createSimProviderSet } from "../adapters/sim/sim-provider-set";
import type { ProviderKind } from "./provider-kind";

/** Builds a provider set. The profile and database are constructor inputs,
 *  never per-call arguments (PLAN.md P0.2). */
export type ProviderFactory = (deps: { profile: ContactCenterProfile; database: DatabaseHandle }) => ProviderSet;

function placeholderFor(kind: ProviderKind): ProviderFactory {
  return () => {
    if (import.meta.env.DEV) {
      console.info(`[providers] no "${kind}" adapter is built yet; using placeholders (every call rejects "not-supported")`);
    }
    return createPlaceholderProviderSet();
  };
}

/** One factory per `?provider=` value. `sim` is the simulated set (P0.4);
 *  twilio/cxone stay placeholders until their adapters exist. */
export const PROVIDER_FACTORIES: Record<ProviderKind, ProviderFactory> = {
  sim: () => createSimProviderSet({ seed: SIM_DEMO_SEED }),
  twilio: placeholderFor("twilio"),
  cxone: placeholderFor("cxone"),
};
