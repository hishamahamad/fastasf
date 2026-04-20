import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import type { FastasfConfig } from '../config/schema'
import type { RuleResult } from './budgets'
import { type Lockfile, isMajorExemptionExpired } from '../lockfile'

// --- Bundle types (blockList only) ---

type BundleChunk = { type: 'chunk'; moduleIds: string[] }
type Bundle = Record<string, { type: string } & Record<string, unknown>>

// --- Helpers ---

function extractPackageName(moduleId: string): string | null {
  // In pnpm, module IDs look like:
  // /project/node_modules/.pnpm/moment@2.30.1/node_modules/moment/moment.js
  // We need the last node_modules/ segment, skipping dot-prefixed entries like .pnpm
  const matches = [...moduleId.matchAll(/node_modules\/(@[^/]+\/[^/]+|[^@./][^/]*)/g)]
  if (!matches.length) return null
  return matches[matches.length - 1][1]
}

function parseVersion(raw: string): { major: number; minor: number; patch: number } | null {
  const cleaned = raw.replace(/^[\^~>=<v\s]+/, '')
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  }
}

async function fetchLatestVersion(pkg: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as { version?: string }
    return data.version ?? null
  } catch {
    return null
  }
}

// --- Package version detection ---

function readPackageVersion(pkgJsonPath: string): string | null {
  if (!existsSync(pkgJsonPath)) return null
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { version?: string }
    return pkg.version ?? null
  } catch {
    return null
  }
}

function recordVersion(versions: Map<string, string[]>, name: string, version: string): void {
  const existing = versions.get(name) ?? []
  if (!existing.includes(version)) versions.set(name, [...existing, version])
}

// Resolves workspace roots from package.json `workspaces` field.
// Handles the common glob patterns used by npm/yarn workspaces.
// pnpm workspaces (pnpm-workspace.yaml) use a single root .pnpm store — no need to walk per-workspace.
function resolveWorkspaceRoots(root: string): string[] {
  const roots = [root]
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      workspaces?: string[] | { packages?: string[] }
    }
    const patterns: string[] = Array.isArray(pkg.workspaces)
      ? pkg.workspaces
      : (pkg.workspaces?.packages ?? [])

    for (const pattern of patterns) {
      if (pattern.endsWith('/*')) {
        const dir = join(root, pattern.slice(0, -2))
        if (!existsSync(dir)) continue
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) roots.push(join(dir, entry.name))
        }
      } else {
        const wsRoot = join(root, pattern)
        if (existsSync(wsRoot)) roots.push(wsRoot)
      }
    }
  } catch {
    // not a monorepo or unreadable package.json — treat as single-package project
  }
  return roots
}

function walkNodeModules(dir: string, versions: Map<string, string[]>, depth: number): void {
  if (depth > 10) return
  const nmDir = join(dir, 'node_modules')
  if (!existsSync(nmDir)) return

  let entries: string[]
  try {
    entries = readdirSync(nmDir)
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.startsWith('.')) continue

    if (entry.startsWith('@')) {
      const scopeDir = join(nmDir, entry)
      let scoped: string[]
      try {
        scoped = readdirSync(scopeDir)
      } catch {
        continue
      }
      for (const pkg of scoped) {
        const pkgDir = join(scopeDir, pkg)
        const version = readPackageVersion(join(pkgDir, 'package.json'))
        if (version) recordVersion(versions, `${entry}/${pkg}`, version)
        walkNodeModules(pkgDir, versions, depth + 1)
      }
    } else {
      const pkgDir = join(nmDir, entry)
      const version = readPackageVersion(join(pkgDir, 'package.json'))
      if (version) recordVersion(versions, entry, version)
      walkNodeModules(pkgDir, versions, depth + 1)
    }
  }
}

// pnpm virtual store entries: name@version or @scope+name@version, with optional _peer suffix
function findVersionsPnpm(root: string): Map<string, string[]> {
  const versions = new Map<string, string[]>()
  const pnpmDir = join(root, 'node_modules', '.pnpm')

  let entries: string[]
  try {
    entries = readdirSync(pnpmDir)
  } catch {
    return versions
  }

  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const match = entry.match(/^(@[^+]+\+[^@]+|[^@]+)@([^_]+)/)
    if (!match) continue
    const rawName = match[1]
    const version = match[2]
    const name = rawName.startsWith('@') ? rawName.replace('+', '/') : rawName
    recordVersion(versions, name, version)
  }

  return versions
}

