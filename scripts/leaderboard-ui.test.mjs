import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { registerHooks } from "node:module";
import { JSDOM } from "jsdom";
import React from "react";

registerHooks({ load(url, context, next) {
  if (url.endsWith(".module.css")) return { format: "module", shortCircuit: true, source: 'export default new Proxy({}, {get: (_, key) => String(key)});' };
  return next(url, context);
} });
const dom = new JSDOM("<html><body></body></html>", { url: "http://localhost:3000", pretendToBeVisual: true });
for (const name of ["window", "document", "HTMLElement", "MutationObserver", "Node", "Event", "MouseEvent", "getComputedStyle"]) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react");
const { Leaderboard } = await import("../app/leaderboard/leaderboard.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const person = (id, rank = 1) => ({ contributor_id: id, rank, name: `Creator ${id}`, profile_photo_url: null, avatars_made: 2, total_votes: 3, revenue_cents: "90071992547409930" });
const summary = (period = "monthly", individuals = [person("A")], cursor = null) => ({ period, as_of: "2026-10-08T12:00:00Z", month_start: "2026-10-01T04:00:00Z", month_end: "2026-11-01T04:00:00Z", individuals, podium: individuals.slice(0, 3), monthly_top_avatars: [{ id: "avatar", rank: 1, contributor_id: "A", name: "Creator A", profile_photo_url: null, photo_url: "https://example.com/avatar.webp", title: "Monthly Favorite", upvotes: 3 }], monthly_top_regions: [{ rank: 1, state_code: "NY", state_name: "New York", avatars_contributed: 2, revenue_cents: "300" }], monthly_rewards: [{ rank: 1, credits: 2000 }, { rank: 2, credits: 1000 }, { rank: 3, credits: 500 }], next_cursor: cursor });

test("period switches replace creators and podium while monthly panels remain monthly", async () => {
  globalThis.fetch = async url => { assert.equal(url, "/api/leaderboard?period=all_time"); return Response.json(summary("all_time", [person("B")])); };
  const ui = render(React.createElement(Leaderboard, { initial: summary() }));
  assert.ok(ui.getAllByText("$900,719,925,474,099.30").length);
  fireEvent.click(ui.getByRole("button", { name: "All Time" }));
  await waitFor(() => assert.equal(ui.getByRole("button", { name: "All Time" }).getAttribute("aria-pressed"), "true"));
  assert.ok(ui.getAllByText("Creator B").length === 2);
  assert.ok(ui.getByText("Monthly Favorite"));
  assert.ok(ui.getByText("October 2026"));
  assert.ok(ui.getByText("New York"));
});

test("pagination appends without duplicates, preserves database order, and refresh resets the page", async () => {
  const requests = [];
  globalThis.fetch = async url => { requests.push(url); return Response.json(requests.length === 1 ? summary("monthly", [person("A"), person("B", 2)], null) : summary("monthly", [person("C")])); };
  const ui = render(React.createElement(Leaderboard, { initial: summary("monthly", [person("A")], "cursor-value") }));
  fireEvent.click(ui.getByRole("button", { name: "Load more creators" }));
  await waitFor(() => assert.ok(ui.getAllByText("Creator B").length));
  const table = ui.getByRole("table");
  assert.equal(table.querySelectorAll("tbody tr").length, 2);
  assert.match(table.textContent, /Creator A.*Creator B/);
  assert.equal(ui.queryByRole("button", { name: "Load more creators" }), null);
  fireEvent.click(ui.getByRole("button", { name: "Refresh ↻" }));
  await waitFor(() => assert.ok(ui.getAllByText("Creator C").length));
  assert.equal(table.querySelectorAll("tbody tr").length, 1);
  assert.deepEqual(requests, ["/api/leaderboard?period=monthly&cursor=cursor-value", "/api/leaderboard?period=monthly"]);
});

test("failed period requests retain existing rankings and retry the requested period", async () => {
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? Response.json({ error: "Please log in and finish signup." }, { status: 401 }) : Response.json(summary("all_time", [person("B")]));
  const ui = render(React.createElement(Leaderboard, { initial: summary() }));
  fireEvent.click(ui.getByRole("button", { name: "All Time" }));
  await waitFor(() => assert.match(ui.getByRole("alert").textContent, /Please log in/));
  assert.equal(ui.getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed"), "true");
  fireEvent.click(ui.getByRole("button", { name: "Try again" }));
  await waitFor(() => assert.equal(ui.getByRole("button", { name: "All Time" }).getAttribute("aria-pressed"), "true"));
  assert.equal(ui.queryByRole("alert"), null);
});

test("empty and initial failure states do not invent creators and can recover", async () => {
  globalThis.fetch = async () => Response.json({ ...summary(), individuals: [], podium: [], monthly_top_avatars: [], monthly_top_regions: [] });
  const ui = render(React.createElement(Leaderboard, { initial: null }));
  fireEvent.click(ui.getByRole("button", { name: "Try again" }));
  await waitFor(() => assert.ok(ui.getByText("The podium is waiting for our first creators.")));
  assert.ok(ui.getByText("No avatars published this month yet."));
  assert.ok(ui.getByText("No state activity this month yet."));
  assert.equal(ui.getByRole("table").querySelectorAll("tbody tr").length, 0);
});


test("podium revenue counts from zero to the exact amount without rounding large cents", async () => {
  const ui = render(React.createElement(Leaderboard, {initial: summary()}));
  const counter = ui.container.querySelector('span[aria-label="$900,719,925,474,099.30"]');
  assert.equal(counter.textContent, "$0.00");
  await waitFor(() => assert.equal(counter.textContent, "$900,719,925,474,099.30"), {timeout: 4000});
});

test("reduced motion shows final revenue immediately", async () => {
  const original = window.matchMedia;
  window.matchMedia = () => ({matches: true, addEventListener() {}, removeEventListener() {}});
  try {
    const ui = render(React.createElement(Leaderboard, {initial: summary()}));
    const counter = ui.container.querySelector('span[aria-label="$900,719,925,474,099.30"]');
    await waitFor(() => assert.equal(counter.textContent, "$900,719,925,474,099.30"));
  } finally { window.matchMedia = original; }
});

test("animation preview counts sample revenue and replay resets it to zero", async () => {
  const { LeaderboardPreview } = await import('../app/test/leaderboard/preview.tsx');
  const ui = render(React.createElement(LeaderboardPreview));
  const counter = () => ui.container.querySelector('span[aria-label="$1,240.00"]');
  assert.equal(counter().textContent, "$0.00");
  await waitFor(() => assert.equal(counter().textContent, "$1,240.00"), {timeout: 4000});
  fireEvent.click(ui.getByRole("button", {name: "Replay animation ↻"}));
  assert.equal(counter().textContent, "$0.00");
});

test("only the authenticated user's row and podium receive the gold highlight", () => {
  const ui = render(React.createElement(Leaderboard, {initial: summary("monthly", [person("A"), person("B", 2)]), viewerId: "B"}));
  const row = ui.getByText("You").closest("tr");
  assert.equal(row.getAttribute("aria-current"), "true");
  assert.ok(row.className.includes("currentUser"));
  assert.equal(ui.container.querySelectorAll('tr[aria-current="true"]').length, 1);
  assert.equal(ui.container.querySelectorAll('.currentWinner').length, 1);
  assert.ok(row.textContent.includes("Creator B"));
});
