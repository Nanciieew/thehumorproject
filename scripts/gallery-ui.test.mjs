import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { registerHooks } from "node:module";
registerHooks({ load(url, context, next) {
  if (url.endsWith(".module.css")) return { format: "module", shortCircuit: true, source: 'export default new Proxy({}, {get: (_, key) => String(key)});' };
  return next(url, context);
} });

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:3000" });
for (const name of ["window", "document", "HTMLElement", "HTMLDialogElement", "HTMLInputElement", "MutationObserver", "Node", "Event", "MouseEvent", "getComputedStyle"]) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
const observers = new Set();
globalThis.IntersectionObserver = class {
  constructor(callback) { this.callback = callback; }
  observe() { observers.add(this); }
  disconnect() { observers.delete(this); }
  unobserve() { observers.delete(this); }
};
const { render, fireEvent, waitFor, cleanup, act } = await import("@testing-library/react");
const { Gallery } = await import("../app/gallery.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); observers.clear(); globalThis.fetch = originalFetch; });
const photo = (id, count = 2) => ({ id, photo_url: `https://example.com/${id}.webp`, contributor_name: "Test Contributor", created_at: "2026-10-07T12:00:00Z", published_at: "2026-10-07T12:00:00Z", source: "upload", upvotes: count, vote: null });
const mount = (userId = "user", items = [photo("one")], cursor = null) => render(React.createElement(Gallery, {userId, initial: {items, next_cursor: cursor}}));
const scroll = async () => { await act(async () => { for (const observer of [...observers]) observer.callback([{isIntersecting: true}]); }); };

test("guests see public counts and an English login prompt without casting a vote", () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error("Unexpected request"); };
  const ui = mount(null);
  fireEvent.click(ui.getByRole("button", {name: "Upvote: 2 upvotes"}));
  assert.ok(ui.getByRole("dialog", {name: "Make your vote count."}));
  assert.equal(ui.getByRole("link", {name: "Log in"}).getAttribute("href"), "/login");
  assert.equal(calls, 0);
  fireEvent.click(ui.getByRole("button", {name: "Keep browsing"}));
  fireEvent.click(ui.getByRole("button", {name: "Downvote"}));
  assert.ok(ui.getByRole("dialog")); assert.equal(calls, 0);
});

test("up/down/removal update counts and colors; duplicate clicks are blocked; failures roll back", async () => {
  let finish; let calls = 0; const desired = [];
  globalThis.fetch = async (_url, options) => { calls++; desired.push(JSON.parse(options.body).value); return new Promise((resolve) => { finish = resolve; }); };
  const ui = mount();
  fireEvent.click(ui.getByRole("button", {name: "Upvote: 2 upvotes"}));
  let up = ui.getByRole("button", {name: "Upvote: 3 upvotes"});
  assert.equal(up.getAttribute("aria-pressed"), "true"); assert.ok(up.className.includes("text-blue-600"));
  assert.ok(ui.getByRole("button", {name: "Downvote"}).className.includes("text-gray-400"));
  fireEvent.click(up); assert.equal(calls, 1);
  await act(async () => finish(Response.json({vote: 1, upvotes: 3})));
  fireEvent.click(ui.getByRole("button", {name: "Downvote"}));
  assert.ok(ui.getByRole("button", {name: "Downvote"}).className.includes("text-red-600"));
  up = ui.getByRole("button", {name: "Upvote: 2 upvotes"}); assert.ok(up.className.includes("text-gray-400"));
  assert.equal(ui.getByRole("button", {name: "Downvote"}).textContent, "");
  await act(async () => finish(Response.json({vote: -1, upvotes: 2})));
  fireEvent.click(ui.getByRole("button", {name: "Downvote"}));
  assert.equal(ui.getByRole("button", {name: "Downvote"}).getAttribute("aria-pressed"), "false");
  await act(async () => finish(Response.json({vote: null, upvotes: 2})));
  assert.deepEqual(desired, [1, -1, null]);
  globalThis.fetch = async () => { throw new TypeError("Network offline"); };
  fireEvent.click(ui.getByRole("button", {name: "Upvote: 2 upvotes"}));
  await waitFor(() => assert.ok(ui.getByRole("alert")));
  assert.equal(ui.getByRole("button", {name: "Upvote: 2 upvotes"}).getAttribute("aria-pressed"), "false");
});

test("infinite scrolling appends, deduplicates, and ends; filter changes fetch fresh results", async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    const query = new URL(String(url), "http://localhost:3000").searchParams;
    if (query.get("sort") === "month") return Response.json({items: [], next_cursor: null});
    if (query.get("cursor") === "first") return Response.json({items: [photo("one", 100), photo("two")], next_cursor: "second"});
    if (query.get("cursor") === "second") return Response.json({items: [photo("three")], next_cursor: null});
    return Response.json({items: [photo("fresh")], next_cursor: null});
  };
  const ui = mount("user", [photo("one")], "first");
  await scroll(); await waitFor(() => assert.equal(ui.getAllByRole("article").length, 2));
  assert.ok(ui.getAllByRole("button", {name: "Upvote: 2 upvotes"}).length === 2);
  await scroll(); await waitFor(() => assert.equal(ui.getAllByRole("article").length, 3));
  assert.ok(ui.getByText("You’re all caught up."));
  assert.equal(ui.queryByRole("button", {name: "Load more"}), null);
  fireEvent.click(ui.getByRole("button", {name: "New this month"}));
  await scroll(); await waitFor(() => assert.ok(ui.getByText("No new avatars this month yet.")));
  fireEvent.click(ui.getByRole("button", {name: "Most votes overall", exact: true}));
  await scroll(); await waitFor(() => assert.equal(ui.getAllByRole("article").length, 1));
  assert.ok(ui.container.querySelector("#photo-fresh"));
  assert.equal(requests.length, 4);
});

