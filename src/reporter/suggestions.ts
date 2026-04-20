import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type Suggestion = {
  pkg: string
  alternative: string
  alternativeSize: string
  savings: string
}

type AlternativesMap = Record<
  string,
  { alternative: string; alternativeSize: string; savings: string } | null
>

let _cache: AlternativesMap | null = null

function loadAlternatives(): AlternativesMap {
  if (_cache) return _cache
  try {
    const path = resolve(__dirname, '../../data/alternatives.json')
    _cache = JSON.parse(readFileSync(path, 'utf8')) as AlternativesMap
  } catch {
    _cache = {}
  }
  return _cache
}

function extractPackageName(file: string): string {
  // Strip size/version annotations like "chart.js (52kb)" or "moment (1.2.3 → 2.0.0)"
  return file.replace(/\s*\(.*\)$/, '').trim()
}

export function getSuggestion(file: string): Suggestion | null {
  const alternatives = loadAlternatives()
  const pkg = extractPackageName(file)
  const entry = alternatives[pkg]
  if (!entry) return null
  return { pkg, ...entry }
}
