#!/usr/bin/env node
/**
 * Writes synthetic Claude Code and Codex session logs so the widget can be run with
 * believable usage on a machine that has none — handy for design review, for a demo,
 * and for checking the collectors end to end.
 *
 *   node scripts/demo-logs.mjs [targetDir]
 *
 * It prints the two environment variables to launch with. Nothing outside targetDir
 * (default: a folder in the system temp dir) is touched.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const target = process.argv[2] ?? join(tmpdir(), 'tokens-make-you-drink-water-demo')
const claudeHome = join(target, 'claude')
const codexHome = join(target, 'codex')

const now = new Date()
const iso = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60_000).toISOString()
const dayParts = [
  String(now.getFullYear()),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0')
]

const claudeLines = [
  { type: 'user', timestamp: iso(96), message: { role: 'user', content: 'a prompt the app never reads' } },
  assistant('msg_demo_1', 96, { input: 18_400, output: 5_100, cacheCreation: 31_000, cacheRead: 220_000 }),
  assistant('msg_demo_2', 61, { input: 9_800, output: 3_400, cacheCreation: 12_500, cacheRead: 410_000 }),
  assistant('msg_demo_3', 24, { input: 6_200, output: 2_900, cacheCreation: 8_100, cacheRead: 155_000 }),
  // Replayed verbatim by a resumed session: the collector must not count it twice.
  assistant('msg_demo_3', 24, { input: 6_200, output: 2_900, cacheCreation: 8_100, cacheRead: 155_000 })
]

const codexLines = [
  { timestamp: iso(48), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'also never read' }] } },
  tokenCount(42, { input: 24_500, cached: 21_000, output: 6_400 }),
  tokenCount(19, { input: 38_900, cached: 34_200, output: 9_100 }),
  tokenCount(6, { input: 15_300, cached: 12_800, output: 4_600 })
]

await mkdir(join(claudeHome, 'projects', '-Users-you-code-widget'), { recursive: true })
await writeFile(
  join(claudeHome, 'projects', '-Users-you-code-widget', 'demo-session.jsonl'),
  `${claudeLines.map((line) => JSON.stringify(line)).join('\n')}\n`
)

await mkdir(join(codexHome, 'sessions', ...dayParts), { recursive: true })
await writeFile(
  join(codexHome, 'sessions', ...dayParts, 'rollout-demo.jsonl'),
  `${codexLines.map((line) => JSON.stringify(line)).join('\n')}\n`
)

process.stdout.write(
  [
    'Synthetic logs written.',
    '',
    `  CLAUDE_CONFIG_DIR=${claudeHome} \\`,
    `  CODEX_HOME=${codexHome} \\`,
    '  npm run dev',
    ''
  ].join('\n')
)

function assistant(id, minutesAgo, usage) {
  return {
    type: 'assistant',
    timestamp: iso(minutesAgo),
    requestId: `req_${id}`,
    message: {
      id,
      role: 'assistant',
      model: 'claude-sonnet-4-5',
      usage: {
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_creation_input_tokens: usage.cacheCreation,
        cache_read_input_tokens: usage.cacheRead
      }
    }
  }
}

function tokenCount(minutesAgo, usage) {
  return {
    timestamp: iso(minutesAgo),
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        last_token_usage: {
          input_tokens: usage.input,
          cached_input_tokens: usage.cached,
          output_tokens: usage.output,
          reasoning_output_tokens: Math.round(usage.output * 0.4),
          total_tokens: usage.input + usage.output
        },
        total_token_usage: { input_tokens: 999_999, cached_input_tokens: 0, output_tokens: 999_999, total_tokens: 999_999 }
      }
    }
  }
}
