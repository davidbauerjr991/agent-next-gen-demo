import { createElement } from "react";
import { Building2 } from "lucide-react";
import type { CreateNewOutboundConfig, CreateNewOutboundContact } from "@nicecxone/lyra-ui";

/** An address book in the launcher's Address Book group (CXone's Directory
 *  App "Address Book"). The set is data: the three below are seeded; the
 *  DirectoryProvider serves them from P0.9, and admins upload their own (CSV
 *  import in Settings → Connections → Address books, P0.9.2). */
export interface AddressBook {
  id: string;
  name: string;
  source: "seeded" | "uploaded" | "connected";
  entries: CreateNewOutboundContact[];
}

export const ADDRESS_BOOKS: AddressBook[] = [
  { id: "partner-network", name: "Partner Network", source: "seeded", entries: [] },
  { id: "vendor-directory", name: "Vendor Directory", source: "seeded", entries: [] },
  { id: "regional-offices", name: "Regional Offices", source: "seeded", entries: [] },
];

/** The Address Book group: pick a book (lyra's group `subFilter`), then its
 *  entries list and search like any group. Renders however many books exist. */
export function addressBookGroup(
  books: readonly AddressBook[],
  selectedId: string,
  onSelect: (id: string) => void,
): CreateNewOutboundConfig["groups"][number] {
  const selected = books.find((b) => b.id === selectedId);
  return {
    id: "address-book",
    label: "Address Book",
    kind: "contacts",
    icon: createElement(Building2, { className: "h-4 w-4", strokeWidth: 1.5 }),
    contacts: selected ? selected.entries : books.flatMap((b) => b.entries),
    emptyMessage: selected ? `No ${selected.name} contacts yet` : "Choose an address book",
    subFilter: {
      ariaLabel: "Address book",
      placeholder: "Choose an address book",
      value: selectedId,
      options: books.map((b) => ({ value: b.id, label: `${b.name} (${b.entries.length})` })),
      onChange: onSelect,
    },
  };
}
