/**
 * Series view — with pagination, search, sort, and genre filter.
 */

import { getSeriesCategories, getSeries, prefetchGenres, getGenreForItem } from '../api/xtream.js';
import { renderGrid, sortItems } from '../components/grid.js';
import { initSearch, filterItems } from '../components/search.js';
import { paginate, renderPagination, DEFAULT_PAGE_SIZE } from '../components/pagination.js';
import { openSeriesModal } from '../components/modal.js';
import { createGenreFilter, parseGenreString } from '../components/genreFilter.js';

let _pin = null;
let _allItems   = [];
let _query      = '';
let _sortBy     = 'name';
let _page       = 1;
let _pageSize   = DEFAULT_PAGE_SIZE;
let _cleanupSearch = null;

/** @type {Set<string>} */
let _selectedGenres = new Set();
/** @type {ReturnType<createGenreFilter>|null} */
let _genreFilter = null;
/** @type {AbortController|null} */
let _prefetchAbort = null;

export async function initSeriesView(pin, store) {
  _pin = pin;

  const categorySelect = document.getElementById('series-category');
  const sortSelect     = document.getElementById('series-sort');
  const searchInput    = document.getElementById('series-search');

  _genreFilter = createGenreFilter(
    document.getElementById('series-genre-filter'),
    (genres) => {
      _selectedGenres = genres;
      _page = 1;
      renderCurrentItems(store);
    }
  );

  try {
    const cats = await getSeriesCategories(pin);
    populateCategorySelect(categorySelect, cats);
  } catch (err) {
    showError('series', err.message);
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
export async function reloadSeriesView(store) {
  const categorySelect = document.getElementById('series-category');
  const searchInput    = document.getElementById('series-search');
  const prevCategory   = categorySelect.value;

  try {
    const cats = await getSeriesCategories(_pin);
    populateCategorySelect(categorySelect, cats);
    if (prevCategory) categorySelect.value = prevCategory;
  } catch (err) {
    showError('series', err.message);
  }

  _query = '';
  searchInput.value = '';
  _page = 1;
  await loadCategory(categorySelect.value, store);
}

async function loadCategory(categoryId, store) {
  // Cancel any in-flight genre prefetch for the previous category
  if (_prefetchAbort) {
    _prefetchAbort.abort();
    _prefetchAbort = null;
  }

  setLoading('series', true);
  clearError('series');

  try {
    _allItems = await getSeries(_pin, categoryId);
    _page = 1;
    _selectedGenres = new Set();
    _genreFilter?.reset();
    renderCurrentItems(store);
  } catch (err) {
    showError('series', err.message);
    _allItems = [];
  } finally {
    setLoading('series', false);
  }

  // Kick off background genre prefetch (does not block the UI)
  if (_allItems.length > 0) {
    _startGenrePrefetch(store);
  }
}

function _startGenrePrefetch(store) {
  _prefetchAbort = new AbortController();
  const { signal } = _prefetchAbort;
  const snapshot = _allItems;

  prefetchGenres(_pin, snapshot, 'series', {
    signal,
    maxItems: 300,
    onProgress: (loaded, total) => {
      if (signal.aborted) return;
      _syncGenresFromCache(snapshot);
      _genreFilter?.setLoading(loaded < total, loaded, total);
    },
  }).then(() => {
    if (!signal.aborted) {
      _syncGenresFromCache(snapshot);
      _genreFilter?.setLoading(false, 0, 0);
    }
  }).catch(() => {
    // Prefetch cancelled or failed — leave filter with whatever was found
  });
}

/**
 * Walk the current item list and push any newly-cached genres into the filter.
 */
function _syncGenresFromCache(items) {
  const found = new Set();
  for (const item of items) {
    const id = item.series_id ?? item.id;
    const genre = getGenreForItem(id);
    if (genre) {
      for (const g of parseGenreString(genre)) found.add(g);
    }
  }
  _genreFilter?.addGenres(found);
}

function renderCurrentItems(store) {
  const grid     = document.getElementById('series-grid');
  const emptyEl  = document.getElementById('series-empty');
  const pagingEl = document.getElementById('series-pagination');

  let filtered = filterItems(_allItems, _query);
  filtered = sortItems(filtered, _sortBy);

  // Apply genre filter
  if (_selectedGenres.size > 0) {
    filtered = filtered.filter(item => {
      const id = item.series_id ?? item.id;
      const genre = getGenreForItem(id);
      if (!genre) return false;
      return parseGenreString(genre).some(g => _selectedGenres.has(g));
    });
  }

  const result = paginate(filtered, _page, _pageSize);

  emptyEl.hidden = result.total > 0;

  renderGrid(grid, result.items, {
    onSelect:     (item) => openSeriesModal(item, (i) => store.getItemLists(i)),
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
