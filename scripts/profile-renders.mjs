// Render profiling for the agent workspace (P-LAYOUT-F2 8): which components re-render, how often and why, on Phase 2's
// Home and on an active call, 10 seconds each. Drives the installed Chrome (playwright's `channel: "chrome"`, as
// playwright.config.ts) against a running server — the dev server or `npm run build && npm run preview` — and reads
// React's committed fibers through a stand-in DevTools hook installed before React loads.
//
//   node scripts/profile-renders.mjs <base url> <label> [seconds] [steady|events]
//   e.g. node scripts/profile-renders.mjs http://localhost:5199/agent-next-gen-demo/ dev
//
// "events" (P-LAYOUT-F3 15) measures what an event re-renders instead of the steady state: every commit for
// [seconds] after an arrival (Maya Chen, hotkey B, answered on arrival) and after an accept (Tom Lewis, hotkey C,
// ringing, then Accept), with no settling before each — the cards' state fanning out (the 2026-11-01 baseline's
// cause 2). It reports commits, total renders, the largest commit, and the components that started them.
//
// Per component: renders (a fiber that rendered in a commit: mounted, or new props, state or context), total
// `actualDuration` (dev only: production React keeps no per-fiber timings, so prod reports counts and the commits'
// wall-clock time), and the cause of each render — "props" (the parent passed new ones), "state" (one of its own hooks
// changed: which hook index, so a store subscription or a timer can be told apart in the source), "context", "mount".
// Production names are minified: each type is also reported with the first string literal in its source, to find it.
import { chromium } from "@playwright/test";

const [base, label = "run", seconds = "10", mode = "steady"] = process.argv.slice(2);
if (!base) {
  console.error("usage: node scripts/profile-renders.mjs <base url> <label> [seconds] [steady|events]");
  process.exit(1);
}
const WINDOW_MS = Number(seconds) * 1000;

