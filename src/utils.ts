import { brotliCompressSync, gzipSync } from 'node:zlib'

export function compress(source: string | Buffer | Uint8Array, algorithm: string): number {
  const buf = typeof source === 'string' 
    ? Buffer.from(source, 'utf8') 
    : Buffer.from(source)
    
  if (algorithm === 'brotli') return brotliCompressSync(buf).byteLength
  if (algorithm === 'gzip') return gzipSync(buf).byteLength
  return buf.byteLength
}

export function parseSizeString(size: string): number {
  const match = size.match(/^(\d+(\.\d+)?)(kb|mb)$/i)
  if (!match) throw new Error(`fastasf: invalid size string "${size}". size must be either "kb" or "mb".`)
  const value = parseFloat(match[1])
  const unit = match[3].toLowerCase()
  return Math.round(value * (unit === 'mb' ? 1024 * 1024 : 1024))
}
