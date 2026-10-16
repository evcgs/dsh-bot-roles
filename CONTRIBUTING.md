# Contributing

Thanks for considering it. This pack is small and its rules are short.

## The one rule

**Edit `roles/roles.json`, never the generated files.** `presets/*.patch.yml`, `bots/roster.json`, and `docs/bot-team-prompt.md` are generated; `npm run check` fails the moment one drifts from the catalog.

```bash
npm run build     # regenerate every face
npm run check     # 39 assertions, no dependencies
npm test          # 26 tests, no dependencies
```

Both commands run with **zero installed dependencies** — that is a deliberate property of this repository, not an accident. Please keep it: no runtime and no dev dependencies. The YAML emitter exists so a serializer is not needed.

## Adding or changing a role

1. Edit or add an entry in `roles/roles.json`.
2. `npm run build && npm run check && npm test`.
3. If the change is not purely additive, update `docs/SANITIZATION.md` if it relates to differences from a source team.

Text rules the build enforces, because YAML silently mangles each of them:

| Rule | Why |
|---|---|
| `presetId` matches `^bot-[a-z0-9-]+$` | Namespaced ids cannot shadow a shipped preset (`standard`, `ptc`, `minimal`, `cordis`) |
| Instructions are flush-left, no tabs, no trailing whitespace | A block scalar cannot represent indented prose without an explicit indentation indicator; the build refuses rather than emitting something that mis-parses |
| No absolute home paths, no personal ids | A published pack must not leak the environment it came from. Use the `{{cwd}}` token for a workspace path |
| `order` is a unique integer | Roster order; also keeps diffs meaningful |
| `tools` values are booleans | `tools.web` is the only supported switch today |

## Changing the tool baseline

The baseline lives in [`scripts/lib/toolsets.mjs`](scripts/lib/toolsets.mjs). Two things to know before editing it:

- A preset's `plugins` list **is** the agent's composition. A role that mounts only `persona` reaches the model with an empty tool registry.
- Only mount packages that ship with dsh base or dsh-web-app. `npm run check` asserts every mounted name starts with `@deepseek-ai/`.

If you add a row, run the mount gate — it is the only thing that catches a row whose schema requires a field or whose service collides with the host plane:

```bash
node tools/verify-composition.mjs --dsh-bin <path-to>/@deepseek-ai/dsh/lib/bin.js
```

It must pass, **including its negative control**. A green run with the control disabled proves nothing.

## Roles with safety constraints

The medical and security roles carry red lines (emergency escalation, no diagnosis, authorised targets only, no exploit steps). Changes there need the constraint preserved in substance, and a line in the pull request saying how you verified it.

## Commit messages

Conventional Commits, scoped by area: `feat(roles): add …`, `fix(toolsets): …`, `docs(sanitization): …`, `chore(build): …`.

## License

By contributing you agree your contribution is licensed under the MIT License in [LICENSE](LICENSE).
