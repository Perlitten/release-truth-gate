# Graph Report - release-truth-gate  (2026-07-18)

## Corpus Check
- 102 files · ~213,002 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 499 nodes · 1158 edges · 36 communities (26 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `37f7194d`
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
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]

## God Nodes (most connected - your core abstractions)
1. `databaseRoute()` - 63 edges
2. `jsonResponse()` - 38 edges
3. `requireAuthenticatedUser()` - 22 edges
4. `requireSameOriginMutation()` - 21 edges
5. `scripts` - 19 edges
6. `appendAuditEvent()` - 19 edges
7. `parseJsonBody()` - 19 edges
8. `HttpError` - 18 edges
9. `canonicalJson()` - 14 edges
10. `consumeRateLimit()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `databaseRoute()`  [EXTRACTED]
  app/api/auth/logout/route.js → src/server/http.js
- `GET()` --calls--> `databaseRoute()`  [EXTRACTED]
  app/api/github/callback/route.js → src/server/http.js
- `GET()` --calls--> `databaseRoute()`  [EXTRACTED]
  app/api/projects/[projectId]/repositories/route.js → src/server/http.js
- `POST()` --calls--> `databaseRoute()`  [EXTRACTED]
  app/api/projects/[projectId]/repositories/route.js → src/server/http.js
- `GET()` --calls--> `databaseRoute()`  [EXTRACTED]
  app/api/projects/[projectId]/route.js → src/server/http.js

## Import Cycles
- None detected.

## Communities (36 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (30): logOutcome(), POST(), analysisRequestSchema, analystInstructions, buildAnalysisInput(), evidenceAssessmentSchema, groundAssessment(), identifier (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (35): assessmentSchema, buildShareUrl(), canonicalJson(), citationSchema, createEvidenceExport(), decisionSchema, decodeBase64Url(), encodeBase64Url() (+27 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (46): dependencies, dotenv, drizzle-orm, @fontsource-variable/inter, next, openai, @opennextjs/cloudflare, pg (+38 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): Authorization, Baseline verification, Client-owned product state, Current architecture, Deployment target update, Evidence Gate MVP audit, Executive finding, Expected external blockers (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.28
Nodes (13): clearUserSessionCookieHeader(), createUserSession(), getUserSession(), hashSessionToken(), parseCookies(), revokeRequestSession(), secureCookiesEnabled(), sessionTokenFromRequest() (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (17): appendDecision(), calculateVerdict(), createDecisionRecord(), currentApprovalForCoverage(), deriveClaimCoverage(), deriveFindings(), isValidDate(), KNOWN_RELATIONS (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (61): requestSchema, jsonResponse(), auditEvents, claimEvidenceLinks, claimSourceType, decisions, decisionStatus, decisionType (+53 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (7): Design QA, Functional checks, Ground truth and artifacts, Measured viewports, Remaining production prerequisites, Runtime checks, Visual decisions

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (7): GitHub App, Local development, Production, Release Truth, Roles, Verification, What is authoritative

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (5): Implemented controls, Operational requirements, Security model, Trust boundary, Verification and incident practice

### Community 10 - "Community 10"
Cohesion: 0.50
Nodes (3): Answer, Q: What trust-boundary fixes closed the Round 2 audit findings?, Source Nodes

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (3): Answer, Q: What makes the final Release Truth snapshot reproducible and deployable?, Source Nodes

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (22): GET(), githubInstallations, githubOauthStates, GET(), createGitHubAppJwt(), createGitHubState(), createInstallationToken(), encode() (+14 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (9): App(), can(), capabilities, formatDate(), initials(), markers, ProductApp(), ProductShell() (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.09
Nodes (37): POST(), claimSchema, GET(), POST(), POST(), apiRequest(), cookieFrom(), inviteAndAccept() (+29 more)

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (4): client, databaseName, env, parsed

### Community 29 - "Community 29"
Cohesion: 0.28
Nodes (9): canonicalJson(), sortCanonical(), GET(), verifyAuditChain(), artifactHash(), exportSigningConfig(), readPem(), signExportManifest() (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (7): client, databaseName, env, migration, next, parsed, { privateKey, publicKey }

### Community 31 - "Community 31"
Cohesion: 0.27
Nodes (6): DatabaseUnavailableError, openDatabase(), resolveDatabaseConnectionString(), withDatabase(), GET(), child

### Community 32 - "Community 32"
Cohesion: 0.43
Nodes (5): actor(), githubExternalId(), githubSummary(), normalizeGitHubObject(), truncate()

## Knowledge Gaps
- **150 isolated node(s):** `identifier`, `payload`, `assessment`, `requestSchema`, `requestSchema` (+145 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `databaseRoute()` connect `Community 24` to `Community 19`, `Community 4`, `Community 6`, `Community 31`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `deriveFindings()` connect `Community 5` to `Community 1`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `calculateVerdict()` connect `Community 5` to `Community 1`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `identifier`, `payload`, `assessment` to the rest of the system?**
  _150 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11829268292682926 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05925925925925926 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._