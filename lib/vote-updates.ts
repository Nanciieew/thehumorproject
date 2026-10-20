export const VOTES_CHANGED_EVENT = "checked:votes-changed";
export function announceVoteChange() {
  window.dispatchEvent(new Event(VOTES_CHANGED_EVENT));
  try { window.localStorage.setItem(VOTES_CHANGED_EVENT, String(Date.now())); } catch { /* Periodic refresh also keeps counts current. */ }
}
