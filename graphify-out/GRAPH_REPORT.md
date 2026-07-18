# Graph Report - release-truth-gate  (2026-07-18)

## Corpus Check
- 64 files · ~193,500 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 350 nodes · 625 edges · 30 communities (23 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `70094025`
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
- [[_COMMUNITY_Community 29|Community 29]]

## God Nodes (most connected - your core abstractions)
1. `databaseRoute()` - 23 edges
2. `scripts` - 19 edges
3. `jsonResponse()` - 17 edges
4. `Evidence Gate MVP audit` - 11 edges
5. `consumeRateLimit()` - 9 edges
6. `POST()` - 9 edges
7. `HttpError` - 9 edges
8. `requireSameOriginMutation()` - 9 edges
9. `getAnalystAccessState()` - 8 edges
10. `validateSameOrigin()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `requireSameOriginMutation()` --calls--> `validateSameOrigin()`  [EXTRACTED]
  src/server/http.js → api/security.mjs
- `parseJsonBody()` --calls--> `readBoundedText()`  [EXTRACTED]
  src/server/http.js → api/security.mjs
- `POST()` --calls--> `jsonResponse()`  [EXTRACTED]
  app/api/analyze/route.js → api/security.mjs
- `GET()` --calls--> `jsonResponse()`  [EXTRACTED]
  app/api/session/route.js → api/security.mjs
- `POST()` --calls--> `jsonResponse()`  [EXTRACTED]
  app/api/session/route.js → api/security.mjs

## Import Cycles
- None detected.

## Communities (30 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (29): logOutcome(), POST(), analysisRequestSchema, analystInstructions, buildAnalysisInput(), evidenceAssessmentSchema, groundAssessment(), identifier (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (38): canonicalJson(), sortCanonical(), assessmentSchema, buildShareUrl(), canonicalJson(), citationSchema, createEvidenceExport(), decisionSchema (+30 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (27): dependencies, dotenv, drizzle-orm, @fontsource-variable/inter, next, openai, @opennextjs/cloudflare, pg (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): Authorization, Baseline verification, Client-owned product state, Current architecture, Deployment target update, Evidence Gate MVP audit, Executive finding, Expected external blockers (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (35): POST(), requestSchema, jsonResponse(), apiRequest(), cookieFrom(), inviteAndAccept(), registerUser(), responseJson() (+27 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (13): appendDecision(), calculateVerdict(), createDecisionRecord(), currentApprovalForCoverage(), deriveClaimCoverage(), deriveFindings(), isValidDate(), KNOWN_RELATIONS (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (27): claimEvidenceLinks, claims, claimSourceType, decisions, decisionStatus, decisionType, evidence, evidenceSourceType (+19 more)

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
Nodes (19): scripts, audit:prod, build, build:worker, check, db:check, db:down, db:generate (+11 more)

### Community 24 - "Community 24"
Cohesion: 0.47
Nodes (4): DatabaseUnavailableError, openDatabase(), resolveDatabaseConnectionString(), withDatabase()

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (4): client, databaseName, env, parsed

### Community 29 - "Community 29"
Cohesion: 0.32
Nodes (12): clearUserSessionCookieHeader(), createUserSession(), getUserSession(), hashSessionToken(), parseCookies(), revokeRequestSession(), secureCookiesEnabled(), sessionTokenFromRequest() (+4 more)

## Knowledge Gaps
- **135 isolated node(s):** `identifier`, `payload`, `assessment`, `requestSchema`, `requestSchema` (+130 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `canonicalJson()` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Why does `jsonResponse()` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `appendAuditEvent()` connect `Community 4` to `Community 1`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `identifier`, `payload`, `assessment` to the rest of the system?**
  _135 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12280701754385964 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05288207297726071 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._