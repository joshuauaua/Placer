# PostHog Self-driving setup — PLACER

## Summary

Session Replay, Error Tracking, and Support were enabled; seven signal sources are now wired to the inbox; a six-scout troop is active (one custom scout written for PLACER's core imagination funnel); and two Replay Vision scanners are armed to surface on-screen defects and user frustration as soon as recordings arrive. Findings will start appearing in your [Self-driving inbox](https://eu.posthog.com/project/259020/inbox) within ~30 minutes.

---

## AI data processing

**Approved.** Organization-level AI data processing consent was confirmed before this run started.

---

## GitHub

**Connected during this run.**
- Integration id: `80575`
- GitHub account: `joshuauaua`
- Connected at: 2026-08-27

---

## Products enabled

| Product | Result | Notes |
|---|---|---|
| Session Replay | **enabled** | Server flip applied; `posthog.init` has no `disable_session_recording` override |
| Error Tracking | **enabled** | Server flip applied; `posthog.init` has no `capture_exceptions: false` override |
| Support (Conversations) | **enabled** | Ready to receive tickets once an inbound channel is connected (see follow-ups) |

`posthog.init` in `src/main.jsx` is clean — no overrides cancel the server-side enables.

---

## Signal sources

| Source product | Source type | Action | Config row ID |
|---|---|---|---|
| `signals_scout` | `cross_source_issue` | Already enabled (default — no row needed) | — |
| `health_checks` | `health_issue` | **Created** | `01a042dd-fb59-72c0-8b32-9cfd51ac0a17` |
| `error_tracking` | `issue_created` | **Created** | `01a042de-00eb-7959-bd96-2640f80c19b6` |
| `error_tracking` | `issue_reopened` | **Created** | `01a042de-02f9-7a99-842c-f45338918ca1` |
| `error_tracking` | `issue_spiking` | **Created** | `01a042de-05e8-7c73-bb04-0a6f771bc5dc` |
| `session_replay` | `session_analysis_cluster` | **Created** (sample\_rate: 0.1) | `01a042de-18cb-748b-b645-34b20fde7cc7` |
| `conversations` | `ticket` | **Created** | `01a042de-1a60-7f19-9710-7415b28358f5` |
| `github` | `issue` | **Created** (dormant — no warehouse source) | `01a042e0-2b54-79cf-914c-c40519b22768` |
| `llm_analytics` | `evaluation_report` | Skipped — no LLM usage in this project | — |
| `logs` | — | Skipped — PostHog logs not in use | — |
| `replay_vision` | — | Not a source row — `emits_signals` on the scanner itself is the config | — |

---

## Connected tools

| Tool | Status |
|---|---|
| GitHub Issues | **Selected but not connected** — you skipped connecting `joshuauaua/Plot` during setup. The responder row is enabled and stays dormant until you connect the warehouse source. See follow-ups. |
| Linear, Jira, Sentry, Zendesk | Not used (not selected) |

The GitHub Issues responder only emits once its warehouse source syncs. No other records are currently being watched.

---

## Scout troop

**Run budget:** 100 runs/day (early access default; 0 used today). Banner: *"Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more."*

**6 scouts active, 22 disabled.**

### Enabled

| Scout | What it watches |
|---|---|
| `general` | Cross-product correlations and surfaces no specialist covers |
| `product-analytics` | Conversion and retention regressions in saved funnels and lifecycle flows |
| `web-analytics` | Per-channel session volume, attribution breakage, and landing-page health |
| `observability-gaps` | High-volume events with no insight, dashboard, or alert coverage |
| `web-vitals` | Per-page LCP, INP, CLS, FCP against Google thresholds and PLACER's own history |
| `imagination-funnel` *(custom)* | PLACER's core 3-step imagination submission flow — see Custom scouts below |

### Disabled (22 scouts)

| Scout | Reason |
|---|---|
| `error-tracking` | Covered by native source (`issue_created`, `issue_reopened`, `issue_spiking`) |
| `session-replay` | Covered by native source (`session_analysis_cluster`) |
| `ai-observability` | No LLM/AI usage in this project |
| `revenue-analytics` | No payment SDK or revenue events |
| `feature-flags` | No feature flags in use |
| `experiments` | No A/B experiments running |
| `surveys` | No PostHog native surveys (PLACER uses a custom survey form) |
| `logs` | PostHog logs product not in use |
| `csp-violations` | No CSP reporting configured |
| `customer-analytics` | Consumer/community app, not B2B |
| `data-pipelines` | No CDP destinations or exports |
| `data-warehouse` | GitHub Issues warehouse source is dormant |
| `conversations` | No support conversation data yet |
| `apm` | No OpenTelemetry/distributed tracing |
| `replay-vision` | Step 6c just created new scanners — no prior observations to trend |
| `anomaly-detection` | No saved insights or dashboards to watch yet |
| `health-checks` | Health checks covered by the native `health_issue` source |
| `inbox-validation` | No shipped fixes to validate on a fresh setup |
| `insight-alerts` | No alerts configured yet |
| `mcp-tool-calls` | No `$mcp_tool_call` telemetry |
| `skills-store` | Internal PostHog tooling scout |
| `tasks` | Not applicable to PLACER's usage |

Enable any disabled scout from the [Self-driving inbox](https://eu.posthog.com/project/259020/inbox) if you add that surface later.

---

## Custom scouts

### Created: `signals-scout-imagination-funnel`

**What it watches:** PLACER's core 4-step creation flow — `explore_started` → `view_captured` → `imagination_description_started` → `imagination_posted` / `imagination_post_failed`. Speaks up when end-to-end conversion drops ≥ 25% relative to the prior week, or when post failures (`imagination_post_failed`) spike above the baseline.

**Why no built-in scout covers it:** `signals-scout-product-analytics` watches *saved* PostHog funnels and retention insights. On a fresh project with no saved funnels, it closes out empty every run. This custom scout watches the raw event sequence directly, so it produces signal immediately.

**Discriminator:** Conversion rate (`imagination_posted / explore_started`) dropping ≥ 25% week-over-week, failure rate (`imagination_post_failed / imagination_description_started`) rising ≥ 3 pp, or a single step's pass-through rate dropping ≥ 30 pp.

**Explore patterns:** step-by-step drop-off analysis, failure breakdown by `error_name` (especially `QuotaExceededError` from localStorage overflow), canvas engagement depth at posting, 28-day conversion trend.

**Noise escape hatch:** Set `emit: false` on the scout's config in PostHog to switch it to dry-run if it becomes noisy.

### Surfaces considered and ruled out

| Surface | Filter applied | Outcome |
|---|---|---|
| Survey completion (`survey_submitted`) | No abandonment events, no baseline data yet | Report note only |
| Canvas abandonment | No explicit abandon event; session-level join too complex | Not ready for a scout |
| `imagination_viewed` engagement | No success/failure pair — a browse action, not a conversion | Not watchable |

---

## Replay Vision scanners

Replay Vision scanners are LLMs that watch individual session recordings on a schedule and push what they find to the Self-driving inbox. Findings arrive at half weight; they need corroboration from a second observation before being promoted into a full inbox report.

**No recordings exist yet.** Both scanners are armed and will start scanning the day recordings begin — no second setup needed.

Credit spend per observation: 5 credits. Monthly estimate: 0 (no recordings). The `creating-replay-vision-scanners` sizing skill was unavailable on this deploy — formal spend verification was skipped; the briefs' bounded defaults are conservatively sized.

| Scanner | ID | Type | Query scope | Sampling | Status |
|---|---|---|---|---|---|
| Imagination creation breakage | `01a042e8-f8da-78de-a6bb-276354a2471a` | monitor | Sessions at root path (`$pathname = "/"`) — where the 3-step creation flow lives | 50% | **Created**, enabled, `emits_signals: true` |
| Imagination creation frustration | `01a042e9-057b-78cf-aa27-5cb4a98cce92` | monitor | Sessions with a `$rageclick` event | 100% | **Created**, enabled, `emits_signals: true` |

**Why root path for breakage:** PLACER is a single-page app; the imagination creation flow (street view → canvas → describe → post) all happens at `$pathname = "/"`. The other routes (`/survey`, `/admin`, `/privacy`, `/gdpr`) are separate paths excluded by this filter.

**Why `$rageclick` for frustration:** The frustration monitor owns the *what they did* axis. Gating on `$rageclick` is cheap and high-precision. The two monitors are intentionally disjoint — the breakage monitor must never add an event gate, and the frustration monitor must never add a URL scope.

---

## Follow-ups

- [ ] **Connect GitHub Issues warehouse source** — you selected GitHub Issues but skipped connecting `joshuauaua/Plot`. Connect it at [New warehouse source](https://eu.posthog.com/project/259020/pipeline/new/source). The responder row is already enabled and will start emitting once the source syncs.
- [ ] **Connect a Support inbound channel** — Conversations (support) is enabled but needs an email, inbox, or Slack channel connected before tickets flow in. Configure it in PostHog → Support settings.
- [ ] **Add funnels and retention insights in PostHog** — The `signals-scout-product-analytics` scout watches *saved* PostHog funnels. Build a funnel from `explore_started` → `imagination_posted` (and a retention insight) so the scout has saved flows to monitor over time. The custom `imagination-funnel` scout watches raw events as an interim measure.

---

## What happens next

- The scout coordinator picks up fresh configs within ~30 minutes. Fresh configs run immediately on the next tick.
- Each scout run draws from the project's daily budget (100 runs/day by default during early access).
- Error tracking, session replay, and support findings reach the inbox via their native sources as soon as those products produce data.
- The Replay Vision scanners start scanning the day recordings begin arriving.
- Inbox findings cluster into reports. Immediately-actionable ones can start coding tasks automatically.

View your inbox: **https://eu.posthog.com/project/259020/inbox**
