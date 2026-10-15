// Marcus Webb — the scripted inbound voice call the Advanced page launches
// with the "L" key (an AI-agent refund escalation the agent reviews and can
// take over). The page owns the scenario itself until P0.5c moves it into the
// engine's scenario player; this module only holds its fixed identity.
//
// Desk's older Marcus Webb chat flow (its Copilot-tab walkthrough and the
// localStorage that persisted it) was removed per parity row 26: Advanced's
// scenario set is the standard (PLAN.md "Parity decisions").

/** The scenario card's fixed id. lyra's create-new-customers-data.ts has a
 *  directory record with this same id, so the card also carries it as
 *  `entityId` (the pages look records up by `entityId` since P0.5b.2). */
export const MARCUS_WEBB_ID = "marcus-webb-scenario";
/** The card's case/customer number. Matches no directory record. */
export const MARCUS_WEBB_CUSTOMER_ID = "MW-DEMO-0001";
export const MARCUS_WEBB_CUSTOMER_NAME = "Marcus Webb";
