/**
 * localStorage helpers — PIN and custom lists only.
 * Xtream server credentials are stored exclusively in server-side env vars.
 */

const PIN_KEY   = 'iptv_hub_pin';
const LISTS_KEY = 'iptv_hub_lists';

// ─── PIN ──────────────────────────────────────────────────────────────────────

export function savePin(pin) {
  localStorage.setItem(PIN_KEY, String(pin));
}

export function loadPin() {
  return localStorage.getItem(PIN_KEY) ?? null;
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY);
}

// ─── Custom Lists ─────────────────────────────────────────────────────────────

/** Returns a Map<string, object[]> of all custom lists. */
export function loadLists() {
  try {
    const raw = localStorage.getItem(LISTS_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw)));
  } catch {
    return new Map();
  }
}

/** Persists a Map<string, object[]> to localStorage. */
export function saveLists(listsMap) {
  localStorage.setItem(LISTS_KEY, JSON.stringify(Object.fromEntries(listsMap)));
}

export function createList(listsMap, name) {
  const trimmed = name.trim();
  if (!trimmed || listsMap.has(trimmed)) return false;
  listsMap.set(trimmed, []);
  saveLists(listsMap);
  return true;
}

export function deleteList(listsMap, name) {
  const deleted = listsMap.delete(name);
  if (deleted) saveLists(listsMap);
  return deleted;
}

export function addToList(listsMap, listName, item) {
  const list = listsMap.get(listName);
  if (!list) return false;
  const id = itemId(item);
  if (list.some((i) => itemId(i) === id)) return false;
  list.push(structuredClone(item));
  saveLists(listsMap);
  return true;
}

export function removeFromList(listsMap, listName, item) {
  const list = listsMap.get(listName);
  if (!list) return false;
  const id = itemId(item);
  const idx = list.findIndex((i) => itemId(i) === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveLists(listsMap);
  return true;
}

export function isInList(listsMap, listName, item) {
  const list = listsMap.get(listName);
  if (!list) return false;
  const id = itemId(item);
  return list.some((i) => itemId(i) === id);
}

/** Returns list names that contain the given item. */
export function getItemLists(listsMap, item) {
  const id = itemId(item);
  return [...listsMap.entries()]
    .filter(([, list]) => list.some((i) => itemId(i) === id))
    .map(([name]) => name);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function itemId(item) {
  return item.stream_id ?? item.series_id ?? item.vod_id ?? item.id;
}
