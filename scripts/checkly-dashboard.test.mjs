import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { questActivitySlots, questDay, shiftDay, questSummary, recordQuestVote, completeQuestDay, readQuestHistory } from '../lib/checkly-quest.ts';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url:'http://localhost:3000' });
for (const name of ['window','document','HTMLElement','HTMLDialogElement','MutationObserver','Node','Event','MouseEvent','getComputedStyle','localStorage','sessionStorage']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.self = dom.window;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open',''); };
dom.window.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
const {render, waitFor, cleanup, within, fireEvent} = await import('@testing-library/react');
const {QuestInvitation} = await import('../app/quest-invitation.tsx');
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
 const ui = render(React.createElement(ChecklyDashboard,{userId:'alice',firstName:'Alice',received:{upvotes:'124',downvotes:'18'}}));
 await waitFor(() => assert.equal(ui.getByRole('link',{name:/Keep voting/}).getAttribute('href'),'/quest'));
 assert.equal(ui.getByText(/Upvotes received/).parentElement.querySelector('strong').textContent,'124');
 assert.equal(ui.getByText(/Downvotes received/).parentElement.querySelector('strong').textContent,'18');
 assert.equal(within(ui.getByRole('list',{name:'Weekly quest completion'})).getAllByRole('listitem').length,7);
 assert.ok(ui.getAllByLabelText(/: completed/).length >= 1);
 assert.equal(ui.queryByRole('dialog'),null);
 assert.equal(ui.getAllByRole('link').length,1);
});
test('each fresh login opens the quest invitation if today is incomplete', () => {
 const login = () => { window.history.replaceState(null,'','/gallery?welcome=quest'); return render(React.createElement(React.StrictMode,null,React.createElement(QuestInvitation,{userId:'alice',firstName:'Alice',received:{upvotes:'124',downvotes:'18'}}))); };
 const ui = login();
 assert.ok(ui.getByRole('dialog',{name:/Your daily dose/}));
 assert.equal(ui.getByRole('link',{name:'Let’s judge some memes'}).getAttribute('href'),'/quest');
 assert.equal(window.location.search,'');
 fireEvent.click(ui.getByRole('button',{name:'Maybe later'}));
 assert.equal(ui.queryByRole('dialog'),null);
 fireEvent(window,new Event('focus'));
 assert.equal(ui.queryByRole('dialog'),null);
 ui.unmount();
 const again = login();
 assert.ok(again.getByRole('dialog',{name:/Your daily dose/}));
});
test('completed quests suppress the login invitation while yesterday’s completion does not', () => {
 const today=questDay();
 localStorage.setItem('checked:quest-history:alice',JSON.stringify({[today]:day(true)}));
 window.history.replaceState(null,'','/gallery?welcome=quest');
 const ui=render(React.createElement(QuestInvitation,{userId:'alice',firstName:''}));
 assert.equal(ui.queryByRole('dialog'),null);
 assert.equal(window.location.search,'');
 ui.unmount();
 localStorage.setItem('checked:quest-history:alice',JSON.stringify({[shiftDay(today,-1)]:day(true)}));
 window.history.replaceState(null,'','/gallery?welcome=quest');
 const next=render(React.createElement(QuestInvitation,{userId:'alice',firstName:''}));
 assert.ok(next.getByRole('dialog',{name:/Your daily dose/}));
 fireEvent(next.getByRole('dialog'),new Event('cancel',{cancelable:true}));
 assert.equal(next.queryByRole('dialog'),null);
});
test('dashboard starts with zero activity and gives a direct daily quest action', () => {
 const ui = render(React.createElement(ChecklyDashboard,{userId:'new',firstName:'',received:{upvotes:'0',downvotes:'0'}}));
 assert.equal(ui.container.querySelector('img[src*="glass-checkmark"]'),null);
 assert.equal(ui.getByRole('link',{name:/Start daily quest/}).getAttribute('href'),'/quest');
 assert.equal(within(ui.getByRole('list',{name:'Weekly quest completion'})).getAllByRole('listitem').filter(item=>item.dataset.completed==='true').length,0);
 assert.equal(ui.getAllByText('0',{selector:'strong'}).length,3);
});

test('monthly activity uses calendar dates so today lights its matching numbered box', () => {
 const today = questDay();
 const month = today.slice(0,7);
 const [year,monthNumber] = month.split('-').map(Number);
 const dayNumber = Number(today.slice(-2));
 localStorage.setItem('checked:quest-history:alice',JSON.stringify({[shiftDay(`${month}-01`,-1)]:day(true),[today]:day(true,{new:-1})}));
 const ui = render(React.createElement(ChecklyDashboard,{userId:'alice',firstName:'Alice',received:{upvotes:'124',downvotes:'18'}}));
 const cells = within(ui.getByRole('list',{name:'This month’s daily quests'})).getAllByRole('listitem');
 assert.equal(cells.length,new Date(Date.UTC(year,monthNumber,0)).getUTCDate());
 assert.deepEqual(cells.map(cell=>cell.querySelector('span').textContent),Array.from({length:cells.length},(_,i)=>String(i+1)));
 assert.ok(cells.every(cell=>cell.querySelectorAll('[role=img]').length===3));
 assert.match(cells[dayNumber-1].getAttribute('aria-label'),/quest complete/);
 assert.equal(cells[dayNumber-1].getAttribute('aria-current'),'date');
 assert.equal(cells.filter(cell=>/quest complete$/.test(cell.getAttribute('aria-label'))).length,1);
 if(dayNumber<cells.length) assert.match(cells[cells.length-1].getAttribute('aria-label'),/not completed/);
});

