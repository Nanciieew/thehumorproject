export type QuestDay = { completed: boolean; votes: Record<string, 1 | -1>; voteTimes?: Record<string, string> };
export type QuestHistory = Record<string, QuestDay>;
export const QUEST_HISTORY_EVENT = "checked:quest-history";
const historyKey = (userId: string) => `checked:quest-history:${userId}`;

export function questDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function readQuestHistory(userId: string): QuestHistory {
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey(userId)) ?? "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    const history: QuestHistory = {};
    for (const [day, entry] of Object.entries(saved)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !entry || typeof entry !== "object") continue;
      const value = entry as QuestDay;
      history[day] = { completed: value.completed === true, votes: {}, voteTimes: {} };
      for (const [id, vote] of Object.entries(value.votes ?? {})) if (vote === 1 || vote === -1) history[day].votes[id] = vote;
      for (const [id, time] of Object.entries(value.voteTimes ?? {})) {
        if (history[day].votes[id] && typeof time === "string" && Number.isFinite(Date.parse(time)) && questDay(new Date(time)) === day) history[day].voteTimes![id] = time;
      }
    }
    return history;
  } catch { return {}; }
}
function updateHistory(userId: string, update: (entry: QuestDay) => void, now = new Date()) {
  const history = readQuestHistory(userId);
  const day = questDay(now);
  const entry = history[day] ?? { completed: false, votes: {} };
  update(entry); history[day] = entry;
  try { localStorage.setItem(historyKey(userId), JSON.stringify(history)); } catch { return; }
  window.dispatchEvent(new Event(QUEST_HISTORY_EVENT));
}
export function recordQuestVote(userId: string, photoId: string, value: 1 | -1, now = new Date()) {
  updateHistory(userId, entry => {
    const isNewVote = !(photoId in entry.votes);
    entry.votes[photoId] = value;
    if (isNewVote) { entry.voteTimes ??= {}; entry.voteTimes[photoId] = now.toISOString(); }
  }, now);
}
export function completeQuestDay(userId: string) {
  updateHistory(userId, entry => { entry.completed = true; });
}
export function questSummary(history: QuestHistory, today = questDay()) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = shiftDay(today, -((weekday + 6) % 7));
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(monday, index);
    return { day, completed: history[day]?.completed ?? false, today: day === today, future: day > today };
  });
  let streak = 0;
  let cursor = history[today]?.completed ? today : shiftDay(today, -1);
  while (history[cursor]?.completed) { streak++; cursor = shiftDay(cursor, -1); }
  let upvotes = 0, downvotes = 0;
  for (const entry of Object.values(history)) for (const value of Object.values(entry.votes)) {
    if (value === 1) upvotes++;
    else if (value === -1) downvotes++;
  }
  return { week, streak, upvotes, downvotes, completedThisWeek: week.filter(day => day.completed).length, completedToday: history[today]?.completed ?? false };
}

/** Counts successful votes in New York's three eight-hour windows. */
export function questActivitySlots(entry?: QuestDay): [number, number, number] {
  const counts: [number, number, number] = [0, 0, 0];
  const hours = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" });
  for (const [id, timestamp] of Object.entries(entry?.voteTimes ?? {})) {
    if (!entry?.votes[id] || !Number.isFinite(Date.parse(timestamp))) continue;
    const hour = Number(hours.format(new Date(timestamp)));
    counts[Math.floor(hour / 8)]++;
  }
  return counts;
}
