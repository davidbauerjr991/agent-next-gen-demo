/** What the transcript export supports. Static for its lifetime; each flag
 *  shows or hides its control (never disables it). */
export interface TranscriptExportCapabilities {
  /** `transcript.download`: the visible transcript as a text file. */
  download: boolean;
  /** `transcript.emailCopy`: a copy emailed to the customer. */
  emailCopy: boolean;
}

/** One line of the visible transcript. */
export interface TranscriptExportLine {
  /** Display time of the line, as shown ("9:15 AM"). */
  at: string;
  /** Who said it ("Maya Chen", "John Smith"). */
  speaker: string;
  text: string;
}

/** The thread to export, as the agent sees it. */
export interface TranscriptExportRequest {
  /** The assignment the thread belongs to. */
  assignmentId: string;
  customerName: string;
  lines: readonly TranscriptExportLine[];
}

export interface TranscriptFile {
  /** `<customer>-<assignmentId>-<date>.txt`. */
  filename: string;
  text: string;
}

/**
 * Exports a thread's transcript: builds the downloadable text file and sends
 * a copy to the customer. The UI hands over the lines it shows; the provider
 * owns the format, the file name and the delivery.
 */
export interface TranscriptExportProvider {
  readonly capabilities: TranscriptExportCapabilities;
  /** The transcript as a `.txt` file. */
  buildTranscript(request: TranscriptExportRequest): Promise<TranscriptFile>;
  /** Emails a copy to `address`; resolves with the address it went to. */
  emailCopy(request: TranscriptExportRequest & { address: string }): Promise<{ address: string }>;
}
