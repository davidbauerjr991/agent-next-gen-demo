// Link to existing customer in the reference slot (P-HOME-1m): the directory
// picker the docked panel's match view uses (`CustomerMatchSearchBody`), so it
// shows wherever the reference column is. Linking a schedule item records the
// link for the item (its customer is then the record, `scheduleItemCustomer`);
// linking the active conversation goes through its own link
// (`handleLinkCustomerRecord`). A kind cell's Contact Details is the docked
// panel, as a conversation's is (ContactDetailsControl).
import { useState } from "react";
import { CustomerMatchSearchBody, filterCustomersByQuery } from "@/components/customer-info";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";

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
