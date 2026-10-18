import { Button, SearchInput } from "@nicecxone/lyra-ui";
import { type CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { ChevronRight } from "lucide-react";

/* ── Unknown-contact customer matching (Premium/Advanced only) ──
   Per explicit request: when an interaction on Premium/Advanced isn't
   backed by a real `CREATE_NEW_CUSTOMERS` directory record (the same
   `!activeInteractionIsRealCustomer` signal that already drives the no-tab
   header treatment — see that const's own doc comment on each page file),
   the docked Customer Information panel no longer just shows a blank
   Detail-tab form for a name nobody can confirm. Instead it runs a
   simulated "does this look like anyone already in the directory" check
   and shows the result — possible matches to link to, or a genuinely-new-
   contact empty state — with a "Create New Customer" escape hatch either
   way. Both pieces below are page-agnostic UI-support logic (not a
   page-specific BEHAVIOR rule each tier reinterprets its own way, unlike
   e.g. `resolveActiveChannelDateTimeLabel`), so they live here once rather
   than being duplicated verbatim into each page file — consistent with
   `buildCustomerInfoFields`/`splitCustomerName`/etc. already doing the
   same. */

/** Same plain string-hash approach `hashSeed` (agent-next-gen-shared-
 *  utils.ts) already uses to turn a record id into a stable pseudo-random
 *  number — kept as its own tiny function here (rather than importing that
 *  one) since this hashes a raw dialed/typed identifier string, not a
 *  `recordId`, and the two are conceptually different seeds even though
 *  the math is identical. */
function hashMatchSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Simulated "does this unknown caller/emailer/chatter potentially match
 * someone already in the customer directory" check. There's no real
 * matching backend here — no shared phone/email index to actually query —
 * so this derives a believable, DETERMINISTIC result from the raw dialed/
 * typed identifier itself via `hashMatchSeed`: the same identifier always
 * returns the same result (stable across re-renders and switching away and
 * back), roughly 3 in 10 identifiers come back with zero matches (a
 * genuinely first-time contact — the "0 Matches" empty state), and the
 * rest return 1-8 "possible" matches pulled deterministically out of
 * `pool` (a rotating window starting at a hash-derived index, not a real
 * similarity ranking).
 */
export function findPossibleCustomerMatches(
  identifier: string | undefined,
  pool: readonly CreateNewCustomerRecord[]
): CreateNewCustomerRecord[] {
  if (!identifier || pool.length === 0) return [];
  const seed = hashMatchSeed(identifier);
  if (seed % 10 < 3) return [];
  const matchCount = Math.min(pool.length, 1 + (seed % 8));
  const startIndex = seed % pool.length;
  const matches: CreateNewCustomerRecord[] = [];
  for (let i = 0; i < matchCount; i++) {
    matches.push(pool[(startIndex + i) % pool.length]);
  }
  return matches;
}

/** The "Search Customers" box's own manual filter — unlike
 *  `findPossibleCustomerMatches` above (which never reads what the agent
 *  actually typed), this is a plain case-insensitive substring match
 *  across name/customer id/phone/email, for an agent who wants to look up
 *  a specific record by hand rather than rely on the automatic check
 *  (e.g. it came back empty, or missed the right person). Empty query
 *  returns no results — the panel falls back to
 *  `findPossibleCustomerMatches`'s own list in that case (see the render
 *  call site). */
export function filterCustomersByQuery(
  query: string,
  pool: readonly CreateNewCustomerRecord[]
): CreateNewCustomerRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return pool.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.customerId.toLowerCase().includes(q) ||
      c.firstPhone.toLowerCase().includes(q) ||
      c.emailAddress.toLowerCase().includes(q)
  );
}

/** Shared "N Matches"/"N Possible Matches"/"0 Matches" header subhead text
 *  (plus which list is actually the one currently visible) for the search
 *  step of the unknown-contact matching UI — used by BOTH
 *  `CustomerInformationSidePanel` and `CustomerInfoHoverPreview`, per
 *  explicit request that the closed panel's hover preview show the exact
 *  same information the docked open panel does, so the two never disagree
 *  on how many matches there are or what to call them. `searchResults`
 *  (real typed-search results) wins over `possibleMatches` (the automatic
 *  check) the instant `query` has anything in it — see
 *  `findPossibleCustomerMatches`/`filterCustomersByQuery`'s own doc
 *  comments for what each list actually is. */
export function buildCustomerMatchSubhead(
  query: string,
  possibleMatches: CreateNewCustomerRecord[],
  searchResults: CreateNewCustomerRecord[]
): { subhead: string; visibleList: CreateNewCustomerRecord[] } {
  const queryActive = !!query.trim();
  const visibleList = queryActive ? searchResults : possibleMatches;
  const count = visibleList.length;
  const subhead = queryActive
    ? `${count} Match${count === 1 ? "" : "es"}`
    : count === 0
      ? "0 Matches"
      : `${count} Possible Match${count === 1 ? "" : "es"}`;
  return { subhead, visibleList };
}

/** The search-step body for the unknown-contact Customer Information panel
 *  (see the doc comment above) — a `SearchInput` over whichever list is
 *  currently relevant (`matches`, already resolved by the caller to either
 *  the automatic possible-matches list or the manual search results — see
 *  `CustomerInformationSidePanel`'s own `matchState` render branch), each
 *  row hover-revealing a "Link To Record" button in place of its default
 *  chevron (`group`/`group-hover`, same reveal-on-hover mechanism already
 *  used elsewhere in this app, e.g. the Latest Interaction card's "View
 *  All Contacts" button). Empty list (whether that's a genuine "0
 *  Matches" or just no search results yet) shows the same centered
 *  placeholder text either way — the header subhead just above this body
 *  (built by the caller) is what actually distinguishes those two cases
 *  for the agent. */
export function CustomerMatchSearchBody({
  query,
  onQueryChange,
  matches,
  onLinkRecord,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  matches: CreateNewCustomerRecord[];
  onLinkRecord: (customer: CreateNewCustomerRecord) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
      <SearchInput
        value={query}
        onValueChange={onQueryChange}
        placeholder="Search Customers"
        aria-label="Search Customers"
      />
      {matches.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16 text-center lyra-body-sm text-lyra-fg-secondary">
          No Customers Match This Interaction
        </div>
      ) : (
        <div className="flex flex-col">
          {matches.map((customer) => (
            <div
              key={customer.id}
              className="group -mx-2 flex items-center justify-between gap-2 rounded-lyra-sm px-2 py-2.5 transition-colors hover:bg-lyra-bg-surface-container-subtle"
            >
              <div className="min-w-0">
                <p className="lyra-body-md text-lyra-fg-default truncate">{customer.name}</p>
                <p className="lyra-body-sm text-lyra-fg-secondary truncate">{customer.customerId}</p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-lyra-fg-secondary group-hover:hidden"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <Button
                variant="outline"
                size="sm"
                className="hidden shrink-0 group-hover:inline-flex"
                onClick={() => onLinkRecord(customer)}
              >
                Link To Record
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
