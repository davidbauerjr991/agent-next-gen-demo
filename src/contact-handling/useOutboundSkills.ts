import { useCallback, useEffect, useState } from "react";
import type { ChannelKind } from "@/domain";
import { useInteractionProvider, useProviders } from "@/provider-context";

export interface SkillOption {
  value: string;
  label: string;
}

/** Outbound skills per channel from `listOutboundSkills` (P0.5b.2), in the
 *  `{ value, label }` shape lyra's pickers take. Loaded once per provider for
 *  every channel the provider can dial out on. */
export function useOutboundSkills() {
  const provider = useInteractionProvider();
  const outboundChannels = useProviders().capabilities.interaction.channels.outbound;
  const [byChannel, setByChannel] = useState<Partial<Record<ChannelKind, SkillOption[]>>>({});

  useEffect(() => {
    let cancelled = false;
    for (const channel of outboundChannels) {
      provider
        .listOutboundSkills(channel)
        .then((skills) => {
          if (cancelled) return;
          setByChannel((prev) => ({ ...prev, [channel]: skills.map((s) => ({ value: s.id, label: s.name })) }));
        })
        .catch((error) => {
          if (import.meta.env.DEV) console.warn(`[outbound] listOutboundSkills(${channel}) failed`, error);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [provider, outboundChannels]);

  const options = useCallback((channel: ChannelKind) => byChannel[channel] ?? [], [byChannel]);
  /** Every channel's skills, de-duplicated by id (lyra's picker takes one list). */
  const allOptions = useCallback(() => {
    const seen = new Map<string, SkillOption>();
    for (const list of Object.values(byChannel)) for (const s of list ?? []) if (!seen.has(s.value)) seen.set(s.value, s);
    return [...seen.values()];
  }, [byChannel]);
  /** The skill id for a display name (a stored thread keeps only the name). */
  const idForName = useCallback(
    (name: string | undefined) => (name ? allOptions().find((s) => s.label === name)?.value : undefined),
    [allOptions],
  );
  const labelFor = useCallback(
    (id: string) => allOptions().find((s) => s.value === id)?.label,
    [allOptions],
  );

  return { outboundChannels, options, allOptions, idForName, labelFor };
}
