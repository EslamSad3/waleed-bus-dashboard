---
type: "query"
date: "2026-09-13T18:41:09.133117+00:00"
question: "Why does fleet-owner creation show ممنوع?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["[...proxy]/route.ts", "errors.ts"]
---

# Q: Why does fleet-owner creation show ممنوع?

## Answer

Expanded from original query via graph vocabulary: [fleet, owner, create, platform, permission, guard, authorization, auth, role, membership, admin]. The rejection came from the dashboard BFF CSRF origin check in app/api/[...proxy]/route.ts. Inside Docker, req.nextUrl.host could represent the internal container address rather than the browser-visible host. The fix compares Origin against x-forwarded-host or Host. Matching localhost and 127.0.0.1 probes now reach validation with HTTP 400, authenticated login returns 201, and GET fleet-owners returns 200.

## Outcome

- Signal: useful

## Source Nodes

- [...proxy]/route.ts
- errors.ts