import type { FastasfConfig } from '../config/schema'
import { parseSizeString } from '../utils'
import type { RuleResult } from './budgets'
import { type Lockfile, isLegacyFormatsTTLExpired } from '../lockfile'

const ALLOWED_FORMATS = ['webp', 'avif', 'svg']
const ALL_IMAGE_EXTENSIONS = /\.(webp|avif|svg|png|jpe?g|gif|bmp|tiff?|ico)$/i

type BundleAsset = { type: 'asset'; source: string | Uint8Array; fileName: string }
type Bundle = Record<string, { type: 'chunk' | 'asset' } & Record<string, unknown>>

function getImageAssets(bundle: Bundle): [string, BundleAsset][] {
  return Object.entries(bundle).filter(
    (entry): entry is [string, BundleAsset] =>
      entry[1].type === 'asset' && ALL_IMAGE_EXTENSIONS.test(entry[0]),
  )
}

function getExtension(file: string): string {
  const match = file.match(/\.([^.]+)$/)
  return match ? match[1].toLowerCase() : ''
}

export function checkImageFormats(bundle: Bundle, config: FastasfConfig, lock: Lockfile): RuleResult {
  const { legacyFormats, legacyFormatsTTL } = config.images
  const ttlExpired = isLegacyFormatsTTLExpired(lock, legacyFormatsTTL)
  const allowed = new Set(ttlExpired ? ALLOWED_FORMATS : [...ALLOWED_FORMATS, ...legacyFormats])

  const breakdown = getImageAssets(bundle)
    .map(([file]) => ({ file, size: 0 }))
    .filter(({ file }) => !allowed.has(getExtension(file)))

  return {
    rule: 'images.formats',
    passed: breakdown.length === 0,
    actual: breakdown.length,
    budget: 0,
    breakdown,
  }
}

export function checkImageSizes(bundle: Bundle, config: FastasfConfig): RuleResult {
  const budget = parseSizeString(config.images.maxSizePerAsset)

  const breakdown = getImageAssets(bundle)
    .map(([file, asset]) => ({
      file,
      size: typeof asset.source === 'string'
        ? Buffer.byteLength(asset.source, 'utf8')
        : asset.source.byteLength,
    }))
    .sort((a, b) => b.size - a.size)

  const actual = breakdown.length > 0 ? breakdown[0].size : 0

  return {
    rule: 'images.maxSizePerAsset',
    passed: breakdown.every(img => img.size <= budget),
    actual,
    budget,
    breakdown,
  }
}
