import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost:3000',pretendToBeVisual:true});
for (const name of ['window','document','navigator','HTMLElement','HTMLInputElement','MutationObserver','Node','Event','MouseEvent','getComputedStyle']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.self=dom.window; globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {render,fireEvent,waitFor,cleanup,act}=await import('@testing-library/react');
const {GuestLanding}=await import('../app/guest-landing.tsx');
const originalFetch=globalThis.fetch;
afterEach(()=>{cleanup();globalThis.fetch=originalFetch;Object.defineProperty(document,'hidden',{configurable:true,value:false});});
function camera(getUserMedia){Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});dom.window.HTMLMediaElement.prototype.play=async()=>{};}
test('guest mirror automatically requests video before login and never uploads',async()=>{
 let requests=0,uploads=0,stopped=0;
 camera(async options=>{requests++;assert.equal(options.audio,false);assert.equal(options.video.facingMode,'user');return {getTracks:()=>[{stop:()=>stopped++}],getVideoTracks:()=>[]};});
 globalThis.fetch=async()=>{uploads++;throw new Error('Unexpected upload');};
 const ui=render(React.createElement(GuestLanding));
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Turn off mirror'})));
 assert.equal(uploads,0);assert.equal(requests,1);assert.equal(ui.queryByRole('checkbox'),null);
 fireEvent.click(ui.getByRole('button',{name:'Turn off mirror'}));
 assert.equal(stopped,1);assert.equal(ui.getByLabelText('Local mirrored camera preview').srcObject,null);
});
test('cancelled automatic camera requests stop late-arriving streams',async()=>{
 let resolve,stopped=0;camera(()=>new Promise(r=>resolve=r));
 const ui=render(React.createElement(GuestLanding));
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Cancel camera request'})));
 fireEvent.click(ui.getByRole('button',{name:'Cancel camera request'}));
 await act(async()=>resolve({getTracks:()=>[{stop:()=>stopped++}]}));
 assert.equal(stopped,1);assert.ok(ui.getByText('CAMERA OFF'));
});
test('hiding or leaving the landing page releases the camera and requires a manual restart',async()=>{
 let stopped=0,requests=0;camera(async()=>{requests++;return {getTracks:()=>[{stop:()=>stopped++}],getVideoTracks:()=>[]};});
 const ui=render(React.createElement(GuestLanding));
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Turn off mirror'})));
 Object.defineProperty(document,'hidden',{configurable:true,value:true});
 fireEvent(document,new Event('visibilitychange'));assert.equal(stopped,1);assert.ok(ui.getByText('CAMERA OFF'));
 Object.defineProperty(document,'hidden',{configurable:true,value:false});
 fireEvent(document,new Event('visibilitychange'));assert.equal(requests,1);
 fireEvent.click(ui.getByRole('button',{name:'Try the mirror'}));
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Turn off mirror'})));
 ui.unmount();assert.equal(stopped,2);
});
test('camera denial leaves navigation accessible and allows a user-initiated retry',async()=>{
 let requests=0;camera(async()=>{requests++;if(requests===1)throw new DOMException('denied','NotAllowedError');return {getTracks:()=>[],getVideoTracks:()=>[]};});
 const ui=render(React.createElement(GuestLanding));
 await waitFor(()=>assert.ok(ui.getByText(/Camera blocked/)));
 assert.equal(ui.getByRole('link',{name:/Check my ego/}).getAttribute('href'),'/login');
 assert.equal(ui.getByRole('link',{name:/Explore the gallery/}).getAttribute('href'),'/gallery');
 fireEvent.click(ui.getByRole('button',{name:'Try the mirror'}));
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Turn off mirror'})));
 assert.equal(requests,2);assert.equal(ui.queryByText(/Camera blocked/),null);
});
test('React Strict Mode makes only one automatic permission request',async()=>{
 let requests=0;camera(async()=>{requests++;return {getTracks:()=>[],getVideoTracks:()=>[]};});
 const ui=render(React.createElement(React.StrictMode,null,React.createElement(GuestLanding)));
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Turn off mirror'})));
 assert.equal(requests,1);
});
test('navigation while permission is pending releases the eventual stream',async()=>{
 let resolve,stopped=0;camera(()=>new Promise(r=>resolve=r));
 const ui=render(React.createElement(GuestLanding));
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Cancel camera request'})));
 ui.unmount();await act(async()=>resolve({getTracks:()=>[{stop:()=>stopped++}]}));
 assert.equal(stopped,1);
});
test('pagehide releases the stream before the page enters the back-forward cache',async()=>{
 let stopped=0;camera(async()=>({getTracks:()=>[{stop:()=>stopped++}],getVideoTracks:()=>[]}));
 const ui=render(React.createElement(GuestLanding));
 await waitFor(()=>assert.ok(ui.getByRole('button',{name:'Turn off mirror'})));
 fireEvent(window,new Event('pagehide'));
 assert.equal(stopped,1);assert.ok(ui.getByText('CAMERA OFF'));
});
