import type { Readable } from 'node:stream'

export interface ObjectStorage {
  writePart(objectKey: string, partNumber: number, body: Readable): Promise<void>
  completeObject(objectKey: string, parts: number): Promise<{ sizeBytes: bigint; sha256: string }>
  openRead(objectKey: string): Promise<Readable>
  stat(objectKey: string): Promise<{ sizeBytes: bigint } | null>
  deleteObject(objectKey: string): Promise<void>
  inspectParts(objectKey: string, parts: number): Promise<{ complete: boolean; sizeBytes: bigint }>
  ready(): Promise<void>
}
