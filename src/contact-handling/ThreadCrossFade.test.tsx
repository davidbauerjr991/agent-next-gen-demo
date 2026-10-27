// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreadCrossFade } from "./ThreadCrossFade";

// A tab switch ends the incoming tab's running animations so the cross-fade is the one motion; a looping one (the
// typing dots, a spinner) can't be finished (`finish()` throws on an infinite end) — adding an Email channel to
// Lucas while his bot's dots showed blanked the page (P-HOME-1h).

function animation(endTime: number) {
  return {
    effect: { getComputedTiming: () => ({ endTime }) },
    finish: vi.fn(() => {
      if (!Number.isFinite(endTime)) throw new DOMException("Cannot finish Animation with an infinite target effect end.", "InvalidStateError");
    }),
  };
}

afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  delete (HTMLElement.prototype as Partial<HTMLElement>).getAnimations;
});

describe("ThreadCrossFade", () => {
  it("finishes the finite animations on a tab switch and leaves a looping one running", () => {
    const finite = animation(200);
    const looping = animation(Infinity);
    Object.assign(HTMLElement.prototype, {
      animate: () => ({ finished: Promise.resolve() }),
      getAnimations: () => [finite, looping],
    });
    const view = (tab: string) => (
      <div style={{ position: "relative" }}>
        <ThreadCrossFade transitionKey={tab} groupKey="lucas" />
        <p>{tab}</p>
      </div>
    );
    const root = createRoot(document.body.appendChild(document.createElement("div")));
    act(() => root.render(view("chat")));
    expect(() => act(() => root.render(view("email")))).not.toThrow();
    expect(finite.finish).toHaveBeenCalled();
    expect(looping.finish).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
