// Preloaded food library: the user's actual regular foods, their ingredients, and editable meal templates.
// Values come from typical label / USDA data. Items marked `estimate` (restaurant portions, packaged
// products whose labels vary by batch) should be checked against the package and edited.

import type { Component, FoodCategory, FoodItem, FoodServings, Micro, Modifier, Nutrients, QuickGroup } from './types'

type M = Partial<Record<Micro, number>>

const n = (kcal: number, protein: number, carbs: number, fat: number, fiber: number, micros?: M): Nutrients => ({
  kcal,
  protein,
  carbs,
  fat,
  fiber,
  micros,
})

interface Opts {
  brand?: string
  servings?: FoodServings
  tags?: string[]
  quick?: QuickGroup
  estimate?: boolean
  notes?: string
  addons?: string[]
  favorite?: boolean
  defaultQty?: number
}

const T0 = 0

function food(id: string, name: string, category: FoodCategory, serving: string, nutrients: Nutrients, o: Opts = {}): FoodItem {
  return {
    id,
    name,
    kind: 'food',
    category,
    serving,
    nutrients,
    brand: o.brand,
    servings: o.servings,
    tags: o.tags,
    quickLog: o.quick,
    estimate: o.estimate,
    notes: o.notes,
    addons: o.addons,
    favorite: o.favorite,
    defaultQty: o.defaultQty,
    createdAt: T0,
    updatedAt: T0,
  }
}

function combo(
  kind: 'recipe' | 'meal',
  id: string,
  name: string,
  category: FoodCategory,
  serving: string,
  components: Component[],
  o: Opts & { yield?: number; modifiers?: Modifier[] } = {},
): FoodItem {
  return {
    ...food(id, name, category, serving, n(0, 0, 0, 0, 0), o),
    kind,
    components,
    yield: o.yield ?? 1,
    modifiers: o.modifiers,
  }
}

const c = (foodId: string, qty: number): Component => ({ foodId, qty })

const FRUIT = { fruit: 1 }

