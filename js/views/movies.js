/**
 * Movies (VOD) view — with pagination, search, sort, and genre filter.
 */

import { getVodCategories, getVodStreams, prefetchGenres, getGenreForItem } from '../api/xtream.js';
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

/** @type {Set<string>} */
let _selectedGenres = new Set();
/** @type {ReturnType<createGenreFilter>|null} */
let _genreFilter = null;
/** @type {AbortController|null} */
let _prefetchAbort = null;

export async function initMoviesView(pin, store) {
  _pin = pin;

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
  // Cancel any in-flight genre prefetch for the previous category
  if (_prefetchAbort) {
    _prefetchAbort.abort();
    _prefetchAbort = null;
  }

  setLoading('movies', true);
  clearError('movies');

  try {
    _allItems = await getVodStreams(_pin, categoryId);
    _page = 1;
    _selectedGenres = new Set();
    _genreFilter?.reset();
    renderCurrentItems(store);
  } catch (err) {
    showError('movies', err.message);
    _allItems = [];
  } finally {
    setLoading('movies', false);
  }

  // Kick off background genre prefetch (does not block the UI)
  if (_allItems.length > 0) {
    _startGenrePrefetch(store);
  }
}

function _startGenrePrefetch(store) {
  _prefetchAbort = new AbortController();
  const { signal } = _prefetchAbort;
  const snapshot = _allItems; // capture reference for this load

  prefetchGenres(_pin, snapshot, 'vod', {
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
 * This is called incrementally as the prefetch progresses.
 */
function _syncGenresFromCache(items) {
  const found = new Set();
  for (const item of items) {
    const id = item.stream_id ?? item.vod_id ?? item.id;
    const genre = getGenreForItem(id);
    if (genre) {
      for (const g of parseGenreString(genre)) found.add(g);
    }
  }
  _genreFilter?.addGenres(found);
}

function renderCurrentItems(store) {
  const grid       = document.getElementById('movies-grid');
  const emptyEl    = document.getElementById('movies-empty');
  const pagingEl   = document.getElementById('movies-pagination');

  let filtered = filterItems(_allItems, _query);
  filtered = sortItems(filtered, _sortBy);

  // Apply genre filter: only include items whose genre overlaps the selection.
  // Items with no cached genre data are excluded while a filter is active so
  // that results are accurate; they will appear once their genre is loaded.
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
