import { useEffect, useMemo, type ReactNode } from "react";
import type { DatabaseHandle } from "../data/database-handle";
import type { ContactCenterProfile } from "../profiles/contact-center-profile";
import { ProviderContext, type ProviderContextValue } from "./context";
import { PROVIDER_FACTORIES, type ProviderFactory } from "./factories";
import { getInteractionStore } from "./interaction-store";
import { peekProviderSet, releaseProviderSet, retainProviderSet } from "./provider-cache";
import type { ProviderKind, SimLatencyPreset } from "./provider-kind";

interface ProviderRootProps {
  kind: ProviderKind;
  profile: ContactCenterProfile;
  database: DatabaseHandle;
  /** Overrides `PROVIDER_FACTORIES[kind]` — for tests and the sim-only
   *  customer console (P0.6). */
  factory?: ProviderFactory;
  /** The sim's injected delay (`?latency=`, P0.5b.2). Part of the cache key
   *  when `kind` is "sim", so a change builds a new set. */
  simLatency?: SimLatencyPreset;
  children: ReactNode;
}

/** Builds the active provider set once per (kind, profile, database) and
 *  supplies it, with the profile and database, to everything below. */
export function ProviderRoot({ kind, profile, database, factory, simLatency, children }: ProviderRootProps) {
  const key = `${kind}|${profile.id}|${database.id}${kind === "sim" && simLatency ? `|latency=${simLatency}` : ""}`;
  const create = factory ?? PROVIDER_FACTORIES[kind];
  const providers = peekProviderSet(key, () => create({ profile, database, simLatency }));

  useEffect(() => {
    retainProviderSet(key);
    return () => releaseProviderSet(key);
  }, [key]);

  // The interaction store (P0.5.0) follows the active provider: subscribed and
  // hydrated while mounted, unsubscribed before the cache's deferred dispose.
  useEffect(() => {
    const store = getInteractionStore(providers.interaction);
    store.start();
    return () => store.stop();
  }, [providers]);

  // Dev-only devtools handle (`__providers.interaction.accept("x")`). App
  // code must never read it — components go through the hooks.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__providers = providers;
    return () => {
      if (window.__providers === providers) delete window.__providers;
    };
  }, [providers]);

  const value = useMemo<ProviderContextValue>(
    () => ({
      kind,
      providers,
      capabilities: {
        interaction: providers.interaction.capabilities,
        media: providers.media.capabilities,
      },
      profile,
      database,
    }),
    [kind, providers, profile, database],
  );

  return <ProviderContext value={value}>{children}</ProviderContext>;
}
