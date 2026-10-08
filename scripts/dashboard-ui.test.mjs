import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { registerHooks } from "node:module";
import { JSDOM } from "jsdom";
import React from "react";

registerHooks({ load(url, context, next) {
  if (url.endsWith(".module.css")) return { format: "module", shortCircuit: true, source: 'export default new Proxy({}, {get: (_, key) => String(key)});' };
  return next(url, context);
} });
const dom = new JSDOM("<html><body></body></html>", { url: "http://localhost:3000" });
for (const name of ["window", "document", "HTMLElement", "MutationObserver", "Node", "Event", "MouseEvent", "getComputedStyle"]) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react");
const { DashboardStats } = await import("../app/my-works/dashboard-stats.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

test("dashboard shows exact all-time totals and refreshes the cards", async () => {
 const ui=render(React.createElement(DashboardStats,{initial:{published_count:"42",upvotes:"1006",revenue_cents:"90071992547409930"}}));
 assert.ok(ui.getByText("$900,719,925,474,099.30"));assert.ok(ui.getByText("1,006"));assert.ok(ui.getByText("42"));
 globalThis.fetch=async url=>{assert.equal(url,"/api/dashboard");return Response.json({published_count:"43",upvotes:"1010",revenue_cents:"1200"});};
 fireEvent.click(ui.getByRole("button",{name:"Refresh ↻"}));
 await waitFor(()=>assert.ok(ui.getByText("$12.00")));assert.ok(ui.getByText("43"));
});
test("dashboard preserves totals on failure and recovers from missing initial totals",async()=>{
 const ui=render(React.createElement(DashboardStats,{initial:null}));
 assert.equal(ui.getAllByText("—").length,3);
 globalThis.fetch=async()=>Response.json({error:"Unavailable"},{status:503});
 fireEvent.click(ui.getByRole("button",{name:"Try again"}));
 await waitFor(()=>assert.match(ui.getByRole("alert").textContent,/Unavailable/));
 globalThis.fetch=async()=>Response.json({published_count:"0",upvotes:"0",revenue_cents:"0"});
 fireEvent.click(ui.getByRole("button",{name:"Try again"}));
 await waitFor(()=>assert.ok(ui.getByText("$0.00")));assert.equal(ui.queryByRole("alert"),null);
 globalThis.fetch=async()=>{throw new TypeError("Offline");};
 fireEvent.click(ui.getByRole("button",{name:"Refresh ↻"}));
 await waitFor(()=>assert.ok(ui.getByRole("alert")));assert.ok(ui.getByText("$0.00"));
});