test("feed failure shows retry without losing existing cards", async () => {
  let failure = true;
  globalThis.fetch = async () => failure ? Response.json({error: "Couldn’t load more photos."}, {status: 503}) : Response.json({items: [photo("two")], next_cursor: null});
  const ui = mount("user", [photo("one")], "first");
  await scroll(); await waitFor(() => assert.ok(ui.getByRole("alert")));
  assert.equal(ui.getAllByRole("article").length, 1);
  failure = false; fireEvent.click(ui.getByRole("button", {name: "Try again"}));
  await waitFor(() => assert.equal(ui.getAllByRole("article").length, 2));
});

test("upload control is English and a selected gallery file is uploaded directly before publishing", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    if (url === "/api/gallery/upload") return Response.json({uploadId: "ticket", signedUrl: "https://storage.example.test/signed"});
    if (url === "https://storage.example.test/signed") return Response.json({});
    if (url === "/api/gallery/publish") return Response.json({photoId: "published"});
    return Response.json({items: [], next_cursor: null});
  };
  const ui = mount(); fireEvent.click(ui.getByRole("button", {name: "Upload photo"}));
  assert.ok(ui.getByText("Choose file")); assert.ok(ui.getByText("No file chosen"));
  assert.ok(ui.getByText(/Up to 10 MB and 24 megapixels/));
  assert.ok(ui.getByRole("button", {name: "Publish photo"}).disabled);
  const file = new File([new Uint8Array(3 * 1024 * 1024)], "portrait.png", {type: "image/png"});
  fireEvent.change(ui.container.querySelector('input[type="file"]'), {target: {files: [file]}});
  fireEvent.click(ui.getByRole("button", {name: "Publish photo"}));
  await waitFor(() => assert.ok(ui.getByText("Your avatar is live. Welcome to the gallery!")));
  assert.equal(calls[1][0], "https://storage.example.test/signed"); assert.equal(calls[1][1].method, "PUT");
  assert.deepEqual(JSON.parse(calls[2][1].body), {assetId: "ticket", source: "upload"});
});

test("ranking moves immediately on upvote/removal, reconciles server totals and rolls back failures", async () => {
  let finish;
  globalThis.fetch = async () => new Promise((resolve) => { finish = resolve; });
  const ui = mount("user", [photo("z", 2), photo("a", 2)]);
  const order = () => ui.getAllByRole("article").map((element) => element.id);
  const click = (id) => fireEvent.click(ui.container.querySelector(`#photo-${id} button`));
  assert.deepEqual(order(), ["photo-z", "photo-a"]);
  click("a"); assert.deepEqual(order(), ["photo-a", "photo-z"]);
  await act(async () => finish(Response.json({vote: 1, upvotes: 3})));
  click("a"); assert.deepEqual(order(), ["photo-z", "photo-a"]);
  await act(async () => finish(Response.json({vote: null, upvotes: 8})));
  assert.deepEqual(order(), ["photo-a", "photo-z"]);
  globalThis.fetch = async () => Response.json({error: "Vote failed"}, {status: 500});
  fireEvent.click(ui.container.querySelector('#photo-a button[aria-label="Downvote"]'));
  await waitFor(() => assert.ok(ui.getByText("Vote failed")));
  assert.equal(ui.container.querySelector('#photo-a button').getAttribute('aria-label'), 'Upvote: 8 upvotes');
});

test("returning to the page refreshes global leaders, including photos outside the visible page", async () => {
  const ui = mount("user", [photo("old", 2)]);
  globalThis.fetch = async () => Response.json({items: [photo("new-leader", 50), photo("old", 3)], next_cursor: "updated-cursor"});
  await act(async () => window.dispatchEvent(new Event("focus")));
  await waitFor(() => assert.equal(ui.getAllByRole("article")[0].id, "photo-new-leader"));
  assert.ok(ui.getByRole("button", {name: "Upvote: 3 upvotes"}));
});

