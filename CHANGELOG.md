# Changelog

All notable changes to this pack. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because the payload is role prose, a change to a role's `instructions` is a **minor** release, and removing or renaming a `presetId` is a **major** one: sessions that already selected a preset resolve it by id.

## [Unreleased]

## [0.1.0] — 2026-10-16

Initial release.

### Added

- 13 Bot roles as `@deepseek-ai/dsh-agent-preset` declarations, one bundle patch per role: Chief, Engineer, Researcher, Analyst, PM, Legal, Finance, Marketing, Sales, Support, SecGuard, HealthRecord, StrokeConsult.
- A shared tool baseline in `scripts/lib/toolsets.mjs`: files and search, shell (platform-gated bash/pwsh), todo list, jobs, ask-user, skills, present, goals, and an isolated compaction group. Web search is per-role and off for the two medical roles.
- `roles/roles.json` as the single source of truth, with a strict zero-dependency YAML emitter and a build that regenerates every face at once.
- The Bot-team face: `bots/roster.json` plus a generated paste-ready prompt for a Main Bot, since DS Bot exposes no creation API.
- `tools/verify-composition.mjs`: composes the profile with `dsh --dump-config`, boots a scratch profile, and reads the preset registry's own per-preset activation diagnostics, with a negative control that must fail.
- `docs/SANITIZATION.md`: every difference from the role text as it originally ran.

### Fixed during development

Found by the mount gate rather than by reading, both of which would have shipped as silent capability loss:

- `@deepseek-ai/dsh-tool-todo` requires `allowParallelInProgress`; mounting it bare failed activation and every role lost its todo list.
- The compaction rows needed `isolate: { compaction, toolResultPruner }` or they collided with the host plane's services and every role lost compaction.
- The YAML emitter wrote `disabled: { js: … }` as a nested mapping instead of the `!!js` scalar, which cordis reads as an object rather than an expression.
