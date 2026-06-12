/**
 * IPTV Hub — App entry point
 * PIN-based auth, view routing, theme toggle, user dropdown.
 *
 * Xtream server credentials live exclusively in Netlify env vars.
 * The client only ever stores and sends the PIN.
 */

import { authenticate, clearApiCache } from './api/xtream.js';
import {
  savePin,
  loadPin,
  clearPin,
  loadLists,
  createList     as storageCreateList,
  deleteList     as storageDeleteList,
  addToList      as storageAddToList,
  removeFromList as storageRemoveFromList,
  isInList       as storageIsInList,
  getItemLists   as storageGetItemLists,
} from './storage/local.js';
import { initModal, openListsModal } from './components/modal.js';
import { initMoviesView, reloadMoviesView, refreshMoviesGenres } from './views/movies.js';
import { initSeriesView, reloadSeriesView, refreshSeriesGenres } from './views/series.js';
import { initListsView, refreshListsView } from './views/lists.js';

// ─── Shared store ─────────────────────────────────────────────────────────────

let listsMap = loadLists();

const store = {
  getLists:     ()            => listsMap,
  getItemLists: (item)        => storageGetItemLists(listsMap, item),
  isInList:     (name, item)  => storageIsInList(listsMap, name, item),

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

window.__iptv_store__ = store;

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

const THEME_KEY = 'iptv-hub-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

// Load saved theme
const savedTheme = localStorage.getItem(THEME_KEY) ?? 'dark';
applyTheme(savedTheme);

document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') ?? 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ─── User Dropdown ────────────────────────────────────────────────────────────

const userMenuBtn  = document.getElementById('user-menu-btn');
const userDropdown = document.getElementById('user-dropdown');

userMenuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = userDropdown.classList.toggle('is-open');
  userMenuBtn.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('click', () => {
  userDropdown?.classList.remove('is-open');
  userMenuBtn?.setAttribute('aria-expanded', 'false');
});

userDropdown?.addEventListener('click', (e) => e.stopPropagation());

// ─── PIN Keypad ───────────────────────────────────────────────────────────────

const MAX_PIN_LENGTH = 6;
let pinValue = '';

function updatePinDisplay() {
  document.querySelectorAll('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < pinValue.length);
  });
  document.getElementById('pin-submit').disabled = pinValue.length < 1;
}

function tryAutoSubmitPin() {
  if (pinValue.length !== MAX_PIN_LENGTH) return;
  const btn = document.getElementById('pin-submit');
  if (btn.disabled) return;
  btn.click();
}

document.querySelectorAll('.key-btn[data-digit]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (pinValue.length >= MAX_PIN_LENGTH) return;
    pinValue += btn.dataset.digit;
    updatePinDisplay();
    tryAutoSubmitPin();
  });
});

document.getElementById('pin-backspace').addEventListener('click', () => {
  pinValue = pinValue.slice(0, -1);
  updatePinDisplay();
});

// Keyboard support: type/paste on login screen
document.addEventListener('keydown', (e) => {
  if (document.getElementById('login-screen').hidden) return;
  if (e.key >= '0' && e.key <= '9' && pinValue.length < MAX_PIN_LENGTH) {
    pinValue += e.key;
    updatePinDisplay();
    tryAutoSubmitPin();
  } else if (e.key === 'Backspace') {
    pinValue = pinValue.slice(0, -1);
    updatePinDisplay();
  } else if (e.key === 'Enter') {
    document.getElementById('pin-submit').click();
  }
});

// Paste support — on desktop and mobile (via clipboard API or paste event on document)
document.addEventListener('paste', (e) => {
  if (document.getElementById('login-screen').hidden) return;
  const pasted = (e.clipboardData ?? window.clipboardData)?.getData('text') ?? '';
  const digits = pasted.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH);
  if (digits.length > 0) {
    pinValue = digits;
    updatePinDisplay();
    e.preventDefault();
    tryAutoSubmitPin();
  }
});

// ─── PIN Submit ───────────────────────────────────────────────────────────────

document.getElementById('pin-submit').addEventListener('click', async () => {
  const errorEl = document.getElementById('login-error');
  const btn     = document.getElementById('pin-submit');
  const label   = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.btn-spinner');

  errorEl.hidden = true;
  btn.disabled   = true;
  label.textContent = 'Verifying…';
  spinner.hidden = false;

  try {
    await authenticate(pinValue);
    savePin(pinValue);
    startApp(pinValue);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    pinValue = '';
    updatePinDisplay();
  } finally {
    btn.disabled = pinValue.length < 1;
    label.textContent = 'Sign In';
    spinner.hidden = true;
  }
});

// ─── Toast ────────────────────────────────────────────────────────────────────

let _toastTimer = null;

function showToast(message, durationMs = 2500) {
  const el = document.getElementById('app-toast');
  el.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    ${message}
  `;
  el.classList.add('toast--visible');

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('toast--visible'), durationMs);
}

// ─── Cache purge ──────────────────────────────────────────────────────────────

document.getElementById('clear-cache-btn').addEventListener('click', async () => {
  const btn = document.getElementById('clear-cache-btn');
  if (btn.disabled) return;

  // Close dropdown
  userDropdown?.classList.remove('is-open');

  btn.disabled = true;

  clearApiCache();

  try {
    if (_viewsInitialized.has('movies')) await reloadMoviesView(store);
    if (_viewsInitialized.has('series')) await reloadSeriesView(store);
  } finally {
    btn.disabled = false;
    showToast('Cache cleared — data refreshed');
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

document.getElementById('logout-btn').addEventListener('click', () => {
  userDropdown?.classList.remove('is-open');
  clearApiCache();
  clearPin();
  showLoginScreen();
});

// ─── View routing ─────────────────────────────────────────────────────────────

const views = {
  movies: document.getElementById('view-movies'),
  series: document.getElementById('view-series'),
  lists:  document.getElementById('view-lists'),
};

let _activeView = 'movies';
let _viewsInitialized = new Set();

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    if (target === _activeView) return;

    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== target; });
    _activeView = target;
  });
});

function refreshListsViewIfActive() {
  if (_activeView === 'lists') refreshListsView(store);
}

// ─── App start ────────────────────────────────────────────────────────────────

function startApp(pin) {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app').hidden = false;

  _activeView = 'movies';
  Object.entries(views).forEach(([key, el]) => { el.hidden = key !== 'movies'; });
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.view === 'movies');
  });

  initModal(pin, (item) => store.openListsModal(item), () => {
    refreshMoviesGenres();
    refreshSeriesGenres();
  });

  if (!_viewsInitialized.has('movies')) {
    initMoviesView(pin, store);
    _viewsInitialized.add('movies');
  }

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.view;
      if (!_viewsInitialized.has(v)) {
        if (v === 'series') initSeriesView(pin, store);
        if (v === 'lists')  initListsView(store);
        _viewsInitialized.add(v);
      }
    });
  });
}

function showLoginScreen() {
  document.getElementById('app').hidden = true;
  document.getElementById('login-screen').hidden = false;
  pinValue = '';
  updatePinDisplay();
  _viewsInitialized.clear();
}

// ─── Auto-login ───────────────────────────────────────────────────────────────

const savedPin = loadPin();
if (savedPin) {
  pinValue = savedPin;
  updatePinDisplay();

  authenticate(savedPin)
    .then(() => startApp(savedPin))
    .catch(() => {
      clearPin();
      pinValue = '';
      updatePinDisplay();
      showLoginScreen();
    });
}
