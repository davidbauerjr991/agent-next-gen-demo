// Whether the Contact Details button shows in a record header (P-LAYOUT-F4 18): the setting is on (Settings → Workspace →
// "Show Contact Details button") AND the contact is identified (P-LAYOUT-F3 8: an unidentified contact's header shows
// Session Details only, and the button comes once it's linked). Hide, never disable. Off, Contact Details is still
// reachable from the Customer Info card and every link into it. The one predicate: the conversation's header and a
// kind cell's both render `ContactDetailsControl`, which calls it.
export function contactDetailsButtonShown({ enabled, identified }: { enabled: boolean; identified: boolean }): boolean {
  return enabled && identified;
}
