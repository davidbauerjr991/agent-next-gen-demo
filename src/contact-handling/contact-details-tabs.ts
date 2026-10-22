// Contact Details' tab set as a registry (P-CANVAS; PLAN "The main column as
// a work surface"), so P1.7's Contact Details configuration can make it
// admin-configurable without re-plumbing. Under AI display inline and main:
// Customer Information, Notes, Detail, Transcript, Session (Overview's cards
// moved to the canvas). AI display "panel" keeps Overview first: it is where
// that mode's AI feed and Copilot composer live.
import type { ComponentType } from "react";
import { DEFAULT_CONTACT_DETAILS_TABS } from "@/components/workspace/contact-details-tab-bodies";

/** The tab ids are the panel's tab state values ("Details" is Overview,
 *  "Session Details" is Session: the names the rest of the workspace sets). */
export type ContactDetailsTabId = "Details" | "Customer Information" | "Notes" | "Detail" | "Transcript" | "Session Details";

/** The panel's sub-pages, reached from a card or link rather than the tab row
 *  ("Customer Info" is panel mode's customer drill-in). */
export type ContactDetailsSubPage = "Customer Info" | "Artifacts" | "Experience Memory";

export type ContactDetailsView = ContactDetailsTabId | ContactDetailsSubPage;

export interface ContactDetailsTabContext {
  /** AI display "panel". */
  aiInPanel: boolean;
  /** The card has a customer record (an unknown contact has Detail, Transcript and Session). */
  realCustomer: boolean;
}

export interface ContactDetailsTab {
  id: ContactDetailsTabId;
  /** English source text; the tab row passes it through `t()`. */
  label: string;
  /** The label under AI display "panel", when it differs (panel mode has its own Overview tab). */
  panelLabel?: string;
  order: number;
  applies?: (ctx: ContactDetailsTabContext) => boolean;
  /** The tab's body; reads the workspace. `inPreview`: the record header's hover preview. */
  Body: ComponentType<{ inPreview: boolean }>;
}

let tabs = new Map<ContactDetailsTabId, ContactDetailsTab>();

export function registerContactDetailsTab(tab: ContactDetailsTab): void {
  tabs.set(tab.id, tab);
}

export function resetContactDetailsTabs(): void {
  tabs = new Map(DEFAULT_CONTACT_DETAILS_TABS.map((tab) => [tab.id, tab]));
}
resetContactDetailsTabs();

/** The tab row for this card and mode, in order. */
export function contactDetailsTabs(ctx: ContactDetailsTabContext): ContactDetailsTab[] {
  return [...tabs.values()].filter((tab) => tab.applies?.(ctx) ?? true).sort((a, b) => a.order - b.order);
}

export function contactDetailsTab(id: ContactDetailsTabId): ContactDetailsTab | undefined {
  return tabs.get(id);
}

/** What the panel shows for the tab state `view`: a sub-page as is (panel
 *  mode's customer drill-in only there), a tab if it's in this card's row,
 *  otherwise the row's first tab. Outside panel mode Overview and the
 *  drill-in are gone, so both land on Customer Information when the card has it. */
export function resolveContactDetailsView(view: ContactDetailsView, ctx: ContactDetailsTabContext): ContactDetailsView {
  if (view === "Artifacts" || view === "Experience Memory") return view;
  if (view === "Customer Info") {
    if (ctx.aiInPanel) return view;
    view = "Customer Information";
  }
  const row = contactDetailsTabs(ctx);
  return row.some((tab) => tab.id === view) ? view : (row[0]?.id ?? view);
}
