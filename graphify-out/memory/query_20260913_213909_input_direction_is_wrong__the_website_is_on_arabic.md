---
type: "query"
date: "2026-09-13T21:39:09.139548+00:00"
question: "input direction is wrong, the website is on arabic, mean rtl not ltr and thr pass eye should be rtl too so to be at the too way left"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Input", "login/page.tsx"]
---

# Q: input direction is wrong, the website is on arabic, mean rtl not ltr and thr pass eye should be rtl too so to be at the too way left

## Answer

Expanded via graph vocabulary: [input, login]. Updated the login email and password fields to RTL with right-aligned content, moved the password visibility control to the far left, and reserved left-side padding so it cannot overlap the password. Verified visually with populated fields after a successful production build and lint.

## Outcome

- Signal: useful

## Source Nodes

- Input
- login/page.tsx