import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { questDay, shiftDay, questSummary, recordQuestVote, completeQuestDay, readQuestHistory } from '../lib/checkly-quest.ts';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'http://localhost:3000' });
for (const name of ['window','document','HTMLElement','HTMLDialogElement','MutationObserver','Node','Event','MouseEvent','getComputedStyle','localStorage','sessionStorage']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.self = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open',''); };
dom.window.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
const {render, waitFor, cleanup} = await import('@testing-library/react');
const {ChecklyDashboard} = await import('../app/checkly-dashboard.tsx');
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null,'','/'); });
const day = (completed = true, votes = {}) => ({completed,votes});
test('week starts Monday, includes colored completion states, and streak survives until today ends', () => {
 const summary = questSummary({'2026-10-18':day(),'2026-10-19':day(),'2026-10-20':day(),'2026-10-21':day(false)},'2026-10-21');
 assert.equal(summary.week[0].day,'2026-10-19');
 assert.equal(summary.week[6].day,'2026-10-25');
 assert.equal(summary.completedThisWeek,2);
 assert.equal(summary.streak,3);
 assert.equal(summary.completedToday,false);
 assert.equal(questSummary({'2026-10-19':day()},'2026-10-21').streak,0);
});
test('date calculations handle New York midnight, year boundaries, and leap days', () => {
 assert.equal(questDay(new Date('2026-10-20T03:59:59Z')),'2026-10-19');
 assert.equal(questDay(new Date('2026-10-20T04:00:00Z')),'2026-10-20');
 assert.equal(shiftDay('2027-01-01',-1),'2026-12-31');
 assert.equal(shiftDay('2028-03-01',-1),'2028-02-29');
});
test('quest votes are deduplicated, account scoped, and only completion earns a check', () => {
 recordQuestVote('alice','one',1); recordQuestVote('alice','one',1); recordQuestVote('alice','two',-1);
 let summary = questSummary(readQuestHistory('alice'));
 assert.equal(summary.upvotes,1); assert.equal(summary.downvotes,1); assert.equal(summary.completedToday,false);
 completeQuestDay('alice'); completeQuestDay('alice');
 summary = questSummary(readQuestHistory('alice'));
 assert.equal(summary.streak,1); assert.equal(summary.completedThisWeek,1);
 assert.deepEqual(readQuestHistory('bob'),{});
});
test('dashboard shows all weekly checks and metrics with one direct voting action', async () => {
 const today = questDay();
 localStorage.setItem('checked:quest-history:alice',JSON.stringify({[shiftDay(today,-1)]:day(true,{a:1,b:1}),[today]:day(true,{c:-1})}));
 const ui = render(React.createElement(ChecklyDashboard,{userId:'alice',firstName:'Alice'}));
 await waitFor(() => assert.equal(ui.getByRole('link',{name:/Keep voting/}).getAttribute('href'),'/quest'));
 assert.equal(ui.getByText(/Upvotes given/).parentElement.querySelector('strong').textContent,'2');
 assert.equal(ui.getByText(/Downvotes given/).parentElement.querySelector('strong').textContent,'1');
 assert.equal(ui.getAllByRole('listitem').length,7);
 assert.ok(ui.getAllByLabelText(/: completed/).length >= 1);
 assert.equal(ui.queryByRole('dialog'),null);
 assert.equal(ui.getAllByRole('link').length,1);
});
test('fresh login goes directly to the dashboard without a blocking invitation', () => {
 window.history.replaceState(null,'','/?welcome=quest');
 const ui = render(React.createElement(ChecklyDashboard,{userId:'alice',firstName:'Alice'}));
 assert.equal(ui.queryByRole('dialog'),null);
 assert.equal(window.location.search,'');
 assert.ok(ui.getByRole('heading',{name:'Checkly Quest.'}));
});
test('dashboard starts with zero activity and gives a direct daily quest action', () => {
 const ui = render(React.createElement(ChecklyDashboard,{userId:'new',firstName:''}));
 assert.equal(ui.getByRole('link',{name:/Start daily quest/}).getAttribute('href'),'/quest');
 assert.equal(ui.getAllByRole('listitem').filter(item=>item.dataset.completed==='true').length,0);
 assert.equal(ui.getAllByText('0',{selector:'strong'}).length,4);
});
