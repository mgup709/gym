export const fmtIn = (n?: number) => (n === undefined ? '—' : `${Number(n.toFixed(2))} in`)
export const signed = (n: number, unit = ' in') => `${n > 0 ? '+' : ''}${Number(n.toFixed(2))}${unit}`
export const fmtSec = ([a, b]: [number, number]) => (a >= 120 ? `${a / 60}–${b / 60} min` : `${a}–${b} s`)
