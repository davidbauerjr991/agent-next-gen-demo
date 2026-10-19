// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { HostSlot } from "./portal-hosts";

// E1: two slots active in one commit (the left nav's voice slot mounting while the bottom one is still active),
// then the later one deactivates. The host must end up in the slot still active, never detached.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Layout({ host, top, bottomActive }: { host: HTMLElement; top: boolean; bottomActive: boolean }) {
  return (
    <>
      {top && <HostSlot host={host} data-testid="top" />}
      <HostSlot host={host} active={bottomActive} data-testid="bottom" />
    </>
  );
}

let container: HTMLDivElement;
let root: Root;
const slot = (id: string) => container.querySelector(`[data-testid=${id}]`);
const renderLayout = (host: HTMLElement, top: boolean, bottomActive: boolean) =>
  act(() => root.render(<Layout host={host} top={top} bottomActive={bottomActive} />));

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
}

describe("HostSlot", () => {
  it("hands the host back to the slot still active when the later one deactivates", () => {
    mount();
    const host = document.createElement("div");
    renderLayout(host, true, true);
    renderLayout(host, true, false);
    expect(host.parentNode).toBe(slot("top"));
  });

  it("falls back to the remaining slot when the holder unmounts", () => {
    mount();
    const host = document.createElement("div");
    renderLayout(host, false, true);
    renderLayout(host, true, true);
    expect(host.parentNode).toBe(slot("top"));
    renderLayout(host, false, true);
    expect(host.parentNode).toBe(slot("bottom"));
  });
});
