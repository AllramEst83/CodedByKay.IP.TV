/**
 * My Lists view.
 */

import { renderGrid, sortItems } from '../components/grid.js';
import { initSearch, filterItems } from '../components/search.js';
import { openListsModal } from '../components/modal.js';

let _activeList = null;
let _query = '';
let _cleanupSearch = null;

export function initListsView(store) {
  const createBtn = document.getElementById('create-list-btn');
  const nameInput = document.getElementById('new-list-name');
  const deleteBtn = document.getElementById('delete-list-btn');
  const searchInput = document.getElementById('lists-search');

  createBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return;
    const ok = store.createList(name);
    if (ok) {
      nameInput.value = '';
      _activeList = name;
      renderSidebar(store);
      renderActiveList(store);
    }
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createBtn.click();
  });

  deleteBtn.addEventListener('click', () => {
    if (!_activeList) return;
    const confirmed = window.confirm(`Ta bort listan "${_activeList}"?`);
    if (!confirmed) return;
    store.deleteList(_activeList);
    _activeList = null;
    renderSidebar(store);
    renderActiveList(store);
  });

  if (_cleanupSearch) _cleanupSearch();
  _cleanupSearch = initSearch(searchInput, (q) => {
    _query = q;
    renderActiveList(store);
  });

  renderSidebar(store);
  renderActiveList(store);
}

export function refreshListsView(store) {
  renderSidebar(store);
  renderActiveList(store);
}

// ─── Sidebar (tab list) ───────────────────────────────────────────────────────

function renderSidebar(store) {
  const tabsEl = document.getElementById('lists-tabs');
  const deleteBtn = document.getElementById('delete-list-btn');
  tabsEl.innerHTML = '';

  const lists = store.getLists();

  for (const [name] of lists) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `lists-tab${name === _activeList ? ' is-active' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', name === _activeList ? 'true' : 'false');
    btn.textContent = name;
    btn.title = name;

    btn.addEventListener('click', () => {
      _activeList = name;
      renderSidebar(store);
      renderActiveList(store);
    });

    tabsEl.appendChild(btn);
  }

  deleteBtn.hidden = !_activeList || !lists.has(_activeList);
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

function renderActiveList(store) {
  const grid = document.getElementById('lists-grid');
  const emptyEl = document.getElementById('lists-empty');

  if (!_activeList || !store.getLists().has(_activeList)) {
    grid.innerHTML = '';
    emptyEl.hidden = false;
    emptyEl.textContent = store.getLists().size === 0
      ? 'Skapa en lista för att komma igång.'
      : 'Välj en lista.';
    return;
  }

  let items = store.getLists().get(_activeList) ?? [];
  items = filterItems(items, _query);
  items = sortItems(items, 'name');

  if (items.length === 0) {
    grid.innerHTML = '';
    emptyEl.hidden = false;
    emptyEl.textContent = _query ? 'Inget innehåll hittades.' : 'Listan är tom.';
    return;
  }

  emptyEl.hidden = true;

  renderGrid(grid, items, {
    onSelect: (item) => {
      store.openListsModal(item);
    },
    getListCount: (item) => store.getItemLists(item).length,
  });
}
