/**
 * Search component — debounced real-time filtering.
 */

import debounce from 'lodash-es/debounce.js';

/**
 * Attaches a debounced input listener to a search field.
 *
 * @param {HTMLInputElement} inputEl
 * @param {Function} onSearch  called with the current query string
 * @param {number} [wait=200]  debounce delay in ms
 * @returns {Function}  cleanup function to remove the listener
 */
export function initSearch(inputEl, onSearch, wait = 200) {
  const handler = debounce((e) => {
    onSearch(e.target.value.trim());
  }, wait);

  inputEl.addEventListener('input', handler);

  return () => {
    inputEl.removeEventListener('input', handler);
    handler.cancel();
  };
}

/**
 * Filters an array of items by a query string against name/title.
 *
 * @param {object[]} items
 * @param {string} query
 * @returns {object[]}
 */
export function filterItems(items, query) {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter((item) => {
    const name = (item.name ?? item.title ?? item.series_name ?? '').toLowerCase();
    return name.includes(q);
  });
}
