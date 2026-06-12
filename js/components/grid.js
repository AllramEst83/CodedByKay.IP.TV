/**
 * Content grid renderer.
 * Renders an array of VOD/series items as article cards into a container.
 * Updated to use the new pastel design system card layout.
 * Note: "Watch Now" has been removed — this is a library browser only.
 */

import { proxyImageUrl } from '../utils/imageProxy.js';

const PLACEHOLDER_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <path d="M10 9l5 3-5 3V9z"/>
</svg>`;

const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

/**
 * @param {HTMLElement} container
 * @param {object[]} items
 * @param {object} [opts]
 * @param {Function} [opts.onSelect]      called with (item) when card or title is clicked
 * @param {Function} [opts.onAddToList]   called with (item) when add-to-list is clicked
 * @param {Function} [opts.getListCount]  returns number of lists item belongs to
 */
export function renderGrid(container, items, { onSelect, onAddToList, getListCount } = {}) {
  container.innerHTML = '';

  for (const item of items) {
    const article = document.createElement('article');
    article.className = 'card';
    article.setAttribute('role', 'listitem');
    article.setAttribute('tabindex', '0');

    const title =
      item.name ??
      item.title ??
      item.series_name ??
      '(No title)';

    const posterSrc = proxyImageUrl(
      item.stream_icon ??
      item.cover ??
      item.backdrop_path ??
      item.poster_path ??
      null
    );

    const rating = parseFloat(item.rating ?? item.rating_5based ?? 0);
    const year = item.releaseDate?.slice(0, 4) ?? item.year ?? null;
    const listCount = getListCount?.(item) ?? 0;

    article.innerHTML = `
      ${rating > 0 ? `<span class="card-rating-badge" aria-label="Rating ${rating.toFixed(1)}">${rating.toFixed(1)}</span>` : ''}
      ${listCount > 0 ? `<span class="card-list-badge" aria-label="In ${listCount} list(s)">${listCount}</span>` : ''}
      ${
        posterSrc
          ? `<img class="card-poster" src="${escapeAttr(posterSrc)}" alt="${escapeAttr(title)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.hidden=false;" /><div class="card-poster-placeholder" hidden aria-hidden="true">${PLACEHOLDER_SVG}</div>`
          : `<div class="card-poster-placeholder" aria-hidden="true">${PLACEHOLDER_SVG}</div>`
      }
      <div class="card-body">
        <h3 class="card-title" title="${escapeAttr(title)}">${escapeHtml(title)}</h3>
        ${year ? `<p class="card-year">${escapeHtml(year)}</p>` : ''}
        <div class="card-actions">
          <button class="card-action-btn add-list js-add-list${listCount > 0 ? ' is-in-list' : ''}" type="button" aria-label="${listCount > 0 ? 'Manage lists' : 'Add to list'}">
            ${PLUS_ICON} ${listCount > 0 ? 'In list' : 'Add to list'}
          </button>
        </div>
      </div>
    `;

    article.dataset.id = String(
      item.stream_id ?? item.series_id ?? item.vod_id ?? item.id ?? ''
    );

    // Click anywhere on the card (except the add-list button) → open detail modal
    if (onSelect) {
      article.addEventListener('click', (e) => {
        if (e.target.closest('.js-add-list')) return;
        onSelect(item);
      });
      article.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      });
    }

    const addBtn = article.querySelector('.js-add-list');
    if (onAddToList) {
      addBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        onAddToList(item);
      });
    }

    container.appendChild(article);
  }
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

export function sortItems(items, criterion) {
  const clone = [...items];
  switch (criterion) {
    case 'rating':
      return clone.sort(
        (a, b) =>
          parseFloat(b.rating ?? b.rating_5based ?? 0) -
          parseFloat(a.rating ?? a.rating_5based ?? 0)
      );
    case 'added':
      return clone.sort(
        (a, b) =>
          parseInt(b.added ?? b.last_modified ?? 0, 10) -
          parseInt(a.added ?? a.last_modified ?? 0, 10)
      );
    case 'name':
    default:
      return clone.sort((a, b) =>
        (a.name ?? a.title ?? '').localeCompare(b.name ?? b.title ?? '', 'sv')
      );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