/** Installed in the page before any script: React registers with it and reports every commit. */
function installHook() {
  const stats = { recording: false, commits: 0, commitWallMs: 0, longTasks: 0, longTaskMs: 0, types: new Map() };
  window.__renderStats = stats;
  const nameOf = (type) => {
    if (!type) return null;
    if (typeof type === "string") return null; // host component
    const inner = type.render ?? type.type ?? type;
    return type.displayName ?? inner.displayName ?? inner.name ?? "(anonymous)";
  };
  const hintOf = (type) => {
    const fn = type?.render ?? type?.type ?? type;
    if (typeof fn !== "function") return "";
    const match = /["'`]([^"'`\n]{4,60})["'`]/.exec(Function.prototype.toString.call(fn));
    return match ? match[1] : "";
  };
  /** Which of a function component's hooks changed (its index in the hook list), or -1. */
  const changedHook = (fiber, prev) => {
    let a = fiber.memoizedState;
    let b = prev.memoizedState;
    for (let i = 0; a && b && i < 200; i++, a = a.next, b = b.next) {
      const v = a.memoizedState;
      // An effect's slot is a new object every render: not a cause.
      const isEffect = v && typeof v === "object" && "create" in v && "deps" in v;
      if (!isEffect && v !== b.memoizedState) {
        // A preview of the new value, to find the hook in the source (a store snapshot's keys, a number, …).
        const preview =
          v === null || v === undefined ? String(v)
          : typeof v === "object" ? (Array.isArray(v) ? `array(${v.length})` : `{${Object.keys(v).slice(0, 4).join(",")}}`)
          : typeof v === "function" ? "fn"
          : String(v).slice(0, 24);
        return `${i}:${preview}`;
      }
    }
    return -1;
  };
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]); // function, class, forwardRef, memo, simple memo
  const PERFORMED_WORK = 1; // React's flag on a fiber that rendered in this pass (in production too)
  /** `fiber` is in this commit's tree; `prev` the version it was cloned from (null: mounted now). */
  const record = (fiber, prev) => {
    if (prev && !(fiber.flags & PERFORMED_WORK)) return; // cloned but bailed out: didn't render
    let cause;
    if (!prev) cause = "mount";
    else if (fiber.memoizedProps !== prev.memoizedProps) cause = "props";
    else if (fiber.memoizedState !== prev.memoizedState) cause = `state#${changedHook(fiber, prev)}`;
    else cause = "context";
    const name = nameOf(fiber.type);
    if (!name) return;
    const key = name;
    let entry = stats.types.get(key);
    if (!entry) {
      entry = { name, hint: hintOf(fiber.type), renders: 0, selfMs: 0, causes: {} };
      stats.types.set(key, entry);
    }
    entry.renders++;
    stats.commitRenders++;
    if (cause !== "props" && cause !== "mount") stats.commitOrigins.add(`${name}(${cause})`);
    // Self time (dev only): its actualDuration less its children's that ran in this commit, as DevTools counts it.
    if (typeof fiber.actualDuration === "number") {
      let children = 0;
      // Its children ran this pass only when their list was re-created (else they were skipped, with stale times).
      if (!prev || fiber.child !== prev.child) {
        for (let c = fiber.child; c; c = c.sibling) if (typeof c.actualDuration === "number") children += c.actualDuration;
      }
      entry.selfMs += Math.max(0, fiber.actualDuration - children);
    }
    entry.causes[cause] = (entry.causes[cause] ?? 0) + 1;
  };
  /** The committed tree, as React DevTools walks it: a subtree React skipped (its child list is the previous one,
   *  untouched) didn't render and isn't entered; its fibers' stale `alternate`s would otherwise look like renders. */
  const walk = (root) => {
    const stack = [[root, root.alternate]];
    while (stack.length) {
      const [f, prev] = stack.pop();
      if (COMPONENT_TAGS.has(f.tag)) record(f, prev);
      if (prev && f.child === prev.child) continue;
      for (let c = f.child; c; c = c.sibling) {
        // A child cloned this pass points at its previous version; a new one has none.
        const before = c.alternate && prev ? c.alternate : null;
        stack.push([c, before]);
      }
    }
  };
  let ids = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    inject(renderer) {
      const id = ++ids;
      this.renderers.set(id, renderer);
      return id;
    },
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
    onCommitFiberRoot(_id, root) {
      if (!stats.recording) return;
      const t0 = performance.now();
      stats.commits++;
      stats.commitRenders = 0;
      stats.commitOrigins = new Set();
      walk(root.current);
      stats.commitLog.push({ renders: stats.commitRenders, origins: [...stats.commitOrigins].slice(0, 6) });
      stats.walkMs = (stats.walkMs ?? 0) + (performance.now() - t0);
    },
  };
  // Timer callbacks (the page clock's 1s tick, the queue walk, the sim's timers), timed through the render React runs
  // in the microtasks right after them: the work a tick costs, in production too (no per-fiber timings there).
  const nativeSetInterval = window.setInterval.bind(window);
  window.setInterval = (fn, ms, ...args) =>
    nativeSetInterval(
      (...a) => {
        if (!stats.recording) return fn(...a);
        const t0 = performance.now();
        fn(...a);
        const done = () => {
          const ms = performance.now() - t0;
          stats.intervalRuns = (stats.intervalRuns ?? 0) + 1;
          stats.intervalMs = (stats.intervalMs ?? 0) + ms;
          stats.intervalMax = Math.max(stats.intervalMax ?? 0, ms);
        };
        // After the microtasks: a `useSyncExternalStore` update (the page clock's `useClockValue`) renders at SyncLane
        // in a microtask, so it's inside; a plain setState renders in a Scheduler task, which MessageChannel's FIFO
        // ordering still puts before this one. Passive effects after the commit aren't counted.
        const channel = new MessageChannel();
        channel.port1.onmessage = done;
        channel.port2.postMessage(null);
      },
      ms,
      ...args,
    );
  new PerformanceObserver((list) => {
    if (!stats.recording) return;
    for (const entry of list.getEntries()) {
      stats.longTasks++;
      stats.longTaskMs += entry.duration;
    }
  }).observe({ type: "longtask", buffered: false });
}

/** Waits until no page-wide commit (over 1,500 renders: the cards' state, an arrival, a toast) has happened for
 *  `quietMs`, up to `maxMs`, so a window measures the steady state, not the arrival before it. Returns how long it
 *  waited and how many such commits it saw. */
