import pc from 'picocolors'
import type { RuleResult } from '../rules/budgets'
import { getSuggestion } from './suggestions'

const RULE_DOCS: Record<string, { why: string; source: string }> = {
  'budgets.js': {
    why: 'Research shows 120kb brotli is the upper bound for sub-2s TTI on mid-range devices over 4G.',
    source: 'https://fastasf.dev/budgets/js',
  },
  'budgets.css': {
    why: 'CSS blocks rendering. 30kb brotli keeps stylesheet parse time under ~50ms on mid-range devices.',
    source: 'https://fastasf.dev/budgets/css',
  },
  'budgets.fonts': {
    why: 'Fonts block text rendering. 50kb covers one family with 2-3 weights subset to Latin.',
    source: 'https://fastasf.dev/budgets/fonts',
  },
  'budgets.total': {
    why: '200kb brotli ≈ 700kb parsed. Keeps total parse + transfer under ~1.5s, within a 2s TTI target.',
    source: 'https://fastasf.dev/budgets/total',
  },
  'budgets.perChunk': {
    why: 'Large chunks defeat the purpose of code splitting and hurt parallel loading and cache efficiency.',
    source: 'https://fastasf.dev/budgets/per-chunk',
  },
  'budgets.perAsset': {
    why: 'Catch-all for any asset type. Prevents oversized files from slipping through regardless of category.',
    source: 'https://fastasf.dev/budgets/per-asset',
  },
  'images.formats': {
    why: 'PNG and JPG are 2-5x larger than WebP/AVIF at equivalent quality.',
    source: 'https://fastasf.dev/images/formats',
  },
  'images.maxSizePerAsset': {
    why: '100kb covers a 1000x800 WebP at quality 80. Larger usually means uncompressed or oversized for display.',
    source: 'https://fastasf.dev/images/size',
  },
  'dependencies.blockList': {
    why: 'These packages have modern, significantly smaller alternatives.',
    source: 'https://fastasf.dev/dependencies/blocklist',
  },
  'dependencies.maxDuplicates': {
    why: 'Duplicate packages inflate the bundle and can cause subtle version conflicts.',
    source: 'https://fastasf.dev/dependencies/duplicates',
  },
  'dependencies.versions': {
    why: 'Outdated dependencies miss performance improvements and bug fixes.',
    source: 'https://fastasf.dev/dependencies/versions',
  },
}

const FIX_COMMANDS: Record<string, string> = {
  'images.formats': 'npx fastasf fix --images',
  'dependencies.blockList': 'npx fastasf fix --dependencies',
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}mb`
  return `${Math.round(bytes / 1024)}kb`
}

function formatPassed(result: RuleResult): string {
  const usage = result.budget > 0
    ? ` — ${formatBytes(result.actual)} / ${formatBytes(result.budget)}`
    : ''
  return pc.green(`  ✓ ${result.rule}${usage}`)
}

function formatFailed(result: RuleResult): string {
  const lines: string[] = []

  // Header
  if (result.budget > 0) {
    const over = result.actual - result.budget
    lines.push(
      pc.red(`  ✖ ${result.rule} — ${formatBytes(result.actual)} / ${formatBytes(result.budget)} (${formatBytes(over)} over)`),
    )
  } else {
    const label = result.actual === 1 ? 'violation' : 'violations'
    lines.push(pc.red(`  ✖ ${result.rule} — ${result.actual} ${label}`))
  }

  // Why + source
  const docs = RULE_DOCS[result.rule]
  if (docs) {
    lines.push('')
    lines.push(`    ${pc.dim('Why?')} ${docs.why}`)
    lines.push(`    ${pc.dim(docs.source)}`)
  }

  // Top contributors
  const contributors = result.breakdown.slice(0, 5)
  if (contributors.length > 0) {
    lines.push('')

    if (result.rule === 'images.formats') {
      const files = contributors.map(c => pc.yellow(c.file)).join(', ')
      lines.push(`    ${pc.dim('→')} ${files}`)
    } else if (result.rule === 'dependencies.blockList' || result.rule === 'dependencies.versions') {
      lines.push(`    ${pc.dim('Packages:')}`)
      for (const c of contributors) {
        lines.push(`     ${pc.dim('→')} ${pc.yellow(c.file)}`)
      }
    } else {
      lines.push(`    ${pc.dim('Top contributors:')}`)
      for (const c of contributors) {
        const size = c.size > 0 ? pc.dim(` ${formatBytes(c.size)}`) : ''
        lines.push(`     ${pc.dim('→')} ${pc.yellow(c.file)}${size}`)

        const suggestion = getSuggestion(c.file)
        if (suggestion) {
          lines.push(
            `       ${pc.cyan(`try ${suggestion.alternative} (${suggestion.alternativeSize}), saves ~${suggestion.savings}`)}`,
          )
        }
      }
    }
  }

  // Fix command
  const fixCmd = FIX_COMMANDS[result.rule]
  if (fixCmd) {
    lines.push('')
    lines.push(`    ${pc.dim('Run:')} ${pc.cyan(fixCmd)}`)
  }

  return lines.join('\n')
}

export function formatResults(results: RuleResult[]): string {
  const lines: string[] = []

  lines.push('')
  lines.push(pc.bold('  fastasf'))
  lines.push('')

  for (const result of results) {
    lines.push(result.passed ? formatPassed(result) : formatFailed(result))
    if (!result.passed) lines.push('')
  }

  const total = results.length
  const failed = results.filter(r => !r.passed).length
  const passed = total - failed

  lines.push(
    failed > 0
      ? pc.red(`  ${failed} of ${total} checks failed`)
      : pc.green(`  ${passed} of ${total} checks passed`),
  )

  return lines.join('\n')
}
