import type { FastasfConfig } from './schema'

export const defaults: FastasfConfig = {
  strict: true,

  budgets: {
    compression: 'brotli',
    total: '200kb',
    js: '120kb',
    css: '30kb',
    fonts: '50kb',
    perChunk: '30kb',
    perAsset: '100kb',
  },

  images: {
    legacyFormats: [],
    legacyFormatsTTL: 60,
    maxSizePerAsset: '100kb',
    requireDimensions: true,
    requireLazyLoad: true,
  },

  dependencies: {
    requireLatestMinor: true,
    requireLatestMajor: true,
    majorExemptions: {},
    majorExemptionTTL: 90,
    blockList: ['moment', 'lodash'],
    suggestAlternatives: true,
    maxDuplicates: 0,
  },
}
