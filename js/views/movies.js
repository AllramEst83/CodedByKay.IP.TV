/**
 * Movies (VOD) view — with pagination, search, sort, and genre filter.
 * Genre data is populated progressively from detail modal views and
 * persisted in localStorage — no background prefetch.
 */

import { getVodCategories, getVodStreams, getGenreForItem } from '../api/xtream.js';
import { renderGrid, sortItems } from '../components/grid.js';
import { initSearch, filterItems } from '../components/search.js';
import { paginate, renderPagination, DEFAULT_PAGE_SIZE } from '../components/pagination.js';
import { openVodModal } from '../components/modal.js';
import { createGenreFilter, parseGenreString } from '../components/genreFilter.js';

let _pin = null;
let _allItems   = [];
let _query      = '';
let _sortBy     = 'name';
let _page       = 1;
let _pageSize   = DEFAULT_PAGE_SIZE;
let _cleanupSearch = null;
let _store = null;

/** @type {Set<string>} */
let _selectedGenres = new Set();
/** @type {ReturnType<createGenreFilter>|null} */
let _genreFilter = null;

export async function initMoviesView(pin, store) {
  _pin = pin;
  _store = store;

  const categorySelect = document.getElementById('movies-category');
  const sortSelect     = document.getElementById('movies-sort');
  const searchInput    = document.getElementById('movies-search');

  _genreFilter = createGenreFilter(
    document.getElementById('movies-genre-filter'),
    (genres) => {
      _selectedGenres = genres;
      _page = 1;
      renderCurrentItems(store);
    }
  );

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

  showPickCategoryPrompt('movies');
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

  const selected = categorySelect.value;
  if (selected) {
    await loadCategory(selected, store);
  } else {
    showPickCategoryPrompt('movies');
  }
}

async function loadCategory(categoryId, store) {
  if (!categoryId) {
    showPickCategoryPrompt('movies');
    return;
  }

  setLoading('movies', true);
  clearError('movies');

  try {
    let items = await getVodStreams(_pin, categoryId);
    _allItems = items;
    _page = 1;
    _selectedGenres = new Set();
    _genreFilter?.reset();
    syncGenreFilter();
    renderCurrentItems(store);
  } catch (err) {
    showError('movies', err.message);
    _allItems = [];
  } finally {
    setLoading('movies', false);
  }
}

/**
 * Called after the detail modal closes to refresh the genre filter
 * with any newly-discovered genre data.
 */
export function refreshMoviesGenres() {
  if (_allItems.length > 0 && _genreFilter) {
    syncGenreFilter();
  }
}

function syncGenreFilter() {
  const found = new Set();
  for (const item of _allItems) {
    const id = item.stream_id ?? item.vod_id ?? item.id;
    const genre = getGenreForItem(id);
    if (genre) {
      for (const g of parseGenreString(genre)) found.add(g);
    }
  }
  if (found.size > 0) {
    _genreFilter?.addGenres(found);
  }
}

function renderCurrentItems(store) {
  const grid       = document.getElementById('movies-grid');
  const emptyEl    = document.getElementById('movies-empty');
  const pagingEl   = document.getElementById('movies-pagination');

  let filtered = filterItems(_allItems, _query);
  filtered = sortItems(filtered, _sortBy);

  if (_selectedGenres.size > 0) {
    filtered = filtered.filter(item => {
      const id = item.stream_id ?? item.vod_id ?? item.id;
      const genre = getGenreForItem(id);
      if (!genre) return false;
      return parseGenreString(genre).some(g => _selectedGenres.has(g));
    });
  }

  const result = paginate(filtered, _page, _pageSize);

  emptyEl.hidden = result.total > 0;

  renderGrid(grid, result.items, {
    onSelect:     (item) => openVodModal(item, (i) => store.getItemLists(i)),
    onAddToList:  (item) => store.openListsModal(item),
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
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = 'Pick a category…';
  select.appendChild(placeholder);

  for (const cat of categories ?? []) {
    const opt = document.createElement('option');
    opt.value       = cat.category_id ?? '';
    opt.textContent = cat.category_name ?? cat.category_id;
    select.appendChild(opt);
  }
}

function showPickCategoryPrompt(prefix) {
  document.getElementById(`${prefix}-grid`).innerHTML = '';
  document.getElementById(`${prefix}-pagination`).innerHTML = '';
  const el = document.getElementById(`${prefix}-empty`);
  el.textContent = 'Pick a category to browse content.';
  el.hidden = false;
}

function setLoading(prefix, on) {
  document.getElementById(`${prefix}-loading`).hidden = !on;
  document.getElementById(`${prefix}-grid`).style.display = on ? 'none' : '';
  if (on) document.getElementById(`${prefix}-pagination`).innerHTML = '';
}

function showError(prefix, msg) {
  const el = document.getElementById(`${prefix}-empty`);
  el.textContent = `Error: ${msg}`;
  el.hidden = false;
}

function clearError(prefix) {
  const el = document.getElementById(`${prefix}-empty`);
  el.hidden = true;
  el.textContent = 'No content found.';
}
