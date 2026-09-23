import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import { resizeImage } from '@/lib/photos'
import type { ISODate, Photo, PhotoAngle } from '@/lib/types'
import { uid } from '@/lib/utils'
import { usePhotoURL } from './usePhotoURL'

export const ANGLES: { value: PhotoAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
  { value: 'side2', label: 'Other side' },
]

function Thumb({ photo, reference, label, onPick, onDelete, busy }: { photo?: Photo; reference?: Photo; label: string; onPick: () => void; onDelete: () => void; busy: boolean }) {
  const url = usePhotoURL(photo?.blob)
  const refUrl = usePhotoURL(reference?.blob)
  return (
    <div className="space-y-1">
      <button onClick={onPick} className="relative block aspect-[3/4] w-full overflow-hidden rounded-2xl border border-dashed border-border bg-surface-2">
        {url ? (
          <img src={url} alt={label} className="size-full object-cover" />
        ) : (
          <>
            {refUrl && <img src={refUrl} alt="" className="absolute inset-0 size-full object-cover opacity-25" />}
            <span className="relative flex size-full flex-col items-center justify-center gap-1 text-ink-3">
              <Camera className="size-6" />
              <span className="text-xs">{busy ? 'Saving…' : refUrl ? 'Match last pose' : 'Add'}</span>
            </span>
          </>
        )}
      </button>
      <div className="flex items-center justify-between text-xs text-ink-2">
        {label}
        {photo && (
          <button onClick={onDelete} className="p-1 text-ink-3" aria-label={`Delete ${label} photo`}>
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

/** Take / choose progress photos for a date. The last photo of each angle shows faintly as a pose guide. */
export function PhotoCapture({ date, cycleDay }: { date: ISODate; cycleDay?: number | null }) {
  const photos = useLiveQuery(() => db.photos.where('date').equals(date).toArray(), [date])
  const previous = useLiveQuery(async () => {
    const all = await db.photos.where('date').below(date).reverse().sortBy('date')
    const map = new Map<PhotoAngle, Photo>()
    for (const p of all) if (!map.has(p.angle)) map.set(p.angle, p)
    return map
  }, [date])
  const input = useRef<HTMLInputElement>(null)
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const [busy, setBusy] = useState<PhotoAngle | null>(null)

  const onFile = async (file?: File) => {
    if (!file) return
    setBusy(angle)
    try {
      const { blob, width, height } = await resizeImage(file)
      const existing = photos?.find((p) => p.angle === angle)
      await db.photos.put({ id: existing?.id ?? uid(), date, angle, blob, width, height, cycleDay: cycleDay ?? null, createdAt: Date.now() })
    } catch {
      toast("Couldn't read that image")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {ANGLES.map((a) => (
          <Thumb
            key={a.value}
            label={a.label}
            photo={photos?.find((p) => p.angle === a.value)}
            reference={previous?.get(a.value)}
            busy={busy === a.value}
            onPick={() => {
              setAngle(a.value)
              input.current?.click()
            }}
            onDelete={async () => {
              const p = photos?.find((x) => x.angle === a.value)
              if (!p) return
              await db.photos.delete(p.id)
              toast('Photo deleted', () => db.photos.put(p).then(() => undefined))
            }}
          />
        ))}
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
        onFile(e.target.files?.[0])
        e.target.value = ''
      }} />
    </div>
  )
}
