import type { ProviderSet } from "../providers";

// Reference-counted provider sets that survive StrictMode.
//
// Building in an effect would cost a blank first frame; building in a
// useState initializer leaks the extra instance StrictMode's double render
// makes. Instead `peek` (render) creates at most once per key, `retain`/
// `release` (effect setup/cleanup) count users, and a release to zero only
// schedules disposal. StrictMode's unmount→remount happens inside one commit,
// so the remount's `retain` cancels it; a real unmount (or a key change, e.g.
// switching database) disposes the set and drops it, so the next `peek`
// builds a fresh one.
//
// Known limitation: a render React discards before commit could leave a
// zero-ref set that's never disposed. The root mounts once, so this is
// accepted.

interface Entry {
  set: ProviderSet;
  refs: number;
  pendingDispose?: ReturnType<typeof setTimeout>;
}

const entries = new Map<string, Entry>();

function log(message: string) {
  if (import.meta.env.DEV) console.debug(`[providers] ${message}`);
}

/** The set for `key`, created with `create` if there isn't one. Safe to call
 *  from render. */
export function peekProviderSet(key: string, create: () => ProviderSet): ProviderSet {
  let entry = entries.get(key);
  if (!entry) {
    entry = { set: create(), refs: 0 };
    entries.set(key, entry);
    log(`created ${key}`);
  }
  return entry.set;
}

/** Marks one user of `key` (effect setup); cancels a pending disposal. */
export function retainProviderSet(key: string): void {
  const entry = entries.get(key);
  if (!entry) return;
  entry.refs += 1;
  if (entry.pendingDispose !== undefined) {
    clearTimeout(entry.pendingDispose);
    entry.pendingDispose = undefined;
  }
}

/** Drops one user of `key` (effect cleanup); disposes once nobody re-retains
 *  it within the same turn. */
export function releaseProviderSet(key: string): void {
  const entry = entries.get(key);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0 || entry.pendingDispose !== undefined) return;
  entry.pendingDispose = setTimeout(() => {
    entry.pendingDispose = undefined;
    if (entry.refs > 0 || entries.get(key) !== entry) return;
    entries.delete(key);
    void disposeSet(key, entry.set);
  }, 0);
}

async function disposeSet(key: string, set: ProviderSet): Promise<void> {
  const results = await Promise.allSettled([
    set.interaction.dispose(),
    set.media.dispose(),
    set.customerData.dispose(),
    set.assist.dispose(),
  ]);
  log(`disposed ${key}`);
  if (import.meta.env.DEV) {
    for (const r of results) {
      if (r.status === "rejected") console.error(`[providers] dispose failed for ${key}`, r.reason);
    }
  }
}

/** Disposes every set — for HMR, so a hot update doesn't leak transports. */
function disposeAll(): void {
  for (const [key, entry] of entries) {
    if (entry.pendingDispose !== undefined) clearTimeout(entry.pendingDispose);
    void disposeSet(key, entry.set);
  }
  entries.clear();
}

import.meta.hot?.dispose(disposeAll);
