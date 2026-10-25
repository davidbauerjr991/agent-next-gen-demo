import type { ChannelKind } from "@/domain";

/** A channel's name as rows and toasts say it (English source; render through `t()`). */
export const CHANNEL_NAMES: Record<ChannelKind, string> = { voice: "Voice", chat: "Chat", sms: "SMS", whatsapp: "WhatsApp", email: "Email" };
