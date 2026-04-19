import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createJiti } from 'jiti'
import { FastasfConfigSchema, type FastasfConfig } from './schema'
import type { DeepPartial } from './schema'
import { defaults } from './defaults'

const CONFIG_FILES = [
  'fastasf.config.ts',
  'fastasf.config.js',
  'fastasf.config.mjs',
  'fastasf.config.cjs',
]

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base }
  for (const key in override) {
    const baseVal = base[key]
    const overrideVal = override[key]
    if (
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      ) as T[typeof key]
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal as T[typeof key]
    }
  }
  return result
}

async function resolveConfigFile(root: string): Promise<string | null> {
  for (const file of CONFIG_FILES) {
    const path = resolve(root, file)
    if (existsSync(path)) return path
  }
  return null
}

async function loadConfigFile(path: string): Promise<DeepPartial<FastasfConfig>> {
  // jiti is a great way to load config files with support for ESM/CJS/TS without needing to bundle or transpile them first
  const jiti = createJiti(import.meta.url)
  const mod = await jiti.import(path)
  return (mod as any)?.default ?? mod
}

export async function loadConfig(root: string = process.cwd()): Promise<FastasfConfig> {
  const configPath = await resolveConfigFile(root)

  const userConfig: DeepPartial<FastasfConfig> = configPath ? await loadConfigFile(configPath) : {}
  const merged = deepMerge(defaults as Record<string, unknown>, userConfig as Record<string, unknown>) as FastasfConfig

  const result = FastasfConfigSchema.safeParse(merged)
  if (!result.success) {
    const messages = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`fastasf: invalid config:\n${messages}`)
  }

  return result.data
}
