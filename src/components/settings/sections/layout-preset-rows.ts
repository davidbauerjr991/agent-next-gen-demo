// Settings → Layout's preset rows (P-LAYOUT): one per legacy placement field. Each option's description, shown under
// the row while it's selected, is one sentence; anything longer is the row's (?) help (P-LAYOUT-F3 11).
import {
  AI_CANVAS_LAYOUT_FIELD,
  ASSIGNMENTS_PLACEMENT_FIELD,
  ASSIGNMENTS_PLACEMENT_OPTIONS,
  HOME_LAYOUT_FIELD,
} from "@/settings";
import type { PresetRow } from "./LayoutPresetRow";

export const PRESET_ROWS: readonly PresetRow[] = [
  {
    field: "home.layout",
    label: HOME_LAYOUT_FIELD.meta!.label,
    help: HOME_LAYOUT_FIELD.meta!.description,
    options: [
      { value: "oneColumn", label: "One column", description: "Home's sections stack in one column, the Activity feed among them." },
      { value: "twoColumn", label: "Two columns", description: "The Activity feed sits on the left and the other sections on the right." },
    ],
  },
  {
    field: "assignments.placement",
    label: ASSIGNMENTS_PLACEMENT_FIELD.meta!.label,
    help: ASSIGNMENTS_PLACEMENT_FIELD.meta!.description,
    options: (["leftNav", "interiorPanel"] as const).map((value) => ({
      value,
      label: ASSIGNMENTS_PLACEMENT_OPTIONS[value].label,
      description: ASSIGNMENTS_PLACEMENT_OPTIONS[value].description,
    })),
  },
  {
    field: "ai.displayLocation",
    label: "AI display",
    help: "Where Copilot's suggestions, answers and cards show: in the conversation, in the Contact Details panel beside it, or in the main column with the conversations moved to the panel.",
    options: [
      { value: "inline", label: "Inline in the transcript", description: "Copilot's rows and cards sit in the conversation." },
      { value: "panel", label: "In the Contact Details panel", description: "Copilot sits in the Contact Details panel beside the conversation." },
      { value: "main", label: "Main column (conversations in panel)", description: "Copilot holds the main column, and the conversations move to the panel." },
    ],
  },
  {
    field: "ai.canvasLayout",
    label: AI_CANVAS_LAYOUT_FIELD.meta!.label,
    help: AI_CANVAS_LAYOUT_FIELD.meta!.description,
    options: [
      { value: "twoColumn", label: "Two columns", description: "The reference cards sit in a column beside the conversation." },
      { value: "stacked", label: "Stacked", description: "The reference cards sit above the conversation, pinned while it scrolls." },
    ],
  },
  {
    field: "voice.controlsLocation",
    label: "Voice controls location",
    help: "Where a live call's controls show: under your work, or at the top of the assignments list, in the left nav or the interior panel.",
    options: [
      { value: "bottom", label: "Bottom", description: "The call controls sit under your work." },
      { value: "top", label: "Top of assignments", description: "The call controls sit at the top of the assignments list, wherever it is." },
    ],
  },
];
