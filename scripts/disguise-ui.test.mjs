import assert from 'node:assert/strict';
import {afterEach,test} from 'node:test';
import {JSDOM} from 'jsdom';
import React from 'react';
const dom=new JSDOM('<html><body></body></html>',{url:'http://localhost:3000/disguise'});
for(const name of ['window','document','navigator','HTMLElement','HTMLInputElement','MutationObserver','Node','Event','MouseEvent','getComputedStyle','FileReader','sessionStorage'])Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.self=dom.window;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {render,fireEvent,waitFor,cleanup,act}=await import('@testing-library/react');
const {DisguiseStudio}=await import('../app/disguise/studio.tsx');
const {setDisguiseDraft,peekDisguiseDraft,clearDisguiseDraft}=await import('../lib/disguise-draft.ts');
const originalFetch=globalThis.fetch;
afterEach(()=>{cleanup();sessionStorage.clear();globalThis.fetch=originalFetch;const d=peekDisguiseDraft();if(d)clearDisguiseDraft(d.image);});
const draft=()=>setDisguiseDraft('/9j/AA==');
const id='30000000-0000-4000-8000-000000000001';
const preview={id,selected:null,expiresAt:new Date(Date.now()+86400000).toISOString(),variants:Array.from({length:5},(_,i)=>({caption:`Caption ${i+1}`,url:`https://fixture.supabase.co/meme-${i+1}.webp`}))};
function setup({configured=true}={}){return render(React.createElement(DisguiseStudio,{configured,userId:'tester'}));}
const generateButton=ui=>ui.getByRole('button',{name:'Generate five memes ↗'});
const generationConsent=ui=>ui.getByRole('checkbox',{name:/Send this picture/});
async function generate(ui){fireEvent.click(generationConsent(ui));fireEvent.click(generateButton(ui));await waitFor(()=>assert.ok(ui.getByRole('button',{name:/01\s*Caption 1/})));}
test('generation requires explicit consent; five captions switch to matching cached model images without another call',async()=>{
 draft();const requests=[];let resolve;
 globalThis.fetch=(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return new Promise(r=>resolve=r);};
 const ui=setup();assert.equal(peekDisguiseDraft(),null);assert.equal(generateButton(ui).disabled,true);assert.equal(requests.length,0);
 fireEvent.change(ui.getByLabelText(/Give the jokes a direction/),{target:{value:'Finals week'}});
 fireEvent.click(generationConsent(ui));const button=generateButton(ui);fireEvent.click(button);fireEvent.click(button);assert.equal(requests.length,1);
 assert.equal(requests[0].url,'/api/factory');assert.equal(requests[0].body.direction,'Finals week');assert.equal(requests[0].body.image,'data:image/jpeg;base64,/9j/AA==');assert.equal(requests[0].body.approved,true);
 await act(async()=>resolve(Response.json(preview)));
 for(let index=0;index<5;index++){
  const button=ui.getByRole('button',{name:new RegExp(`0${index+1}\\s*Caption ${index+1}`)});fireEvent.click(button);
  assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(ui.getByAltText(`AI-generated meme: Caption ${index+1}`).getAttribute('src'),preview.variants[index].url);
 }
 assert.equal(requests.length,1,'switching captions reuses the cached images');
});
test('publication sends only the selected index after separate approval, locks selection, and reports cleanup',async()=>{
 draft();const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,...JSON.parse(options.body)});return Response.json(url==='/api/factory'?preview:{photoId:id});};
 const ui=setup();await generate(ui);fireEvent.click(ui.getByRole('button',{name:/03\s*Caption 3/}));
 const publish=ui.getByRole('button',{name:'Keep this meme & publish ↗'});assert.equal(publish.disabled,true);assert.equal(calls.length,1);
 fireEvent.click(ui.getByRole('checkbox',{name:/Publish this meme/}));fireEvent.click(publish);fireEvent.click(publish);
 await waitFor(()=>assert.ok(ui.getByRole('link',{name:'See my meme ↗'})));
 assert.deepEqual(calls[1],{url:`/api/factory/${id}`,selected:2,approved:true});assert.equal(calls.length,2);
 assert.ok(ui.getByText('Published to Checked Gallery. Four unused previews deleted.'));
 assert.equal(ui.getByRole('button',{name:/04\s*Caption 4/}).disabled,true);
 assert.equal(ui.getByRole('link',{name:'See my meme ↗'}).getAttribute('href'),`/gallery?sort=newest#photo-${id}`);
});
test('upload validates locally, previews without AI calls, and replacing the picture resets consent',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected request');};
 const ui=setup(),input=ui.container.querySelector('input[type=file]');
 fireEvent.change(input,{target:{files:[new dom.window.File(['fixture'],'meme.png',{type:'image/png'})]}});
 await waitFor(()=>assert.ok(ui.getByAltText('Your uploaded meme picture')));assert.equal(calls,0);
 fireEvent.click(generationConsent(ui));assert.equal(generationConsent(ui).checked,true);
 fireEvent.change(input,{target:{files:[new dom.window.File(['bad'],'meme.webp',{type:'image/webp'})]}});
 await waitFor(()=>assert.ok(ui.getByText('Choose a JPG or PNG meme picture up to 2 MB.')));
 assert.equal(generationConsent(ui).checked,false);assert.equal(calls,0);
});
test('cancelling discards the private batch and ignores a late model response',async()=>{
 draft();let resolve;const calls=[];
 globalThis.fetch=(url,options)=>{calls.push({url,method:options.method});return options.method==='DELETE'?Promise.resolve(Response.json({ok:true})):new Promise(r=>resolve=r);};
 const ui=setup();fireEvent.click(generationConsent(ui));fireEvent.click(generateButton(ui));fireEvent.click(ui.getByRole('button',{name:'Cancel generation'}));
 await act(async()=>resolve(Response.json(preview)));
 assert.equal(ui.queryByAltText('AI-generated meme: Caption 1'),null);assert.equal(calls.filter(call=>call.method==='DELETE').length,1);
});
test('publication failure allows retry of the confirmed caption and never claims cleanup succeeded early',async()=>{
 draft();let publishes=0;globalThis.fetch=async(url)=>url==='/api/factory'?Response.json(preview):++publishes===1?Response.json({error:'Cleanup pending.'},{status:503}):Response.json({photoId:id});
 const ui=setup();await generate(ui);fireEvent.click(ui.getByRole('checkbox',{name:/Publish this meme/}));fireEvent.click(ui.getByRole('button',{name:'Keep this meme & publish ↗'}));
 await waitFor(()=>assert.ok(ui.getByText('Cleanup pending.')));assert.equal(ui.queryByText('Published to Checked Gallery. Four unused previews deleted.'),null);
 assert.equal(ui.getByRole('button',{name:/02\s*Caption 2/}).disabled,true);
 fireEvent.click(ui.getByRole('button',{name:'Retry publishing & cleanup'}));await waitFor(()=>assert.ok(ui.getByRole('link',{name:'See my meme ↗'})));assert.equal(publishes,2);
});
test('cached batch restores after remount without generating again; missing configuration blocks paid requests',async()=>{
 sessionStorage.setItem('checked:factory-batch:tester',id);let calls=0;globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,`/api/factory/${id}`);assert.equal(options.method,undefined);return Response.json(preview);};
 const ui=setup();await waitFor(()=>assert.ok(ui.getByAltText('AI-generated meme: Caption 1')));assert.equal(calls,1);ui.unmount();sessionStorage.clear();
 draft();const missing=setup({configured:false});fireEvent.click(generationConsent(missing));assert.equal(generateButton(missing).disabled,true);
});
