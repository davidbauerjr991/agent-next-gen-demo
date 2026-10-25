// Demo moments (P-HOME-1): several scripts started together from one key, so
// a beat that needs two assignments at once is one keystroke. Data only; the
// sim's hotkeys play them as the customer side, and the agent UI never knows.

export interface ScenarioMoment {
  id: string;
  /** A bare letter, like a script's `launch.hotkey`. */
  hotkey: string;
  /** Each script and how long after the key it starts. */
  plays: readonly { scriptId: string; atMs: number }[];
}

export const SCENARIO_MOMENTS: readonly ScenarioMoment[] = [
  // Maya's call is live when Lucas's chat arrives in review; his approval request
  // (about 13s into his script) toasts while the agent is on her call.
  {
    id: "maya-lucas",
    hotkey: "M",
    plays: [
      { scriptId: "maya-chen-refund-call", atMs: 0 },
      { scriptId: "lucas-thomas", atMs: 3_000 },
    ],
  },
];
