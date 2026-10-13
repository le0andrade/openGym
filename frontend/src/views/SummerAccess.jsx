import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { clearSummerContentCache } from '../lib/summer-shredded.js'
import { Button } from '../components/ui.jsx'

export default function SummerAccess({ children }) {
  const user = useStore(s => s.user)
  const setUser = useStore(s => s.setUser)
  const [access, setAccess] = useState(null), [email, setEmail] = useState(''), [code, setCode] = useState('')
  const [challenge, setChallenge] = useState(null), [message, setMessage] = useState(null), [busy, setBusy] = useState(false)
  const refresh = () => api('/api/summer-shredded/access').then(setAccess).catch(()=>setAccess({ allowed: false, reason: 'verification-unavailable' }))
  useEffect(() => {
    let live = true
    setAccess(null)
    const load = () => api('/api/summer-shredded/access').then(a=>{if(live)setAccess(a)}).catch(()=>{if(live)setAccess({allowed:false,reason:'verification-unavailable'})})
    load(); const timer=setInterval(load,15000);window.addEventListener('focus',load)
    return ()=>{live=false;clearInterval(timer);window.removeEventListener('focus',load)}
  }, [user?.id])
  useEffect(() => {
    if (access && !access.allowed) {
      clearSummerContentCache()
      const ui = useUI.getState()
      ui.closeAll(); ui.stopRest(); ui.stopWork()
    }
  }, [access?.allowed])
  const request = async () => {
    setBusy(true);setMessage(null)
    try { const result=await api('/api/summer-shredded/access/request',{method:'POST',body:JSON.stringify({email})});setChallenge(result.challengeId);setMessage('Se houver uma compra elegível neste e-mail, você receberá um código de 8 dígitos.') }
    catch(e){setMessage(e.status===429?'Aguarde um minuto antes de pedir outro código.':'Não foi possível enviar o código. Tente novamente em instantes.')}
    finally{setBusy(false)}
  }
  const verify=async()=>{
    setBusy(true);setMessage(null)
    try { const a=await api('/api/summer-shredded/access/verify',{method:'POST',body:JSON.stringify({challengeId:challenge,code})});clearSummerContentCache();setAccess(a) }
    catch{setMessage('Código inválido ou expirado. Confira os 8 dígitos ou solicite outro código.')}
    finally{setBusy(false)}
  }
  if(!access)return <div className="narrow"><div className="card" role="status">Verificando seu acesso…</div></div>
  if(access.allowed)return children
  return <div className="narrow"><div className="hdr"><div><h1>Summer Shredded</h1><div className="sub">Acesso ao seu programa</div></div></div><section className="card">
    <h2>{access.reason==='purchase-revoked'?'Seu acesso está indisponível':'Vincule sua compra'}</h2>
    {access.reason==='integration-not-configured'?<p>A liberação de acesso ainda está sendo configurada pelo produtor.</p>:access.reason==='verification-unavailable'?<p>Não foi possível conferir seu acesso agora. Tente novamente quando a conexão estiver disponível.</p>:access.reason==='purchase-revoked'?<p>A Kiwify não informa uma compra ativa para esta conta. Confira o status com o produtor.</p>:<>
      <p className="small muted">Use o mesmo e-mail informado na compra pela Kiwify.</p>
      <label>E-mail da compra<input className="input" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <Button variant="primary" disabled={busy || !email.includes('@') || !access.emailConfigured} onClick={request}>{challenge?'Enviar novo código':'Receber código por e-mail'}</Button>
      {!access.emailConfigured&&<p className="small">O envio de códigos ainda está sendo configurado pelo produtor.</p>}
      {challenge&&<><label>Código de 8 dígitos<input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><Button disabled={busy||code.length!==8} onClick={verify}>Confirmar acesso</Button></>}
    </>}
    {message&&<p role="status">{message}</p>}
    <Button variant="ghost" onClick={refresh}>Verificar novamente</Button>
    <Button variant="ghost" onClick={async()=>{await api('/api/logout',{method:'POST'}).catch(()=>{});clearSummerContentCache();setUser(null)}}>Sair da conta</Button>
  </section></div>
}
