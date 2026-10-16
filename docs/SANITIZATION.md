# What changed from the source team

This pack was derived from a live team of 13 DS Bot Bots and then made publishable. This file lists **every** difference between the role text as it ran and the text shipped here. It was produced by diffing the original bot export against `roles/roles.json` line by line, not written from memory.

The original export is not part of this repository (it contains private workspace state). Paths below are shown as placeholders on purpose.

## Change categories

| # | Category | What happened | Applies to |
|---|---|---|---|
| **A** | Workspace path → token | The literal absolute workspace path in each role was replaced by `{{cwd}}`, which dsh interpolates per session, so the role follows whoever installs it | all 13 |
| **B** | Typography normalisation | `A/B` became `A / B` around slashes and `+`; `，`-joined lists kept as-is. **No semantic change** — this is the bulk of the diff and the reason almost every line shows a change | all 13 |
| **C** | Deployment state → portable discipline | Paragraphs describing *this* deployment ("your session does not have tool X mounted") were rewritten as a transferable rule: probe what is actually mounted, never fake a tool call, never invent a result. The originals are kept verbatim in that role's `localNotes` | SecGuard, HealthRecord, StrokeConsult |
| **D** | Incidental task text removed | One-off task text that described the source team's first assignment, kept in `localNotes` | Engineer |
| **E** | Personal identifier removed | A concrete `personId` value went from the role text; the clause now refers to the caller-supplied id, with a marker left in `localNotes` recording that a sentence was removed | HealthRecord |
| **F** | Authored from scratch | The source bot carried **no** instructions (it was the Main Bot, and DS Bot supplies its behaviour from the plugin itself). The persona here was written from DS Bot's built-in Main Bot rules plus the team's observed分工 conventions | Chief |
| **G** | Vendor/deployment de-branding | An opening line naming one specific commercial red-team platform as the backing service became a capability description that any comparable platform satisfies | SecGuard |

## Per role

| Role | Categories | Notes |
|---|---|---|
| Chief | **F** | New persona. Two modes stated explicitly: with team tools, dispatch and report; without them, execute yourself or hand back next steps — **never pretend to dispatch or invent a member's reply**. |
| Engineer | A, B, D | Discipline unchanged. Added one sentence so the role still works when `eng-review-kit` is absent: apply the same evidence-anchor rule manually. |
| Researcher | A, B | Discipline unchanged. |
| Analyst | A, B | Discipline unchanged. |
| PM | A, B | Discipline unchanged. |
| Legal | A, B | Discipline unchanged. |
| Finance | A, B | Discipline unchanged. |
| Marketing | A, B | Discipline unchanged. |
| Sales | A, B | Discipline unchanged. |
| Support | A, B | Discipline unchanged. |
| SecGuard | A, B, C, G | Medical/safety constraints preserved. The security rules (authorised targets only, read-only assessment, no exploit steps, risk-graded reports) are intact. |
| HealthRecord | A, B, C, E | All six original hard constraints preserved and strengthened with two additions from the source role's own later wording: "no prognosis claims", and the closing科普 disclaimer sentence. The one-archive-per-person rule became item 7. |
| StrokeConsult | A, B, C | All seven original constraints preserved verbatim in substance, including the 120 / "last known well" emergency red line and the time-window paragraph. |

## On `localNotes`

`localNotes` is verbatim source text, with three stated exceptions: the bracketed section label was changed from its source wording to mark it as a deployment supplement; the removed personal identifier is replaced by a marker recording that a sentence was dropped; and category **B** typography applies.

`localNotes` is **not** mounted by any preset. It appears only in `bots/roster.json` and `docs/bot-team-prompt.md`, so importing the team as Bots restores the source behaviour, while installing the presets gives the portable version.

## What was deliberately not changed

- **No role's discipline or red lines were weakened.** The medical red lines (no diagnosis, no prescriptions, 120 first, "missing ≠ negative", "different units are different tests"), the compliance boundaries (blocking verdicts, no outbound commitments), and the evidence-anchor rules are all preserved.
- **No role was given a capability it did not have.** Where the source said "you do not have tool X", the text still refuses to claim the capability — it now says "probe first and say so honestly" instead of naming one deployment's state.
- **Skills are not shipped.** Roles reference `eng-review-kit`, `financial-services-vertical`, `medical-kb-governance`, and `health-record-standardization`. Those live in the source deployment and are not redistributed here; each role degrades explicitly when a skill is missing rather than pretending.
- **Models are not pinned.** The presets set no model, so sessions use the deployment default. The exported model per role is recorded in `roles/roles.json` under `exportedModels` and shown for information only in the Bot-team prompt.

## Reproducing the diff

```bash
# roles/roles.json holds the shipped text; each role's localNotes holds the source
# paragraphs that category C/D/E moved out of the mounted persona.
node -e "const c=require('./roles/roles.json');for(const r of c.roles)console.log(r.presetId, r.localNotes?'has localNotes':'')"
```
