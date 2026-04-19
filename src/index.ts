import type { DeepPartial, FastasfConfig } from './config/schema'

export function defineConfig(config: DeepPartial<FastasfConfig>): DeepPartial<FastasfConfig> {
  return config
}
