// The customer's slide-overs in the reference slot (P-HOME-1m): a kind
// cell's Contact Details (the customer's record), and Link to existing
// customer — the directory picker the docked panel's match view uses
// (`CustomerMatchSearchBody`), so it shows wherever the reference column is.
// Linking a schedule item records the link for the item (its customer is
// then the record, `scheduleItemCustomer`); linking the active conversation
// goes through its own link (`handleLinkCustomerRecord`).
import { useState } from "react";
import { Avatar, MenuItem } from "@nicecxone/lyra-ui";
import { CustomerMatchSearchBody, filterCustomersByQuery } from "@/components/customer-info";
import { initialsFor } from "@/components/agent-next-gen-shared-utils";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { t } from "@/i18n";

/** A customer's record: who they are and how to reach them. */
export function CustomerRecordBody({ entityId }: { entityId: string }) {
  const { findDirectoryCustomer } = useWorkspace();
  const record = findDirectoryCustomer(entityId);
  if (!record) return null;
  const lines = [
    { label: t("Customer ID"), value: record.customerId },
    ...(record.firstPhone ? [{ label: t("Phone"), value: record.firstPhone }] : []),
    ...(record.emailAddress ? [{ label: t("Email"), value: record.emailAddress }] : []),
  ];
  return (
    <div className="flex flex-col gap-4 p-4" data-slot="customer-record" data-entity-id={entityId}>
      <div className="flex items-center gap-3">
        <Avatar initials={initialsFor(record.name)} size="lg" color="success" aria-hidden="true" />
        <p className="lyra-body-lg-emphasis text-lyra-fg-default">{record.name}</p>
      </div>
      <div className="-mx-3 flex flex-col">
        {lines.map((line) => (
          <MenuItem key={line.label} as="div" static comfortable={false} header={line.label} label={line.value} />
        ))}
      </div>
    </div>
  );
}

/** Link to existing customer: search the directory, link a record. */
export function LinkCustomerBody({ itemId }: { itemId?: string }) {
  const { customerDirectoryPool, handleLinkCustomerRecord, setSelectedDetailPanelContent } = useWorkspace();
  const [, setLinked] = useWorkspaceUiField("linkedItemCustomers");
  const [query, setQuery] = useState("");
  return (
    <div data-slot="link-customer">
      <CustomerMatchSearchBody
        query={query}
        onQueryChange={setQuery}
        matches={filterCustomersByQuery(query, customerDirectoryPool)}
        onLinkRecord={(record) => {
          if (itemId) setLinked((prev) => ({ ...prev, [itemId]: record.id }));
          else handleLinkCustomerRecord(record);
          setSelectedDetailPanelContent(null);
        }}
      />
    </div>
  );
}
