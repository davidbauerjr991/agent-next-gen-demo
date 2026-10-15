import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import { MARCUS_WEBB_CUSTOMER_NAME } from "@/components/agent-next-gen-marcus-webb-scenario";

// Legacy: the page-owned form of Marcus Webb's call transcript, moved out of
// AgentWorkspaceAdvancedPage.tsx so the page exports only components. The
// ported copy is src/scenarios/scripts/marcus-webb.ts; a drift test keeps the
// two equal. P0.5c deletes this file when the scenario player replaces the
// page's inline launch.

/* ── MARCUS_WEBB_CALL_TRANSCRIPT ──
 *  Turn-by-turn transcript for Marcus's voice call, wired into his
 *  `Interaction.liveMessages.voice` (see the "L" keydown handler, below)
 *  so it renders as real message bubbles the moment the contact goes into
 *  review mode — per explicit request ("for reviewed contacts, display the
 *  transcript in the session details panel when the contact goes into
 *  review mode... create a transcript for the marcus webb call between
 *  marcus and the AI Agent"). `onReview` (far below, the notice's own
 *  render site) is what actually flips `customerPanelActiveTab` to
 *  "Transcript" and opens the docked panel so this is visible the instant
 *  review starts, rather than only whenever the agent happens to click
 *  into the Transcript tab themselves.
 *
 *  Dramatizes the exact 2-step scenario from the attached overview image:
 *  a Cognigy virtual agent handles an inbound refund request for a
 *  damaged product, looks up the order and finds it's valued at $200 —
 *  above the $100 refund limit it's authorized to approve on its own — and
 *  escalates by telling the customer it needs supervisor sign-off, then
 *  places them on hold pending human review. That hold is precisely the
 *  moment "L" surfaces the incoming-notice/review flow, so the transcript
 *  ends there rather than resolving the refund itself. */
export const MARCUS_WEBB_CALL_TRANSCRIPT: TranscriptMessage[] = [
  {
    id: "mw-t1",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:41 AM",
    text: "Thanks for calling in — I'm the virtual assistant today. Can you tell me a bit about what's going on?",
  },
  {
    id: "mw-t2",
    sender: "customer",
    name: MARCUS_WEBB_CUSTOMER_NAME,
    initials: "MW",
    timestamp: "9:41 AM",
    text: "Hi, yeah — I ordered a pair of noise-cancelling headphones and they showed up with a cracked ear cup. I'd like a refund.",
  },
  {
    id: "mw-t3",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:42 AM",
    text: "I'm sorry to hear that — a damaged item on arrival definitely qualifies for a refund. Let me pull up your order.",
  },
  {
    id: "mw-t4",
    sender: "customer",
    name: MARCUS_WEBB_CUSTOMER_NAME,
    initials: "MW",
    timestamp: "9:42 AM",
    text: "Sure, it's order number 48213, placed last Tuesday.",
  },
  {
    id: "mw-t5",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:43 AM",
    text: "Found it — the headphones on that order are valued at $200. I'm authorized to approve refunds up to $100 on my own, so this one comes in just above what I can approve directly.",
  },
  {
    id: "mw-t6",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:43 AM",
    text: "I'll need to check with a supervisor before I can process it. Would you mind holding for a moment while I flag this for a human agent to review?",
  },
  {
    id: "mw-t7",
    sender: "customer",
    name: MARCUS_WEBB_CUSTOMER_NAME,
    initials: "MW",
    timestamp: "9:44 AM",
    text: "That's fine, I can hold.",
  },
  {
    id: "mw-t8",
    sender: "agent",
    name: "Cognigy AI Agent",
    initials: "AI",
    timestamp: "9:44 AM",
    text: "Thank you for your patience — please hold while I connect with a supervisor for approval on this $200 refund.",
  },
];
