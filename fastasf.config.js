import { defineConfig } from '@fastasf/vite-plugin'

export default defineConfig({
  // Kill the build on violations, or just warn
  // true | false
  // Default: true
  strict: true,

  budgets: {
    // What compression to measure sizes against
    // 'brotli' | 'gzip' | 'none'
    // Default: 'brotli'
    compression: 'brotli',

    // Combined size of all JS + CSS + fonts on initial load
    // JS + CSS + fonts must stay under this ceiling together,
    // even if individual budgets pass
    // string: '<number>kb' | '<number>mb'
    // Default: '200kb'
    // Why: 200kb brotli ≈ 700kb parsed. On a mid-range device
    // over 4G, this keeps total parse + transfer under ~1.5s,
    // leaving headroom for rendering within a 2s TTI target.
    total: '200kb',

    // Total JS size on initial load
    // string: '<number>kb' | '<number>mb'
    // Default: '120kb'
    // Why: 120kb brotli ≈ 400kb parsed JS. Research by
    // Alex Russell shows this is the upper bound before
    // parse + compile costs push TTI past 2s on mid-range
    // Android devices (Snapdragon 6-series) over 4G.
    js: '120kb',

    // Total CSS size on initial load
    // string: '<number>kb' | '<number>mb'
    // Default: '30kb'
    // Why: CSS blocks rendering. 30kb brotli ≈ 100kb parsed,
    // which keeps stylesheet parse time under ~50ms on
    // mid-range devices. Beyond this, first contentful paint
    // degrades noticeably.
    css: '30kb',

    // Total font size on initial load
    // string: '<number>kb' | '<number>mb'
    // Default: '50kb'
    // Why: Fonts block text rendering until loaded. 50kb covers
    // one family with 2-3 weights subset to Latin. Anything
    // beyond this usually means unsubset fonts or too many
    // weights, both fixable problems.
    fonts: '50kb',

    // Max size of any single code-split chunk
    // string: '<number>kb' | '<number>mb'
    // Default: '30kb'
    // Why: Keeps individual chunks small enough for efficient
    // caching and parallel loading. A 30kb chunk over 4G
    // transfers in ~20ms. Large chunks defeat the purpose
    // of code splitting.
    perChunk: '30kb',

    // Max size of any single file in build output
    // string: '<number>kb' | '<number>mb'
    // Default: '100kb'
    // Why: Catch-all for any asset type. Prevents oversized
    // unoptimized files from slipping into the build
    // regardless of category.
    perAsset: '100kb',

    // [v1] Per-route JS budgets
    // Will support file-based routing (Next, Nuxt, SvelteKit,
    // Astro, Remix) and config-based routing (React Router,
    // Vue Router) with automatic route discovery.
    // perRoute: {
    //   '/': '50kb',
    //   '/dashboard': '150kb'
    // }
  },

  images: {
    // Temporarily allow legacy formats (png, jpg) while
    // migrating to modern formats (webp, avif, svg, gif)
    // Array<'png' | 'jpg'>
    // Default: []
    legacyFormats: [],

    // Max days legacy formats are allowed before
    // fastasf starts failing again
    // number (30-180)
    // Default: 60
    // Why: Converting images is not a major migration.
    // 60 days is generous for running a batch conversion
    // script across your assets.
    legacyFormatsTTL: 60,

    // Max size of any single image in build output
    // string: '<number>kb' | '<number>mb'
    // Default: '100kb'
    // Why: A 100kb image is roughly 1000x800 in WebP at
    // quality 80. Anything larger is usually uncompressed
    // or oversized for its display dimensions.
    maxSizePerAsset: '100kb',

    // Require width and height attributes on <img> tags
    // Prevents CLS (cumulative layout shift)
    // true | false
    // Default: true
    requireDimensions: true,

    // Require loading="lazy" on non-critical images
    // true | false
    // Default: true
    requireLazyLoad: true
  },

  dependencies: {
    // Fail if minor/patch versions are behind latest
    // true | false
    // Default: true
    requireLatestMinor: true,

    // Fail if major versions are behind latest
    // true | false
    // Default: true
    requireLatestMajor: true,

    // Packages exempt from major version checks
    // These still must be on latest minor/patch
    // of their current major
    // Record<string, string> — package name to
    // current major version
    // Default: {}
    majorExemptions: {
      // '@mui/material': '5',
      // 'react': '18',
    },

    // Max days a major exemption can last before
    // fastasf starts failing again
    // number (30-180)
    // Default: 90
    // Why: 90 days is a full quarter. Enough time to
    // plan and execute a migration. Max 180 because
    // beyond six months you're not migrating, you're
    // ignoring.
    majorExemptionTTL: 90,

    // Packages that should never appear in the bundle
    // string[]
    // Default: ['moment', 'lodash']
    // Why: moment (68kb) and lodash (72kb) are the two most
    // common bundle bloaters with modern alternatives
    // (dayjs 2kb, lodash-es or native methods).
    blockList: ['moment', 'lodash'],

    // Show lighter alternatives when a blocked or
    // heavy package is detected
    // true | false
    // Default: true
    suggestAlternatives: true,

    // Max number of duplicate packages allowed in the bundle
    // (e.g. two versions of React)
    // number (0 = no duplicates allowed)
    // Default: 0
    maxDuplicates: 0
  }
})