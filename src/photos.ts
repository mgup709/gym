// Progress photos live in IndexedDB on this device only. No analysis, no scoring.

export type PhotoView = 'front' | 'side' | 'back'

export interface Photo {
  id: string
  date: string
  view: PhotoView
  blob: Blob
  note?: string
}

const DB = 'lbd-photos'
const STORE = 'photos'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const listPhotos = () => tx<Photo[]>('readonly', (s) => s.getAll() as IDBRequest<Photo[]>)
export const savePhoto = (p: Photo) => tx('readwrite', (s) => s.put(p))
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id))
