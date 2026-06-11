/**
 * IPTV Hub — App entry point
 * Bootstraps auth, view routing and the shared store.
 */

import { authenticate } from './api/xtream.js';
import {
  saveCredentials,
  loadCredentials,
  clearCredentials,
  loadLists,
  saveLists,
  createList as storageCreateList,
  deleteList as storageDeleteList,
  addToList as storageAddToList,
  removeFromList as storageRemoveFromList,
  isInList as storageIsInList,
  getItemLists as storageGetItemLists,
} from './storage/local.js';
import { initModal, openListsModal } from './components/modal.js';
import { initMoviesView } from './views/movies.js';
import { initSeriesView } from './views/series.js';
import { initListsView, refreshListsView } from './views/lists.js';

// ─── Shared store ─────────────────────────────────────────────────────────────

let listsMap = loadLists();

const store = {
  getLists: () => listsMap,
  getItemLists: (item) => storageGetItemLists(listsMap, item),
  isInList: (name, item) => storageIsInList(listsMap, name, item),
  createList(name) {
    const ok = storageCreateList(listsMap, name);
    if (ok) refreshListsViewIfActive();
    return ok;
  },
  deleteList(name) {
    const ok = storageDeleteList(listsMap, name);
    if (ok) refreshListsViewIfActive();
    return ok;
  },
  toggleListItem(listName, item) {
    if (storageIsInList(listsMap, listName, item)) {
      storageRemoveFromList(listsMap, listName, item);
    } else {
      storageAddToList(listsMap, listName, item);
    }
    refreshListsViewIfActive();
  },
  openListsModal(item) {
    openListsModal(item, listsMap, (name, i) => store.toggleListItem(name, i));
  },
};

// Expose store globally so modal.js can call it without circular imports
window.__iptv_store__ = store;

// ─── Login / Logout ───────────────────────────────────────────────────────────

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const label = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.btn-spinner');

  const creds = {
    serverUrl: document.getElementById('server-url').value.trim(),
    username: document.getElementById('username').value.trim(),
    password: document.getElementById('password').value.trim(),
  };

  errorEl.hidden = true;
  btn.disabled = true;
  label.textContent = 'Ansluter…';
  spinner.hidden = false;

  try {
    await authenticate(creds);
    saveCredentials(creds);
    startApp(creds);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    label.textContent = 'Anslut';
    spinner.hidden = true;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  clearCredentials();
  showLoginScreen();
});

// ─── View routing ─────────────────────────────────────────────────────────────

const views = {
  movies: document.getElementById('view-movies'),
  series: document.getElementById('view-series'),
  lists: document.getElementById('view-lists'),
};

let _activeView = 'movies';
let _viewsInitialized = new Set();

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    if (target === _activeView) return;

    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    Object.entries(views).forEach(([key, el]) => {
      el.hidden = key !== target;
    });

    _activeView = target;
  });
});

function refreshListsViewIfActive() {
  if (_activeView === 'lists') {
    refreshListsView(store);
  }
}

// ─── App start ────────────────────────────────────────────────────────────────

function startApp(creds) {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app').hidden = false;

  // Reset to movies view
  _activeView = 'movies';
  Object.entries(views).forEach(([key, el]) => { el.hidden = key !== 'movies'; });
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.view === 'movies');
  });

  initModal(creds, (item, type) => store.openListsModal(item));

  if (!_viewsInitialized.has('movies')) {
    initMoviesView(creds, store);
    _viewsInitialized.add('movies');
  }

  // Lazy-init series and lists views on first nav
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      if (!_viewsInitialized.has(v)) {
        if (v === 'series') initSeriesView(creds, store);
        if (v === 'lists') initListsView(store);
        _viewsInitialized.add(v);
      }
    });
  });
}

function showLoginScreen() {
  document.getElementById('app').hidden = true;
  document.getElementById('login-screen').hidden = false;
  _viewsInitialized.clear();
}

// ─── Auto-login ───────────────────────────────────────────────────────────────

const savedCreds = loadCredentials();
if (savedCreds) {
  // Pre-fill form in case auth fails
  document.getElementById('server-url').value = savedCreds.serverUrl ?? '';
  document.getElementById('username').value = savedCreds.username ?? '';
  document.getElementById('password').value = savedCreds.password ?? '';

  // Silently verify credentials on load
  authenticate(savedCreds)
    .then(() => startApp(savedCreds))
    .catch(() => showLoginScreen());
}
