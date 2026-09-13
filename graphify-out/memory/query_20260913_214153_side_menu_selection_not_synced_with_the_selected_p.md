---
type: "query"
date: "2026-09-13T21:41:53.442885+00:00"
question: "side menu selection not synced with the selected page"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Sidebar()", "(shell)/layout.tsx", "sidebar.tsx"]
---

# Q: side menu selection not synced with the selected page

## Answer

Expanded via graph vocabulary: [sidebar, layout, pathname, active, navigation]. Root cause: the persistent App Router layout captured x-pathname only on its initial server render, so the Sidebar active prop stayed at '/'. Converted Sidebar to a client component using usePathname(), tightened nested-route matching to exact href or href plus '/', removed the stale layout header dependency, and verified both /fleets and /fleets/[id] expose الأساطيل as aria-current=page with the correct highlight.

## Outcome

- Signal: useful

## Source Nodes

- Sidebar()
- (shell)/layout.tsx
- sidebar.tsx