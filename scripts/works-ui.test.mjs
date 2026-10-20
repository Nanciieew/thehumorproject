import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:3000", pretendToBeVisual: true });
for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "MutationObserver", "Node", "Event", "MouseEvent", "getComputedStyle"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const observers = new Set();
globalThis.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; }
  observe() { observers.add(this); }
  disconnect() { observers.delete(this); }
  unobserve() { observers.delete(this); }
};
const { render, fireEvent, waitFor, cleanup, act } = await import("@testing-library/react");
const { WorksGrid } = await import("../app/my-works/works-grid.tsx");
const { CaptionEditor } = await import("../app/my-works/[id]/caption-editor.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); observers.clear(); globalThis.fetch = originalFetch; });
const work = (id) => ({ work_id: id, title: `Work ${id}`, description: "A little story", source: "generated", created_at: "2026-10-07T12:00:00Z", photo_id: null, photo_url: `https://example.com/${id}.webp` });

test("works load without duplicates, default to most votes, and switch to newest on the server", async () => {
  const calls = [];
  globalThis.fetch = async url => {
    const query = new URL(url, "http://localhost").searchParams; calls.push(query);
    if (query.get("sort") === "newest") return Response.json({ items: [work("newest"),work("one")], next_cursor: null });
    if (query.get("cursor")) return Response.json({ items: [work("one"),work("two")], next_cursor: null });
    return Response.json({ items: [work("one")], next_cursor: "more" });
  };
  const ui = render(React.createElement(WorksGrid, { initial: { items: [work("one")], next_cursor: "more" } }));
  await waitFor(() => assert.equal(calls.length, 1));
  assert.equal(ui.getByLabelText("Show").value, "top");
  await act(async () => { for (const observer of [...observers]) observer.callback([{ isIntersecting: true }]); });
  await waitFor(() => assert.equal(ui.getAllByRole("listitem").length, 2));
  assert.equal(ui.getByRole("link", { name: "Edit Work two" }).getAttribute("href"), "/my-works/two");
  fireEvent.change(ui.getByLabelText("Show"), {target:{value:"newest"}});
  await waitFor(() => assert.ok(ui.getByRole("link", {name:"Edit Work newest"})));
  assert.equal(calls.at(-1).get("sort"),"newest");
});

test("vote changes refresh meme counts and overview totals from the same response", async () => {
  let upvotes = '2';const totals=[];
  globalThis.fetch = async () => Response.json({items:[{...work('one'),photo_id:'one',upvotes,downvotes:'3'}],next_cursor:null,received:{upvotes,downvotes:'3'}});
  const ui = render(React.createElement(WorksGrid,{initial:{items:[work('one')],next_cursor:null},onTotalsChange:value=>totals.push(value)}));
  await waitFor(()=>assert.ok(ui.getByLabelText('2 upvotes received')));
  upvotes='9';await act(async()=>window.dispatchEvent(new Event('checked:votes-changed')));
  await waitFor(()=>assert.ok(ui.getByLabelText('9 upvotes received')));
  assert.deepEqual(totals.at(-1),{upvotes:'9',downvotes:'3'});
});

test("deletion confirms first, cancels without writing, blocks duplicates and removes the selected meme", async () => {
  const calls=[];let finish;let removed=false;
  globalThis.fetch = (url, options={}) => {
    if(options.method==='DELETE') {calls.push({url,body:JSON.parse(options.body)});return new Promise(resolve=>{finish=()=>{removed=true;resolve(Response.json({deleted:true}));};});}
    return Promise.resolve(Response.json({items:removed?[]:[work('one')],next_cursor:null,received:{upvotes:'0',downvotes:'0'}}));
  };
  const ui=render(React.createElement(WorksGrid,{initial:{items:[work('one')],next_cursor:null}}));
  await act(async()=>{});
  fireEvent.click(ui.getByRole('button',{name:'Delete Work one'}));
  assert.ok(ui.getByRole('dialog',{name:'Delete this meme?'}));assert.equal(calls.length,0);
  fireEvent.click(ui.getByRole('button',{name:'Cancel'}));assert.equal(calls.length,0);assert.ok(ui.getByRole('link',{name:'Edit Work one'}));
  fireEvent.click(ui.getByRole('button',{name:'Delete Work one'}));
  fireEvent.click(ui.getByRole('button',{name:'Delete permanently'}));
  fireEvent.click(ui.getByRole('button',{name:'Deleting…'}));assert.equal(calls.length,1);
  assert.deepEqual(calls[0],{url:'/api/my-works/one',body:{confirmed:true}});
  await act(async()=>finish());
  await waitFor(()=>assert.equal(ui.queryByRole('link',{name:'Edit Work one'}),null));
  assert.equal(ui.getByRole('link',{name:/Create new meme/}).getAttribute('href'),'/disguise');
});

test("failed deletion keeps the meme and confirmation open for retry", async () => {
  globalThis.fetch = async (_url,options={}) => options.method==='DELETE' ? Response.json({error:'Couldn’t delete this meme.'},{status:503}) : Response.json({items:[work('one')],next_cursor:null});
  const ui=render(React.createElement(WorksGrid,{initial:{items:[work('one')],next_cursor:null}}));await act(async()=>{});
  fireEvent.click(ui.getByRole('button',{name:'Delete Work one'}));fireEvent.click(ui.getByRole('button',{name:'Delete permanently'}));
  await waitFor(()=>assert.ok(ui.getByRole('alert')));
  assert.ok(ui.getByRole('dialog'));assert.equal(ui.getByRole('button',{name:'Delete permanently'}).disabled,false);
});

test("caption failures retain drafts; save blocks duplicate requests and confirms success", async () => {
  let finish; let calls = 0; let payload; let refreshes = 0;
  globalThis.fetch = async (_url, options) => { calls++; payload = JSON.parse(options.body); return new Promise((resolve) => { finish = resolve; }); };
  const ui = render(React.createElement(AppRouterContext.Provider, { value: { refresh: () => refreshes++ } }, React.createElement(CaptionEditor, { work: work("one") })));
  fireEvent.change(ui.getByLabelText(/Work name/), { target: { value: " New name " } });
  fireEvent.change(ui.getByLabelText(/Description/), { target: { value: "My story" } });
  fireEvent.click(ui.getByRole("button", { name: "Save changes" }));
  fireEvent.submit(ui.container.querySelector("form"));
  assert.equal(calls, 1); assert.equal(ui.getByLabelText(/Work name/).disabled, true);
  await act(async () => finish(Response.json({ error: "Couldn’t save your captions. Please try again." }, { status: 503 })));
  assert.ok(ui.getByRole("alert")); assert.equal(ui.getByLabelText(/Work name/).value, " New name ");
  fireEvent.click(ui.getByRole("button", { name: "Save changes" }));
  assert.deepEqual(payload, { title: " New name ", description: "My story" });
  await act(async () => finish(Response.json({ title: "New name", description: "My story" })));
  assert.ok(ui.getByRole("status")); assert.equal(refreshes, 1); assert.equal(ui.getByLabelText(/Work name/).value, "New name");
});
