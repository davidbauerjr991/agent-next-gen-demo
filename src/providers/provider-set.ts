import type { AssistProvider } from "./assist-provider";
import type { CustomerDataProvider } from "./customer-data-provider";
import type { InteractionCapabilities, InteractionProvider } from "./interaction-provider";
import type { MediaCapabilities, MediaProvider } from "./media-provider";

/** The four providers the workspace runs on, built together by one factory
 *  and supplied through the provider context (P0.3). */
export interface ProviderSet {
  interaction: InteractionProvider;
  media: MediaProvider;
  customerData: CustomerDataProvider;
  assist: AssistProvider;
}

/** Every provider's static `capabilities`, keyed like `ProviderSet`. Only
 *  providers that declare capabilities appear; add a key when one does. */
export interface ProviderCapabilities {
  interaction: InteractionCapabilities;
  media: MediaCapabilities;
}
