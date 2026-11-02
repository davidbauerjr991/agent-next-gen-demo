# The right column's drag (P-LAYOUT-F4 22b)

`node scripts/profile-renders.mjs <url> <label> 1 drag <column|panel|slideover>`: a one-second drag of the edge (60
pointer moves at 16 ms) on Lucas Thomas, dev server, Chrome headless. The window runs from the press to 400 ms after the
release. "Small commits" are the ones of 100 renders or fewer, the drag's own; the larger commits in a window are the
scripted case's events (messages arriving), not pointer moves.

| Target | | Commits per move | Component renders per move (all) | Largest commit |
| --- | --- | --- | --- | --- |
| Column | before | 2.4 | 1,629 | 1,472 |
| Column | after | 1.1 | 4 (small commits; 72 with the case's own events) | 1,359 (the case's event) |
| Copilot panel | before | 3.3 | 1,199 | 1,113 |
| Copilot panel | after | 2.1 | 10 (small commits; 60 with the case's event) | 1,000 (the case's event) |
| Slide-over | before | 3.0 | 1,944 | 1,778 |
| Slide-over | after | 1.0 | 3 | 3 |

Cause: nearly all of the renders (87k of the column's 98k, 107k of the slide-over's 117k) started in
`AgentWorkspaceAdvancedPage`, the workspace controller, on one store-subscription hook: every pointer move wrote the
width to a store the controller reads (the assignments' working state for the column and the panel, the workspace UI
store's per-assignment slide-over memory for the slide-over, and its reported slot width), so the whole page, the
transcript and the cards included, re-rendered per move. Not the transcript, `CenteredColumn` or the pushed cards as
such: they were re-rendered because the controller was.

Fix: a drag's moves are previewed in a ref (`useReferenceColumnWidth().preview`, the slide-over's `pendingWidth`) and
written once on release (`commit`, the resize-state callback ending); lyra's drag state moves the panel's own element
per move. Frame intervals during the drag stay at 16.7 ms (median and 95th percentile) in every target; the one slow
frame in the column and panel windows (about 170 to 200 ms) is the case's large commit, not a pointer move. A release
is one commit (the store write; 1,000 to 1,900 renders, once).

Home's detail panel is the same `InteriorPanel` and was already smooth: it keeps no per-move store write.
