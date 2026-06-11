/**
 * Series view.
 */

import { getSeriesCategories, getSeries } from '../api/xtream.js';
import { renderGrid, sortItems } from '../components/grid.js';
import { initSearch, filterItems } from '../components/search.js';
import { openSeriesModal } from '../components/modal.js';

let _creds = null;
let _allItems = [];
let _query = '';
let _sortBy = 'name';
let _cleanupSearch = null;

export async function initSeriesView(creds, store) {
  _creds = creds;

  const categorySelect = document.getElementById('series-category');
  const sortSelect = document.getElementById('series-sort');
  const searchInput = document.getElementById('series-search');

  // Load categories
  try {
    const cats = await getSeriesCategories(creds);
    populateCategorySelect(categorySelect, cats);
  } catch (err) {
    showError('series', err.message);
  }

  categorySelect.addEventListener('change', () => {
    _query = '';
    searchInput.value = '';
    loadCategory(categorySelect.value, store);
  });

  sortSelect.addEventListener('change', () => {
    _sortBy = sortSelect.value;
    renderCurrentItems(store);
  });

  if (_cleanupSearch) _cleanupSearch();
  _cleanupSearch = initSearch(searchInput, (q) => {
    _query = q;
    renderCurrentItems(store);
  });

  loadCategory('', store);
}

async function loadCategory(categoryId, store) {
  setLoading('series', true);
  clearError('series');

  try {
    _allItems = await getSeries(_creds, categoryId);
    renderCurrentItems(store);
  } catch (err) {
    showError('series', err.message);
    _allItems = [];
  } finally {
    setLoading('series', false);
  }
}

function renderCurrentItems(store) {
  const grid = document.getElementById('series-grid');
  const emptyEl = document.getElementById('series-empty');

  let items = filterItems(_allItems, _query);
  items = sortItems(items, _sortBy);

  emptyEl.hidden = items.length > 0;

  renderGrid(grid, items, {
    onSelect: (item) => {
      openSeriesModal(item, (i) => store.getItemLists(i));
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
