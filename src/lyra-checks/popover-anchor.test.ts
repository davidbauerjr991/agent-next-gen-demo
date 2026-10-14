// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
// lyra-ui has no test runner of its own; its pure helpers that this app
// depends on are unit-tested here, against the live sibling source.
import { createLastKnownAnchor } from "../../../lyra-ui/src/components/popover-anchor";

function rect(x: number, y: number): DOMRect {
  return new DOMRect(x, y, 100, 40);
}

describe("createLastKnownAnchor (lyra Popover virtual anchor)", () => {
  it("measures the element live while it's on the page", () => {
    const el = document.createElement("button");
    document.body.appendChild(el);
    let current = rect(10, 20);
    el.getBoundingClientRect = () => current;
    const anchor = createLastKnownAnchor(() => el);
    expect(anchor.getBoundingClientRect()).toMatchObject({ x: 10, y: 20 });
    current = rect(30, 40);
    expect(anchor.getBoundingClientRect()).toMatchObject({ x: 30, y: 40 });
    el.remove();
  });

  it("keeps the last position once the element leaves the page", () => {
    const el = document.createElement("button");
    document.body.appendChild(el);
    el.getBoundingClientRect = () => (el.isConnected ? rect(200, 300) : rect(0, 0));
    const anchor = createLastKnownAnchor(() => el);
    anchor.getBoundingClientRect();
    el.remove();
    expect(anchor.getBoundingClientRect()).toMatchObject({ x: 200, y: 300 });
  });

  it("starts fresh for a new element", () => {
    const first = document.createElement("button");
    const second = document.createElement("button");
    document.body.append(first);
    first.getBoundingClientRect = () => rect(200, 300);
    second.getBoundingClientRect = () => rect(0, 0);
    let target: HTMLElement = first;
    const anchor = createLastKnownAnchor(() => target);
    anchor.getBoundingClientRect();
    target = second; // detached, never measured on the page
    expect(anchor.getBoundingClientRect()).toMatchObject({ x: 0, y: 0 });
    first.remove();
  });
});