test('successful votes keep their actual eight-hour New York window and do not duplicate', () => {
 const times=['2026-10-19T04:00:00Z','2026-10-19T11:59:59Z','2026-10-19T12:00:00Z','2026-10-19T19:59:59Z','2026-10-19T20:00:00Z','2026-10-20T03:59:59Z'];
 times.forEach((time,i)=>recordQuestVote('timed',String(i),1,new Date(time)));
 recordQuestVote('timed','0',-1,new Date('2026-10-19T21:00:00Z'));
 const entry=readQuestHistory('timed')['2026-10-19'];
 assert.deepEqual(questActivitySlots(entry),[2,2,2]);
 assert.equal(entry.voteTimes['0'],new Date(times[0]).toISOString());
 recordQuestVote('timed','next',1,new Date('2026-10-20T04:00:00Z'));
 assert.deepEqual(questActivitySlots(readQuestHistory('timed')['2026-10-20']),[1,0,0]);
});
test('legacy history stays readable without inventing times and DST uses local hours', () => {
 localStorage.setItem('checked:quest-history:legacy',JSON.stringify({'2026-10-19':day(true,{old:1})}));
 assert.deepEqual(questActivitySlots(readQuestHistory('legacy')['2026-10-19']),[0,0,0]);
 recordQuestVote('dst','a',1,new Date('2026-11-01T05:30:00Z'));
 recordQuestVote('dst','b',1,new Date('2026-11-01T06:30:00Z'));
 recordQuestVote('dst','c',1,new Date('2026-11-01T13:00:00Z'));
 assert.deepEqual(questActivitySlots(readQuestHistory('dst')['2026-11-01']),[2,1,0]);
});

test('a new vote lights only today’s actual time slot in the monthly grid', () => {
 const now = new Date();
 recordQuestVote('slots-ui','one',1,now);
 const ui = render(React.createElement(ChecklyDashboard,{userId:'slots-ui',firstName:''}));
 const cells = within(ui.getByRole('list',{name:'This month’s daily quests'})).getAllByRole('listitem');
 const todayCell = cells[Number(questDay(now).slice(-2))-1];
 const hour = Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'}).format(now));
 const levels = [...todayCell.querySelectorAll('[role=img]')].map(cell=>cell.dataset.level);
 assert.deepEqual(levels,[0,1,2].map(slot=>slot===Math.floor(hour/8)?'1':'0'));
 assert.equal(cells.flatMap(cell=>[...cell.querySelectorAll('[data-level]')]).filter(cell=>cell.dataset.level!=='0').length,1);
});


test('combined Checkboard shows received votes separately from voting history and includes the collection', () => {
 recordQuestVote('owner','voted-on-someone-else',1);
 const ui=render(React.createElement(ChecklyDashboard,{userId:'owner',received:{upvotes:'987',downvotes:'23'}},React.createElement('section',{'aria-label':'Uploaded memes'},'My collection')));
 assert.equal(ui.getByRole('heading',{level:1}).textContent,'My Checkboard');
 assert.equal(ui.getByText('Upvotes received').parentElement.querySelector('strong').textContent,'987');
 assert.equal(ui.getByText('Downvotes received').parentElement.querySelector('strong').textContent,'23');
 assert.ok(ui.getByRole('region',{name:'Uploaded memes'}));
 assert.equal(ui.queryByText('Upvotes given'),null);
});
test('failed received totals show unavailable rather than invented zeroes', () => {
 const ui=render(React.createElement(ChecklyDashboard,{userId:'owner',received:null}));
 assert.equal(ui.getByText('Upvotes received').parentElement.querySelector('strong').textContent,'—');
 assert.equal(ui.getByText('Downvotes received').parentElement.querySelector('strong').textContent,'—');
 assert.match(ui.getByRole('alert').textContent,/couldn’t load/);
});

test('hero and decorations use independent assets while the dashboard remains interactive', () => {
 const ui=render(React.createElement(ChecklyDashboard,{userId:'owner',received:{upvotes:'124',downvotes:'18'}}));
 const sources=[...ui.container.querySelectorAll('img')].map(img=>decodeURIComponent(img.getAttribute('src')));
 for(const asset of ['mascot.png','glass-bubbles.png','sparkle.svg']) assert.ok(sources.some(src=>src.includes(asset)),asset);
 assert.equal(ui.container.querySelector('img[src*="glass-checkmark"]'),null);
 assert.equal(ui.getByRole('link',{name:/Start daily quest/}).getAttribute('href'),'/quest');
 assert.equal(within(ui.getByRole('list',{name:'Weekly quest completion'})).getAllByRole('listitem').length,7);
});
