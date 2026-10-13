import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useSummerContent, useSummerSelection } from '../lib/summer-shredded.js'
import { FOODS, FOOD_BY_ID, energyEstimate, nutritionTarget, nutritionTotals, substituteQuantity, initialNutrition, programDay } from '../lib/summer-nutrition.js'
import { todayISO, uid } from '../lib/format.js'
import { Button, NumberField } from '../components/ui.jsx'
import { nav } from '../lib/nav.js'

const n = (value, precision = 0) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: precision })
export default function SummerDiet() {
  const { S, user, update } = useStore()
  const loaded = useSummerContent(), { program, week } = useSummerSelection(loaded.data, user)
  const stored = S.summerNutrition || initialNutrition(program?.audience || 'male')
  const [profile, setProfile] = useState(() => ({ ...stored.profile }))
  const [newWeight, setNewWeight] = useState(stored.week7Weight || '')
  const [editing, setEditing] = useState(!energyEstimate(stored.profile))
  const [query, setQuery] = useState(''), [foodId, setFoodId] = useState(FOODS[0].id), [quantity, setQuantity] = useState(100)
  const [mealId, setMealId] = useState(stored.meals[0].id)
  const [swap, setSwap] = useState(null), [basis, setBasis] = useState('kcal')
  const [message, setMessage] = useState(null)
  const today = todayISO(), day = programDay(loaded.data?.selection?.startedOn, today)
  const target = nutritionTarget(stored.profile, week, day, stored.week7Weight, loaded.data?.nutritionProtocol)
  const planned = nutritionTotals(stored.meals.flatMap(m => m.items))
  const checked = stored.days[today]?.meals || []
  const consumed = nutritionTotals(stored.meals.filter(m => checked.includes(m.id)).flatMap(m => m.items))
  const change = fn => update(s => { s.summerNutrition ||= initialNutrition(program?.audience || 'male'); fn(s.summerNutrition) })
  const saveProfile = () => {
    if (!energyEstimate(profile)) { setMessage('Preencha idade, altura, peso e atividade com valores válidos.'); return }
    change(d => { d.profile = { ...profile }; d.week7Weight = null }); setEditing(false); setMessage(null)
  }
  const addFood = () => {
    if (!Number.isFinite(Number(quantity)) || quantity <= 0 || quantity > 5000) return setMessage('Informe uma quantidade maior que zero.')
    if (swap) {
      const replacement = substituteQuantity(FOOD_BY_ID[swap.foodId], FOOD_BY_ID[foodId], swap.quantity, basis)
      if (replacement === null || replacement > 5000) return setMessage('Não há dados suficientes para esta substituição.')
      change(d => { const item = d.meals.flatMap(m=>m.items).find(i=>i.id===swap.id); if (item) { item.foodId = foodId; item.quantity = replacement } }); setSwap(null)
    } else change(d => { d.meals.find(m=>m.id===mealId)?.items.push({ id: uid(), foodId, quantity: Number(quantity) }) })
    setMessage(null)
  }
  if (loaded.loading) return <div className="card" role="status">Carregando alimentação…</div>
  if (loaded.error) return <div className="card" role="alert">Não foi possível carregar a alimentação. <Button onClick={()=>location.reload()}>Tentar novamente</Button></div>
  if (!program) return <div className="card">Escolha seu programa para começar. <Button onClick={()=>nav('/home')}>Ver treinos</Button></div>
  return <div className="narrow summer-diet">
    <div className="hdr"><div><h1>Dieta</h1><div className="sub">Semana {week} · Dia {day + 1} · estimativa do protocolo do produtor</div></div></div>
    {message && <p role="alert">{message}</p>}
    {editing ? <section className="card"><h2>Seus dados</h2>
      <div className="summer-fields">
        <label>Sexo para a equação<select className="input" value={profile.sex} onChange={e=>setProfile({...profile,sex:e.target.value})}><option value="male">Masculino</option><option value="female">Feminino</option></select></label>
        {[['age','Idade (anos)'],['height','Altura (cm)'],['weight','Peso inicial (kg)']].map(([key,label])=><label key={key}>{label}<NumberField className="input" value={profile[key]} decimal onChange={v=>setProfile({...profile,[key]:v === '' || v === null ? '' : Number(v)})}/></label>)}
        <label>Atividade diária<select className="input" value={profile.activity} onChange={e=>setProfile({...profile,activity:e.target.value})}><option value="light">Leve</option><option value="moderate">Moderada</option><option value="intense">Intensa</option></select></label>
      </div><Button variant="primary" onClick={saveProfile}>Salvar dados e calcular</Button>
    </section> : <section className="card"><div className="row between"><h2>Meta de hoje</h2><Button size="sm" variant="ghost" onClick={()=>setEditing(true)}>Editar dados</Button></div>
      <div className="big">{target.target === null ? '—' : n(target.target)} <span className="small muted">kcal</span></div>
      {target.tmb && <p className="small muted">TMB {n(target.tmb)} · GET {n(target.get)} · fator {n(target.factor,2)}{target.offset !== undefined ? ` · ajuste ${target.offset > 0 ? '+' : ''}${target.offset} kcal` : ''}</p>}
      {target.reason==='recalculate' && <><p>Atualize seu peso para recalcular o GET a partir da semana 7.</p><label>Peso atualizado (kg)<NumberField className="input" decimal value={newWeight} onChange={setNewWeight}/></label><Button onClick={()=>{if (!energyEstimate(stored.profile,Number(newWeight))) return setMessage('Informe um peso válido.'); change(d=>{d.week7Weight=Number(newWeight)})}}>Recalcular GET</Button></>}
      {target.reason==='producer-day-pending' && <p className="small">A meta deste dia aguarda definição do produtor.</p>}
    </section>}
    <section className="card"><h2>Alimentação de hoje</h2><div className="big">{n(consumed.kcal)} <span className="small muted">kcal registradas</span></div>
      <div className="summer-macros"><span>Proteínas <b>{n(consumed.protein,1)} g</b></span><span>Carboidratos <b>{n(consumed.carbs,1)} g</b></span><span>Gorduras <b>{n(consumed.fat,1)} g</b></span></div>
      <p className="small muted">Planejado: {n(planned.kcal)} kcal · {n(planned.protein,1)} g P · {n(planned.carbs,1)} g C · {n(planned.fat,1)} g G</p>
      {planned.unknown > 0 && <p className="small">Totais parciais: {planned.unknown} alimento(s) sem valores completos na planilha.</p>}
    </section>
    {stored.meals.map(m => <section key={m.id} className="card"><div className="row between"><input className="input" aria-label="Nome da refeição" value={m.name} onChange={e=>change(d=>{d.meals.find(x=>x.id===m.id).name=e.target.value})}/><label className="small"><input type="checkbox" checked={checked.includes(m.id)} onChange={()=>change(d=>{const current=d.days[today]?.meals||[];d.days[today]={meals:current.includes(m.id)?current.filter(x=>x!==m.id):[...current,m.id]}})}/>Consumida</label></div>
      <div className="list">{m.items.map(item=>{const food=FOOD_BY_ID[item.foodId];return <div key={item.id} className="summer-food-row"><div><b>{food?.name || 'Alimento indisponível'}</b><div className="small muted">{food?.nutritionUnknown ? 'Dados nutricionais não informados na fonte' : food?.unit}</div></div>
        <NumberField className="input" aria-label={`Quantidade de ${food?.name}`} decimal value={item.quantity} onChange={v=>change(d=>{d.meals.find(x=>x.id===m.id).items.find(x=>x.id===item.id).quantity=Math.max(0,Math.min(5000,Number(v)||0))})}/>
        <Button size="sm" variant="ghost" onClick={()=>{setSwap(item);setFoodId(item.foodId);setQuery('')}}>Substituir</Button><Button size="sm" variant="ghost" onClick={()=>change(d=>{d.meals.find(x=>x.id===m.id).items=d.meals.find(x=>x.id===m.id).items.filter(x=>x.id!==item.id)})}>Remover</Button>
      </div>})}</div>
      {!m.items.length && <p className="small muted">Adicione alimentos abaixo.</p>}<p className="small muted">{n(nutritionTotals(m.items).kcal)} kcal</p>
    </section>)}
    <section className="card"><h2>{swap ? `Substituir ${FOOD_BY_ID[swap.foodId]?.name}` : 'Adicionar alimento'}</h2>
      <label>Buscar na tabela<input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome do alimento"/></label>
      <label>Alimento<select className="input" value={foodId} onChange={e=>setFoodId(e.target.value)}>{FOODS.filter(f=>f.id===foodId || f.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())).map(f=><option value={f.id} key={f.id}>{f.name} · {f.unit || 'medida não definida'}</option>)}</select></label>
      {swap ? <><label>Manter a mesma quantidade de<select className="input" value={basis} onChange={e=>setBasis(e.target.value)}><option value="kcal">Calorias</option><option value="protein">Proteínas</option><option value="carbs">Carboidratos</option><option value="fat">Gorduras</option></select></label><p className="small">Quantidade calculada: {substituteQuantity(FOOD_BY_ID[swap.foodId],FOOD_BY_ID[foodId],swap.quantity,basis) ?? 'indisponível'} {FOOD_BY_ID[foodId]?.unit}</p></> : <><label>Quantidade ({FOOD_BY_ID[foodId]?.unit})<NumberField className="input" decimal value={quantity} onChange={setQuantity}/></label><label>Refeição<select className="input" value={mealId} onChange={e=>setMealId(e.target.value)}>{stored.meals.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></>}
      <Button variant="primary" onClick={addFood}>{swap ? 'Confirmar substituição' : 'Adicionar à refeição'}</Button>{swap && <Button variant="ghost" onClick={()=>setSwap(null)}>Cancelar substituição</Button>}
    </section>
    <Button variant="ghost" onClick={()=>change(d=>{d.meals.push({id:uid(),name:'Nova refeição',items:[]})})}>Adicionar refeição</Button>
  </div>
}
