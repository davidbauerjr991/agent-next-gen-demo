import type { ReactNode } from "react";
import type { ProviderCapabilities } from "../providers";
import { useCapability } from "./hooks";

// Capability gating — the one pattern for controls a provider can't do:
// - Hide, don't disable: an unsupported control isn't rendered.
// - One control: wrap it, `<IfCapable when={(c) => c.interaction.hold}>`.
// - A prop (lyra-ui components never see providers): read `useCapability`
//   in the app component and pass the plain boolean/array down.
// - An options list: filter it, e.g. New Outbound's channels ∩
//   `capabilities.interaction.channels.outbound`.
// Gate a control in the step that moves it onto a real provider — the
// placeholders report every capability false, so gating earlier hides it.

interface IfCapableProps {
  when: (capabilities: ProviderCapabilities) => boolean;
  /** Rendered instead when unsupported. Defaults to nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function IfCapable({ when, fallback = null, children }: IfCapableProps) {
  return useCapability(when) ? children : fallback;
}
