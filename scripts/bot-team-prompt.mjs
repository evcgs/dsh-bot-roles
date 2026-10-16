#!/usr/bin/env node
// Print the Bot-team import prompt to stdout, regenerated from the catalog so it
// is never a stale copy of docs/bot-team-prompt.md.
//
//   npm run bot-team-prompt            # print
//   npm run bot-team-prompt | pbcopy   # copy, then paste into your Main Bot
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadCatalog } from './lib/catalog.mjs'
import { botTeamPrompt } from './lib/prompt.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalog = loadCatalog(ROOT)
process.stdout.write(botTeamPrompt(catalog.roles, catalog))
