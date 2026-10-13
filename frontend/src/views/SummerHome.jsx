import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useSummerContent, useSummerSelection, enrollSummerProgram, startSummerWorkout, conditioningWorkout } from '../lib/summer-shredded.js'
import { nav } from '../lib/nav.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { todayISO } from '../lib/format.js'

export default function SummerHome() {
  const user = useStore(s => s.user)
  const S = useStore(s => s.S)
  const loaded = useSummerContent()
  const [updated, setUpdated] = useState(null)
  const [choice, setChoice] = useState('masculino')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  useEffect(() => { setUpdated(null) }, [loaded.data])
  const content = updated || loaded.data
  const { program, week, slug, setSlug, setWeek } = useSummerSelection(content, user)
  const [expanded, setExpanded] = useState(null)
  const [cardioOption, setCardioOption] = useState(0)
  const start = workout => startSummerWorkout(program, workout, week)
  const enroll = async () => {
    setBusy(true); setFailure(null)
    try { setUpdated(await enrollSummerProgram(choice)) }
    catch { setFailure('Não foi possível salvar seu programa. Tente novamente.') }
    finally { setBusy(false) }
  }
  const done = S.workouts.filter(w => w.product === 'summer-shredded' && w.programId === program?.id && w.programWeek === week)
  return <div className="narrow">
    <div className="hdr"><div><h1>Summer Shredded</h1><div className="sub">{program ? `${program.name} · Semana ${week} de 12` : 'Seu programa de treinos'}</div></div></div>
    {loaded.loading && <div className="card" role="status">Carregando seus treinos…</div>}
    {loaded.error && <div className="card" role="alert">Não foi possível carregar os treinos. <Button onClick={() => location.reload()}>Tentar novamente</Button></div>}
    {!loaded.loading && !loaded.error && !program && <div className="card">
      <h2>Escolha seu programa</h2><p className="muted">A semana 1 começa hoje. Sua progressão é salva na conta e avança a cada sete dias.</p>
      <label>Programa<select className="input" value={choice} onChange={e => setChoice(e.target.value)}>
        <option value="masculino">Masculino</option><option value="feminino">Feminino</option>
      </select></label>
      {failure && <p role="alert">{failure}</p>}
      <Button variant="primary" disabled={busy} onClick={enroll}>{busy ? 'Salvando…' : 'Começar meu programa'}</Button>
    </div>}
    {program && <>
      {user?.admin && <div className="card"><h2>Prévia do produtor</h2>
        <label>Programa<select className="input" value={slug} onChange={e => setSlug(e.target.value)}><option value="masculino">Masculino</option><option value="feminino">Feminino</option></select></label>
        <label>Semana<select className="input" value={week} onChange={e => setWeek(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i+1}>{i+1}</option>)}</select></label>
      </div>}
      {S.active && <div className="card"><h2>Treino em andamento</h2><p>{S.active.name}</p><Button variant="primary" icon="play" onClick={() => nav('/workout')}>Continuar treino</Button></div>}
      {content.selection?.completed && <div className="card">As 12 semanas do programa passaram. Seus registros continuam em Progresso.</div>}
      <div className="card"><div className="row between"><h2>Treinos da semana</h2><span className="tag acc">{done.filter(log=>program.workouts.some(w=>w.id===log.programWorkoutId)).length} registros</span></div>
        <p className="small muted">Escolha o treino previsto para hoje.</p>
        {program.workouts.map(w => <div key={w.id} style={{ marginBottom: 14 }}>
          <div className="row between"><Button variant="ghost" onClick={() => setExpanded(expanded === w.id ? null : w.id)}>{w.name} · {w.exercises.length} exercícios</Button>
            <Button size="sm" variant="primary" style={{ flex: 'none', width: 'auto', whiteSpace: 'nowrap' }} disabled={!!S.active || !w.exercises.length} onClick={() => start(w)}>Iniciar {w.id}</Button></div>
          {done.some(x=>x.programWorkoutId===w.id && x.d===todayISO()) && <div className="small accent">Registrado hoje</div>}
          {expanded === w.id && <div className="list">{w.exercises.map((e,i)=><div className="item" key={i}><div className="grow"><div className="tt">{e.sourceName}</div><div className="ss">{e.prescription[week-1]}{e.note ? ` · ${e.note}` : ''}</div></div></div>)}</div>}
        </div>)}
      </div>
      <div className="card"><h2>Abdômen</h2><p>{program.conditioning.abdomen.sourceName}</p><p className="accent">{program.conditioning.abdomen.prescription[week-1]}</p>
        <p className="small muted">TSD: todos os dias · DSDN: dia sim, dia não</p><Button disabled={!!S.active} onClick={()=>start(conditioningWorkout(program,'abdomen'))}>Iniciar abdômen</Button>
      </div>
      <div className="card"><h2>Cardio</h2><p>{program.conditioning.cardio.prescription[week-1]} · {program.conditioning.cardio.intensity}</p>
        <label>Modalidade<select className="input" value={cardioOption} onChange={e=>setCardioOption(Number(e.target.value))}>{program.conditioning.cardio.options.map((o,i)=><option key={o.exerciseId} value={i}>{o.label}</option>)}</select></label>
        <Button disabled={!!S.active} onClick={()=>start(conditioningWorkout(program,'cardio',cardioOption))}>Iniciar cardio</Button>
      </div>
      <div className="card"><h2>Orientações do programa</h2>{program.notes.map((n,i)=><p className="small" key={i}>{n}</p>)}</div>
    </>}
    <Button icon="history" onClick={()=>nav('/history')}>Ver histórico</Button>
  </div>
}
