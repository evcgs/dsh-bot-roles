# dsh-bot-roles

**13 Bot roles for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), packaged as an installable plugin bundle.**

Install it, and each role becomes an **agent preset** you can pick when starting a session — persona, tool baseline, and discipline included. The same catalog also exports a **paste-ready prompt** that recreates the roles as living [DS Bot](https://github.com/FeiZhuLulu/DeepSeek-Bot) Bots, for teams that want the sidebar-and-group-chat experience.

[中文说明](README.zh.md)

---

## One catalog, two faces

Everything is generated from [`roles/roles.json`](roles/roles.json). Nothing is maintained twice.

| Face | Artefact | What it gives you | How it installs |
|---|---|---|---|
| **Presets** (primary) | [`presets/*.patch.yml`](presets/) | One `@deepseek-ai/dsh-agent-preset` row per role, declared as an ordinary Cordis bundle patch | Install the bundle — the roles appear in your preset roster |
| **Bot team** | [`bots/roster.json`](bots/roster.json) + [`docs/bot-team-prompt.md`](docs/bot-team-prompt.md) | The same roles as long-lived Bots with bot-to-bot messaging and group chats | Paste the generated prompt into your Main Bot. DS Bot creates Bots only through its own tools, so no plugin can do this for you — see [why](docs/import-bot-team.md#why-this-is-a-prompt-and-not-a-script) |

## The 13 roles

| # | Role | Label | Responsibility | Web search |
|---|---|---|---|---|
| 1 | **Chief** | `Chief of Staff` | Routes a request to the right role, dispatches, reports back | yes |
| 2 | **Engineer** | `ENG` | Code and engineering review, process, implementation and acceptance | yes |
| 3 | **Researcher** | `RES` | Cross-source research and intelligence synthesis, sourced digests | yes |
| 4 | **Analyst** | `DATA` | SQL / statistics / visualisation, structured data reports | yes |
| 5 | **PM** | `PM` | Product spec definition: scope, priority, acceptance criteria | yes |
| 6 | **Legal** | `LEGAL` | Compliance review, boundary checks, blocking verdicts | yes |
| 7 | **Finance** | `FIN` | Pricing and cost accounting, margin, financial framing | yes |
| 8 | **Marketing** | `MKT` | Outbound copy, channel framing, claim compliance | yes |
| 9 | **Sales** | `SALES` | Account briefs, needs analysis, follow-up strategy | yes |
| 10 | **Support** | `SUP` | Ticket triage, reply drafts, escalation, knowledge capture | yes |
| 11 | **SecGuard** | `SEC` | Security review and risk grading, AI-red-team framing | yes |
| 12 | **HealthRecord** | `MED-R` | Normalises health data into comparable coded records (LOINC + UCUM), every number sourced | **no** |
| 13 | **StrokeConsult** | `MED-S` | Stroke patient/family guidance: FAST, triage, secondary prevention | **no** |

The two medical roles deliberately mount **no outbound web search**: their own instructions require that health information is never sent out as free text. Everything else gets `tool-web` with fetch enabled.

## Install

### Where you end up

After installing and restarting, the roles are in **Settings → Agent presets**, and in the preset chip on the **new-session** screen. Selecting one composes that role's persona plus a baseline toolset (files, shell, todo list, jobs, skills, ask-user, present, goals, compaction).

### Option A — the Web Plugins page (recommended)

1. Open the sidebar's **Plugins** page.
2. Install by spec. Either a GitHub address:
   ```
   github:evcgs/dsh-bot-roles
   ```
   or an npm package once published: `dsh-bot-roles`.
3. The installer enables the bundle when it finishes. Restart dsh.

The manager checks a GitHub spec with `git ls-remote` first, and refuses a package that declares no bundle patch — this one does, so it is accepted as a bundle rather than a plain dependency.

### Option B — CLI plus the profile's bundle list

A profile needs **both** edits; adding only the dependency does nothing.

```bash
# 1. add the dependency (spec may be a GitHub address, a path, a tarball, or a name)
dsh plugin --profile web add github:evcgs/dsh-bot-roles
```

```jsonc
// 2. profiles/web/package.json — add the name to BOTH places
{
  "dependencies": { "dsh-bot-roles": "github:evcgs/dsh-bot-roles" },
  "dsh": { "profile": { "bundles": ["…", "dsh-bot-roles"] } }
}
```

3. Restart dsh.

### Option C — from a local checkout

```bash
git clone https://github.com/evcgs/dsh-bot-roles.git
cd dsh-bot-roles && npm run check && npm test
```

Then add it to your profile with `link:` in `dependencies` **and** to `dsh.profile.bundles`, as above, and restart.

### Requirements

- dsh **0.2.1-alpha.1** or later, with the agent-preset plane present (the Web profile ships it).
- Nothing else. The pack has no dependencies and no entry point: it is a pure patch bundle.

Deeper detail — exact plugin specs, uninstall, and a troubleshooting table: [`docs/install.md`](docs/install.md).

### Verify it composed

`dsh --dump-config` prints the composed profile tree without mounting anything, so you can confirm the rows landed before restarting:

```bash
dsh --profile web --dump-config | grep -A2 "== dsh-bot-roles"
```

## Import the same roles as DS Bot Bots

Open [`docs/bot-team-prompt.md`](docs/bot-team-prompt.md), copy everything below its horizontal rule, and send it to your **Main Bot**. It contains the full roster inline plus the execution rules (check for duplicates first, copy `instructions` verbatim, substitute the workspace path, only pass `model` when that provider exists in your deployment).

The prompt is deliberately explicit that a role must never fake a capability it does not have — the roles themselves say the same thing.

## Customize

```bash
# edit roles/roles.json, then regenerate every face at once
npm run build     # presets/ + bots/roster.json + docs/bot-team-prompt.md + package.json patch list
npm run check     # fails if any generated file drifted from the catalog
npm test
```

Useful catalog fields per role: `presetId` (must be `bot-*`, namespaced so it cannot shadow a shipped preset like `standard`), `name`, `roleLabel`, `color`, `order`, `description`, `tools.web`, `instructions`, and optional `localNotes`. The tool baseline itself lives in [`scripts/lib/toolsets.mjs`](scripts/lib/toolsets.mjs).

Text rules the build enforces because YAML silently mangles them: instructions must be flush-left, free of tabs and trailing whitespace, and free of absolute home paths or personal ids.

## How this was verified

Role packs fail quietly. A preset can be valid YAML and still never mount — an unresolvable package name, a config field the row's schema requires, a service that collides with the host plane. dsh records each failure per preset and keeps running, so a bad pack looks exactly like a good one until a session silently loses tools.

So this repository ships a gate that reads that record back. `node --test`, `npm run check`, and:

```bash
node tools/verify-composition.mjs --dsh-bin <path-to>/@deepseek-ai/dsh/lib/bin.js
```

It builds a throwaway `DSH_HOME`, symlinks this working tree into a scratch profile, and then:

1. **Composition** — `dsh --dump-config` must attribute rows to this bundle, declare all 13 presets, and emit no skipped-patch warning.
2. **Mount** — a probe plugin calls the preset registry's own `list()` after boot and reads every preset's `broken` diagnostic. All 13 must mount clean.
3. **Negative control** — a deliberately broken preset (an unresolvable package name) must be reported broken. Without this step a green run would only prove the probe was not looking. It is on by default.

Two real defects were found by step 2 rather than by reading:

- `@deepseek-ai/dsh-tool-todo` requires `allowParallelInProgress`; mounting it bare fails activation and the role silently loses its todo list.
- The compaction rows need `isolate` or they collide with the host plane's `compaction` / `toolResultPruner` services, and the role silently loses compaction.

Both are recorded in [`scripts/lib/toolsets.mjs`](scripts/lib/toolsets.mjs) next to the fix.

## What changed from the source team

This pack was derived from a live 13-Bot team, then made publishable. Every edit is listed in [`docs/SANITIZATION.md`](docs/SANITIZATION.md) — no silent rewrites:

- absolute workspace paths became `{{cwd}}`, which dsh interpolates per session;
- deployment-specific "tool X is not mounted here" paragraphs were replaced with a portable "probe first, never fake a tool call" discipline, and the originals preserved verbatim in each role's `localNotes`;
- one-off task text was dropped;
- a concrete personal id was removed.

Roles reference optional skills (`eng-review-kit`, `financial-services-vertical`, `medical-kb-governance`, `health-record-standardization`). They are **not** shipped here: each role degrades explicitly when a skill is absent rather than pretending.

## Repository layout

```
roles/roles.json                 single source of truth (13 roles)
presets/*.patch.yml              generated — one agent-preset row per role
bots/roster.json                 generated — DS Bot import roster
docs/bot-team-prompt.md          generated — paste this into your Main Bot
scripts/lib/toolsets.mjs         the tool baseline every role mounts
scripts/lib/yaml.mjs             strict YAML emitter (zero dependencies)
scripts/lib/catalog.mjs          catalog → preset/roster, shared by build and check
scripts/build.mjs                npm run build
scripts/check.mjs                npm run check
tools/verify-composition.mjs     the authoritative composition + mount gate
test/*.test.mjs                  node --test, zero dependencies
docs/SANITIZATION.md             exactly what changed from the source team
```

## License

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Unofficial and not endorsed by DeepSeek; the `@deepseek-ai/*` packages it mounts remain under their own licenses.
