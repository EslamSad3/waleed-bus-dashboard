---
type: "query"
date: "2026-09-13T21:36:58.312138+00:00"
question: "inputs are seems not correct also make sure remember me works correctly logic"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Input", "login/page.tsx", "lib/auth.ts", "proxy.ts", "refreshSession()", "setSessionCookies()"]
---

# Q: inputs are seems not correct also make sure remember me works correctly logic

## Answer

Expanded from original query via vocab: [auth, login, session, cookie, cookies, input]. Fixed login input direction and eye-button overlap, standardized autofill styling, added an accessible styled remember-me control, introduced a server-only persistence marker, preserved the 7-day choice across refresh-token rotation, and restored missing access sessions at the proxy boundary. Verified unchecked refresh cookies remain session cookies, checked cookies persist for 604800 seconds, both refresh flows redirect once and then return 200.

## Outcome

- Signal: useful

## Source Nodes

- Input
- login/page.tsx
- lib/auth.ts
- proxy.ts
- refreshSession()
- setSessionCookies()