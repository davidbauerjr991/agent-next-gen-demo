// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ProviderSet } from "../providers";
import { ProviderRoot } from "./ProviderRoot";
import { useInteractionProvider } from "./hooks";

// provider-cache.ts lifecycle (P0.8), exercised through ProviderRoot:
// StrictMode's remount reuses the set, a real unmount disposes it, and a key
// change swaps sets. The cache is module-level, so each test uses its own
// database id instead of a reset hook.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fakeSet() {
  const dispose = {
    interaction: vi.fn(async () => {}),
    media: vi.fn(async () => {}),
    customerData: vi.fn(async () => {}),
    assist: vi.fn(async () => {}),
  };
  const set = {
    interaction: { capabilities: {}, dispose: dispose.interaction },
    media: { capabilities: {}, dispose: dispose.media },
    customerData: { dispose: dispose.customerData },
    assist: { dispose: dispose.assist },
  } as unknown as ProviderSet;
  return { set, dispose };
}

const profile = { id: "p", name: "P" };
const db = (id: string) => ({ id, name: id, profileId: "p" });

/** Lets the cache's deferred `setTimeout(0)` disposal run. */
const flushTimers = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });

describe("provider cache lifecycle", () => {
  let container: HTMLElement;
  let root: Root;
  const seen: unknown[] = [];

  function Probe() {
    seen.push(useInteractionProvider());
    return null;
  }

  function app(databaseId: string, factory: () => ProviderSet, strict = true): ReactNode {
    const tree = (
      <ProviderRoot kind="sim" profile={profile} database={db(databaseId)} factory={factory}>
        <Probe />
      </ProviderRoot>
    );
    return strict ? <StrictMode>{tree}</StrictMode> : tree;
  }

  beforeAll(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    await flushTimers();
    container.remove();
    seen.length = 0;
  });

  function mount(node: ReactNode) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    return act(async () => root.render(node));
  }

  it("StrictMode's remount reuses the set and does not dispose it", async () => {
    const built = fakeSet();
    const factory = vi.fn(() => built.set);
    await mount(app("strict-remount", factory));
    await flushTimers();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(built.dispose.interaction).not.toHaveBeenCalled();
    expect(new Set(seen).size).toBe(1);
  });

  it("a real unmount disposes every provider once; mounting again builds a fresh set", async () => {
    const first = fakeSet();
    const factory = vi.fn(() => first.set);
    await mount(app("real-unmount", factory));
    await act(async () => root.unmount());
    await flushTimers();

    for (const dispose of Object.values(first.dispose)) expect(dispose).toHaveBeenCalledTimes(1);

    const second = fakeSet();
    const factory2 = vi.fn(() => second.set);
    await mount(app("real-unmount", factory2));
    expect(factory2).toHaveBeenCalledTimes(1);
    expect(second.dispose.interaction).not.toHaveBeenCalled();
  });

  it("a key change disposes the old set and builds the new one", async () => {
    const oldBuilt = fakeSet();
    const newBuilt = fakeSet();
    await mount(app("key-a", () => oldBuilt.set));
    await flushTimers();
    expect(oldBuilt.dispose.interaction).not.toHaveBeenCalled();

    const newFactory = vi.fn(() => newBuilt.set);
    await act(async () => root.render(app("key-b", newFactory)));
    await flushTimers();

    expect(newFactory).toHaveBeenCalledTimes(1);
    for (const dispose of Object.values(oldBuilt.dispose)) expect(dispose).toHaveBeenCalledTimes(1);
    for (const dispose of Object.values(newBuilt.dispose)) expect(dispose).not.toHaveBeenCalled();
    expect(seen[seen.length - 1]).toBe(newBuilt.set.interaction);
  });
});
