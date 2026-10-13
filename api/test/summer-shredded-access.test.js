import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { accessConfig, createAccessStore, accessRoutes } from '../summer-shredded/access.js'
import { createContentStore, seedContent, validateProductContent, summerShreddedRoutes } from '../summer-shredded/content-store.js'
const env={KIWIFY_WEBHOOK_SECRET:'test-only-receiver-secret-123456789',KIWIFY_PRODUCT_MAP:JSON.stringify({both:'choice',male:'masculino',female:'feminino'}),RESEND_API_KEY:'test',SUMMER_EMAIL_FROM:'test@example.test'}
const order=(id='order1',product='both',email='buyer@example.test')=>({order_id:id,order_status:'paid',webhook_event_type:'order_approved',Product:{product_id:product},Customer:{email},refunded_at:null})
const dirFor=()=>fs.mkdtempSync(path.join(os.tmpdir(),'summer-access-'))
function withStore(fn){const dir=dirFor();let at=1000000;const store=createAccessStore(dir,accessConfig(env),{clock:()=>at});try{return fn(store,()=>{at+=60001},dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
test('production stays closed without configuration and cannot enable development bypass',()=>{
 const config=accessConfig({NODE_ENV:'production',SUMMER_ACCESS_MODE:'development'});assert.equal(config.development,false)
 withStore((store)=>{assert.equal(store.status('student').allowed,false);assert.equal(store.status('producer',true).allowed,true)})
 const dir=dirFor();try{assert.equal(createAccessStore(dir,config).status('student').reason,'integration-not-configured')}finally{fs.rmSync(dir,{recursive:true,force:true})}
 assert.throws(()=>accessConfig({KIWIFY_PRODUCT_MAP:'invalid'}),/invalid/)
})
test('purchase requires email proof before granting a program; verified buyer is bound to one account',()=>withStore((s,advance)=>{
 s.event(order('one','female'));assert.equal(s.status('student').allowed,false)
 const c=s.challenge('student',' BUYER@example.test ');assert.equal(c.email,'buyer@example.test');assert.ok(c.code)
 const access=s.verify('student',c.id,c.code);assert.deepEqual(access.programs,['feminino']);assert.equal(access.allowed,true)
 assert.throws(()=>s.verify('student',c.id,c.code),/expired/)
 advance();assert.equal(s.challenge('another','buyer@example.test').code,undefined)
 assert.equal(s.status('another').allowed,false)
}))
test('refund is terminal for its order and late approval cannot reopen it',()=>withStore(s=>{
 const event=order();s.event(event);const c=s.challenge('student','buyer@example.test');s.verify('student',c.id,c.code)
 s.event({...event,order_status:'refunded',webhook_event_type:'order_refunded',refunded_at:'2026-10-13T10:00Z'})
 assert.equal(s.status('student').allowed,false);assert.equal(s.event(event).ignored,'terminal-order');assert.equal(s.status('student').reason,'purchase-revoked')
 s.event(order('new-purchase'));assert.equal(s.status('student').allowed,true)
}))
test('chargeback, expiration and explicit subscription revocation block access',()=>withStore(s=>{
 const event={...order(),subscription_id:'sub1',Subscription:{id:'sub1',customer_access:{has_access:true,access_until:'2030-01-01T00:00:00Z'}}}
 s.event(event);const c=s.challenge('student','buyer@example.test');s.verify('student',c.id,c.code);assert.equal(s.status('student').allowed,true)
 s.event({...event,Subscription:{...event.Subscription,customer_access:{...event.Subscription.customer_access,has_access:false}}});assert.equal(s.status('student').allowed,false)
 assert.ok(s.read().revokedSubscriptions.sub1)
 s.event(event);assert.equal(s.status('student').allowed,false)
 s.event({...order('new'),order_status:'chargeback',webhook_event_type:'order_chargeback'});assert.equal(s.status('student').allowed,false)
}))
test('duplicate webhooks, pending payments and unknown products do not add access',()=>withStore(s=>{
 assert.equal(s.event({...order(),order_status:'waiting_payment',webhook_event_type:'pix_generated'}).ignored,'non-access-event')
 assert.equal(s.event(order('unknown','constructor')).ignored,'unmapped-product')
 assert.deepEqual(s.event(order()),{ok:true});assert.equal(s.event(order()).duplicate,true)
 assert.equal(Object.keys(s.read().orders).length,1)
 assert.throws(()=>s.event(order('__proto__')),/invalid order/)
 assert.throws(()=>s.event(order('order1','male')),/identity mismatch/)
}))
test('subscription revocation on a terminal order also blocks its other paid orders',()=>withStore(s=>{
 const old={...order('old'),subscription_id:'sub1'};s.event(old)
 s.event({...old,order_status:'refunded',webhook_event_type:'order_refunded'})
 s.event({...order('renewal'),subscription_id:'sub1'})
 const c=s.challenge('student','buyer@example.test');s.verify('student',c.id,c.code)
 assert.equal(s.status('student').allowed,true)
 s.event({...old,Subscription:{customer_access:{has_access:false}}})
 assert.equal(s.status('student').allowed,false)
}))
test('codes expire, rate limits apply and five failed attempts exhaust a code',()=>withStore((s,advance)=>{
 s.event(order());const c=s.challenge('student','buyer@example.test')
 assert.throws(()=>s.challenge('student','buyer@example.test'),e=>e.status===429)
 for(let i=0;i<5;i++)assert.throws(()=>s.verify('student',c.id,'00000000'),/invalid/)
 assert.throws(()=>s.verify('student',c.id,c.code),/invalid/)
 advance();const next=s.challenge('student','buyer@example.test');for(let i=0;i<11;i++)advance()
 assert.throws(()=>s.verify('student',next.id,next.code),/expired/)
}))
test('access storage contains hashes rather than raw buyer email or one-time codes',()=>withStore((s,a,dir)=>{
 s.event(order());const c=s.challenge('student','buyer@example.test')
 const data=fs.readFileSync(path.join(dir,'summer-shredded-access.json'),'utf8')
 assert.equal(data.includes('buyer@example.test'),false);assert.equal(data.includes(c.code),false)
}))
test('webhook authenticates before reading body, and unauthenticated claim/content requests fail',async()=>{
 const dir=dirFor();try{
 let user=null,body=order(),out,reads=0;const context={dataDir:dir,env,json:(r,status,data)=>{out={status,data}},readBody:async()=>{reads++;return body},readSession:()=>user,isAdmin:u=>u?.admin===true,sendCode:async()=>{}}
 const access=accessRoutes(context),req={url:'/api/webhooks/kiwify?key=wrong'}
 await access.routes['POST /api/webhooks/kiwify'](req,{});assert.equal(out.status,401);assert.equal(reads,0)
 req.url='/api/webhooks/kiwify?key='+env.KIWIFY_WEBHOOK_SECRET;await access.routes['POST /api/webhooks/kiwify'](req,{});assert.equal(out.status,200)
 await access.routes['POST /api/summer-shredded/access/request']({},{});assert.equal(out.status,401)
 const content=summerShreddedRoutes({...context,requireAdmin:()=>null,requireAccess:access.requireAccess})
 user={id:'student'};await content['GET /api/summer-shredded/content']({},{});assert.equal(out.status,403)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('verified product mapping filters content and assigns the purchased program without resetting start date',async()=>{
 const dir=dirFor();try{
 let body=order('purchase','female'),out;const user={id:'student'}
 const context={dataDir:dir,env,json:(r,status,data)=>{out={status,data}},readBody:async()=>body,readSession:()=>user,isAdmin:()=>false}
 const access=accessRoutes(context);access.store.event(body);const c=access.store.challenge(user.id,'buyer@example.test');access.store.verify(user.id,c.id,c.code)
 const content=summerShreddedRoutes({...context,requireAdmin:()=>null,requireAccess:access.requireAccess})
 await content['GET /api/summer-shredded/content']({},{});assert.deepEqual(out.data.programs.map(p=>p.slug),['feminino']);assert.equal(out.data.selection.source,'kiwify');const started=out.data.selection.startedOn
 body={programSlug:'masculino'};await content['POST /api/summer-shredded/enrollment']({},{});assert.equal(out.status,403)
 await content['GET /api/summer-shredded/content']({},{});assert.equal(out.data.selection.startedOn,started)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('draft revision prevents overwrites and validates nutrition before publication',()=>{
 const dir=dirFor();try{
 const store=createContentStore(dir),draft=seedContent().draft
 const first=store.saveDraft(draft,'producer',0);assert.equal(first.draftRevision,1)
 assert.throws(()=>store.saveDraft(draft,'other',0),e=>e.status===409)
 assert.throws(()=>store.publish('other',0),e=>e.status===409)
 const published=store.publish('producer',1);assert.equal(published.published.nutritionProtocol.weeks.length,12)
 const invalid=structuredClone(draft);invalid.nutritionProtocol.weeks[0].offsets=[0];assert.throws(()=>validateProductContent(invalid),/nutrition/)
 invalid.nutritionProtocol=draft.nutritionProtocol;invalid.programs[0].workouts[0].exercises[0].prescription[0]='2x10junk';assert.throws(()=>validateProductContent(invalid),/prescription/)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('one package allows subsequent program switches but revoked access cannot switch',async()=>{
 const dir=dirFor();try{
 let body={programSlug:'feminino'},out;const user={id:'student'}
 const context={dataDir:dir,env,json:(r,status,data)=>{out={status,data}},readBody:async()=>body,readSession:()=>user,isAdmin:()=>false}
 const access=accessRoutes(context),purchase=order();access.store.event(purchase)
 const c=access.store.challenge(user.id,'buyer@example.test');access.store.verify(user.id,c.id,c.code)
 const routes=summerShreddedRoutes({...context,requireAdmin:()=>null,requireAccess:access.requireAccess})
 await routes['POST /api/summer-shredded/enrollment']({},{});assert.equal(out.status,200);const start=out.data.selection.startedOn
 body={programSlug:'masculino',startedOn:'2030-01-01',week:12}
 await routes['POST /api/summer-shredded/enrollment']({},{});assert.equal(out.status,200);assert.equal(out.data.selection.startedOn,start);assert.equal(out.data.selection.programSlug,'masculino')
 access.store.event({...purchase,order_status:'refunded',webhook_event_type:'order_refunded'})
 body={programSlug:'feminino'};await routes['POST /api/summer-shredded/enrollment']({},{});assert.equal(out.status,403)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
