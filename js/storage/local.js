/**
 * localStorage helpers — credentials and custom lists.
 */

const CREDS_KEY = 'iptv_hub_credentials';
const LISTS_KEY = 'iptv_hub_lists';

// ─── Credentials ──────────────────────────────────────────────────────────────

export function saveCredentials({ serverUrl, username, password }) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ serverUrl, username, password }));
}

export function loadCredentials() {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCredentials() {
  localStorage.removeItem(CREDS_KEY);
}

// ─── Custom Lists ─────────────────────────────────────────────────────────────

/**
 * Returns a Map<string, object[]> of all custom lists.
 */
export function loadLists() {
  try {
    const raw = localStorage.getItem(LISTS_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

/**
 * Persists a Map<string, object[]> to localStorage.
 */
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
  const id = item.stream_id ?? item.series_id ?? item.vod_id ?? item.id;
  const alreadyIn = list.some(
    (i) => (i.stream_id ?? i.series_id ?? i.vod_id ?? i.id) === id
  );
  if (alreadyIn) return false;
  list.push(structuredClone(item));
  saveLists(listsMap);
  return true;
}

export function removeFromList(listsMap, listName, item) {
  const list = listsMap.get(listName);
  if (!list) return false;
  const id = item.stream_id ?? item.series_id ?? item.vod_id ?? item.id;
  const idx = list.findIndex(
    (i) => (i.stream_id ?? i.series_id ?? i.vod_id ?? i.id) === id
  );
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveLists(listsMap);
  return true;
}

export function isInList(listsMap, listName, item) {
  const list = listsMap.get(listName);
  if (!list) return false;
  const id = item.stream_id ?? item.series_id ?? item.vod_id ?? item.id;
  return list.some((i) => (i.stream_id ?? i.series_id ?? i.vod_id ?? i.id) === id);
}

/** Returns list names that contain the given item */
export function getItemLists(listsMap, item) {
  const id = item.stream_id ?? item.series_id ?? item.vod_id ?? item.id;
  const names = [];
  for (const [name, list] of listsMap) {
    if (list.some((i) => (i.stream_id ?? i.series_id ?? i.vod_id ?? i.id) === id)) {
      names.push(name);
    }
  }
  return names;
}