export const SEED_FOODS: FoodItem[] = [
  // ── Fruit ──────────────────────────────────────────────
  food('banana', 'Banana', 'fruit', '1 medium (118 g)', n(105, 1.3, 27, 0.4, 3.1, { potassium: 422, magnesium: 32, vitaminC: 10.3, folate: 24, calcium: 6, iron: 0.3 }), { servings: FRUIT, quick: 'fruit' }),
  food('watermelon', 'Watermelon', 'fruit', '1 cup diced (152 g)', n(46, 0.9, 11.5, 0.2, 0.6, { potassium: 170, magnesium: 15, vitaminC: 12.3, folate: 5, calcium: 11, iron: 0.4 }), { servings: FRUIT, quick: 'fruit' }),
  food('pineapple', 'Pineapple', 'fruit', '1 cup chunks (165 g)', n(82, 0.9, 21.6, 0.2, 2.3, { potassium: 180, magnesium: 20, vitaminC: 79, folate: 30, calcium: 21, iron: 0.5 }), { servings: FRUIT, quick: 'fruit' }),
  food('mango', 'Mango', 'fruit', '1 cup pieces (165 g)', n(99, 1.4, 24.7, 0.6, 2.6, { potassium: 277, magnesium: 17, vitaminC: 60, folate: 71, calcium: 18, iron: 0.3 }), { servings: FRUIT, quick: 'fruit' }),
  food('grapes', 'Cotton candy grapes', 'fruit', '1 cup (151 g)', n(104, 1.1, 27.3, 0.2, 1.4, { potassium: 288, magnesium: 11, vitaminC: 4.8, calcium: 15, iron: 0.5, folate: 3 }), { servings: FRUIT, quick: 'fruit' }),

  // ── Dairy / protein ingredients ─────────────────────────
  food('chobani-plain', 'Plain Chobani Greek yogurt', 'snack', '1 cup (227 g)', n(120, 20, 8, 0, 0, { calcium: 220, potassium: 300, b12: 1.2, iodine: 50, magnesium: 20 }), { brand: 'Chobani', servings: { calcium: 1 }, tags: ['dairy', 'lactose-friendly'], quick: 'snacks', addons: ['banana', 'mango', 'pineapple', 'watermelon', 'grapes', 'maple-syrup', 'chia', 'almonds'], estimate: true, notes: 'Nonfat plain. Check your container size.' }),
  food('chobani-lemon', 'Lemon Chobani yogurt', 'snack', '1 cup (150 g)', n(140, 11, 17, 3, 0, { calcium: 120, potassium: 190, b12: 0.6, iodine: 30 }), { brand: 'Chobani', servings: { calcium: 1 }, tags: ['dairy'], quick: 'snacks', estimate: true }),
  food('skyr', 'Plain skyr', 'snack', '1 cup (150 g)', n(90, 16, 5, 0, 0, { calcium: 150, potassium: 200, b12: 0.8, iodine: 40 }), { servings: { calcium: 1 }, tags: ['dairy', 'lactose-friendly'], estimate: true }),
  food('cottage-cheese', 'Good Culture 2% cottage cheese', 'ingredient', '½ cup (113 g)', n(90, 14, 3, 2.5, 0, { calcium: 100, potassium: 150, b12: 0.5, iodine: 25 }), { brand: 'Good Culture', servings: { calcium: 0.5 }, tags: ['dairy'], estimate: true }),
  food('egg-whites', 'Liquid egg whites', 'ingredient', '½ cup (122 g)', n(63, 13, 0.9, 0.2, 0, { potassium: 200, magnesium: 13, calcium: 9, b12: 0.1, folate: 5 })),
  food('egg', 'Egg', 'ingredient', '1 large (50 g)', n(72, 6.3, 0.4, 4.8, 0, { calcium: 28, iron: 0.9, magnesium: 6, potassium: 69, vitaminD: 1.1, folate: 24, b12: 0.45, iodine: 26 })),
  food('soy-milk', 'Silk unsweetened soy milk', 'ingredient', '1 cup (240 ml)', n(80, 7, 3, 4, 2, { calcium: 300, vitaminD: 3, b12: 1.2, potassium: 380, magnesium: 40, iron: 1.1 }), { brand: 'Silk', servings: { calcium: 1 }, tags: ['soy'], estimate: true }),
  food('core-power', 'Core Power 26 g vanilla shake', 'ingredient', '1 bottle (14 fl oz)', n(170, 26, 8, 4.5, 0, { calcium: 590, potassium: 700, vitaminD: 2.5, magnesium: 80 }), { brand: 'Fairlife', servings: { calcium: 1.5 }, tags: ['dairy', 'lactose-free'], estimate: true }),
  food('iso100', 'ISO100 Gourmet Vanilla', 'ingredient', '1 scoop (30 g)', n(120, 25, 2, 0.5, 0), { brand: 'Dymatize', estimate: true }),
  food('lf-milk', 'Lactose-free milk 2%', 'ingredient', '1 cup (240 ml)', n(120, 13, 6, 4.5, 0, { calcium: 380, vitaminD: 3, potassium: 400, b12: 1.3, iodine: 85 }), { brand: 'Fairlife', servings: { calcium: 1 }, tags: ['dairy', 'lactose-free'] }),
  food('cheese', 'Cheddar cheese', 'condiment', '1 oz (28 g)', n(115, 6.5, 0.4, 9.5, 0, { calcium: 200, b12: 0.3, iodine: 12 }), { servings: { calcium: 1 }, tags: ['dairy'], quick: 'extras' }),
  food('parmesan', 'Parmesan', 'condiment', '1 tbsp grated (5 g)', n(21, 1.9, 0.7, 1.4, 0, { calcium: 55 }), { tags: ['dairy'] }),

  // ── Seafood & protein ───────────────────────────────────
  food('salmon', 'Salmon (sushi-grade)', 'ingredient', '4 oz (113 g)', n(235, 23, 0, 15, 0, { vitaminD: 12, b12: 3.6, potassium: 410, magnesium: 31, iodine: 15 }), { tags: ['seafood'] }),
  food('tuna', 'Canned tuna in water', 'ingredient', '1 can (5 oz)', n(120, 27, 0, 1, 0, { b12: 2.5, vitaminD: 1.5, potassium: 270, magnesium: 30, iron: 1.5, iodine: 17 }), { tags: ['seafood', 'no-cook'] }),
  food('canned-salmon', 'Canned salmon', 'ingredient', '1 can (5 oz)', n(160, 26, 0, 6, 0, { calcium: 250, vitaminD: 12, b12: 4.5, potassium: 350, magnesium: 30 }), { servings: { calcium: 1 }, tags: ['seafood', 'no-cook'], estimate: true }),
  food('smoked-salmon', 'Smoked salmon', 'ingredient', '2 oz (56 g)', n(66, 10.3, 0, 2.4, 0, { vitaminD: 3.9, b12: 1.8, potassium: 99 }), { tags: ['seafood', 'no-cook'] }),
  food('shrimp', 'Shrimp, cooked', 'ingredient', '4 oz (113 g)', n(112, 27, 0.2, 0.3, 0, { calcium: 80, magnesium: 40, potassium: 190, b12: 1.3, iron: 0.6, iodine: 20 }), { tags: ['seafood'] }),
  food('chicken', 'Grilled chicken breast', 'ingredient', '4 oz (113 g)', n(187, 35, 0, 4, 0, { potassium: 290, magnesium: 33, b12: 0.4, iron: 1 })),
  food('tofu', 'Extra-firm tofu', 'ingredient', '3 oz (85 g)', n(80, 9, 2, 4.5, 1, { calcium: 150, iron: 1.5, magnesium: 30, potassium: 120 }), { tags: ['soy', 'no-cook'] }),
  food('edamame', 'Edamame, shelled', 'ingredient', '½ cup (75 g)', n(94, 9.2, 6.9, 4, 4, { folate: 241, iron: 1.7, magnesium: 48, potassium: 338, calcium: 47, vitaminC: 4.5 }), { servings: { veg: 1 }, tags: ['soy', 'legume'] }),
  food('lentils', 'Lentils, cooked', 'ingredient', '½ cup (99 g)', n(115, 9, 20, 0.4, 7.8, { iron: 3.3, folate: 179, potassium: 365, magnesium: 36, calcium: 19 }), { tags: ['legume'] }),
  food('black-beans', 'Black beans', 'ingredient', '½ cup (86 g)', n(114, 7.6, 20.4, 0.5, 7.5, { folate: 128, iron: 1.8, magnesium: 60, potassium: 305, calcium: 23 }), { tags: ['legume', 'no-cook'] }),

  // ── Grains ──────────────────────────────────────────────
  food('sourdough', 'Sourdough toast', 'ingredient', '1 slice (50 g)', n(135, 5.5, 26, 1, 1.2, { iron: 1.6, folate: 80, calcium: 20, magnesium: 12, potassium: 60 })),
  food('brown-rice', 'Brown rice, cooked', 'ingredient', '1 cup (195 g)', n(218, 4.5, 45.8, 1.6, 3.5, { magnesium: 84, potassium: 84, iron: 0.8, folate: 8 })),
  food('white-rice', 'White rice, cooked', 'ingredient', '1 cup (158 g)', n(205, 4.3, 44.5, 0.4, 0.6, { iron: 1.9, folate: 92, magnesium: 19, potassium: 55 })),
  food('pasta', 'Pasta (dry weight)', 'ingredient', '2 oz dry (56 g)', n(200, 7, 42, 1, 2.5, { iron: 1.9, folate: 170, magnesium: 25, potassium: 90 })),
  food('oo-cookies', 'Oats Overnight — Cookies & Cream (packet)', 'ingredient', '1 packet', n(270, 25, 35, 6, 5, { calcium: 150, iron: 2, potassium: 300 }), { brand: 'Oats Overnight', estimate: true, notes: 'Edit to match your packet label.' }),
  food('oo-brownie', 'Oats Overnight — Fudge Brownie (packet)', 'ingredient', '1 packet', n(270, 25, 36, 6.5, 6, { calcium: 150, iron: 2.5, potassium: 350 }), { brand: 'Oats Overnight', estimate: true, notes: 'Edit to match your packet label.' }),

  // ── Vegetables ──────────────────────────────────────────
  food('greens', 'Mixed greens', 'ingredient', '1 cup (30 g)', n(7, 0.6, 1.1, 0.1, 0.7, { calcium: 20, iron: 0.4, potassium: 110, folate: 45, vitaminC: 5 }), { servings: { veg: 1 } }),
  food('cucumber', 'Cucumber', 'ingredient', '½ cup sliced (52 g)', n(8, 0.3, 1.9, 0.1, 0.3, { potassium: 76, vitaminC: 1.5 }), { servings: { veg: 1 } }),
  food('grape-tomatoes', 'Grape tomatoes', 'ingredient', '1 cup (150 g)', n(27, 1.3, 5.8, 0.3, 1.8, { potassium: 355, vitaminC: 20.5, folate: 22, magnesium: 16, calcium: 15 }), { servings: { veg: 2 } }),
  food('tomato-slices', 'Tomato slices', 'ingredient', '3 slices (60 g)', n(11, 0.5, 2.3, 0.1, 0.7, { potassium: 140, vitaminC: 8, folate: 9 }), { servings: { veg: 0.5 } }),
  food('lettuce', 'Shredded lettuce', 'ingredient', '1 cup (36 g)', n(5, 0.3, 1, 0, 0.5, { potassium: 50, folate: 10 }), { servings: { veg: 0.5 } }),
  food('grilled-onions', 'Grilled onions', 'ingredient', '¼ cup (40 g)', n(35, 0.5, 5, 1.5, 0.8, { potassium: 60, vitaminC: 2 }), { servings: { veg: 0.5 } }),
  food('serrano', 'Serrano pepper', 'ingredient', '1 pepper (6 g)', n(2, 0.1, 0.4, 0, 0.2, { vitaminC: 2.7 })),

  // ── Condiments, oils, seasonings (never silently ignored) ─
  food('chipotle-mayo', 'Chipotle mayo', 'condiment', '1 tbsp (15 g)', n(90, 0, 1, 10, 0), { quick: 'extras' }),
  food('spicy-mayo', 'Spicy mayo', 'condiment', '1 tbsp (15 g)', n(90, 0, 1, 10, 0), { quick: 'extras' }),
  food('olive-oil', 'Olive oil', 'condiment', '1 tsp (4.5 g)', n(40, 0, 0, 4.5, 0), { quick: 'extras' }),
  food('avocado-spray', 'Avocado-oil spray', 'condiment', 'light spray (~1 g)', n(9, 0, 0, 1, 0), { quick: 'extras' }),
  food('maple-syrup', 'Maple syrup', 'condiment', '1 tbsp (20 g)', n(52, 0, 13.4, 0, 0, { calcium: 20, potassium: 42 }), { quick: 'extras' }),
  food('butter', 'Butter', 'condiment', '1 tsp (5 g)', n(34, 0, 0, 3.8, 0), { quick: 'extras' }),
  food('almonds', 'Almonds', 'condiment', '1 oz (28 g)', n(164, 6, 6.1, 14.2, 3.5, { calcium: 76, iron: 1, magnesium: 76, potassium: 208 }), { quick: 'extras' }),
  food('peanut-butter', 'Peanut butter', 'condiment', '1 tbsp (16 g)', n(94, 3.6, 3.5, 8, 0.9, { magnesium: 27, potassium: 107 }), { quick: 'extras' }),
  food('chia', 'Chia seeds', 'condiment', '1 tbsp (12 g)', n(58, 2, 5, 3.7, 4.1, { calcium: 76, magnesium: 40, iron: 0.9 })),
  food('spicy-soy', 'Spicy soy sauce', 'condiment', '1 tbsp', n(10, 1, 1, 0, 0)),
  food('sriracha', 'Sriracha / hot sauce', 'condiment', '1 tsp', n(5, 0, 1, 0, 0)),
  food('furikake', 'Furikake', 'condiment', '1 tsp (3 g)', n(12, 0.4, 1, 0.6, 0.2, { iodine: 20 }), { estimate: true }),
  food('relish', "Cherry-pepper relish", 'condiment', '1 tbsp', n(10, 0, 2, 0, 0), { estimate: true }),
  food('oregano', 'Oregano', 'condiment', '1 pinch', n(1, 0, 0.2, 0, 0.1)),
  food('italian-seasoning', 'Italian seasoning', 'condiment', '1 tsp', n(3, 0.1, 0.6, 0.1, 0.4, { calcium: 20 })),
  food('ghost-salt', 'Ghost pepper salt', 'condiment', '1 pinch', n(0, 0, 0, 0, 0)),
  food('monk-fruit', 'Monk fruit sweetener', 'ingredient', '1 tbsp', n(0, 0, 0, 0, 0), { notes: 'Erythritol blend — carbs not counted.' }),
  food('vanilla', 'Vanilla extract', 'ingredient', '1 tsp', n(12, 0, 0.5, 0, 0)),
  food('cake-batter', 'Cake-batter extract', 'ingredient', '1 tsp', n(10, 0, 0.5, 0, 0), { estimate: true }),
  food('cinnamon', 'Cinnamon', 'ingredient', '1 tsp (2.6 g)', n(6, 0.1, 2.1, 0, 1.4, { calcium: 26, iron: 0.2 })),
  food('xanthan', 'Xanthan gum', 'ingredient', '½ tsp (1.5 g)', n(5, 0, 1.2, 0, 1.2)),

  // ── Pasta sauces ────────────────────────────────────────
  food('bolognese-sauce', 'Bolognese sauce', 'ingredient', '½ cup (125 g)', n(160, 11, 7, 10, 1.5, { iron: 1.5, potassium: 350, b12: 1, vitaminC: 6, calcium: 30 }), { estimate: true, servings: { veg: 0.5 } }),
  food('amatriciana-sauce', 'Amatriciana sauce', 'ingredient', '½ cup (125 g)', n(180, 6, 8, 14, 1.5, { potassium: 330, vitaminC: 8 }), { estimate: true, servings: { veg: 0.5 } }),
  food('marinara', 'Tomato / marinara sauce', 'ingredient', '½ cup (125 g)', n(70, 2, 10, 2.5, 2.5, { potassium: 400, vitaminC: 10, iron: 1, calcium: 40 }), { servings: { veg: 1 } }),

  // ── Saved recipes ───────────────────────────────────────
  combo('recipe', 'pancakes', 'Cottage cheese protein pancakes', 'breakfast', '1 batch', [
    c('banana', 0.5),
    c('cottage-cheese', 1),
    c('egg-whites', 1),
    c('monk-fruit', 1.5),
    c('vanilla', 1),
    c('cinnamon', 3),
  ], { quick: 'breakfast', favorite: true, addons: ['banana', 'mango', 'pineapple', 'maple-syrup', 'chobani-plain', 'peanut-butter', 'avocado-spray', 'butter'] }),
  combo('recipe', 'creami', 'Ninja Creami protein pint', 'snack', '1 pint', [
    c('core-power', 1),
    c('iso100', 1),
    c('vanilla', 1),
    c('cake-batter', 1),
    c('xanthan', 1),
  ], { quick: 'snacks', favorite: true, defaultQty: 1, addons: ['banana', 'mango', 'maple-syrup', 'peanut-butter'] }),
  combo('recipe', 'baked-tomatoes', 'Baked grape tomatoes', 'side', '1 cup tomatoes', [
    c('grape-tomatoes', 1),
    c('avocado-spray', 1),
    c('ghost-salt', 1),
    c('italian-seasoning', 1),
  ], { quick: 'sides' }),

  // ── Saved meals (adjustable when logging) ───────────────
  combo('meal', 'oo-cookies-soy', 'Oats Overnight — Cookies & Cream + soy milk', 'breakfast', '1 jar', [c('oo-cookies', 1), c('soy-milk', 0.625)], { quick: 'breakfast', favorite: true, addons: ['banana', 'mango', 'pineapple', 'chia', 'peanut-butter'], notes: 'About 5 oz Silk unsweetened soy milk.' }),
  combo('meal', 'oo-brownie-soy', 'Oats Overnight — Fudge Brownie + soy milk', 'breakfast', '1 jar', [c('oo-brownie', 1), c('soy-milk', 0.625)], { quick: 'breakfast', favorite: true, addons: ['banana', 'mango', 'pineapple', 'chia', 'peanut-butter'], notes: 'About 5 oz Silk unsweetened soy milk.' }),
  combo('meal', 'eggs-sourdough', 'Eggs + sourdough', 'breakfast', '1 plate', [
    c('egg', 2),
    c('sourdough', 1),
    c('butter', 1),
    c('olive-oil', 0),
    c('chipotle-mayo', 0),
    c('sriracha', 0),
    c('banana', 0),
    c('mango', 0),
  ], {
    quick: 'breakfast',
    modifiers: [
      { id: '3eggs', label: '3 eggs', set: { egg: 3 } },
      { id: '2slices', label: '2 slices', set: { sourdough: 2 } },
      { id: 'oil', label: 'Olive oil instead of butter', set: { butter: 0, 'olive-oil': 1 } },
      { id: 'fruit', label: '+ banana', set: { banana: 1 } },
    ],
  }),
  combo('meal', 'yogurt-watermelon', 'Yogurt + watermelon', 'snack', '1 bowl', [c('chobani-plain', 1), c('watermelon', 1)], { quick: 'snacks' }),
  combo('meal', 'yogurt-pineapple', 'Yogurt + pineapple', 'snack', '1 bowl', [c('chobani-plain', 1), c('pineapple', 1)], { quick: 'snacks' }),
  combo('meal', 'yogurt-mango', 'Yogurt + mango', 'snack', '1 bowl', [c('chobani-plain', 1), c('mango', 1)], { quick: 'snacks' }),
  combo('meal', 'yogurt-grapes', 'Yogurt + cotton candy grapes', 'snack', '1 bowl', [c('chobani-plain', 1), c('grapes', 1)], { quick: 'snacks' }),
  combo('meal', 'poke', 'Usual poke bowl', 'meal', '1 bowl', [
    c('brown-rice', 1),
    c('white-rice', 0),
    c('greens', 1),
    c('edamame', 0.5),
    c('serrano', 1),
    c('spicy-soy', 1),
    c('spicy-mayo', 1.5),
    c('furikake', 1),
    c('salmon', 1),
  ], {
    quick: 'meals',
    favorite: true,
    estimate: true,
    notes: 'Restaurant portions vary — adjust rice, salmon and sauce.',
    modifiers: [
      { id: 'light', label: 'Light rice', set: { 'brown-rice': 0.5 } },
      { id: 'white', label: 'Regular (white) rice', set: { 'brown-rice': 0, 'white-rice': 1 } },
      { id: 'lightwhite', label: 'Light white rice', set: { 'brown-rice': 0, 'white-rice': 0.5 } },
      { id: 'xsalmon', label: 'Extra salmon', set: { salmon: 2 } },
      { id: 'xedamame', label: 'Extra edamame', set: { edamame: 1 } },
      { id: 'xmayo', label: 'Extra spicy mayo', set: { 'spicy-mayo': 3 } },
      { id: 'nomayo', label: 'No mayo', set: { 'spicy-mayo': 0 } },
    ],
  }),
  combo('meal', 'jersey-mikes', "Usual Jersey Mike's bowl", 'meal', '1 bowl', [
    c('chicken', 1.25),
    c('lettuce', 1.5),
    c('tomato-slices', 1),
    c('relish', 1),
    c('grilled-onions', 1),
    c('oregano', 1),
    c('chipotle-mayo', 2),
  ], {
    quick: 'meals',
    estimate: true,
    notes: 'Chicken, no cheese. Sauce is usually the biggest variable.',
    modifiers: [
      { id: 'lightsauce', label: 'Light sauce', set: { 'chipotle-mayo': 1 } },
      { id: 'xsauce', label: 'Extra sauce', set: { 'chipotle-mayo': 3 } },
      { id: 'nosauce', label: 'No sauce', set: { 'chipotle-mayo': 0 } },
    ],
  }),
  combo('meal', 'pasta-bolognese', 'Bolognese', 'pasta', '1 plate', [c('pasta', 1.5), c('bolognese-sauce', 1.5), c('parmesan', 1)], { tags: ['pasta'], estimate: true, modifiers: [{ id: 'big', label: 'Bigger pasta portion', set: { pasta: 2 } }, { id: 'small', label: 'Smaller pasta portion', set: { pasta: 1 } }] }),
  combo('meal', 'pasta-amatriciana', 'Amatriciana', 'pasta', '1 plate', [c('pasta', 1.5), c('amatriciana-sauce', 1), c('parmesan', 1)], { tags: ['pasta'], estimate: true, modifiers: [{ id: 'big', label: 'Bigger pasta portion', set: { pasta: 2 } }, { id: 'small', label: 'Smaller pasta portion', set: { pasta: 1 } }] }),
  combo('meal', 'pasta-tomato', 'Tomato pasta', 'pasta', '1 plate', [c('pasta', 1.5), c('marinara', 1), c('olive-oil', 1), c('parmesan', 1), c('shrimp', 0), c('tuna', 0)], { tags: ['pasta'], modifiers: [{ id: 'shrimp', label: '+ shrimp', set: { shrimp: 1 } }, { id: 'tuna', label: '+ tuna', set: { tuna: 1 } }] }),
  combo('meal', 'pasta-seafood', 'Seafood pasta', 'pasta', '1 plate', [c('pasta', 1.5), c('shrimp', 1), c('marinara', 1), c('olive-oil', 2)], { tags: ['pasta', 'seafood'], estimate: true }),

  // ── Optional seafood meal ideas (templates, not forced) ─
  combo('meal', 'tuna-crispy-rice', 'Tuna crispy-rice bowl', 'meal', '1 bowl', [c('white-rice', 1), c('tuna', 1), c('cucumber', 1), c('edamame', 0.5), c('spicy-soy', 1), c('spicy-mayo', 1), c('furikake', 1), c('serrano', 1)], { tags: ['ricebowl', 'seafood'] }),
  combo('meal', 'salmon-rice-bowl', 'Salmon rice bowl', 'meal', '1 bowl', [c('canned-salmon', 1), c('white-rice', 1), c('greens', 1), c('cucumber', 1), c('edamame', 0.5), c('sriracha', 1), c('furikake', 1)], { tags: ['ricebowl', 'seafood'], modifiers: [{ id: 'brown', label: 'Brown rice', set: { 'white-rice': 0, 'brown-rice': 1 } }] }),
  combo('meal', 'edamame-egg-bowl', 'Edamame + egg rice bowl', 'meal', '1 bowl', [c('white-rice', 1), c('egg', 2), c('edamame', 1), c('cucumber', 1), c('sriracha', 1)], { tags: ['ricebowl'] }),
  combo('meal', 'tuna-sourdough', 'Tuna + sourdough', 'meal', '1 plate', [c('tuna', 1), c('sourdough', 2), c('chobani-plain', 0.25), c('tomato-slices', 1), c('greens', 0.5), c('chipotle-mayo', 0)], { tags: ['seafood'] }),
  combo('meal', 'smoked-salmon-toast', 'Smoked salmon toast', 'breakfast', '2 toasts', [c('sourdough', 2), c('smoked-salmon', 1), c('cottage-cheese', 0.5), c('tomato-slices', 1), c('cucumber', 0.5)], { tags: ['seafood'] }),
]
