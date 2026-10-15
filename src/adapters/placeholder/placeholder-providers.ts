import type {
  AssistProvider,
  CustomerDataProvider,
  InteractionCapabilities,
  InteractionProvider,
  MediaCapabilities,
  MediaProvider,
  ProviderSet,
  Unsubscribe,
} from "../../providers";
import { providerError } from "../provider-error";

// Placeholder providers (P0.3): mounted until a real implementation exists
// (P0.4 for sim; twilio/cxone later). Every method rejects with
// "not-supported" — or "invalid-state" once disposed, per ProviderLifecycle.
// `on()` registers nothing, since no event will ever fire.

const NO_INTERACTION_CAPABILITIES: InteractionCapabilities = {
  channels: { inbound: [], outbound: [] },
  decline: false,
  hold: false,
  mute: false,
  record: false,
  mask: false,
  dtmf: false,
  transfer: { blind: false, consult: false },
  typing: false,
  deliveryReceipts: false,
  agentLeg: false,
  wrapUp: false,
  caseStatus: false,
  reopen: false,
  review: false,
};

const NO_MEDIA_CAPABILITIES: MediaCapabilities = {
  wordTimings: false,
  speechRecognition: false,
  outputVolume: false,
};

const noopUnsubscribe: Unsubscribe = () => {};

/** Shared lifecycle for one placeholder: a `reject(method)` factory whose
 *  error code reflects whether `dispose()` has run. */
function placeholderLifecycle(providerName: string) {
  let disposed = false;
  const reject =
    (method: string) =>
    (): Promise<never> =>
      Promise.reject(
        disposed
          ? providerError("invalid-state", `${providerName}.${method}: provider is disposed`)
          : providerError("not-supported", `${providerName}.${method}: no provider is connected`),
      );
  const dispose = async () => {
    disposed = true;
  };
  return { reject, dispose };
}

function createPlaceholderInteractionProvider(): InteractionProvider {
  const { reject, dispose } = placeholderLifecycle("InteractionProvider");
  return {
    capabilities: NO_INTERACTION_CAPABILITIES,
    on: () => noopUnsubscribe,
    dispose,
    getSnapshot: reject("getSnapshot"),
    getTranscript: reject("getTranscript"),
    listPresenceOptions: reject("listPresenceOptions"),
    listOutboundSkills: reject("listOutboundSkills"),
    setAgentState: reject("setAgentState"),
    connectAgentLeg: reject("connectAgentLeg"),
    disconnectAgentLeg: reject("disconnectAgentLeg"),
    accept: reject("accept"),
    decline: reject("decline"),
    dial: reject("dial"),
    reopen: reject("reopen"),
    end: reject("end"),
    completeWrapUp: reject("completeWrapUp"),
    hold: reject("hold"),
    mute: reject("mute"),
    setRecording: reject("setRecording"),
    setMasked: reject("setMasked"),
    sendDtmf: reject("sendDtmf"),
    transfer: reject("transfer"),
    sendMessage: reject("sendMessage"),
    setTyping: reject("setTyping"),
    setCaseStatus: reject("setCaseStatus"),
    associateEntity: reject("associateEntity"),
    takeOver: reject("takeOver"),
    respondToRequest: reject("respondToRequest"),
  } satisfies InteractionProvider;
}

export function createPlaceholderMediaProvider(): MediaProvider {
  const { reject, dispose } = placeholderLifecycle("MediaProvider");
  return {
    capabilities: NO_MEDIA_CAPABILITIES,
    on: () => noopUnsubscribe,
    dispose,
    getAudioState: reject("getAudioState"),
    unlock: reject("unlock"),
    setOutputVolume: reject("setOutputVolume"),
  } satisfies MediaProvider;
}

export function createPlaceholderCustomerDataProvider(): CustomerDataProvider {
  const { reject, dispose } = placeholderLifecycle("CustomerDataProvider");
  return {
    on: () => noopUnsubscribe,
    dispose,
    getEntity: reject("getEntity"),
    search: reject("search"),
    findNearMatches: reject("findNearMatches"),
    create: reject("create"),
    update: reject("update"),
    linkContactMethod: reject("linkContactMethod"),
    getCollection: reject("getCollection"),
    getContactHistory: reject("getContactHistory"),
  } satisfies CustomerDataProvider;
}

export function createPlaceholderAssistProvider(): AssistProvider {
  const { reject, dispose } = placeholderLifecycle("AssistProvider");
  return {
    on: () => noopUnsubscribe,
    dispose,
    suggest: reject("suggest"),
    extractEntities: reject("extractEntities"),
    cancel: reject("cancel"),
  } satisfies AssistProvider;
}

/** A full set of placeholders: no capabilities, every call rejects. */
export function createPlaceholderProviderSet(): ProviderSet {
  return {
    interaction: createPlaceholderInteractionProvider(),
    media: createPlaceholderMediaProvider(),
    customerData: createPlaceholderCustomerDataProvider(),
    assist: createPlaceholderAssistProvider(),
  };
}