function findPackageVersions(root: string): Map<string, string[]> {
  if (existsSync(join(root, 'node_modules', '.pnpm'))) {
    return findVersionsPnpm(root)
  }

  // TODO: yarn PnP support (.pnp.cjs / .pnp.data.json)
  const versions = new Map<string, string[]>()
  for (const wsRoot of resolveWorkspaceRoots(root)) {
    walkNodeModules(wsRoot, versions, 0)
  }
  return versions
}

// --- Rules ---

export function checkBlockList(bundle: Bundle, config: FastasfConfig): RuleResult {
  const blocked = new Set(config.dependencies.blockList)
  const found = new Set<string>()

  for (const entry of Object.values(bundle)) {
    if (entry.type !== 'chunk') continue
    const chunk = entry as unknown as BundleChunk
    for (const moduleId of (chunk.moduleIds ?? [])) {
      const pkg = extractPackageName(moduleId)
      if (pkg && blocked.has(pkg)) found.add(pkg)
    }
  }

  const breakdown = [...found].map(pkg => ({ file: pkg, size: 0 }))

  return {
    rule: 'dependencies.blockList',
    passed: breakdown.length === 0,
    actual: breakdown.length,
    budget: 0,
    breakdown,
  }
}

export function checkMaxDuplicates(config: FastasfConfig, root: string): RuleResult {
  const { maxDuplicates } = config.dependencies
  const allVersions = findPackageVersions(root)

  const breakdown = [...allVersions.entries()]
    .filter(([, versions]) => versions.length > maxDuplicates + 1)
    .map(([pkg, versions]) => ({
      file: `${pkg} (${versions.join(', ')})`,
      size: versions.length,
    }))
    .sort((a, b) => b.size - a.size)

  return {
    rule: 'dependencies.maxDuplicates',
    passed: breakdown.length === 0,
    actual: breakdown.length > 0 ? breakdown[0].size : 0,
    budget: maxDuplicates,
    breakdown,
  }
}

export async function checkDependencyVersions(
  config: FastasfConfig,
  root: string,
  lock: Lockfile,
  offline: boolean,
): Promise<RuleResult> {
  const empty: RuleResult = {
    rule: 'dependencies.versions',
    passed: true,
    actual: 0,
    budget: 0,
    breakdown: [],
  }

  if (offline) return empty

  const { requireLatestMinor, requireLatestMajor, majorExemptions, majorExemptionTTL } =
    config.dependencies

  let pkgJson: { dependencies?: Record<string, string> }
  try {
    pkgJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  } catch {
    return empty
  }

  const deps = pkgJson.dependencies ?? {}
  const outdated: { file: string; size: number }[] = []

  const results = await Promise.allSettled(
    Object.keys(deps).map(async (pkg) => {
      const installedVersion = readPackageVersion(join(root, 'node_modules', pkg, 'package.json'))
      const latest = await fetchLatestVersion(pkg)
      return { pkg, installedVersion, latest }
    }),
  )

  let anySkipped = false

  for (const result of results) {
    if (result.status === 'rejected') {
      anySkipped = true
      continue
    }

    const { pkg, installedVersion, latest } = result.value

    if (!latest) {
      anySkipped = true
      continue
    }

    const current = installedVersion ? parseVersion(installedVersion) : null
    if (!current) continue

    const latestParsed = parseVersion(latest)
    if (!latestParsed) continue

    const exemptionExpired = isMajorExemptionExpired(lock, pkg, majorExemptionTTL)
    const isMajorExempt = pkg in majorExemptions && !exemptionExpired

    const majorOutdated = latestParsed.major > current.major
    const minorOutdated =
      latestParsed.major === current.major && latestParsed.minor > current.minor

    if (requireLatestMajor && !isMajorExempt && majorOutdated) {
      outdated.push({ file: `${pkg} (${installedVersion} → ${latest})`, size: 0 })
    } else if (requireLatestMinor && minorOutdated) {
      outdated.push({ file: `${pkg} (${installedVersion} → ${latest})`, size: 0 })
    }
  }

  if (anySkipped) {
    console.warn(
      "fastasf: couldn't verify latest versions for some packages — skipping those checks",
    )
  }

  return {
    rule: 'dependencies.versions',
    passed: outdated.length === 0,
    actual: outdated.length,
    budget: 0,
    breakdown: outdated,
  }
}
