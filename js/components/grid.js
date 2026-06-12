/**
 * Content grid renderer.
 * Renders an array of VOD/series items as article cards into a container.
 */

import { proxyImageUrl } from '../utils/imageProxy.js';

const PLACEHOLDER_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <path d="M10 9l5 3-5 3V9z"/>
</svg>`;

const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

/**
 * @param {HTMLElement} container
 * @param {object[]} items
 * @param {object} [opts]
 * @param {Function} [opts.onSelect]   called with (item) when card is clicked
 * @param {Function} [opts.getListCount]  returns number of lists item belongs to
 */
export function renderGrid(container, items, { onSelect, getListCount } = {}) {
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
      '(Ingen titel)';

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
      ${listCount > 0 ? `<span class="card-list-badge" aria-label="Finns i ${listCount} lista(r)">${listCount}</span>` : ''}
      ${
        posterSrc
          ? `<img class="card-poster" src="${escapeAttr(posterSrc)}" alt="${escapeAttr(title)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.hidden=false;" /><div class="card-poster-placeholder" hidden aria-hidden="true">${PLACEHOLDER_SVG}</div>`
          : `<div class="card-poster-placeholder" aria-hidden="true">${PLACEHOLDER_SVG}</div>`
      }
      <div class="card-body">
        <h3 class="card-title" title="${escapeAttr(title)}">${escapeHtml(title)}</h3>
        <div class="card-meta">
          ${rating > 0 ? `<span class="card-rating">${STAR_SVG}${rating.toFixed(1)}</span>` : ''}
          ${year ? `<span>${escapeHtml(year)}</span>` : ''}
        </div>
      </div>
    `;

    article.dataset.id = String(
      item.stream_id ?? item.series_id ?? item.vod_id ?? item.id ?? ''
    );

    if (onSelect) {
      article.addEventListener('click', () => onSelect(item));
      article.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
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
