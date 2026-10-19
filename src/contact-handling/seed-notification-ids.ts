/** The provider contact each assignment notification stands for (P0.5b.2):
 *  the sim seeds these as waiting offers (`SIM_DEMO_SEED`), and opening the
 *  notification accepts it. demo-seed.test.ts keeps the two in step. Its own
 *  module (P-POLISH 1) so contact-handling hooks read it without loading the
 *  dashboard; re-exported from agent-next-gen-interaction-dashboard.tsx. */
export const NOTIFICATION_INTERACTION_ID: Record<string, string> = {
  "1": "seed-notification-1",
  "3": "seed-notification-3",
  "4": "seed-notification-4",
};
