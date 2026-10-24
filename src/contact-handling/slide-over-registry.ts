import type { ComponentType } from "react";
import { MARCUS_WEBB_SLIDE_OVERS } from "@/components/agent-next-gen-marcus-webb-panels";
import { MARCUS_WEBB_ID } from "./scenario-cases";
import type { DetailPanelContent } from "./workspace/workspace-types";

// The slide-over registry (P-SHRINK): a scripted case's panel keys map to
// slide-over content — a title, a subhead and a body — as data, so a case's
// rows and links open its panels without a branch per case in the link
// handler or the slide-over. A key ending in ":" is a prefix (`action:`,
// `instruction:`). Marcus Webb registers today; the other cases still use
// their own branches until they move here.

/** What a link asked for: the key, and for a Copilot row its question and time. */
export interface SlideOverRequest {
  panel: string;
  text?: string;
  time?: string;
  link?: string;
}

export interface SlideOverEntry {
  title: (request: SlideOverRequest) => string;
  subhead?: (request: SlideOverRequest) => string | undefined;
  Body: ComponentType<{ request: SlideOverRequest }>;
}

export type SlideOverTable = Record<string, SlideOverEntry>;

const TABLES: Record<string, SlideOverTable> = { [MARCUS_WEBB_ID]: MARCUS_WEBB_SLIDE_OVERS };

/** The entry a case registers for a panel key: the key itself, else the longest prefix it starts with. */
export function slideOverEntry(caseKey: string | undefined, panel: string): SlideOverEntry | undefined {
  const table = caseKey ? TABLES[caseKey] : undefined;
  if (!table) return undefined;
  if (table[panel]) return table[panel];
  const prefix = Object.keys(table)
    .filter((key) => key.endsWith(":") && panel.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? table[prefix] : undefined;
}

/** The slide-over content a link opens on a case, if the case registers the key. A Copilot row's key
 *  (`instruction:<decision>:<text>:<time>:…`) carries its question and time. */
export function slideOverContent(caseKey: string | undefined, key: string): DetailPanelContent | undefined {
  if (!caseKey || !slideOverEntry(caseKey, key)) return undefined;
  if (key.startsWith("instruction:")) {
    const [, , text, time] = key.split(":");
    return { kind: "registry", caseKey, panel: key, text: decodeURIComponent(text ?? ""), time: decodeURIComponent(time ?? ""), link: key };
  }
  return { kind: "registry", caseKey, panel: key, link: key };
}
