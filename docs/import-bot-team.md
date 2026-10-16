# Importing the roles as DS Bot Bots

The presets are the installable face. This page covers the other face: turning the same 13 roles into living, long-lived Bots that appear in the sidebar, with bot-to-bot messaging and group chats.

## Why this is a prompt and not a script

DS Bot deliberately exposes **no creation API**. `create_bot` is a model-facing tool, the roster lives inside DS Bot's own state file, and the plugin registers no Cordis service for other plugins to call. That is a design choice, not an oversight: a Bot is a real root Session, so creating one means asking the host to create a session and wire it to a Bot record, which only the running DS Bot instance can do.

A plugin that "installed" Bots would therefore have to either patch DS Bot's private state format behind its back or reach into its internals. Both would break on the next DS Bot release and could corrupt a live team.

So this pack ships the honest mechanism: [a generated prompt](../docs/bot-team-prompt.md) containing the full roster, which your Main Bot executes with its own tools. It works the same way whether you install the presets or not.

## 为什么是提示词而不是脚本

DS Bot **刻意不开放创建 API**。`create_bot` 是面向模型的工具，Bot 名单存在 DS Bot 自己的 state 文件里，插件也没有注册任何供其他插件调用的 Cordis 服务。这是设计取舍而非疏漏：一个 Bot 就是一个真实的根 Session，建 Bot 等于请宿主建会话并把会话与 Bot 记录接起来——只有运行中的 DS Bot 实例做得到。

所以一个"能自动装 Bot"的插件，只能绕过 DS Bot 私有的 state 格式去写，或者伸手进它的内部实现。两条路都会在 DS Bot 下次升级时断掉，还可能弄坏正在用的团队。

本包因此给出诚实的机制：一段[生成好的提示词](../docs/bot-team-prompt.md)，内含完整名单，由你的主 Bot 用它自己的工具执行。装不装预设都一样可用。

## How to run the import

1. Open [`bot-team-prompt.md`](bot-team-prompt.md).
2. Copy everything below its horizontal rule.
3. Paste it to your **Main Bot** and send.
4. The Main Bot will call `list_bots` first, skip any Bot that already exists, then `create_bot` once per role. Expect it to take a while — each creation builds a session.
5. Ask it for the summary it was told to produce: created / skipped / failed, with reasons.

## What the prompt instructs, and why

| Instruction | Reason |
|---|---|
| Check `list_bots` first, skip existing names | The import is idempotent; running it twice must not produce "Engineer 2" |
| Copy `instructions` verbatim, do not summarise | A summarised persona is a different role. The source text is the asset |
| Substitute the workspace path for `{{cwd}}` | The roles refer to their working directory; Bot instructions are not interpolated by dsh, so the token must be resolved at creation time |
| Pass `model` only when that provider exists | The exported models were one team's routing. Naming an unavailable provider would leave the Bot unable to answer |
| Keep `skill: X` references even if the skill is absent | The roles are written to degrade explicitly ("say the skill is unavailable") rather than to assume it |
| Report created / skipped / failed per Bot | A silent partial import is worse than a failed one |

## Model routing

The source team ran two models: a fast one for the Main Bot and the engineering role, and a larger one for the rest. This pack records that per role in `roles/roles.json` → `exportedModels`, and shows it in the prompt for information only. Adjust it to whatever your deployment actually serves.

## If your deployment has no DS Bot

Then use the presets — that is the face that needs nothing but dsh itself. The roster file is still useful as a plain description of the team.

## Keeping the two faces in sync

Both faces come from `roles/roles.json`. After editing a role:

```bash
npm run build      # regenerates presets/, bots/roster.json, docs/bot-team-prompt.md
npm run check      # fails if any face drifted
```

Existing Bots do **not** update themselves. To push a role change into a running team, ask the Main Bot to call `update_bot` with the new instructions, or re-run the import and let it report the name as already existing.