async function settle(page, quietMs = 3000, maxMs = 30000) {
  await page.evaluate(() => Object.assign(window.__renderStats, { commitLog: [], recording: true }));
  const started = Date.now();
  let lastBig = Date.now();
  let seen = 0;
  while (Date.now() - started < maxMs) {
    await page.waitForTimeout(250);
    const big = await page.evaluate(() => {
      const s = window.__renderStats;
      const n = s.commitLog.filter((c) => c.renders > 1500).length;
      s.commitLog = [];
      return n;
    });
    if (big > 0) {
      seen += big;
      lastBig = Date.now();
    } else if (Date.now() - lastBig >= quietMs) break;
  }
  await page.evaluate(() => (window.__renderStats.recording = false));
  return { waitedMs: Date.now() - started, pageCommits: seen };
}

async function measure(page, what) {
  await page.evaluate(() => {
    const s = window.__renderStats;
    s.types = new Map();
    Object.assign(s, { commits: 0, walkMs: 0, longTasks: 0, longTaskMs: 0, commitLog: [], intervalRuns: 0, intervalMs: 0, intervalMax: 0, recording: true });
  });
  await page.waitForTimeout(WINDOW_MS);
  const result = await page.evaluate(() => {
    const s = window.__renderStats;
    s.recording = false;
    return {
      commits: s.commits, walkMs: s.walkMs, longTasks: s.longTasks, longTaskMs: s.longTaskMs, types: [...s.types.values()], commitLog: s.commitLog,
      intervalRuns: s.intervalRuns, intervalMs: s.intervalMs, intervalMax: s.intervalMax,
    };
  });
  // The harness's own walk runs inside those timed callbacks too: it's taken out of their total.
  const timerMs = Math.max(0, result.intervalMs - result.walkMs);
  // The commits by size, with what started each.
  const heaviest = [...result.commitLog].sort((a, b) => b.renders - a.renders).slice(0, 8);
  const byCount = [...result.types].sort((a, b) => b.renders - a.renders).slice(0, 8);
  const byTime = [...result.types].sort((a, b) => b.selfMs - a.selfMs).slice(0, 8);
  const total = result.types.reduce((n, t) => n + t.renders, 0);
  // Where commits start: renders of a component's own (state or context), not handed down as props.
  const own = (t) => Object.entries(t.causes).filter(([c]) => c !== "props" && c !== "mount").reduce((n, [, v]) => n + v, 0);
  const origins = [...result.types].filter((t) => own(t) > 0).sort((a, b) => own(b) - own(a)).slice(0, 12);
  return { what, seconds: WINDOW_MS / 1000, commits: result.commits, renders: total, longTasks: result.longTasks, longTaskMs: Math.round(result.longTaskMs), timerRuns: result.intervalRuns, timerMs: Math.round(timerMs), timerMaxMs: Math.round(result.intervalMax), byCount, byTime, origins, heaviest };
}

/** Every commit from just before `act` (no settling) to WINDOW_MS after it: their count, total renders, the largest,
 *  and what started them (each commit's origins, weighted by its renders). */
