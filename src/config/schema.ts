import { z } from 'zod'

const sizeString = z.string().regex(/^\d+(\.\d+)?(kb|mb)$/i, {
  error: 'Must be a size string like "200kb" or "1.5mb"',
})

const ttlDays = z.number().int().min(30).max(180)

export const BudgetsSchema = z.object({
  compression: z.enum(['brotli', 'gzip', 'none']),
  total: sizeString,
  js: sizeString,
  css: sizeString,
  fonts: sizeString,
  perChunk: sizeString,
  perAsset: sizeString,
})

export const ImagesSchema = z.object({
  legacyFormats: z.array(z.enum(['png', 'jpg'])),
  legacyFormatsTTL: ttlDays,
  maxSizePerAsset: sizeString,
  requireDimensions: z.boolean(),
  requireLazyLoad: z.boolean(),
})

export const DependenciesSchema = z.object({
  requireLatestMinor: z.boolean(),
  requireLatestMajor: z.boolean(),
  majorExemptions: z.record(z.string(), z.string()),
  majorExemptionTTL: ttlDays,
  blockList: z.array(z.string()),
  suggestAlternatives: z.boolean(),
  maxDuplicates: z.number().int().min(0),
})

export const FastasfConfigSchema = z.object({
  strict: z.boolean(),
  budgets: BudgetsSchema,
  images: ImagesSchema,
  dependencies: DependenciesSchema,
})

export type BudgetsConfig = z.infer<typeof BudgetsSchema>
export type ImagesConfig = z.infer<typeof ImagesSchema>
export type DependenciesConfig = z.infer<typeof DependenciesSchema>
export type FastasfConfig = z.infer<typeof FastasfConfigSchema>

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}
