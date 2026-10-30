// @vitest-environment jsdom
// The assignments working state's panel width (P-LAYOUT fix (a)): the old InteriorPanel's width cookie moves into it
// on the first read, once, and the cookie goes.
import { beforeEach, describe, expect, it } from "vitest";
import { resetAssignmentsWorkingStateForTests, setAssignmentsWorkingState } from "./assignments-working-state";

const KEY = "agent-next-gen:working:assignments";
const COOKIE = "workspace.assignmentsPanel";
/** The cookie is present at all (an expired one is gone; one set to an empty value would still count). */
const cookieSet = () => document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`));
/** The first read (an empty write reads first) and what's stored after it. */
const firstRead = () => {
  setAssignmentsWorkingState({});
  return JSON.parse(localStorage.getItem(KEY)!) as { panelWidth: number | null };
};

beforeEach(() => {
  localStorage.clear();
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
  resetAssignmentsWorkingStateForTests();
});

describe("the interior panel's width in the working state (P-LAYOUT fix (a))", () => {
  it("is null until dragged, and keeps what's written", () => {
    expect(firstRead().panelWidth).toBeNull();
    setAssignmentsWorkingState({ panelWidth: 400 });
    expect(JSON.parse(localStorage.getItem(KEY)!).panelWidth).toBe(400);
  });

  it("the old panel's width cookie is read into it once, then deleted", () => {
    document.cookie = `${COOKIE}=410; path=/`;
    expect(firstRead().panelWidth).toBe(410);
    expect(cookieSet()).toBe(false);
  });

  it("only the first read migrates: a cookie set after it is ignored", () => {
    document.cookie = `${COOKIE}=410; path=/`;
    expect(firstRead().panelWidth).toBe(410);
    document.cookie = `${COOKIE}=390; path=/`;
    setAssignmentsWorkingState({});
    expect(JSON.parse(localStorage.getItem(KEY)!).panelWidth).toBe(410);
  });

  it("an empty or zero cookie isn't a width: the state stays null and the cookie goes", () => {
    document.cookie = `${COOKIE}=0; path=/`;
    expect(firstRead().panelWidth).toBeNull();
    expect(cookieSet()).toBe(false);
  });

  it("a width already stored wins over the cookie, and the cookie still goes", () => {
    localStorage.setItem(KEY, JSON.stringify({ panelWidth: 380 }));
    document.cookie = `${COOKIE}=410; path=/`;
    expect(firstRead().panelWidth).toBe(380);
    expect(cookieSet()).toBe(false);
  });
});
