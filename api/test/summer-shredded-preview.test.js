import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { createPreviewAccounts, previewRoutes } from '../summer-shredded/preview.js'

const env = { NODE_ENV: 'development', SUMMER_ACCESS_MODE: 'development', SUMMER_PREVIEW: '1' }
test('direct preview requires explicit flags and cannot be enabled in production', () => {
  for (const config of [{}, { ...env, NODE_ENV: 'production' }, { ...env, SUMMER_PREVIEW: '' }, { ...env, SUMMER_ACCESS_MODE: '' }]) {
    const accounts=createPreviewAccounts(config)
    assert.equal(accounts.enabled,false); assert.equal(accounts.forRole('producer'),null); assert.equal(accounts.lookup('summer-preview-producer'),null)
  }
})
test('preview producer privileges belong only to an in-memory preview identity', () => {
  const accounts=createPreviewAccounts(env), producer=accounts.forRole('producer'), student=accounts.forRole('student')
  assert.equal(accounts.isProducer(producer),true); assert.equal(accounts.isProducer(student),false)
  assert.equal(accounts.isProducer({ ...producer }),false)
  assert.equal(producer.admin,undefined); assert.equal(accounts.lookup(student.id),student); assert.equal(accounts.forRole('admin'),null)
})
test('disabled preview route rejects before reading credentials, and unknown roles are refused', async () => {
  let out, reads=0
  const context={json:(r,status,data)=>{out={status,data}},readBody:async()=>{reads++;return {role:'admin'}},sessionCookie:()=> 'fixture'}
  await previewRoutes({...context,accounts:createPreviewAccounts({})})['POST /api/summer-shredded/preview/login']({}, {})
  assert.equal(out.status,404);assert.equal(reads,0)
  await previewRoutes({...context,accounts:createPreviewAccounts(env)})['POST /api/summer-shredded/preview/login']({}, {})
  assert.equal(out.status,400)
})

async function startServer(dir, config) {
  const reserve=net.createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve))
  const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve))
  const child=spawn(process.execPath,['server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,KIWIFY_PRODUCT_MAP:'{}',KIWIFY_WEBHOOK_SECRET:'',RESEND_API_KEY:'',SUMMER_EMAIL_FROM:'',...config,DATA_DIR:dir,PORT:String(port),ORIGIN:`http://localhost:${port}`},stdio:['ignore','pipe','pipe']})
  try {
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('test server did not start')),10000)
      child.once('error',e=>{clearTimeout(timeout);reject(e)})
      child.once('exit',()=>{clearTimeout(timeout);reject(new Error('test server exited'))})
      child.stdout.on('data',data=>{if(String(data).includes('gym-api on')){clearTimeout(timeout);resolve()}})
    })
  } catch(e) {child.kill();throw e}
  return {base:`http://127.0.0.1:${port}`,stop:()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill()})}
}

test('real sessions switch roles without passkeys and stop working when preview is disabled',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'summer-preview-'));let server
  try {
    server=await startServer(dir,env)
    const request=(url,cookie)=>fetch(server.base+url,{headers:cookie?{Cookie:cookie}:{}})
    assert.equal((await (await request('/api/config')).json()).summer_preview,true)
    const login=async role=>{
      const response=await fetch(server.base+'/api/summer-shredded/preview/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})})
      assert.equal(response.status,200);return {cookie:response.headers.get('set-cookie').split(';')[0],user:(await response.json()).user}
    }
    const student=await login('student');assert.equal(student.user.admin,false)
    assert.equal((await request('/api/me',student.cookie)).status,200)
    assert.equal((await request('/api/admin/summer-shredded/content',student.cookie)).status,403)
    assert.equal((await (await request('/api/summer-shredded/access',student.cookie)).json()).allowed,true)
    const written=await fetch(server.base+'/api/data',{method:'PUT',headers:{Cookie:student.cookie,'Content-Type':'application/json'},body:JSON.stringify({state:{workouts:[],summerNutrition:{week7Weight:72}}})})
    assert.equal(written.status,200)
    const producer=await login('producer');assert.equal(producer.user.admin,true)
    assert.equal((await (await request('/api/data',producer.cookie)).json()).state,null)
    assert.equal((await request('/api/admin/summer-shredded/content',producer.cookie)).status,200)
    const me=(await (await request('/api/me',producer.cookie)).json()).user
    assert.equal(me.previewRole,'producer');assert.equal(me.admin,true)
    const returning=await login('student')
    assert.equal((await (await request('/api/data',returning.cookie)).json()).state.summerNutrition.week7Weight,72)
    assert.equal(fs.existsSync(path.join(dir,'db.json')),false)
    await server.stop();server=await startServer(dir,{...env,NODE_ENV:'production'})
    assert.equal((await (await request('/api/config')).json()).summer_preview,false)
    assert.equal((await request('/api/me',producer.cookie)).status,401)
    assert.equal((await request('/api/me',student.cookie)).status,401)
    assert.equal((await fetch(server.base+'/api/summer-shredded/preview/login',{method:'POST'})).status,404)
  } finally {if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true})}
})
