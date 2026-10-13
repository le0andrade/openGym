import { useState } from 'react'
import { api } from '../lib/api.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { clearSummerContentCache } from '../lib/summer-shredded.js'
import { nav } from '../lib/nav.js'
import { Button } from './ui.jsx'

export default function SummerPreview({ compact = false }) {
  const enabled = useStore(s => s.config?.summer_preview)
  const user = useStore(s => s.user)
  const [busy, setBusy] = useState(false), [error, setError] = useState(null)
  if (!enabled) return null
  const enter = async role => {
    setBusy(true); setError(null)
    try {
      // Flush the current profile before replacing the cookie, then clear the
      // local copy so student/producer data cannot be mixed on this device.
      await useStore.getState().signOut()
      useUI.getState().closeAll(); useUI.getState().stopRest(); useUI.getState().stopWork()
      clearSummerContentCache()
      const result = await api('/api/summer-shredded/preview/login', { method: 'POST', body: JSON.stringify({ role }) })
      useStore.getState().setUser(result.user)
      await useStore.getState().pullState()
      nav(role === 'producer' ? '/admin' : '/home')
    } catch { setError('Não foi possível abrir a validação. Confira se o servidor foi iniciado com -Preview.'); useUI.getState().toast('Não foi possível abrir a validação.') }
    finally { setBusy(false) }
  }
  return <section className={compact ? 'narrow summer-preview' : 'card summer-preview'}>
    <div className="small muted">{compact ? `Modo de validação${user?.previewRole ? ' · '+(user.previewRole==='producer'?'Produtor':'Aluno') : ''}` : 'Validação do Summer Shredded'}</div>
    {!compact && <p>Entre direto para testar os treinos, a alimentação e o painel do produtor.</p>}
    <div className="row"><Button disabled={busy} variant={compact ? 'ghost' : 'primary'} onClick={()=>enter('student')}>Ver como aluno</Button><Button disabled={busy} onClick={()=>enter('producer')}>Ver como produtor</Button></div>
    {error && <p role="alert">{error}</p>}
  </section>
}
