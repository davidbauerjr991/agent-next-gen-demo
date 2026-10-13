import type { InteractionId, Participant, UtteranceId } from "../domain";
import type { EventSource, ProviderLifecycle } from "./events";

/** What the media provider supports. Static for its lifetime. */
export interface MediaCapabilities {
  /** `wordBoundary` events fire, so the transcript can reveal words in sync. */
  wordTimings: boolean;
  /** Agent speech is recognized while unmuted (it surfaces as `transcript`
   *  events on the InteractionProvider, not here). */
  speechRecognition: boolean;
  /** `setOutputVolume` works (the voice bar's volume slider). */
  outputVolume: boolean;
}

/** Audio devices as the UI needs to see them. */
export interface AudioState {
  /** "locked" until a user gesture calls `unlock` (browser autoplay rules). */
  output: "locked" | "ready" | "error";
  /** Microphone/recognition status. */
  input: "off" | "listening" | "denied" | "unsupported";
  /** Output volume, 0–1. */
  volume: number;
}

/** Event payloads, by name. */
export interface MediaEvents {
  /** Full snapshot of audio state whenever any part changes. */
  audioStateChanged: AudioState;
  /** Someone started or stopped producing audio — drives the "customer
   *  speaking" indicator in the voice controls. */
  speaking: { interactionId: InteractionId; role: Participant["role"]; speaking: boolean };
  /** Playback reached a word of an utterance. Only when `wordTimings`. */
  wordBoundary: { interactionId: InteractionId; utteranceId: UtteranceId; charIndex: number; charLength: number };
}

/**
 * Audio for voice interactions. Playback is driven by the call itself, not
 * by the UI: the simulation speaks its own transcript (pausing on hold,
 * stopping on end) and a real softphone gets audio in-band. So the UI only
 * unlocks audio, sets volume, and observes state — there is no `speak`.
 * Console-side voice/rate/pitch controls are sim-only and not part of this
 * contract.
 */
export interface MediaProvider extends EventSource<MediaEvents>, ProviderLifecycle {
  /** What this provider supports. */
  readonly capabilities: MediaCapabilities;
  /** Current audio state, for a fresh mount. */
  getAudioState(): Promise<AudioState>;
  /** Unlocks audio output. Call from a user gesture — the Answer click. */
  unlock(): Promise<void>;
  /** Sets output volume, 0–1 (clamped). */
  setOutputVolume(volume: number): Promise<void>;
}
