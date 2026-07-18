# Graph Report - release-truth-gate  (2026-07-18)

## Corpus Check
- 73 files · ~199,512 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 400 nodes · 804 edges · 29 communities (22 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9bffc868`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]

## God Nodes (most connected - your core abstractions)
1. `databaseRoute()` - 41 edges
2. `jsonResponse()` - 23 edges
3. `scripts` - 19 edges
4. `requireSameOriginMutation()` - 15 edges
5. `parseJsonBody()` - 14 edges
6. `requireAuthenticatedUser()` - 14 edges
7. `appendAuditEvent()` - 12 edges
8. `Evidence Gate MVP audit` - 11 edges
9. `canonicalJson()` - 10 edges
10. `HttpError` - 10 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `databaseRoute()`  [EXTRACTED]
  app/api/releases/[releaseId]/claims/route.js → src/server/http.js
- `GET()` --calls--> `databaseRoute()`  [EXTRACTED]
  app/api/releases/[releaseId]/evidence/route.js → src/server/http.js
- `PATCH()` --calls--> `databaseRoute()`  [EXTRACTED]
  app/api/releases/[releaseId]/route.js → src/server/http.js
- `requireSameOriginMutation()` --calls--> `validateSameOrigin()`  [EXTRACTED]
  src/server/http.js → api/security.mjs
- `parseJsonBody()` --calls--> `readBoundedText()`  [EXTRACTED]
  src/server/http.js → api/security.mjs

## Import Cycles
- None detected.

## Communities (29 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (30): logOutcome(), POST(), analysisRequestSchema, analystInstructions, buildAnalysisInput(), evidenceAssessmentSchema, groundAssessment(), identifier (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (34): assessmentSchema, buildShareUrl(), canonicalJson(), citationSchema, createEvidenceExport(), decisionSchema, decodeBase64Url(), encodeBase64Url() (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (46): dependencies, dotenv, drizzle-orm, @fontsource-variable/inter, next, openai, @opennextjs/cloudflare, pg (+38 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): Authorization, Baseline verification, Client-owned product state, Current architecture, Deployment target update, Evidence Gate MVP audit, Executive finding, Expected external blockers (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (29): requestSchema, clearUserSessionCookieHeader(), createUserSession(), getUserSession(), hashSessionToken(), parseCookies(), revokeRequestSession(), secureCookiesEnabled() (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (13): appendDecision(), calculateVerdict(), createDecisionRecord(), currentApprovalForCoverage(), deriveClaimCoverage(), deriveFindings(), isValidDate(), KNOWN_RELATIONS (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (48): claimSchema, GET(), POST(), json(), user(), auditEvents, claimEvidenceLinks, claims (+40 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (7): Design QA, Functional checks, Ground truth and artifacts, Measured viewports, Remaining production prerequisites, Runtime checks, Visual decisions

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (8): Local development, PostgreSQL, Product surface, Production configuration, Release Truth, Security boundary, Trust model, Verification

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (5): Dependency and incident practice, Implemented controls, Protected assets, Residual production requirements, Security model

### Community 10 - "Community 10"
Cohesion: 0.50
Nodes (3): Answer, Q: What trust-boundary fixes closed the Round 2 audit findings?, Source Nodes

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (3): Answer, Q: What makes the final Release Truth snapshot reproducible and deployable?, Source Nodes

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (9): App(), can(), capabilities, formatDate(), initials(), markers, ProductApp(), ProductShell() (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (25): POST(), apiRequest(), cookieFrom(), inviteAndAccept(), registerUser(), responseJson(), DatabaseUnavailableError, openDatabase() (+17 more)

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (4): client, databaseName, env, parsed

## Knowledge Gaps
- **138 isolated node(s):** `identifier`, `payload`, `assessment`, `requestSchema`, `requestSchema` (+133 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `canonicalJson()` connect `Community 6` to `Community 1`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Why does `jsonResponse()` connect `Community 0` to `Community 24`, `Community 4`, `Community 6`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `appendAuditEvent()` connect `Community 6` to `Community 24`, `Community 4`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `identifier`, `payload`, `assessment` to the rest of the system?**
  _138 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12435897435897436 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06079664570230608 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._