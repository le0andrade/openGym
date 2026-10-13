import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import Icon from './Icon.jsx'

export default function TabBar() {
  const nav = useNavigate(), loc = useLocation()
  const user = useStore(s => s.user)
  const active = useStore(s => s.S.active)
  if (!user) return null
  const tabs = [['/home','house','Hoje'],['/workout','dumbbell',active ? 'Continuar' : 'Treinos'],['/stats','chart','Progresso'],['/diet','list','Dieta'],['/settings','gear','Configurações']]
  return <nav id="tabbar">{tabs.map(([to,icon,label]) => <button key={to} className={loc.pathname===to || (to==='/stats' && loc.pathname==='/history') ? 'on' : ''} onClick={()=>nav(to)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
}
