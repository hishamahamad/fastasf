import type { FastasfConfig } from '../config/schema'
import { compress, parseSizeString } from '../utils'

type BundleChunk = { 
  type: 'chunk'
  code: string
  fileName: string
}
type BundleAsset = { 
  type: 'asset'
  source: string | Uint8Array
  fileName: string
}
type Bundle = Record<string, BundleChunk | BundleAsset>

export type RuleResult = {
  rule: string
  passed: boolean
  actual: number
  budget: number
  breakdown: Array<{
    file: string
    size: number
  }>
}



const FONT_EXTENSIONS = /\.(woff2?|ttf|otf|eot)$/

function getAssetBuffer(asset: BundleAsset): Buffer {
  return typeof asset.source === 'string'
    ? Buffer.from(asset.source, 'utf8')
    : Buffer.from(asset.source)
}

export function checkJsBudget(bundle: Bundle, config: FastasfConfig): RuleResult {
  const { compression, js: jsBudget } = config.budgets

  const breakdown = Object.entries(bundle)
    .filter((entry): entry is [string, BundleChunk] => entry[1].type === 'chunk')
    .map(([file, chunk]) => ({
      file,
      size: compress(chunk.code, compression),
    }))
    .sort((a, b) => b.size - a.size)

  const actual = breakdown.reduce((sum, c) => sum + c.size, 0)
  const budget = parseSizeString(jsBudget)

  return {
    rule: 'budgets.js',
    passed: actual <= budget,
    actual,
    budget,
    breakdown,
  }
}

export function checkCssBudget(bundle: Bundle, config: FastasfConfig): RuleResult {
  const { compression, css: cssBudget } = config.budgets

  const breakdown = Object.entries(bundle)
    .filter((entry): entry is [string, BundleAsset] => entry[1].type === 'asset' && entry[0].endsWith('.css'))
    .map(([file, asset]) => ({
      file,
      size: compress(getAssetBuffer(asset), compression),
    }))
    .sort((a, b) => b.size - a.size)

  const actual = breakdown.reduce((sum, c) => sum + c.size, 0)
  const budget = parseSizeString(cssBudget)

  return {
    rule: 'budgets.css',
    passed: actual <= budget,
    actual,
    budget,
    breakdown,
  }
}

export function checkFontsBudget(bundle: Bundle, config: FastasfConfig): RuleResult {
  const { compression, fonts: fontsBudget } = config.budgets

  const breakdown = Object.entries(bundle)
    .filter((entry): entry is [string, BundleAsset] => entry[1].type === 'asset' && FONT_EXTENSIONS.test(entry[0]))
    .map(([file, asset]) => ({
      file,
      size: compress(getAssetBuffer(asset), compression),
    }))
    .sort((a, b) => b.size - a.size)

  const actual = breakdown.reduce((sum, c) => sum + c.size, 0)
  const budget = parseSizeString(fontsBudget)

  return {
    rule: 'budgets.fonts',
    passed: actual <= budget,
    actual,
    budget,
    breakdown,
  }
}

export function checkTotalBudget(bundle: Bundle, config: FastasfConfig): RuleResult {
  // TODO: cache compressed sizes — currently compresses each file multiple times when all checks run
  const js = checkJsBudget(bundle, config)
  const css = checkCssBudget(bundle, config)
  const fonts = checkFontsBudget(bundle, config)

  const actual = js.actual + css.actual + fonts.actual
  const budget = parseSizeString(config.budgets.total)

  const breakdown = [...js.breakdown, ...css.breakdown, ...fonts.breakdown]
    .sort((a, b) => b.size - a.size)

  return {
    rule: 'budgets.total',
    passed: actual <= budget,
    actual,
    budget,
    breakdown,
  }
}

export function checkPerChunkBudget(bundle: Bundle, config: FastasfConfig): RuleResult {
  const { compression, perChunk: perChunkBudget } = config.budgets
  const budget = parseSizeString(perChunkBudget)

  const breakdown = Object.entries(bundle)
    .filter((entry): entry is [string, BundleChunk] => entry[1].type === 'chunk')
    .map(([file, chunk]) => ({
      file,
      size: compress(chunk.code, compression),
    }))
    .sort((a, b) => b.size - a.size)

  const actual = breakdown.length > 0 ? breakdown[0].size : 0

  return {
    rule: 'budgets.perChunk',
    passed: breakdown.every(c => c.size <= budget),
    actual,
    budget,
    breakdown,
  }
}

export function checkPerAssetBudget(bundle: Bundle, config: FastasfConfig): RuleResult {
  const { compression, perAsset: perAssetBudget } = config.budgets
  const budget = parseSizeString(perAssetBudget)

  const breakdown = Object.entries(bundle)
    .map(([file, entry]) => ({
      file,
      size: compress(
        entry.type === 'chunk' ? entry.code : getAssetBuffer(entry),
        compression,
      ),
    }))
    .sort((a, b) => b.size - a.size)

  const actual = breakdown.length > 0 ? breakdown[0].size : 0

  return {
    rule: 'budgets.perAsset',
    passed: breakdown.every(c => c.size <= budget),
    actual,
    budget,
    breakdown,
  }
}
