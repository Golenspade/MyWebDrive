import type { Readable } from 'node:stream'

export interface ObjectStorage {
  writePart(objectKey: string, partNumber: number, body: Readable): Promise<void>
  completeObject(objectKey: string, parts: number, generation: string, expectedSize: bigint): Promise<{ sizeBytes: bigint; sha256: string }>
  openRead(objectKey: string): Promise<Readable>
  stat(objectKey: string): Promise<{ sizeBytes: bigint; generation?: string } | null>
  deleteObject(objectKey: string): Promise<void>
  deletePart(objectKey: string, partNumber: number): Promise<void>
  deleteParts(objectKey: string, parts: number): Promise<void>
  inspectParts(objectKey: string, parts: number): Promise<{ complete: boolean; sizeBytes: bigint }>
  ready(): Promise<void>
}

export class ObjectIntegrityError extends Error {
  constructor() {
    super('object integrity mismatch')
  }
}
