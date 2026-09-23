import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/card'
import { Segmented, Stepper, Switch } from '@/components/ui/controls'
import { Field, Input, NumInput, Select, Textarea } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { db } from '@/lib/db'
import { todayISO, nowHM } from '@/lib/dates'
import { MICRO_INFO, resolveFood } from '@/lib/nutrition'
import { autoSlot, logQuickMacros, saveFood } from '@/lib/repo'
import type { Component, FoodCategory, FoodItem, ISODate, MealSlot, Nutrients, QuickGroup } from '@/lib/types'
import { MICROS } from '@/lib/types'
import { uid } from '@/lib/utils'
import { MacroLine, MEALS, MEAL_LABEL } from './LogSheet'

const CATEGORIES: { value: FoodCategory; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'meal', label: 'Meal' },
  { value: 'snack', label: 'Snack' },
  { value: 'fruit', label: 'Fruit' },
  { value: 'side', label: 'Side' },
  { value: 'pasta', label: 'Pasta' },
  { value: 'condiment', label: 'Sauce / oil / extra' },
  { value: 'ingredient', label: 'Ingredient' },
]

const QUICK: { value: QuickGroup | ''; label: string }[] = [
  { value: '', label: 'Not in Quick Log' },
  { value: 'breakfast', label: 'Quick Log — Breakfast' },
  { value: 'snacks', label: 'Quick Log — Snacks' },
  { value: 'meals', label: 'Quick Log — Meals' },
  { value: 'sides', label: 'Quick Log — Sides' },
  { value: 'fruit', label: 'Quick Log — Fruit chips' },
  { value: 'extras', label: 'Quick Log — Extras chips' },
]

const blank = (kind: FoodItem['kind']): FoodItem => ({
  id: uid(),
  name: '',
  kind,
  category: kind === 'food' ? 'snack' : 'meal',
  serving: kind === 'recipe' ? '1 serving' : kind === 'meal' ? '1 serving' : '1 serving',
  nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micros: {} },
  components: kind === 'food' ? undefined : [],
  yield: kind === 'recipe' ? 1 : undefined,
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

/** Create or edit a food, recipe or saved meal. Saving refreshes every recipe/meal that uses it. */
export function FoodEditor({ open, onClose, food, kind = 'food' }: { open: boolean; onClose: () => void; food?: FoodItem; kind?: FoodItem['kind'] }) {
  const all = useLiveQuery(() => db.foods.toArray(), [])
  const [f, setF] = useState<FoodItem>(() => food ?? blank(kind))
  const [addId, setAddId] = useState('')
  useEffect(() => {
    if (open) setF(food ? structuredClone(food) : blank(kind))
  }, [open, food, kind])

  const lib = useMemo(() => new Map((all ?? []).map((x) => [x.id, x])), [all])
  const computed = f.kind !== 'food' && all ? resolveFood(f, lib).nutrients : null
  const setN = (k: keyof Omit<Nutrients, 'micros'>, v: number | null) => setF({ ...f, nutrients: { ...f.nutrients, [k]: v ?? 0 } })

  const save = async () => {
    if (!f.name.trim()) return toast('Give it a name first')
    await saveFood({ ...f, name: f.name.trim() })
    toast(food ? 'Saved — recipes using it were updated. Past logs keep their values.' : `Added ${f.name}`)
    onClose()
  }
  const archive = async () => {
    await db.foods.update(f.id, { archived: !f.archived, quickLog: undefined })
    toast(f.archived ? 'Restored' : 'Hidden from lists (past logs are kept)')
    onClose()
  }

  const ingredients = (all ?? []).filter((x) => x.id !== f.id && !x.archived).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={food ? `Edit ${food.kind}` : f.kind === 'food' ? 'Custom food' : f.kind === 'recipe' ? 'New recipe' : 'New saved meal'}
      footer={
        <div className="flex gap-2">
          {food && (
            <Button variant="outline" onClick={archive}>
              {f.archived ? 'Restore' : 'Hide'}
            </Button>
          )}
          <Button className="flex-1" onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={f.kind === 'meal' ? 'My usual breakfast' : 'Name'} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand (optional)">
            <Input value={f.brand ?? ''} onChange={(e) => setF({ ...f, brand: e.target.value || undefined })} />
          </Field>
          <Field label="Serving">
            <Input value={f.serving} onChange={(e) => setF({ ...f, serving: e.target.value })} placeholder="1 cup (227 g)" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as FoodCategory })}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quick Log">
            <Select value={f.quickLog ?? ''} onChange={(e) => setF({ ...f, quickLog: (e.target.value || undefined) as QuickGroup | undefined })}>
              {QUICK.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {f.kind === 'food' ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Calories">
                <NumInput value={f.nutrients.kcal} onChange={(v) => setN('kcal', v)} />
              </Field>
              <Field label="Protein g">
                <NumInput value={f.nutrients.protein} onChange={(v) => setN('protein', v)} />
              </Field>
              <Field label="Carbs g">
                <NumInput value={f.nutrients.carbs} onChange={(v) => setN('carbs', v)} />
              </Field>
              <Field label="Fat g">
                <NumInput value={f.nutrients.fat} onChange={(v) => setN('fat', v)} />
              </Field>
              <Field label="Fiber g">
                <NumInput value={f.nutrients.fiber} onChange={(v) => setN('fiber', v)} />
              </Field>
            </div>
            <Section title="Micronutrients & whole-food servings" subtitle="Optional — leave blank if unknown">
              <div className="grid grid-cols-2 gap-3">
                {MICROS.map((m) => (
                  <Field key={m} label={`${MICRO_INFO[m].label} (${MICRO_INFO[m].unit})`}>
                    <NumInput
                      value={f.nutrients.micros?.[m]}
                      onChange={(v) => {
                        const micros = { ...(f.nutrients.micros ?? {}) }
                        if (v == null) delete micros[m]
                        else micros[m] = v
                        setF({ ...f, nutrients: { ...f.nutrients, micros } })
                      }}
                    />
                  </Field>
                ))}
                {(['fruit', 'veg', 'calcium'] as const).map((k) => (
                  <Field key={k} label={`${k === 'calcium' ? 'Calcium-rich' : k === 'veg' ? 'Vegetable' : 'Fruit'} servings`}>
                    <NumInput value={f.servings?.[k]} onChange={(v) => setF({ ...f, servings: { ...f.servings, [k]: v ?? undefined } })} />
                  </Field>
                ))}
              </div>
            </Section>
          </>
        ) : (
          <div className="space-y-3">
            {f.kind === 'recipe' && (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Recipe makes</div>
                  <div className="text-xs text-ink-3">Nutrition is per serving</div>
                </div>
                <Stepper value={f.yield ?? 1} onChange={(v) => setF({ ...f, yield: v })} min={1} step={1} format={(v) => `${v} serving${v === 1 ? '' : 's'}`} />
              </div>
            )}
            <div className="text-sm font-medium">{f.kind === 'recipe' ? 'Ingredients' : 'Includes (default portions)'}</div>
            <div className="divide-y divide-border rounded-2xl border border-border">
              {(f.components ?? []).length === 0 && <p className="px-3 py-3 text-sm text-ink-3">Add foods below.</p>}
              {(f.components ?? []).map((c: Component, i) => {
                const it = lib.get(c.foodId)
                return (
                  <div key={`${c.foodId}-${i}`} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{it?.name ?? c.foodId}</div>
                      <div className="text-xs text-ink-3">{it?.serving}</div>
                    </div>
                    <NumInput className="h-9 w-20 text-center" value={c.qty} onChange={(v) => setF({ ...f, components: f.components!.map((x, j) => (j === i ? { ...x, qty: v ?? 0 } : x)) })} />
                    <button className="p-1 text-ink-3" onClick={() => setF({ ...f, components: f.components!.filter((_, j) => j !== i) })} aria-label="Remove">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <Select value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1">
                <option value="">Add a food…</option>
                {ingredients.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.serving})
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                disabled={!addId}
                onClick={() => {
                  setF({ ...f, components: [...(f.components ?? []), { foodId: addId, qty: 1 }] })
                  setAddId('')
                }}
              >
                Add
              </Button>
            </div>
            {computed && (
              <p className="rounded-2xl bg-surface-2 px-3 py-2 text-sm">
                Per serving: <MacroLine n={computed} className="font-medium tabular-nums" />
              </p>
            )}
          </div>
        )}
        <Switch checked={!!f.favorite} onChange={(v) => setF({ ...f, favorite: v })} label="Favorite" />
        <Switch checked={!!f.estimate} onChange={(v) => setF({ ...f, estimate: v })} label="Values are an estimate" hint="Shows a reminder to check the label or portion" />
        <Field label="Notes">
          <Textarea value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value || undefined })} />
        </Field>
      </div>
    </Sheet>
  )
}