test("a stale background response cannot overwrite a vote made while it was loading", async () => {
  let finishRefresh;
  globalThis.fetch = async (url) => url === "/api/gallery/vote" ? Response.json({vote: 1, upvotes: 3}) : new Promise((resolve) => { finishRefresh = resolve; });
  const ui = mount("user", [photo("one", 2)]);
  await act(async () => window.dispatchEvent(new Event("focus")));
  fireEvent.click(ui.getByRole("button", {name: "Upvote: 2 upvotes"}));
  await waitFor(() => assert.equal(ui.getByRole("button", {name: "Upvote: 3 upvotes"}).disabled, false));
  await act(async () => finishRefresh(Response.json({items: [photo("one", 2)], next_cursor: null})));
  assert.equal(ui.getByRole("button", {name: "Upvote: 3 upvotes"}).getAttribute("aria-pressed"), "true");
});

test("equal upvotes use publication time rather than creation time; downvotes preserve order", async () => {
  let finish;
  globalThis.fetch = async () => new Promise(resolve => { finish = resolve; });
  const newer = { ...photo("a", 1), created_at: "2026-10-07T12:00:00Z", published_at: "2026-10-07T12:00:00Z" };
  const older = { ...photo("z", 1), created_at: "2026-10-06T12:00:00Z", published_at: "2026-10-07T13:00:00Z" };
  const ui = mount("user", [older, newer]);
  const order = () => ui.getAllByRole("article").map(x=>x.id);
  assert.deepEqual(order(), ["photo-z", "photo-a"]);
  fireEvent.click(ui.container.querySelector('#photo-a button[aria-label="Downvote"]'));
  assert.deepEqual(order(), ["photo-z", "photo-a"]);
  await act(async () => finish(Response.json({ vote: -1, upvotes: 1 })));
  assert.deepEqual(order(), ["photo-z", "photo-a"]);
  fireEvent.click(ui.container.querySelector('#photo-a button[aria-label="Downvote"]'));
  await act(async () => finish(Response.json({ vote: null, upvotes: 1 })));
  assert.deepEqual(order(), ["photo-z", "photo-a"]);
});

test("Newest ignores scores and orders by publication time after filtering and refresh", async () => {
  const older = { ...photo("z", 100), created_at: "2026-10-06T12:00:00Z", published_at: "2026-10-07T13:00:00Z" };
  const newer = { ...photo("a", 0), created_at: "2026-10-07T12:00:00Z", published_at: "2026-10-07T12:00:00Z" };
  globalThis.fetch = async () => Response.json({ items: [older, newer], next_cursor: null });
  const ui = mount("user", [older,newer]);
  fireEvent.click(ui.getByRole("button", { name: "Newest first", exact: true }));
  await scroll();
  await waitFor(() => assert.equal(ui.getAllByRole("article")[0].id, "photo-z"));
  await act(async () => window.dispatchEvent(new Event("focus")));
  await waitFor(() => assert.equal(ui.getAllByRole("article")[0].id, "photo-z"));
});


test("an expired creation-time cursor replaces the feed with a fresh publication-time batch", async () => {
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    return calls.length === 1
      ? Response.json({ code: "GALLERY_CURSOR_EXPIRED" }, { status: 409 })
      : Response.json({ items: [photo("fresh")], next_cursor: null });
  };
  const ui = mount("user", [photo("stale")], "old-cursor");
  await scroll();
  await waitFor(() => assert.equal(ui.getAllByRole("article")[0].id, "photo-fresh"));
  assert.equal(ui.getAllByRole("article").length, 1);
  assert.ok(calls[0].includes("cursor=")); assert.ok(!calls[1].includes("cursor="));
});

test("avatar name search sends a trimmed query, survives sort changes and clears to the full gallery", async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(new URL(url, "http://localhost:3000"));
    return Response.json({items: [], next_cursor: null});
  };
  const ui = mount();
  const input = ui.getByRole("searchbox", {name: "Search by avatar name"});
  fireEvent.change(input, {target: {value: "  Mario  "}});
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
  await scroll();
  await waitFor(() => assert.ok(ui.getByText("No avatars found.")));
  assert.equal(requests.at(-1).searchParams.get("search"), "Mario");
  fireEvent.click(ui.getByRole("button", {name: "Newest first"}));
  await scroll();
  await waitFor(() => assert.equal(requests.at(-1).searchParams.get("sort"), "newest"));
  assert.equal(requests.at(-1).searchParams.get("search"), "Mario");
  fireEvent.change(input, {target: {value: ""}});
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
  await scroll();
  await waitFor(() => assert.ok(ui.getByText("Be the first face in the gallery.")));
  assert.equal(requests.at(-1).searchParams.get("search"), "");
});


test("gallery has a single bubble title and avatar cards link to public descriptions while voting stays separate", () => {
  const ui = mount("user", [{...photo("one"), title: "Bubble Hero", description: "A happy little adventurer."}]);
  assert.equal(ui.getByRole("heading", {level: 1, name: "Avatar Gallery"}).getAttribute("id"), "gallery-title");
  assert.equal(ui.getByRole("link", {name: "Bubble Hero"}).getAttribute("href"), "/avatars/one");
  assert.ok(ui.getByRole("button", {name: "Most votes overall"}));
  assert.ok(ui.getByRole("button", {name: "New this month"}));
  assert.ok(ui.getByRole("button", {name: "Newest first"}));
  assert.equal(ui.getByRole("button", {name: "Upvote: 2 upvotes"}).closest("a"), null);
});
