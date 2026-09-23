import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip, Segmented, Stepper } from '@/components/ui/controls'
import { Field, Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { Pill } from '@/components/ui/card'
import { db } from '@/lib/db'
import { nowHM, todayISO } from '@/lib/dates'
import { addN, applyModifier, entryTotal, resolveFood, scaleN, zeroN } from '@/lib/nutrition'
import { autoSlot, buildEntry, deleteEntry, ensureDay, restoreEntries, saveFood } from '@/lib/repo'
import type { Component, FoodEntry, FoodItem, ISODate, MealSlot, Nutrients } from '@/lib/types'
import { fmtNum } from '@/lib/utils'

export const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  evening: 'Evening',
}
export const MEALS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner', 'evening']

export function MacroLine({ n, className }: { n: Nutrients; className?: string }) {
  return (
    <span className={className ?? 'text-xs text-ink-3 tabular-nums'}>
      {fmtNum(n.kcal)} kcal · {fmtNum(n.protein)} P · {fmtNum(n.carbs)} C · {fmtNum(n.fat)} F · {fmtNum(n.fiber, 1)} fib
    </span>
  )
}

const fmtQty = (q: number) => (q === 0.5 ? '½' : q === 0.25 ? '¼' : q === 0.75 ? '¾' : q === 1.5 ? '1½' : String(q))

/**
 * Log a food with custom portions/components/add-ons — or edit an existing entry.
 * Everything shown comes from stored values.
 */
