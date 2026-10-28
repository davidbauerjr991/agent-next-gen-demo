// @vitest-environment jsdom
// useMeasuredWidth (P-HOME-1m, the judder): a width crossing a reader's
// breakpoint commits at once; a change inside a band commits only once the
// size has held, so a CSS width animation doesn't render on every frame.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMeasuredWidth } from "./useMeasuredWidth";

let fire: (width: number) => void = () => {};
class FakeResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    fire = (width) => cb([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

const BANDS = [(w: number) => w < 768] as const;
let renders = 0;
let shown = 0;
function Probe({ el }: { el: HTMLElement }) {
  renders += 1;
  shown = useMeasuredWidth(el, BANDS);
  return null;
}

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  host.getBoundingClientRect = () => ({ width: 1000 }) as DOMRect;
  root = createRoot(document.createElement("div"));
  renders = 0;
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useMeasuredWidth", () => {
  it("measures on mount; in-band frames don't render until the size settles; a breakpoint crossing commits at once", () => {
    act(() => root.render(<Probe el={host} />));
    expect(shown).toBe(1000);
    const afterMount = renders;
    // A width animation's frames, all wide: no render yet.
    act(() => {
      for (const w of [980, 950, 920, 900]) fire(w);
    });
    expect(renders).toBe(afterMount);
    expect(shown).toBe(1000);
    // Held: it commits once, at the last width.
    act(() => vi.advanceTimersByTime(200));
    expect(shown).toBe(900);
    expect(renders).toBe(afterMount + 1);
    // Crossing below 768 commits on that frame.
    act(() => fire(700));
    expect(shown).toBe(700);
  });

  it("live (a full-screen panel sizing to it): every frame commits", () => {
    function LiveProbe({ el }: { el: HTMLElement }) {
      shown = useMeasuredWidth(el, BANDS, () => true);
      return null;
    }
    act(() => root.render(<LiveProbe el={host} />));
    act(() => fire(980));
    expect(shown).toBe(980);
    act(() => fire(950));
    expect(shown).toBe(950);
  });
});
