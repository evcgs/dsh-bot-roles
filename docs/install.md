# Install

Three ways to install, then how to confirm it worked.

- [Before you start](#before-you-start)
- [Option A — the Web Plugins page](#option-a--the-web-plugins-page)
- [Option B — CLI plus the profile's bundle list](#option-b--cli-plus-the-profiles-bundle-list)
- [Option C — from a local checkout](#option-c--from-a-local-checkout)
- [Confirm the rows composed](#confirm-the-rows-composed)
- [Where the roles appear](#where-the-roles-appear)
- [Uninstall](#uninstall)
- [Troubleshooting](#troubleshooting)

## Before you start

- dsh `0.2.1-alpha.1` or later, with the agent-preset plane present. The Web profile ships `@deepseek-ai/dsh-agent-preset-registry`; a deployment without it serves no preset roster at all, and this pack's rows would be declarations nothing reads.
- Know your profile name (`web` in the documented examples) and where it lives (`$DSH_HOME/profiles/<name>`).
- A restart is required. Preset rows are read when the profile composes.

## Option A — the Web Plugins page

Recommended, because the manager makes both edits a profile needs — the package dependency *and* the bundle selection — and refuses a package that is not actually a bundle.

1. Open the sidebar's **Plugins** page.
2. Install by spec:
   - GitHub: `github:evcgs/dsh-bot-roles`
   - a published npm name: `dsh-bot-roles`
   - a local path, or a tarball URL
3. Wait for the install to finish. It enables the bundle by default.
4. Restart dsh.

For a GitHub spec the manager runs `git ls-remote` first to confirm the repository is reachable, then lets the package manager fetch it. It rejects a package with no bundle patch — this one declares `dsh.bundle.patch`, so it is accepted as a bundle rather than a plain dependency.

## Option B — CLI plus the profile's bundle list

A profile needs **two** edits. Adding only the dependency installs the files and changes nothing, which is the single most common way a dsh plugin appears to do nothing.

```bash
dsh plugin --profile web add github:evcgs/dsh-bot-roles
```

```jsonc
// $DSH_HOME/profiles/web/package.json
{
  "dependencies": {
    "dsh-bot-roles": "github:evcgs/dsh-bot-roles"   // 1. the dependency
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-bot-roles"                                // 2. and the bundle list
      ]
    }
  }
}
```

Order matters: bundles compose in list order. Put this pack **after** the bundle that declares the agent-preset registry (`@deepseek-ai/dsh-web-app`), which is why appending is the safe choice.

Then install and restart:

```bash
cd $DSH_HOME/profiles/web && pnpm install
# restart dsh
```

## Option C — from a local checkout

```bash
git clone https://github.com/evcgs/dsh-bot-roles.git
cd dsh-bot-roles
npm run check     # 39 assertions, no dependencies to install
npm test          # 26 tests, no dependencies to install
```

Then use `link:` in both places, as in option B:

```jsonc
{
  "dependencies": { "dsh-bot-roles": "link:/absolute/path/to/dsh-bot-roles" },
  "dsh": { "profile": { "bundles": ["…", "dsh-bot-roles"] } }
}
```

Useful while editing roles: the pack carries no code, so a rebuild plus a restart is all it takes to see a change.

## Confirm the rows composed

`dsh --dump-config` composes the profile tree and prints it **without mounting any plugin**, so you can check before restarting:

```bash
dsh --profile web --dump-config | grep -A2 "== dsh-bot-roles"
```

Expect a comment header naming the bundle followed by 13 rows, one per `preset-bot-*` id. The same command prints a `dsh: [bundle] patch: entry "…" not found` warning when a patch matched nothing — a pack that composes properly prints none of those.

For the stronger check — actually mounting every preset and reading the registry's per-preset diagnostics, with a negative control — run:

```bash
node tools/verify-composition.mjs --dsh-bin <path-to>/@deepseek-ai/dsh/lib/bin.js
```

See the [README's verification section](../README.md#how-this-was-verified) for what it proves.

## Where the roles appear

- **Settings → Agent presets** — the roster, showing each role's name and description.
- **New session** — the preset chip; picking a role starts the session as that role.

Selecting a role composes its persona and the tool baseline in [`scripts/lib/toolsets.mjs`](../scripts/lib/toolsets.mjs): file read/write and search, a shell, todo list, jobs, ask-user, skills, present, goals, and compaction. Roles with `tools.web` also get web search and fetch; the two medical roles deliberately do not.

## Uninstall

Remove the entry from `dsh.profile.bundles` and the dependency from `dependencies`, then reinstall and restart. Sessions that already selected a preset keep the composition they were created with; nothing is deleted from existing sessions.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Roles do not appear at all | The package is in `dependencies` but not `dsh.profile.bundles` | Add it to the bundle list; both edits are required |
| Roles appear but a session has no tools | The preset mounted, but its rows did not | Run `tools/verify-composition.mjs`; it reads the per-row diagnostics the registry keeps |
| A warning `patch: entry "…" not found` | A patch targeted an id that does not exist in this deployment | Check the deployment ships the plugin the row names; the pack only mounts `@deepseek-ai/*` packages |
| Install refused as "not a bundle" | The package's `dsh.bundle.patch` is missing or its files are absent | Confirm you are installing this package, not a fork that dropped the `presets/` directory |
| The install compatibility check rejects it | A declared peer resolved to an incompatible DSH version | This pack declares no peer dependencies, so this should not happen; report it |

## Notes on the presets themselves

- Preset ids are namespaced `bot-*` (`bot-engineer`, `bot-health-record`, …) so they cannot shadow a shipped preset such as `standard`, `ptc`, `minimal`, or `cordis`.
- Every role has a distinct `order` starting at 100, so the roster sorts in team order and after the shipped presets.
- Each preset's row ids match the ids the shipped `standard` preset uses. A profile patch can therefore override one row for one role by id without touching this pack — for example, disabling `tool-web` for a role you want offline.