export function LogSheet({ open, onClose, food, entry, date, onLogged, meal: presetMeal }: { open: boolean; onClose: () => void; food?: FoodItem; entry?: FoodEntry; date: ISODate; onLogged?: () => void; meal?: MealSlot }) {
  const lib = useLiveQuery(async () => new Map((await db.foods.toArray()).map((f) => [f.id, f])), [])
  const baseFood = food ?? (entry?.foodId ? lib?.get(entry.foodId) : undefined)
  const [qty, setQty] = useState(1)
  const [components, setComponents] = useState<Component[] | undefined>()
  const [addons, setAddons] = useState<Record<string, number>>({})
  const [meal, setMeal] = useState<MealSlot>('snack')
  const [time, setTime] = useState(nowHM())
  const [makeDefault, setMakeDefault] = useState(false)
  const [note, setNote] = useState('')
  const [activeMods, setActiveMods] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    if (entry) {
      setQty(entry.qty)
      setComponents(entry.components ?? baseFood?.components)
      setAddons(Object.fromEntries((entry.addons ?? []).map((a) => [a.foodId, a.qty])))
      setMeal(entry.meal)
      setTime(entry.time)
      setNote(entry.note ?? '')
    } else if (food) {
      const t = date === todayISO() ? nowHM() : '12:00'
      setQty(food.defaultQty ?? 1)
      setComponents(food.components)
      setAddons({})
      setTime(t)
      setNote('')
      db.entries
        .where('date')
        .equals(date)
        .toArray()
        .then((es) => setMeal(presetMeal ?? autoSlot(t, food, es)))
    }
    setActiveMods([])
    setMakeDefault(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id, food?.id])

  const preview = useMemo(() => {
    if (!lib) return null
    let per: Nutrients
    if (baseFood) per = resolveFood(baseFood, lib, baseFood.kind === 'meal' ? components : undefined).nutrients
    else if (entry) per = entry.per
    else return null
    let add = zeroN()
    for (const [id, q] of Object.entries(addons)) {
      const f = lib.get(id)
      if (f && q > 0) add = addN(add, resolveFood(f, lib).nutrients, q)
    }
    return addN(scaleN(per, qty), add)
  }, [lib, baseFood, components, addons, qty, entry])

  if (!open) return null
  const title = baseFood?.name ?? entry?.name ?? ''
  const isMeal = baseFood?.kind === 'meal' && components
  const addonIds = [...new Set([...(baseFood?.addons ?? []), ...Object.keys(addons)])]
  const extraAddons = ['chipotle-mayo', 'spicy-mayo', 'olive-oil', 'avocado-spray', 'maple-syrup', 'butter', 'cheese', 'almonds', 'peanut-butter'].filter((id) => !addonIds.includes(id) && !components?.some((c) => c.foodId === id))

  const toggleMod = (id: string) => {
    const m = baseFood?.modifiers?.find((x) => x.id === id)
    if (!m || !components) return
    if (activeMods.includes(id)) {
      // Rebuild from defaults with the remaining modifiers.
      const rest = activeMods.filter((x) => x !== id)
      let c = baseFood!.components!
      for (const r of rest) c = applyModifier(c, baseFood!.modifiers!.find((x) => x.id === r)!.set)
      setComponents(c)
      setActiveMods(rest)
    } else {
      setComponents(applyModifier(components, m.set))
      setActiveMods([...activeMods, id])
    }
  }

  const save = async () => {
    if (!lib) return
    if (entry) {
      const rebuilt = baseFood
        ? await buildEntry(date, baseFood, { qty, components: isMeal ? components : undefined, addons: Object.entries(addons).map(([foodId, q]) => ({ foodId, qty: q })), meal, time })
        : null
      const next: FoodEntry = rebuilt
        ? { ...rebuilt, id: entry.id, createdAt: entry.createdAt, source: entry.source, date: entry.date, note: note || undefined }
        : { ...entry, qty, meal, time, note: note || undefined }
      const prev = entry
      await db.entries.put(next)
      toast('Entry updated', () => restoreEntries([prev]))
    } else if (baseFood) {
      await ensureDay(date)
      const e = await buildEntry(date, baseFood, {
        qty,
        components: isMeal ? components : undefined,
        addons: Object.entries(addons).map(([foodId, q]) => ({ foodId, qty: q })),
        meal,
        time,
        source: 'manual',
        note: note || undefined,
      })
      await db.entries.put(e)
      toast(`Logged ${baseFood.name}`, () => deleteEntry(e.id).then(() => undefined))
      if (makeDefault) {
        await saveFood({ ...baseFood, components: isMeal ? components : baseFood.components, defaultQty: qty })
      }
    }
    onLogged?.()
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="space-y-3">
          {preview && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink-2">Total</span>
              <MacroLine n={preview} className="text-sm font-medium tabular-nums" />
            </div>
          )}
          <Button className="w-full" size="lg" onClick={save}>
            {entry ? 'Save changes' : 'Log it'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {baseFood?.estimate && <Pill tone="amber">Estimated values — edit the food if your label differs</Pill>}
        {baseFood?.notes && <p className="text-sm text-ink-3">{baseFood.notes}</p>}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Servings</div>
            <div className="text-xs text-ink-3">{baseFood?.serving ?? entry?.serving}</div>
          </div>
          <Stepper value={qty} onChange={setQty} step={0.25} min={0.25} max={20} format={fmtQty} />
        </div>
        <div className="flex flex-wrap gap-2">
          {[0.5, 1, 1.5, 2].map((q) => (
            <Chip key={q} active={qty === q} onClick={() => setQty(q)}>
              {fmtQty(q)} serving{q === 1 ? '' : 's'}
            </Chip>
          ))}
        </div>

        {isMeal && lib && (
          <div className="space-y-3">
            {!!baseFood?.modifiers?.length && (
              <div className="flex flex-wrap gap-2">
                {baseFood.modifiers.map((m) => (
                  <Chip key={m.id} active={activeMods.includes(m.id)} onClick={() => toggleMod(m.id)}>
                    {m.label}
                  </Chip>
                ))}
              </div>
            )}
            <div className="divide-y divide-border rounded-2xl border border-border">
              {components!.map((c, i) => {
                const f = lib.get(c.foodId)
                if (!f) return null
                return (
                  <div key={c.foodId} className={`flex items-center justify-between gap-3 px-3 py-2 ${c.qty === 0 ? 'opacity-60' : ''}`}>
                    <div className="min-w-0">
                      <div className="truncate text-sm">{f.name}</div>
                      <div className="text-xs text-ink-3">{f.serving}</div>
                    </div>
                    <Stepper
                      value={c.qty}
                      step={f.category === 'condiment' || f.id.includes('rice') || f.id === 'pasta' ? 0.25 : 0.5}
                      min={0}
                      format={fmtQty}
                      onChange={(v) => setComponents(components!.map((x, j) => (j === i ? { ...x, qty: v } : x)))}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {lib && (addonIds.length > 0 || extraAddons.length > 0) && (
          <div>
            <div className="mb-2 text-sm font-medium">Add-ons, sauces &amp; oils</div>
            <div className="divide-y divide-border rounded-2xl border border-border">
              {addonIds.map((id) => {
                const f = lib.get(id)
                if (!f) return null
                return (
                  <div key={id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{f.name}</div>
                      <div className="text-xs text-ink-3">{f.serving}</div>
                    </div>
                    <Stepper value={addons[id] ?? 0} step={0.5} min={0} format={fmtQty} onChange={(v) => setAddons({ ...addons, [id]: v })} />
                  </div>
                )
              })}
            </div>
            {extraAddons.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {extraAddons.map((id) => (
                  <Chip key={id} onClick={() => setAddons({ ...addons, [id]: 1 })} className="h-7 text-xs">
                    + {lib.get(id)?.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Meal">
            <Segmented size="sm" value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m].slice(0, m === 'evening' ? 3 : 5) }))} />
          </Field>
          <Field label="Time">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-28" />
          </Field>
        </div>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. restaurant was generous with rice" />
        </Field>
        {!entry && baseFood && (
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Remember these portions for one-tap logging
          </label>
        )}
        {entry && entry.addons && baseFood == null && <p className="text-xs text-ink-3">Totals: <MacroLine n={entryTotal(entry)} /></p>}
      </div>
    </Sheet>
  )
}
