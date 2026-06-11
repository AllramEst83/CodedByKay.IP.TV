/**
 * Movies (VOD) view.
 */

import { getVodCategories, getVodStreams } from '../api/xtream.js';
import { renderGrid, sortItems } from '../components/grid.js';
import { initSearch, filterItems } from '../components/search.js';
import { openVodModal, openListsModal } from '../components/modal.js';

let _creds = null;
let _allItems = [];
let _query = '';
let _sortBy = 'name';
let _cleanupSearch = null;

export async function initMoviesView(creds, store) {
  _creds = creds;

  const categorySelect = document.getElementById('movies-category');
  const sortSelect = document.getElementById('movies-sort');
  const searchInput = document.getElementById('movies-search');

  // Load categories
  try {
    const cats = await getVodCategories(creds);
    populateCategorySelect(categorySelect, cats);
  } catch (err) {
    showError('movies', err.message);
  }

  // Category change
  categorySelect.addEventListener('change', () => {
    _query = '';
    searchInput.value = '';
    loadCategory(categorySelect.value, store);
  });

  // Sort change
  sortSelect.addEventListener('change', () => {
    _sortBy = sortSelect.value;
    renderCurrentItems(store);
  });

  // Search
  if (_cleanupSearch) _cleanupSearch();
  _cleanupSearch = initSearch(searchInput, (q) => {
    _query = q;
    renderCurrentItems(store);
  });

  // Load default (all)
  loadCategory('', store);
}

async function loadCategory(categoryId, store) {
  setLoading('movies', true);
  clearError('movies');

  try {
    _allItems = await getVodStreams(_creds, categoryId);
    renderCurrentItems(store);
  } catch (err) {
    showError('movies', err.message);
    _allItems = [];
  } finally {
    setLoading('movies', false);
  }
}

function renderCurrentItems(store) {
  const grid = document.getElementById('movies-grid');
  const emptyEl = document.getElementById('movies-empty');

  let items = filterItems(_allItems, _query);
  items = sortItems(items, _sortBy);

  emptyEl.hidden = items.length > 0;

  renderGrid(grid, items, {
    onSelect: (item) => {
      openVodModal(item, (i) => store.getItemLists(i));
    },
    getListCount: (item) => store.getItemLists(item).length,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function populateCategorySelect(select, categories) {
  const allOpt = select.querySelector('option[value=""]');
  select.innerHTML = '';
  if (allOpt) select.appendChild(allOpt);

  for (const cat of categories ?? []) {
    const opt = document.createElement('option');
    opt.value = cat.category_id ?? '';
    opt.textContent = cat.category_name ?? cat.category_id;
    select.appendChild(opt);
  }
}

function setLoading(prefix, on) {
  document.getElementById(`${prefix}-loading`).hidden = !on;
  document.getElementById(`${prefix}-grid`).style.display = on ? 'none' : '';
}

function showError(prefix, msg) {
  const el = document.getElementById(`${prefix}-empty`);
  el.textContent = `Fel: ${msg}`;
  el.hidden = false;
}

function clearError(prefix) {
  const el = document.getElementById(`${prefix}-empty`);
  el.hidden = true;
  el.textContent = 'Inget innehåll hittades.';
}