async function measureEvent(page, what, act) {
  await page.evaluate(() => {
    const s = window.__renderStats;
    s.types = new Map();
    Object.assign(s, { commits: 0, walkMs: 0, commitLog: [], recording: true });
  });
  await act();
  await page.waitForTimeout(WINDOW_MS);
  const log = await page.evaluate(() => {
    const s = window.__renderStats;
    s.recording = false;
    return s.commitLog;
  });
  const renders = log.reduce((n, c) => n + c.renders, 0);
  const starters = new Map();
  for (const c of log) for (const o of c.origins) starters.set(o, (starters.get(o) ?? 0) + c.renders);
  return {
    what,
    seconds: WINDOW_MS / 1000,
    commits: log.length,
    renders,
    largest: log.reduce((m, c) => Math.max(m, c.renders), 0),
    heaviest: [...log].sort((a, b) => b.renders - a.renders).slice(0, 8),
    starters: [...starters].sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.addInitScript(installHook);
await page.goto(new URL("?provider=sim#/agent-advanced", base).toString());
await page.getByRole("button", { name: "Go Available" }).click();
// "drag" (P-LAYOUT-F4 22b): a 1-second drag of the right column's edge (about 60 pointer moves at 16 ms), measured
// from just before the press to 400 ms after the release: commits and renders per move during the drag, and what a
// release costs. Target: `column` (AI display inline, Lucas Thomas, hotkey A), `panel` (AI display "panel": the Copilot
// panel) or `slideover` (inline, Contact Details open: its edge). No Phase 2 first: AI display is seeded.
//   node scripts/profile-renders.mjs <base url> <label> 1 drag [column|panel|slideover]
if (mode === "drag") {
  const target = process.argv[6] ?? "column";
  const display = target === "panel" ? "panel" : "inline";
  await page.addInitScript((d) => localStorage.setItem("agent-next-gen:settings:ai", JSON.stringify({ v: 1, value: { displayLocation: d, canvasLayout: "twoColumn" } })), display);
  await page.goto(new URL("?provider=sim&latency=off#/agent-advanced", base).toString());
  await page.getByRole("button", { name: "Go Available" }).click();
  await page.keyboard.press("a");
  await page.locator("[data-slot=assignment-card]").getByText("Lucas").first().click();
  await page.waitForTimeout(3000);
  if (target === "slideover") {
    await page.locator("button[data-contact-details]").first().click();
    await page.waitForTimeout(1200);
  }
  await settle(page);
  const sel = target === "slideover" ? "[data-slot=reference-slide-over]" : target === "panel" ? "[data-slot=right-panel] > div" : "[data-canvas-region=reference]";
  const edge = await page.evaluate((s) => {
    const b = document.querySelector(s).getBoundingClientRect();
    return { x: b.left + 1, y: b.top + 300 };
  }, sel);
  await page.evaluate(() => {
    const s = window.__renderStats;
    s.types = new Map();
    Object.assign(s, { commits: 0, walkMs: 0, commitLog: [], recording: true });
  });
  const MOVES = 60;
  // Frame intervals during the drag (requestAnimationFrame): the layout and paint cost React's counts don't show.
  await page.evaluate(() => {
    window.__frames = [];
    window.__framing = true;
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__framing) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  const dragStart = await page.evaluate(() => window.__renderStats.commitLog.length);
  for (let i = 1; i <= MOVES; i++) {
    await page.mouse.move(edge.x - i * 3, edge.y);
    await page.waitForTimeout(16);
  }
  const dragEnd = await page.evaluate(() => window.__renderStats.commitLog.length);
  const frames = await page.evaluate(() => {
    window.__framing = false;
    return window.__frames.slice();
  });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const out = await page.evaluate(([a, b]) => {
    const s = window.__renderStats;
    s.recording = false;
    const during = s.commitLog.slice(a, b);
    const small = during.filter((c) => c.renders <= 100);
    const after = s.commitLog.slice(b);
    const sum = (l) => l.reduce((n, c) => n + c.renders, 0);
    const starters = new Map();
    for (const c of during) for (const o of c.origins) starters.set(o, (starters.get(o) ?? 0) + c.renders);
    const byCount = [...s.types.values()].sort((x, y) => y.renders - x.renders).slice(0, 12).map((t) => `${t.name} ${t.renders}`);
    return { during: { small: { commits: small.length, renders: sum(small) }, commits: during.length, renders: sum(during), largest: during.reduce((m, c) => Math.max(m, c.renders), 0) }, after: { commits: after.length, renders: sum(after) }, starters: [...starters].sort((x, y) => y[1] - x[1]).slice(0, 8), byCount };
  }, [dragStart, dragEnd]);
  await browser.close();
  const per = (n) => (n / MOVES).toFixed(1);
  console.log(`\n### ${label} — drag ${target} (${MOVES} moves in about 1 s)\n`);
  console.log(`During the drag: ${out.during.commits} commits (${per(out.during.commits)} per move), ${out.during.renders} component renders (${per(out.during.renders)} per move), largest commit ${out.during.largest}.`);
  console.log(`Of those, the small commits (100 renders or fewer: the drag's own): ${out.during.small.commits} commits, ${out.during.small.renders} renders (${per(out.during.small.renders)} per move). The rest are the scripted case's events, not pointer moves.`);
  const sorted = [...frames].sort((x, y) => x - y);
  console.log(`Frame intervals during the drag: median ${sorted[Math.floor(sorted.length / 2)]?.toFixed(1)} ms, p95 ${sorted[Math.floor(sorted.length * 0.95)]?.toFixed(1)} ms, slowest ${sorted.at(-1)?.toFixed(1)} ms over ${frames.length} frames.`);
  console.log(`From the release to 400 ms after: ${out.after.commits} commits, ${out.after.renders} renders.`);
  console.log("\nWhat started the renders during the drag (component: renders in the commits it started):\n");
  for (const [name, n] of out.starters) console.log(`- ${name}: ${n}`);
  console.log("\nMost-rendered components over the whole window:\n");
  for (const t of out.byCount) console.log(`- ${t}`);
  process.exit(0);
}

// Phase 2, from Settings → Profile.
await page.locator("aside").getByText("Settings", { exact: true }).first().click();
await page.getByRole("combobox", { name: "Profile" }).click();
await page.getByRole("option", { name: "Phase 2", exact: true }).click();
await page.locator("aside").getByRole("button", { name: "Home", exact: true }).first().click();
if (mode === "events") {
  await settle(page);
  const arrival = await measureEvent(page, "Arrival (Maya Chen, answered on arrival)", async () => {
    await page.keyboard.press("b");
  });
  await settle(page);
  const accept = await measureEvent(page, "Accept (Tom Lewis, ringing, then Accept)", async () => {
    await page.keyboard.press("c");
    await page.getByRole("button", { name: /^Accept/ }).first().click({ timeout: 20_000 });
  });
  await browser.close();
  for (const run of [arrival, accept]) {
    console.log(`\n### ${label} — ${run.what} (${run.seconds}s after it)\n`);
    console.log(`Commits ${run.commits}, component renders ${run.renders}, largest commit ${run.largest}.`);
    console.log("\nCommits by size (renders: what started them):\n");
    for (const c of run.heaviest) console.log(`- ${c.renders}: ${c.origins.join(", ") || "(props only)"}`);
    console.log("\nWhat started the renders (component: renders in the commits it started):\n");
    for (const [name, n] of run.starters) console.log(`- ${name}: ${n}`);
  }
  console.log(`\n<!-- json ${JSON.stringify({ label, arrival, accept })} -->`);
  process.exit(0);
}

// The steady state: after the seeded contacts' arrival and the profile's settling (a window that still sees page-wide
// commits after 20 s reports them as a cause of its own).
const homeSettle = await settle(page);
const home = { ...(await measure(page, "Home")), settle: homeSettle };
// An active call: Maya Chen (the sim's hotkey B), answered on arrival, opened; measured once its arrival (the card, its
// toast) has settled.
await page.keyboard.press("b");
await page.locator("aside [aria-label^='Maya Chen']").first().waitFor({ timeout: 20_000 });
await page.locator("aside [aria-label^='Maya Chen']").first().click({ force: true });
const callSettle = await settle(page);
const call = { ...(await measure(page, "Active call")), settle: callSettle };
await browser.close();

const rows = (list, key) => list.map((t) => `| ${t.name} | ${t.hint ? `\`${t.hint.replace(/\|/g, "\\|")}\`` : ""} | ${t.renders} | ${t.selfMs.toFixed(1)} | ${Object.entries(t.causes).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ")} |`).join("\n");
for (const run of [home, call]) {
  console.log(`\n### ${label} — ${run.what} (${run.seconds}s)\n`);
  console.log(`Commits ${run.commits}, component renders ${run.renders}, long tasks ${run.longTasks} (${run.longTaskMs} ms).`);
  console.log(`Settled first: ${Math.round(run.settle.waitedMs / 1000)} s, ${run.settle.pageCommits} page-wide commits while settling.`);
  console.log(`Interval callbacks (every setInterval: the page clock, the queue walk, the sim) with their renders: ${run.timerRuns} runs, ${run.timerMs} ms in all (slowest ${run.timerMaxMs} ms; the harness's own walk taken out of the total).\n`);
  console.log("Top five by render count:\n\n| Component | Hint | Renders | Time (ms) | Causes |\n| --- | --- | --- | --- | --- |");
  console.log(rows(run.byCount.slice(0, 5)));
  console.log("\nTop five by self time:\n\n| Component | Hint | Renders | Time (ms) | Causes |\n| --- | --- | --- | --- | --- |");
  console.log(rows(run.byTime.slice(0, 5)));
  console.log("\nOrigins (renders from the component's own state or context):\n\n| Component | Hint | Renders | Time (ms) | Causes |\n| --- | --- | --- | --- | --- |");
  console.log(rows(run.origins));
  console.log("\nHeaviest commits (renders: what started them):\n");
  for (const c of run.heaviest) console.log(`- ${c.renders}: ${c.origins.join(", ") || "(props only: a parent outside React's tree, or a root render)"}`);
}
console.log(`\n<!-- json ${JSON.stringify({ label, home, call })} -->`);
