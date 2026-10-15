// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPlaceholderAssistProvider,
  createPlaceholderCustomerDataProvider,
  createPlaceholderMediaProvider,
} from "@/adapters/placeholder/placeholder-providers";
import { createMemoryBus } from "@/adapters/sim/memory-transport";
import { createSimulatedInteractionProvider } from "@/adapters/sim/simulated-interaction-provider";
import type { ProviderSet } from "@/providers";
import { ProviderRoot } from "@/provider-context";
import { useNewAssignments } from "./useNewAssignments";

// The nav cards' "new assignment" dot (useNewAssignments). A tier switch
// remounts the page on the same provider; a card the agent already opened
// must not turn "new" again on the other page.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useNewAssignments", () => {
  let container: HTMLElement;
  let root: Root;
  let isNew: (cardId: string) => boolean;

  function Page({ active }: { active: string | null }) {
    isNew = useNewAssignments(active);
    return null;
  }

  function makeSet(): ProviderSet {
    const bus = createMemoryBus();
    return {
      interaction: createSimulatedInteractionProvider({ createTransport: bus.createTransport }),
      media: createPlaceholderMediaProvider(),
      customerData: createPlaceholderCustomerDataProvider(),
      assist: createPlaceholderAssistProvider(),
    };
  }

  function render(page: "advanced" | "desk" | null, active: string | null, databaseId = "na-1") {
    act(() => {
      root.render(
        <StrictMode>
          <ProviderRoot kind="sim" profile={{ id: "p", name: "P" }} database={{ id: databaseId, name: "na", profileId: "p" }} factory={makeSet}>
            {page && <Page key={page} active={active} />}
          </ProviderRoot>
        </StrictMode>,
      );
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("a card stays seen across a tier switch; a new provider set starts over", () => {
    render("advanced", "lauren");
    render("advanced", "jordan");
    expect(isNew("lauren")).toBe(false);
    expect(isNew("noah")).toBe(true);

    // Tier switch: the other page mounts with its own active card.
    render("desk", "jordan");
    expect(isNew("lauren")).toBe(false);
    expect(isNew("noah")).toBe(true);

    // Another database (a new provider set) has never seen anything.
    render("advanced", null, "na-2");
    expect(isNew("lauren")).toBe(true);
  });
});
