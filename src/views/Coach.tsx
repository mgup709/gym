import { useEffect, useRef, useState } from 'react'
import { askClaude, buildContext, describeCoachError, offlineAnswer } from '../engine/coach'
import type { ViewProps } from '../ui/common'

const SUGGESTED = [
  'Will this make my shoulders bigger?',
  'Is this exercise going to grow my quads more than my glutes?',
  'My knee hurts during Bulgarians. What can I do instead?',
  'What should I eat before glute day?',
  'Are my thighs growing enough?',
  'Is my waist actually getting smaller relative to my hips?',
  'Should I add more glute sets?',
  'Can I remove shoulder exercises?',
  'Which exercise will help create more width around my hips?',
  'How should my cycle affect this week?',
]

export function Coach({ state, update, today, go }: ViewProps) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const online = !!state.profile.apiKey

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [state.coach.length, streaming])

  const ask = async (question: string) => {
    if (!question.trim() || busy) return
    setQ('')
    setErr(null)
    const withQ = { ...state, coach: [...state.coach, { role: 'user' as const, content: question }] }
    update((s) => ({ ...s, coach: [...s.coach, { role: 'user', content: question }] }))
    let answer: string
    if (online) {
      setBusy(true)
      try {
        // History excludes the new question: askClaude appends it.
        answer = await askClaude(state, today, question, setStreaming)
      } catch (e) {
        const msg = await describeCoachError(e)
        setErr(`${msg} Answering with the offline coach instead.`)
        answer = offlineAnswer(withQ, today, question)
      } finally {
        setBusy(false)
        setStreaming('')
      }
    } else {
      answer = offlineAnswer(withQ, today, question)
    }
    update((s) => ({ ...s, coach: [...s.coach, { role: 'assistant', content: answer }] }))
  }

  return (
    <>
      <div className="row between">
        <h2>Coach</h2>
        <span className={`pill ${online ? 'good' : ''}`}>{online ? 'Claude' : 'Offline rules'}</span>
      </div>
      {!online && (
        <div className="note small">
          The offline coach answers common questions from your data. For full answers, add an Anthropic API key in <button className="btn ghost sm" onClick={() => go('settings')}>Settings</button>.
        </div>
      )}
      <div className="chat" style={{ margin: '12px 0' }}>
        {state.coach.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.content}</div>)}
        {busy && <div className="msg assistant">{streaming || 'Thinking…'}</div>}
        <div ref={endRef} />
      </div>
      {err && <div className="note warn small">{err}</div>}
      <div className="chips" style={{ marginBottom: 8 }}>
        {SUGGESTED.map((s) => <button key={s} className="chip" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q) }} className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="text" placeholder="Ask about your plan…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" disabled={busy || !q.trim()}>Ask</button>
      </form>
      <div className="row between" style={{ marginTop: 10 }}>
        <details>
          <summary>What the coach knows</summary>
          <pre className="tiny" style={{ whiteSpace: 'pre-wrap', background: 'var(--surface-2)', padding: 10, borderRadius: 10 }}>{buildContext(state, today)}</pre>
        </details>
        {state.coach.length > 0 && <button className="btn ghost sm" onClick={() => update((s) => ({ ...s, coach: [] }))}>Clear chat</button>}
      </div>
    </>
  )
}
