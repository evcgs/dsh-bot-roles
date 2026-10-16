# dsh-bot-roles

**13 个 Bot 角色，打包成可安装的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）插件 bundle。**

装上之后，每个角色都会成为新建会话时可选的一个 **agent preset**——persona、工具基线、工作纪律一起给。同一份清单还能导出**一段可直接粘贴的提示词**，把这些角色还原成常驻的 [DS Bot](https://github.com/FeiZhuLulu/DeepSeek-Bot) Bot，适合想要「侧栏 + 群聊」那套体验的团队。

[English](README.md)

---

## 一份清单，两个门面

所有内容都从 [`roles/roles.json`](roles/roles.json) 生成，没有任何东西维护两遍。

| 门面 | 产物 | 给你什么 | 怎么装 |
|---|---|---|---|
| **预设**（主） | [`presets/*.patch.yml`](presets/) | 每个角色一行 `@deepseek-ai/dsh-agent-preset`，就是普通的 Cordis bundle patch | 安装 bundle —— 角色出现在预设名单里 |
| **Bot 团队** | [`bots/roster.json`](bots/roster.json) + [`docs/bot-team-prompt.md`](docs/bot-team-prompt.md) | 同样这批角色作为常驻 Bot，带 Bot 互相通信与群聊 | 把生成的提示词粘给主 Bot。DS Bot 只允许通过它自己的工具建 Bot，插件无法代劳——原因见[这里](docs/import-bot-team.md#为什么是提示词而不是脚本) |

## 13 个角色

| # | 角色 | 标签 | 职责 | 联网检索 |
|---|---|---|---|---|
| 1 | **Chief** | `Chief of Staff` | 判断需求归属、分派、如实回报 | 有 |
| 2 | **Engineer** | `ENG` | 代码与工程评审、工程流程、实现与验收 | 有 |
| 3 | **Researcher** | `RES` | 跨源调研与情报综合，带溯源的知识摘要 | 有 |
| 4 | **Analyst** | `DATA` | SQL / 统计 / 可视化，结构化数据报告 | 有 |
| 5 | **PM** | `PM` | 产品规格定义：范围、优先级、验收口径 | 有 |
| 6 | **Legal** | `LEGAL` | 合规复核、边界界定、blocking 判定 | 有 |
| 7 | **Finance** | `FIN` | 定价与成本核算、毛利、财务口径 | 有 |
| 8 | **Marketing** | `MKT` | 对外内容、渠道口径、claim 合规 | 有 |
| 9 | **Sales** | `SALES` | 客户背景简报、需求分析、跟进策略 | 有 |
| 10 | **Support** | `SUP` | 工单分诊、答复草稿、升级、知识沉淀 | 有 |
| 11 | **SecGuard** | `SEC` | 安全评审与风险分级，对齐 AI 红队口径 | 有 |
| 12 | **HealthRecord** | `MED-R` | 把健康信息归一成可比编码记录（LOINC + UCUM），每个数字带来源 | **无** |
| 13 | **StrokeConsult** | `MED-S` | 卒中患者/家属指导：FAST、分诊、二级预防 | **无** |

两个医疗岗**刻意不挂联网检索**：它们自己的纪律要求健康信息不得以自由文本外发。其余角色都带 `tool-web`（fetch 打开）。

## 安装

### 装完在哪看

重启后，角色出现在**设置 → Agent presets**，以及**新建会话**界面的预设选择处。选中一个，会话就按该角色的 persona 加一套基线工具（文件、shell、todo 清单、后台任务、skills、ask-user、present、目标、上下文压缩）组合起来。

### 方式 A —— Web 的 Plugins 页（推荐）

1. 打开侧栏 **Plugins** 页。
2. 按 spec 安装。GitHub 地址：
   ```
   github:evcgs/dsh-bot-roles
   ```
   已发布到 npm 的话也可以直接填 `dsh-bot-roles`。
3. 安装器会自动启用该 bundle。重启 dsh。

管理器会先用 `git ls-remote` 检查 GitHub spec，并拒绝没有声明 bundle patch 的包——本包声明了，所以会被当作 bundle 而不是普通依赖接受。

### 方式 B —— 命令行 + profile 的 bundle 名单

profile 需要**两处都改**；只加依赖不生效。

```bash
# 1. 加依赖（spec 可以是 GitHub 地址、路径、tarball 或包名）
dsh plugin --profile web add github:evcgs/dsh-bot-roles
```

```jsonc
// 2. profiles/web/package.json —— 两个地方都要加
{
  "dependencies": { "dsh-bot-roles": "github:evcgs/dsh-bot-roles" },
  "dsh": { "profile": { "bundles": ["…", "dsh-bot-roles"] } }
}
```

3. 重启 dsh。

### 方式 C —— 本地检出

```bash
git clone https://github.com/evcgs/dsh-bot-roles.git
cd dsh-bot-roles && npm run check && npm test
```

然后照上面把 `link:` 写进 `dependencies`，并加进 `dsh.profile.bundles`，重启。

### 环境要求

- dsh **0.2.1-alpha.1** 或更高，且 agent preset 平面存在（Web profile 自带）。
- 别无其他。本包零依赖、无入口文件：它是一个纯 patch bundle。

更细的内容——确切的安装 spec、卸载、排错表——见 [`docs/install.md`](docs/install.md)。

### 重启前先验证组合

`dsh --dump-config` 会打印组合后的 profile 树而不挂载任何东西，可以据此确认行已落地：

```bash
dsh --profile web --dump-config | grep -A2 "== dsh-bot-roles"
```

## 把同样这批角色导入成 DS Bot Bot

打开 [`docs/bot-team-prompt.md`](docs/bot-team-prompt.md)，把横线以下整段复制给你的**主 Bot**。里面内联了完整名单与执行规则（先查重、`instructions` 原样写入、替换工作区路径、只有该 provider 在你部署里存在时才传 `model`）。

提示词里明确写了：角色不得假装具备自己没有的能力——角色原文也是这么要求的。

## 自定义

```bash
# 改 roles/roles.json，然后一次性重生成全部门面
npm run build     # presets/ + bots/roster.json + docs/bot-team-prompt.md + package.json 的 patch 列表
npm run check     # 任何生成物与清单不一致就失败
npm test
```

每个角色的可用字段：`presetId`（必须是 `bot-*`，带命名空间以免遮蔽 `standard` 这类随包发布的 preset）、`name`、`roleLabel`、`color`、`order`、`description`、`tools.web`、`instructions`，以及可选的 `localNotes`。工具基线本身在 [`scripts/lib/toolsets.mjs`](scripts/lib/toolsets.mjs)。

构建会强制几条文本规则，因为 YAML 会静默地搞坏它们：正文必须顶格、不含 tab、无行尾空格、不出现绝对家目录路径或个人 id。

## 验证是怎么做的

角色包会**悄无声息地坏**。一个 preset 可以是完全合法的 YAML 却永远挂不上——包名解析不到、某个字段是该行 schema 的必填、服务与宿主平面抢注。dsh 会逐条记录失败并继续运行，所以坏包和好包看起来一模一样，直到某个会话悄悄少了工具。

因此本仓库带了一道把这些记录读回来的门。`node --test`、`npm run check`，以及：

```bash
node tools/verify-composition.mjs --dsh-bin <path-to>/@deepseek-ai/dsh/lib/bin.js
```

它会建一个一次性 `DSH_HOME`，把当前工作树软链进一个临时 profile，然后：

1. **组合** —— `dsh --dump-config` 必须把行归属到本 bundle、声明全部 13 个 preset，且不产生任何 patch 未命中的告警。
2. **挂载** —— 一个探针插件在启动后调用 preset registry 自己的 `list()`，读回每个 preset 的 `broken` 诊断。13 个必须全部干净挂载。
3. **负对照** —— 一个故意做坏的 preset（包名解析不到）必须被报为 broken。没有这一步，绿灯只能证明探针没在看。它默认开启。

第 2 步抓到过两个靠阅读发现不了的真实缺陷：

- `@deepseek-ai/dsh-tool-todo` 的 `allowParallelInProgress` 是必填；裸挂会激活失败，角色悄悄失去 todo 清单。
- compaction 那几行需要 `isolate`，否则与宿主平面的 `compaction` / `toolResultPruner` 服务冲突，角色悄悄失去上下文压缩。

两处都连同修复记录在 [`scripts/lib/toolsets.mjs`](scripts/lib/toolsets.mjs) 里。

## 相对源团队改了什么

本包来自一个真实的 13 人 Bot 团队，之后做了可发布化处理。每一处改动都列在 [`docs/SANITIZATION.md`](docs/SANITIZATION.md)，没有静默改写：

- 绝对工作区路径改为 `{{cwd}}`，由 dsh 按会话插值；
- 「本环境未挂载某工具」这类部署专有段落，换成可移植的「先探测、绝不假装调用工具」纪律，原文逐字保留在各角色的 `localNotes` 里；
- 去掉一次性的任务文字；
- 去掉一处具体个人 id。

角色正文提到若干可选 skill（`eng-review-kit`、`financial-services-vertical`、`medical-kb-governance`、`health-record-standardization`）。它们**不随本包发布**：skill 缺失时每个角色都会明确降级说明，而不是假装有。

## 仓库结构

```
roles/roles.json                 单一定义源（13 个角色）
presets/*.patch.yml              生成物 —— 每角色一行 agent preset
bots/roster.json                 生成物 —— DS Bot 导入名单
docs/bot-team-prompt.md          生成物 —— 粘给主 Bot 的提示词
scripts/lib/toolsets.mjs         所有角色共用的工具基线
scripts/lib/yaml.mjs             严格的 YAML 发射器（零依赖）
scripts/lib/catalog.mjs          清单 → preset/roster，build 与 check 共用
scripts/build.mjs                npm run build
scripts/check.mjs                npm run check
tools/verify-composition.mjs     权威的组合 + 挂载验证门
test/*.test.mjs                  node --test，零依赖
docs/SANITIZATION.md             相对源团队的确切改动
```

## 许可

MIT —— 见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。本项目非官方、未获 DeepSeek 背书；它挂载的 `@deepseek-ai/*` 包仍各自遵循其原有许可。
