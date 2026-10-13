import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useStore } from '../store/useStore.js'
import { clearSummerContentCache } from '../lib/summer-shredded.js'
import { EXDB, searchExercises } from '../lib/exercises.js'
import { exerciseNameFor } from '../lib/i18n.js'
import { uid } from '../lib/format.js'
const STANDARD_12_WEEK = ['2x10a15','2x8a12','2x5a9','2x3a7','3x3a7','3x3a7','2x8a12','2x8a12','3x3a7','2x5a9','4x3a7','2x5a9']
import { Button } from '../components/ui.jsx'
import { nav } from '../lib/nav.js'
import { confirmSheet } from '../sheets.jsx'

export default function SummerAdmin() {
  const user=useStore(s=>s.user)
  const [state,setState]=useState(null),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(null)
  const [slug,setSlug]=useState('masculino'),[workoutId,setWorkoutId]=useState('A'),[expanded,setExpanded]=useState(null)
  const [tab,setTab]=useState('workouts'),[query,setQuery]=useState(''),[customName,setCustomName]=useState('')
  const load=()=>api('/api/admin/summer-shredded/content').then(d=>{setState(d);setDirty(false);setMessage(null)}).catch(()=>setMessage('Não foi possível carregar o conteúdo.'))
  useEffect(()=>{if(user?.admin)load()},[user?.id])
  const change=fn=>{setState(s=>{const next=structuredClone(s);fn(next.draft);return next});setDirty(true);setMessage(null)}
  const program=state?.draft.programs.find(p=>p.slug===slug)||state?.draft.programs[0]
  const workout=program?.workouts.find(w=>w.id===workoutId)||program?.workouts[0]
  const patchExercise=(i,fn)=>change(d=>fn(d.programs.find(p=>p.id===program.id).workouts.find(w=>w.id===workout.id).exercises[i]))
  const save=async()=>{
    setBusy(true);setMessage(null)
    try{const r=await api('/api/admin/summer-shredded/draft',{method:'PUT',body:JSON.stringify({content:state.draft,expectedDraftRevision:state.draftRevision||0})});setState(s=>({...s,draft:r.draft,draftRevision:r.draftRevision}));setDirty(false);setMessage('Rascunho salvo. Os alunos continuam vendo a versão publicada.');return r.draftRevision}
    catch(e){setMessage(e.status===409?'O rascunho foi alterado em outro dispositivo. Recarregue antes de continuar.':`Não foi possível salvar: ${e.message}`);return null}
    finally{setBusy(false)}
  }
  const publish=async()=>{
    const revision=dirty?await save():state.draftRevision||0
    if(revision===null)return
    setBusy(true)
    try{const r=await api('/api/admin/summer-shredded/publish',{method:'POST',body:JSON.stringify({expectedDraftRevision:revision})});setState(s=>({...s,revision:r.revision,published:{...structuredClone(s.draft),revision:r.revision}}));clearSummerContentCache();setMessage('Conteúdo publicado para os alunos.')}
    catch(e){setMessage(e.status===409?'Outro dispositivo alterou o rascunho. Recarregue antes de publicar.':`Não foi possível publicar: ${e.message}`)}
    finally{setBusy(false)}
  }
  const addWorkout=()=>{const id='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(id=>!program.workouts.some(w=>w.id===id))||uid();change(d=>{d.programs.find(p=>p.id===program.id).workouts.push({id,name:'Treino '+id,exercises:[]})});setWorkoutId(id)}
  const addExercise=ex=>{
    if(!workout)return setMessage('Adicione um treino primeiro.')
    change(d=>{const own=d.customExercises.some(e=>e.id===ex.id);d.programs.find(p=>p.id===program.id).workouts.find(w=>w.id===workout.id).exercises.push({exerciseId:ex.id,sourceName:own?ex.n:exerciseNameFor(ex),openGymName:own?null:ex.n,match:own?'custom':'equivalent',prescription:[...STANDARD_12_WEEK],mappingReview:{status:'producer-selected',reason:'Exercício selecionado pelo produtor.'}})})
    setMessage('Exercício adicionado ao rascunho.')
  }
  const createExercise=()=>{
    if(!customName.trim())return
    change(d=>d.customExercises.push({id:'ss-admin-'+uid(),n:customName.trim(),bp:'unknown',eq:'unknown',tg:'unknown',sm:[],st:[],img:null,gif:null,needsReview:true,sourceNote:'Criado pelo produtor.'}));setCustomName('')
  }
  const used=id=>state.draft.programs.some(p=>p.workouts.some(w=>w.exercises.some(e=>e.exerciseId===id))||p.conditioning.abdomen.exerciseId===id||p.conditioning.cardio.options.some(e=>e.exerciseId===id))
  if(!user?.admin)return null
  if(!state)return <div className="card" role="status">{message||'Carregando painel do produtor…'}</div>
  const results=searchExercises([...state.draft.customExercises,...EXDB],query).slice(0,35)
  return <div className="narrow summer-admin">
    <div className="hdr"><div><h1>Painel do produtor</h1><div className="sub">Versão publicada {state.revision} · {dirty?'alterações não salvas':'rascunho salvo'}</div></div></div>
    <div className="summer-admin-actions"><Button disabled={busy||!dirty} onClick={save}>Salvar rascunho</Button><Button variant="primary" disabled={busy} onClick={()=>confirmSheet({title:'Publicar conteúdo?',message:'Os alunos passarão a receber este rascunho. Os registros anteriores serão preservados.',confirmText:'Publicar',onConfirm:publish})}>Publicar mudanças</Button></div>
    {message&&<p role="status">{message}</p>}
    {state.catalogueMigration?.blocked?.length>0&&<p role="alert">Há referências antigas que precisam de revisão antes da publicação: {state.catalogueMigration.blocked.map(x=>x.error).join('; ')}</p>}
    <div className="chips">{[['workouts','Treinos'],['exercises','Exercícios'],['nutrition','Protocolo alimentar']].map(([id,label])=><button key={id} className={'chip'+(tab===id?' on':'')} onClick={()=>setTab(id)}>{label}</button>)}</div>
    <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
    {tab==='workouts'&&<>
      <section className="card"><label>Programa<select className="input" value={program.slug} onChange={e=>{setSlug(e.target.value);setExpanded(null)}}>{state.draft.programs.map(p=><option key={p.id} value={p.slug}>{p.name}</option>)}</select></label>
        <label>Nome do programa<input className="input" value={program.name} onChange={e=>change(d=>{d.programs.find(p=>p.id===program.id).name=e.target.value})}/></label>
        <label>Treino<select className="input" value={workout?.id||''} onChange={e=>{setWorkoutId(e.target.value);setExpanded(null)}}>{program.workouts.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <Button size="sm" onClick={addWorkout}>Novo treino</Button>
        {workout&&<><label>Nome do treino<input className="input" value={workout.name} onChange={e=>change(d=>{d.programs.find(p=>p.id===program.id).workouts.find(w=>w.id===workout.id).name=e.target.value})}/></label>
          <Button size="sm" variant="ghost" onClick={()=>confirmSheet({title:'Remover treino?',message:workout.name+' será removido do rascunho.',confirmText:'Remover',danger:true,onConfirm:()=>change(d=>{const p=d.programs.find(p=>p.id===program.id);p.workouts=p.workouts.filter(w=>w.id!==workout.id)})})}>Remover treino</Button>
        </>}
      </section>
      {workout?.exercises.map((e,i)=><section className="summer-exercise-editor" key={i}>
        <div className="row between"><Button variant="ghost" onClick={()=>setExpanded(expanded===i?null:i)}>{i+1}. {e.sourceName}</Button><div className="row"><Button size="sm" disabled={i===0} onClick={()=>change(d=>{const list=d.programs.find(p=>p.id===program.id).workouts.find(w=>w.id===workout.id).exercises;[list[i-1],list[i]]=[list[i],list[i-1]];setExpanded(null)})}>↑</Button><Button size="sm" disabled={i===workout.exercises.length-1} onClick={()=>change(d=>{const list=d.programs.find(p=>p.id===program.id).workouts.find(w=>w.id===workout.id).exercises;[list[i+1],list[i]]=[list[i],list[i+1]];setExpanded(null)})}>↓</Button></div></div>
        {expanded===i&&<>
          <label>Nome exibido ao aluno<input className="input" value={e.sourceName} onChange={ev=>patchExercise(i,x=>{x.sourceName=ev.target.value})}/></label>
          <label>Referência no catálogo<select className="input" value={e.exerciseId} onChange={ev=>patchExercise(i,x=>{const ex=[...state.draft.customExercises,...EXDB].find(ex=>ex.id===ev.target.value);const own=state.draft.customExercises.some(ex=>ex.id===ev.target.value);x.exerciseId=ex.id;x.openGymName=own?null:ex.n;x.match=own?'custom':'equivalent';x.mappingReview={status:'producer-selected',reason:'Referência escolhida pelo produtor.'}})}>
            <option value={e.exerciseId}>{e.openGymName||e.sourceName} · {e.exerciseId}</option>{results.filter(ex=>ex.id!==e.exerciseId).map(ex=><option key={ex.id} value={ex.id}>{ex.n} · {ex.id}</option>)}
          </select></label>
          <div className="small muted">ID {e.exerciseId} · {e.match==='custom'?'Exercício próprio sem mídia':e.openGymName}</div>
          <div className="summer-week-grid">{e.prescription.map((value,wi)=><label key={wi}>Semana {wi+1}<input className="input" value={value} onChange={ev=>patchExercise(i,x=>{x.prescription[wi]=ev.target.value})}/></label>)}</div>
          <label>Observação<textarea className="input" value={e.note||''} onChange={ev=>patchExercise(i,x=>{x.note=ev.target.value})}/></label>
          <label>Técnica<select className="input" value={e.technique||''} onChange={ev=>patchExercise(i,x=>{x.technique=ev.target.value||null})}><option value="">Convencional</option><option value="rest-pause">Rest-pause (10 segundos)</option><option value="dead-stop">Dead stop</option></select></label>
          {e.mappingReview?.reason&&<p className="small muted">{e.mappingReview.reason}</p>}
          <Button size="sm" onClick={()=>patchExercise(i,x=>{x.mappingReview={...x.mappingReview,status:'approved-by-producer'}})}>Marcar correspondência revisada</Button>
          <Button size="sm" variant="ghost" onClick={()=>change(d=>{d.programs.find(p=>p.id===program.id).workouts.find(w=>w.id===workout.id).exercises.splice(i,1);setExpanded(null)})}>Remover exercício</Button>
        </>}
      </section>)}
      <section className="card"><h2>Orientações do programa</h2><textarea className="input" value={program.notes.join('\n')} onChange={e=>change(d=>{d.programs.find(p=>p.id===program.id).notes=e.target.value.split('\n').filter(Boolean)})}/></section>
      <section className="card"><h2>Abdômen e cardio</h2>{['abdomen','cardio'].map(kind=><div key={kind}><h3>{kind==='abdomen'?'Abdômen':'Cardio'}</h3><div className="summer-week-grid">{program.conditioning[kind].prescription.map((v,i)=><label key={i}>Semana {i+1}<input className="input" value={v} onChange={e=>change(d=>{d.programs.find(p=>p.id===program.id).conditioning[kind].prescription[i]=e.target.value})}/></label>)}</div></div>)}</section>
    </>}
    {(tab==='exercises'||tab==='workouts')&&<section className="card"><h2>Catálogo de exercícios</h2><label>Buscar<input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome em português ou inglês"/></label>
      <div className="list">{results.map(ex=><div className="item" key={ex.id}><div className="grow"><div className="tt">{state.draft.customExercises.some(x=>x.id===ex.id)?ex.n:exerciseNameFor(ex)}</div><div className="ss">{ex.id} · {ex.img?'Catálogo openGym':'Sem mídia'}</div></div><Button size="sm" onClick={()=>addExercise(ex)}>Usar no treino</Button></div>)}</div>
      <label>Novo exercício global<input className="input" value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Nome do exercício"/></label><Button onClick={createExercise} disabled={!customName.trim()}>Criar exercício sem mídia</Button>
      {tab==='exercises'&&state.draft.customExercises.map(ex=><div className="summer-custom-row" key={ex.id}><label>Nome<input className="input" value={ex.n} onChange={e=>change(d=>{d.customExercises.find(x=>x.id===ex.id).n=e.target.value})}/></label><label>Equipamento<input className="input" value={ex.eq} onChange={e=>change(d=>{d.customExercises.find(x=>x.id===ex.id).eq=e.target.value})}/></label><Button size="sm" disabled={used(ex.id)} onClick={()=>change(d=>{d.customExercises=d.customExercises.filter(x=>x.id!==ex.id)})}>{used(ex.id)?'Em uso':'Remover do catálogo'}</Button></div>)}
    </section>}
    {tab==='nutrition'&&<section className="card"><h2>Ajustes sobre o GET, por dia do programa</h2><p className="small muted">Campos vazios aguardam definição. A partir da semana 7, o aluno recalcula o GET com o novo peso.</p>
      {state.draft.nutritionProtocol.weeks.map((row,wi)=><div className="summer-protocol-week" key={wi}><h3>Semana {wi+1}</h3><div className="summer-day-grid">{row.offsets.map((v,di)=><label key={di}>Dia {di+1}<input className="input" type="number" step="1" placeholder="Pendente" value={v??''} onChange={e=>change(d=>{d.nutritionProtocol.weeks[wi].offsets[di]=e.target.value===''?null:Number(e.target.value)})}/></label>)}</div></div>)}
    </section>}
    </fieldset>
    <Button variant="ghost" onClick={()=>{if(!dirty||window.confirm('Descartar suas alterações locais e recarregar o rascunho?'))load()}}>Recarregar rascunho</Button>
    <Button variant="ghost" onClick={()=>nav('/home')}>Prévia do aluno</Button>
  </div>
}
