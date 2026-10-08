import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:3000" });
for (const name of ["window", "document", "HTMLElement", "HTMLInputElement", "MutationObserver", "Node", "Event", "MouseEvent", "getComputedStyle"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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

test("works scroll without duplicates, show privacy and details links, and recover from errors", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    if (++calls === 1) throw new TypeError("Offline");
    return Response.json({ items: [work("one"), { ...work("two"), photo_id: "two" }], next_cursor: null });
  };
  const ui = render(React.createElement(WorksGrid, { initial: { items: [work("one")], next_cursor: "more" } }));
  await act(async () => { for (const observer of [...observers]) observer.callback([{ isIntersecting: true }]); });
  assert.match(ui.getByRole("alert").textContent, /Couldn’t load more works/);
  fireEvent.click(ui.getByRole("button", { name: "Try again" }));
  await waitFor(() => assert.equal(ui.getAllByRole("listitem").length, 2));
  assert.equal(ui.getByRole("link", { name: "Edit Work two" }).getAttribute("href"), "/my-works/two");
  assert.ok(ui.getByText("PRIVATE")); assert.ok(ui.getByText("PUBLISHED"));
  assert.ok(ui.getByText("All your works, all yours."));
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