/** Log calories/macros directly (restaurant meal, something not worth saving). */
export function QuickMacrosSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: ISODate }) {
  const [name, setName] = useState('')
  const [n, setN] = useState<Nutrients>({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
  const [meal, setMeal] = useState<MealSlot>(() => autoSlot(nowHM(), null, []))
  const [saveAsFood, setSaveAsFood] = useState(false)
  const save = async () => {
    await logQuickMacros(date, name, n, meal, date === todayISO() ? nowHM() : '12:00')
    if (saveAsFood && name.trim()) await saveFood({ ...blank('food'), name: name.trim(), nutrients: n, category: 'meal', estimate: true })
    toast(`Logged ${name || 'quick add'}`)
    setName('')
    setN({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
    onClose()
  }
  const set = (k: keyof Omit<Nutrients, 'micros'>) => (v: number | null) => setN({ ...n, [k]: v ?? 0 })
  return (
    <Sheet open={open} onClose={onClose} title="Quick add" footer={<Button className="w-full" size="lg" onClick={save}>Log it</Button>}>
      <div className="space-y-4">
        <Field label="What was it?">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sushi dinner out" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Calories"><NumInput value={n.kcal} onChange={set('kcal')} /></Field>
          <Field label="Protein g"><NumInput value={n.protein} onChange={set('protein')} /></Field>
          <Field label="Carbs g"><NumInput value={n.carbs} onChange={set('carbs')} /></Field>
          <Field label="Fat g"><NumInput value={n.fat} onChange={set('fat')} /></Field>
          <Field label="Fiber g"><NumInput value={n.fiber} onChange={set('fiber')} /></Field>
        </div>
        <Field label="Meal">
          <Segmented size="sm" value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m].slice(0, 5) }))} />
        </Field>
        <Switch checked={saveAsFood} onChange={setSaveAsFood} label="Also save as a custom food" />
      </div>
    </Sheet>
  )
}
