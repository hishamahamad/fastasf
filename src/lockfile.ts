import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const LOCKFILE_NAME = '.fastasf-lock.json'

export type Lockfile = {
  legacyFormats?: {
    addedAt: string
  }
  majorExemptions?: {
    [pkg: string]: {
      addedAt: string
    }
  }
}

function isValidLockfile(data: unknown): data is Lockfile {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
  const d = data as Record<string, unknown>

  if (d.legacyFormats !== undefined) {
    if (typeof d.legacyFormats !== 'object' || d.legacyFormats === null) return false
    const lf = d.legacyFormats as Record<string, unknown>
    if (typeof lf.addedAt !== 'string' || isNaN(Date.parse(lf.addedAt))) return false
  }

  if (d.majorExemptions !== undefined) {
    if (typeof d.majorExemptions !== 'object' || d.majorExemptions === null) return false
    for (const val of Object.values(d.majorExemptions as Record<string, unknown>)) {
      if (typeof val !== 'object' || val === null) return false
      const v = val as Record<string, unknown>
      if (typeof v.addedAt !== 'string' || isNaN(Date.parse(v.addedAt))) return false
    }
  }

  return true
}

type ReadResult =
  | { lock: Lockfile; corrupt: false }
  | { lock: Lockfile; corrupt: true }

function readLockfile(root: string): ReadResult {
  const path = resolve(root, LOCKFILE_NAME)
  if (!existsSync(path)) return { lock: {}, corrupt: false }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!isValidLockfile(parsed)) return { lock: {}, corrupt: true }
    return { lock: parsed, corrupt: false }
  } catch {
    return { lock: {}, corrupt: true }
  }
}

function writeLockfile(root: string, data: Lockfile): void {
  const path = resolve(root, LOCKFILE_NAME)
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

export function syncLockfile(
  root: string,
  hasLegacyFormats: boolean,
  currentMajorExemptions: Record<string, string>,
): Lockfile {
  const { lock, corrupt } = readLockfile(root)

  if (corrupt) {
    console.warn('fastasf: .fastasf-lock.json is missing or corrupt — regenerating')
    writeLockfile(root, lock)
  }

  let dirty = false

  // legacyFormats
  if (hasLegacyFormats && !lock.legacyFormats) {
    lock.legacyFormats = { addedAt: new Date().toISOString() }
    dirty = true
  } else if (!hasLegacyFormats && lock.legacyFormats) {
    delete lock.legacyFormats
    dirty = true
  }

  // majorExemptions — stamp new entries, remove deleted ones
  const lockExemptions = lock.majorExemptions ?? {}
  const now = new Date().toISOString()

  for (const pkg of Object.keys(currentMajorExemptions)) {
    if (!lockExemptions[pkg]) {
      lockExemptions[pkg] = { addedAt: now }
      dirty = true
    }
  }

  for (const pkg of Object.keys(lockExemptions)) {
    if (!(pkg in currentMajorExemptions)) {
      delete lockExemptions[pkg]
      dirty = true
    }
  }

  if (Object.keys(lockExemptions).length > 0) {
    lock.majorExemptions = lockExemptions
  } else {
    delete lock.majorExemptions
  }

  if (dirty) writeLockfile(root, lock)

  return lock
}

export function isLegacyFormatsTTLExpired(lock: Lockfile, ttlDays: number): boolean {
  if (!lock.legacyFormats) return false
  const addedAt = new Date(lock.legacyFormats.addedAt).getTime()
  const expiresAt = addedAt + ttlDays * 24 * 60 * 60 * 1000
  return Date.now() > expiresAt
}

export function isMajorExemptionExpired(lock: Lockfile, pkg: string, ttlDays: number): boolean {
  const entry = lock.majorExemptions?.[pkg]
  if (!entry) return false
  const addedAt = new Date(entry.addedAt).getTime()
  const expiresAt = addedAt + ttlDays * 24 * 60 * 60 * 1000
  return Date.now() > expiresAt
}
