# Graph Report - release-truth-gate  (2026-07-18)

## Corpus Check
- 33 files · ~172,081 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 216 nodes · 300 edges · 23 communities (16 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `180b8ce7`
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

## God Nodes (most connected - your core abstractions)
1. `scripts` - 12 edges
2. `Evidence Gate MVP audit` - 10 edges
3. `POST()` - 9 edges
4. `getAnalystAccessState()` - 8 edges
5. `POST()` - 8 edges
6. `Target architecture and ADR` - 8 edges
7. `authenticateAccessCode()` - 7 edges
8. `sessionCookieHeader()` - 7 edges
9. `consumeRateLimit()` - 7 edges
10. `Release Truth` - 7 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `buildAnalysisInput()`  [EXTRACTED]
  app/api/analyze/route.js → api/schema.mjs
- `POST()` --calls--> `groundAssessment()`  [EXTRACTED]
  app/api/analyze/route.js → api/schema.mjs
- `POST()` --calls--> `getAnalystAccessState()`  [EXTRACTED]
  app/api/analyze/route.js → api/security.mjs
- `GET()` --calls--> `getAnalystAccessState()`  [EXTRACTED]
  app/api/session/route.js → api/security.mjs
- `POST()` --calls--> `authenticateAccessCode()`  [EXTRACTED]
  app/api/session/route.js → api/security.mjs

## Import Cycles
- None detected.

## Communities (23 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (30): logOutcome(), POST(), analysisRequestSchema, analystInstructions, buildAnalysisInput(), evidenceAssessmentSchema, groundAssessment(), identifier (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (15): App(), AssessmentCard(), DetailPanel(), formatUtcTimestamp(), laneIcons, navItems, statusLabel(), allEvents (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (26): devDependencies, esbuild, @playwright/test, vite, vitest, wrangler, engines, node (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (20): Authorization, Baseline verification, Client-owned product state, Current architecture, Evidence Gate MVP audit, Executive finding, Expected external blockers, Export (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.21
Nodes (16): assessmentSchema, buildShareUrl(), canonicalJson(), citationSchema, createEvidenceExport(), decisionSchema, decodeBase64Url(), encodeBase64Url() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (13): appendDecision(), calculateVerdict(), createDecisionRecord(), currentApprovalForCoverage(), deriveClaimCoverage(), deriveFindings(), isValidDate(), KNOWN_RELATIONS (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.20
Nodes (10): dependencies, dotenv, @fontsource-variable/inter, next, openai, @opennextjs/cloudflare, @phosphor-icons/react, react (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (7): Design QA, Functional checks, Ground truth and artifacts, Measured viewports, Remaining production prerequisites, Runtime checks, Visual decisions

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (7): Local development, Product surface, Production configuration, Release Truth, Security boundary, Trust model, Verification

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (5): Dependency and incident practice, Implemented controls, Protected assets, Residual production requirements, Security model

### Community 10 - "Community 10"
Cohesion: 0.50
Nodes (3): Answer, Q: What trust-boundary fixes closed the Round 2 audit findings?, Source Nodes

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (3): Answer, Q: What makes the final Release Truth snapshot reproducible and deployable?, Source Nodes

## Knowledge Gaps
- **89 isolated node(s):** `identifier`, `payload`, `assessment`, `requestSchema`, `metadata` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `identifier`, `payload`, `assessment` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12435897435897436 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._