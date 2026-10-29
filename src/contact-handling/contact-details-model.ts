// Contact Details' one view-model (P-HOME-1n): the subject's name and record fields, read by the record header's
// hover preview and by the Contact Details slide-over alike, so the two can't show different data. Built from the
// controller's Contact Details subject (the active conversation, or a schedule item's customer).
import { buildCustomerInfoFields } from "@/components/customer-info";
import type { ContactSubject } from "./workspace/workspace-types";

export interface ContactDetailsModel {
  /** The card it's for. */
  key: string;
  /** The customer's name, as the header and its link show it. */
  name: string | undefined;
  /** The record's fields (Phone #, Contact #, Email, …), what the Customer Information tab edits. */
  fields: ReturnType<typeof buildCustomerInfoFields>;
  /** Whether the subject has a thread (a schedule item's customer has none): the tab set follows it. */
  hasThread: boolean;
}

export function contactDetailsFor(subject: ContactSubject | null): ContactDetailsModel | null {
  if (!subject) return null;
  return {
    key: subject.key,
    name: subject.customerName,
    fields: buildCustomerInfoFields(subject.customerName, subject.customerId, subject.threads),
    hasThread: subject.hasThread,
  };
}
