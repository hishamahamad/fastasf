import type { Plugin, ResolvedConfig } from 'vite'
import type { DeepPartial, FastasfConfig } from './config/schema'
import type { Lockfile } from './lockfile'
import type { RuleResult } from './rules/budgets'
import { loadConfig } from './config/loader'
import { syncLockfile } from './lockfile'
import {
  checkJsBudget,
  checkCssBudget,
  checkFontsBudget,
  checkTotalBudget,
  checkPerChunkBudget,
  checkPerAssetBudget,
} from './rules/budgets'
import { checkImageFormats, checkImageSizes } from './rules/images'
import {
  checkBlockList,
  checkMaxDuplicates,
  checkDependencyVersions,
} from './rules/dependencies'
import { formatResults } from './reporter/formatter'

export function defineConfig(config: DeepPartial<FastasfConfig>): DeepPartial<FastasfConfig> {
  return config
}

export function fastasf(): Plugin {
  let viteConfig: ResolvedConfig
  let fastasfConfig: FastasfConfig
  let lock: Lockfile

  return {
    name: 'fastasf',
    apply: 'build',
    enforce: 'post',

    async configResolved(config) {
      viteConfig = config
      fastasfConfig = await loadConfig(config.root)
      lock = syncLockfile(
        config.root,
        fastasfConfig.images.legacyFormats.length > 0,
        fastasfConfig.dependencies.majorExemptions,
      )
    },

    async generateBundle(_, bundle) {
      const root = viteConfig.root
      const offline = !!process.env.FASTASF_OFFLINE

      const b = bundle as Parameters<typeof checkJsBudget>[0]

      const results: RuleResult[] = [
        checkJsBudget(b, fastasfConfig),
        checkCssBudget(b, fastasfConfig),
        checkFontsBudget(b, fastasfConfig),
        checkTotalBudget(b, fastasfConfig),
        checkPerChunkBudget(b, fastasfConfig),
        checkPerAssetBudget(b, fastasfConfig),
        checkImageFormats(b, fastasfConfig, lock),
        checkImageSizes(b, fastasfConfig),
        checkBlockList(b as Parameters<typeof checkBlockList>[0], fastasfConfig),
        checkMaxDuplicates(fastasfConfig, root),
        await checkDependencyVersions(fastasfConfig, root, lock, offline),
      ]

      console.log(formatResults(results))

      const anyFailed = results.some(r => !r.passed)
      if (anyFailed && fastasfConfig.strict) {
        this.error('fastasf: build failed — fix the violations above before shipping')
      }
    },
  }
}
