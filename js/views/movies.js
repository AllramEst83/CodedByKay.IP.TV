/**
 * Movies (VOD) view — with pagination, search, sort.
 */

import { getVodCategories, getVodStreams } from '../api/xtream.js';
import { renderGrid, sortItems } from '../components/grid.js';
import { initSearch, filterItems } from '../components/search.js';
import { paginate, renderPagination, DEFAULT_PAGE_SIZE } from '../components/pagination.js';
import { openVodModal } from '../components/modal.js';

let _pin = null;
let _allItems   = [];
let _query      = '';
let _sortBy     = 'name';
let _page       = 1;
let _pageSize   = DEFAULT_PAGE_SIZE;
let _cleanupSearch = null;

export async function initMoviesView(pin, store) {
  _pin = pin;

  const categorySelect = document.getElementById('movies-category');
  const sortSelect     = document.getElementById('movies-sort');
  const searchInput    = document.getElementById('movies-search');

  try {
    const cats = await getVodCategories(pin);
    populateCategorySelect(categorySelect, cats);
  } catch (err) {
    showError('movies', err.message);
  }

  categorySelect.addEventListener('change', () => {
    _query = '';
    searchInput.value = '';
    _page = 1;
    loadCategory(categorySelect.value, store);
  });

  sortSelect.addEventListener('change', () => {
    _sortBy = sortSelect.value;
    _page = 1;
    renderCurrentItems(store);
  });

  if (_cleanupSearch) _cleanupSearch();
  _cleanupSearch = initSearch(searchInput, (q) => {
    _query = q;
    _page = 1;
    renderCurrentItems(store);
  });

  loadCategory('', store);
}

/**
 * Re-fetches categories and the currently selected category without
 * re-attaching any event listeners. Used after a cache purge.
 */
export async function reloadMoviesView(store) {
  const categorySelect = document.getElementById('movies-category');
  const searchInput    = document.getElementById('movies-search');
  const prevCategory   = categorySelect.value;

  try {
    const cats = await getVodCategories(_pin);
    populateCategorySelect(categorySelect, cats);
    if (prevCategory) categorySelect.value = prevCategory;
  } catch (err) {
    showError('movies', err.message);
  }

  _query = '';
  searchInput.value = '';
  _page = 1;
  await loadCategory(categorySelect.value, store);
}

async function loadCategory(categoryId, store) {
  setLoading('movies', true);
  clearError('movies');

  try {
    _allItems = await getVodStreams(_pin, categoryId);
    _page = 1;
    renderCurrentItems(store);
  } catch (err) {
    showError('movies', err.message);
    _allItems = [];
  } finally {
    setLoading('movies', false);
  }
}

function renderCurrentItems(store) {
  const grid       = document.getElementById('movies-grid');
  const emptyEl    = document.getElementById('movies-empty');
  const pagingEl   = document.getElementById('movies-pagination');

  let filtered = filterItems(_allItems, _query);
  filtered = sortItems(filtered, _sortBy);

  const result = paginate(filtered, _page, _pageSize);

  emptyEl.hidden = result.total > 0;

  renderGrid(grid, result.items, {
    onSelect:     (item) => openVodModal(item, (i) => store.getItemLists(i)),
    getListCount: (item) => store.getItemLists(item).length,
  });

  renderPagination(pagingEl, result, (newPage, newSize) => {
    _page     = newPage;
    _pageSize = newSize;
    renderCurrentItems(store);
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function populateCategorySelect(select, categories) {
  const allOpt = select.querySelector('option[value=""]');
  select.innerHTML = '';
  if (allOpt) select.appendChild(allOpt);
  for (const cat of categories ?? []) {
    const opt = document.createElement('option');
    opt.value       = cat.category_id ?? '';
    opt.textContent = cat.category_name ?? cat.category_id;
    select.appendChild(opt);
  }
}

function setLoading(prefix, on) {
  document.getElementById(`${prefix}-loading`).hidden = !on;
  document.getElementById(`${prefix}-grid`).style.display = on ? 'none' : '';
  if (on) document.getElementById(`${prefix}-pagination`).innerHTML = '';
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
