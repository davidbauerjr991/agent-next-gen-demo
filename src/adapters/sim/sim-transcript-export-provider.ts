import type { TranscriptExportProvider, TranscriptExportRequest } from "../../providers";
import { sampleMs } from "./sim-util";
import { DEFAULT_LATENCY, type LatencyRange } from "./sim-transport";

const slug = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "customer";

const body = ({ customerName, assignmentId, lines }: TranscriptExportRequest) =>
  [`Transcript — ${customerName} (${assignmentId})`, "", ...lines.map((l) => `[${l.at}] ${l.speaker}: ${l.text}`), ""].join("\n");

/** The simulated export: builds the file from the lines it is handed and
 *  "sends" the email after the sim's usual latency. */
export function createSimTranscriptExportProvider(options?: { latency?: LatencyRange; now?: () => Date }): TranscriptExportProvider {
  const latency = options?.latency ?? DEFAULT_LATENCY;
  const now = options?.now ?? (() => new Date());
  const delay = () => new Promise<void>((resolve) => setTimeout(resolve, sampleMs(latency)));
  return {
    capabilities: { download: true, emailCopy: true },
    async buildTranscript(request) {
      await delay();
      const date = now().toISOString().slice(0, 10);
      return { filename: `${slug(request.customerName)}-${request.assignmentId}-${date}.txt`, text: body(request) };
    },
    async emailCopy({ address }) {
      await delay();
      return { address };
    },
  };
}
