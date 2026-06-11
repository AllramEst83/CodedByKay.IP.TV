/**
 * Detail modal component.
 * Uses the native <dialog> element.
 */

import { getVodInfo, getSeriesInfo } from '../api/xtream.js';
import { proxyImageUrl } from '../utils/imageProxy.js';

const PLACEHOLDER_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <path d="M10 9l5 3-5 3V9z"/>
</svg>`;

const STAR_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

let _pin = null;
let _onListAction = null;

/** @param {string} pin */
export function initModal(pin, onListAction) {
  _pin = pin;
  _onListAction = onListAction;

  const dialog = document.getElementById('detail-modal');
  const closeBtn = dialog.querySelector('.modal-close');

  closeBtn.addEventListener('click', () => dialog.close());

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dialog.close();
  });
}

/**
 * Opens the detail modal for a VOD item.
 * @param {object} item
 */
export async function openVodModal(item, getItemListsFn) {
  const dialog = document.getElementById('detail-modal');
  const loadingEl = document.getElementById('modal-loading');
  const contentEl = document.getElementById('modal-content');

  loadingEl.hidden = false;
  contentEl.hidden = true;
  contentEl.innerHTML = '';
  dialog.showModal();

  try {
    const id = item.stream_id ?? item.vod_id ?? item.id;
    const data = await getVodInfo(_pin, id);
    const info = data?.info ?? {};
    const movieData = data?.movie_data ?? item;

    renderModalContent(contentEl, {
      title: info.name ?? movieData.name ?? item.name ?? '(Ingen titel)',
      poster: proxyImageUrl(info.movie_image ?? item.stream_icon ?? null),
      backdrop: proxyImageUrl(info.backdrop_path?.[0] ?? null),
      rating: info.rating ?? movieData.rating ?? item.rating ?? null,
      year: info.releasedate?.slice(0, 4) ?? movieData.releaseDate?.slice(0, 4) ?? null,
      genre: info.genre ?? null,
      director: info.director ?? null,
      plot: info.plot ?? null,
      cast: info.cast ?? null,
      item,
      getItemListsFn,
      type: 'vod',
    });
  } catch (err) {
    contentEl.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
  } finally {
    loadingEl.hidden = true;
    contentEl.hidden = false;
  }
}

/**
 * Opens the detail modal for a series item.
 * @param {object} item
 */
export async function openSeriesModal(item, getItemListsFn) {
  const dialog = document.getElementById('detail-modal');
  const loadingEl = document.getElementById('modal-loading');
  const contentEl = document.getElementById('modal-content');

  loadingEl.hidden = false;
  contentEl.hidden = true;
  contentEl.innerHTML = '';
  dialog.showModal();

  try {
    const id = item.series_id ?? item.id;
    const data = await getSeriesInfo(_pin, id);
    const info = data?.info ?? {};

    renderModalContent(contentEl, {
      title: info.name ?? item.name ?? '(Ingen titel)',
      poster: proxyImageUrl(info.cover ?? item.cover ?? null),
      backdrop: proxyImageUrl(info.backdrop_path ?? null),
      rating: info.rating ?? item.rating ?? null,
      year: info.releaseDate?.slice(0, 4) ?? null,
      genre: info.genre ?? null,
      director: info.director ?? null,
      plot: info.plot ?? null,
      cast: info.cast ?? null,
      item,
      getItemListsFn,
      type: 'series',
    });
  } catch (err) {
    contentEl.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
  } finally {
    loadingEl.hidden = true;
    contentEl.hidden = false;
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderModalContent(container, { title, poster, backdrop, rating, year, genre, director, plot, cast, item, getItemListsFn, type }) {
  const rating_num = parseFloat(rating ?? 0);
  const listsContaining = getItemListsFn?.(item) ?? [];

  container.innerHTML = `
    ${backdrop ? `<div class="modal-backdrop" style="background-image:url('${escapeAttr(backdrop)}')" aria-hidden="true"></div>` : ''}
    <div class="modal-detail">
      <div class="modal-poster-col">
        ${poster
          ? `<img class="modal-poster" src="${escapeAttr(poster)}" alt="${escapeAttr(title)}" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.hidden=false;" /><div class="modal-poster-placeholder" hidden aria-hidden="true">${PLACEHOLDER_SVG}</div>`
          : `<div class="modal-poster-placeholder" aria-hidden="true">${PLACEHOLDER_SVG}</div>`
        }
      </div>
      <div class="modal-info-col">
        <h2 class="modal-info-title">${escapeHtml(title)}</h2>
        <div class="modal-meta-row">
          ${rating_num > 0 ? `<span class="modal-badge rating">${STAR_SVG} ${rating_num.toFixed(1)}</span>` : ''}
          ${year ? `<span class="modal-badge">${escapeHtml(year)}</span>` : ''}
          ${genre ? `<span class="modal-badge">${escapeHtml(genre)}</span>` : ''}
          ${director ? `<span class="modal-badge">Regi: ${escapeHtml(director)}</span>` : ''}
        </div>
        ${plot ? `<p class="modal-plot">${escapeHtml(plot)}</p>` : ''}
        ${cast ? `
          <p class="modal-section-label">Medverkande</p>
          <p class="modal-cast">${escapeHtml(cast)}</p>
        ` : ''}
        <div class="modal-actions">
          <button class="btn btn-primary js-manage-lists" type="button">
            ${listsContaining.length > 0 ? '✓ Hantera i listor' : '+ Lägg till i lista'}
          </button>
        </div>
        ${listsContaining.length > 0
          ? `<p style="margin-top:8px;font-size:.8rem;color:var(--text-muted)">Finns i: ${listsContaining.map(escapeHtml).join(', ')}</p>`
          : ''}
      </div>
    </div>
  `;

  container.querySelector('.js-manage-lists')?.addEventListener('click', () => {
    _onListAction?.(item, type);
  });
}

// ─── Lists modal (add/remove from list) ───────────────────────────────────────

export function openListsModal(item, listsMap, toggleFn) {
  const dialog = document.getElementById('lists-modal');
  const body = document.getElementById('lists-modal-body');
  const closeBtn = dialog.querySelector('.modal-close');

  const renderBody = () => {
    body.innerHTML = '';

    if (listsMap.size === 0) {
      body.innerHTML = '<p class="no-lists-hint">Inga listor skapade ännu. Gå till "Mina Listor" för att skapa en.</p>';
      return;
    }

    for (const [name] of listsMap) {
      const { addToList, isInList } = window.__iptv_store__;
      const inList = isInList(name, item);

      const row = document.createElement('button');
      row.type = 'button';
      row.className = `list-toggle-row${inList ? ' in-list' : ''}`;
      row.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <span class="list-check">
          ${inList ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </span>
      `;
      row.addEventListener('click', () => {
        toggleFn(name, item);
        renderBody();
      });
      body.appendChild(row);
    }
  };

  renderBody();

  const onClose = () => {
    closeBtn.removeEventListener('click', onClose);
    dialog.removeEventListener('click', outsideClick);
  };
  const outsideClick = (e) => { if (e.target === dialog) { dialog.close(); onClose(); } };

  closeBtn.addEventListener('click', () => { dialog.close(); onClose(); });
  dialog.addEventListener('click', outsideClick);

  dialog.showModal();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
