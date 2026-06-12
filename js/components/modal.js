/**
 * Detail modal component.
 * Uses the native <dialog> element.
 */

import { getVodInfo, getSeriesInfo } from '../api/xtream.js';
import { proxyImageUrl } from '../utils/imageProxy.js';
import { bindAllImageShimmers } from '../utils/imageLoad.js';
import { mountRandomLoader } from '../utils/loader.js';

const PLACEHOLDER_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <path d="M10 9l5 3-5 3V9z"/>
</svg>`;

const STAR_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

let _pin = null;
let _onListAction = null;
let _onDetailClose = null;

/** @param {string} pin */
export function initModal(pin, onListAction, onDetailClose) {
  _pin = pin;
  _onListAction = onListAction;
  _onDetailClose = onDetailClose;

  const dialog = document.getElementById('detail-modal');
  const closeBtn = dialog.querySelector('.modal-close');

  closeBtn.addEventListener('click', () => dialog.close());

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dialog.close();
  });

  dialog.addEventListener('close', () => {
    _onDetailClose?.();
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
  mountRandomLoader(loadingEl.querySelector('.loader-slot'));
  dialog.showModal();

  try {
    const id = item.stream_id ?? item.vod_id ?? item.id;
    const data = await getVodInfo(_pin, id);
    const info = data?.info ?? {};
    const movieData = data?.movie_data ?? item;

    const backdropRaw = Array.isArray(info.backdrop_path)
      ? info.backdrop_path[0]
      : (info.backdrop_path ?? null);

    const displayTitle = info.name ?? movieData.name ?? item.name ?? '(Ingen titel)';
    const origTitle = info.o_name?.trim();

    renderModalContent(contentEl, {
      title: displayTitle,
      originalTitle: origTitle && origTitle !== displayTitle ? origTitle : null,
      poster: proxyImageUrl(info.cover_big ?? info.movie_image ?? item.stream_icon ?? null),
      backdrop: proxyImageUrl(backdropRaw),
      rating: info.rating ?? movieData.rating ?? item.rating ?? null,
      year: formatYear(info.releasedate ?? movieData.releaseDate ?? null),
      duration: formatDuration(info.duration ?? info.duration_secs ?? null),
      genre: info.genre ?? null,
      director: info.director ?? null,
      plot: info.plot ?? info.description ?? null,
      cast: info.cast ?? info.actors ?? null,
      country: info.country ?? null,
      trailerId: info.youtube_trailer ?? item.trailer ?? null,
      tmdbUrl: info.kinopoisk_url ?? (info.tmdb_id ? `https://www.themoviedb.org/movie/${info.tmdb_id}` : null),
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
  mountRandomLoader(loadingEl.querySelector('.loader-slot'));
  dialog.showModal();

  try {
    const id = item.series_id ?? item.id;
    const data = await getSeriesInfo(_pin, id);
    const info = data?.info ?? {};

    const backdropRaw = Array.isArray(info.backdrop_path)
      ? info.backdrop_path[0]
      : (info.backdrop_path ?? null);

    const displayTitle = info.name ?? item.name ?? '(Ingen titel)';
    const origTitle = info.o_name?.trim();
    const epRuntime = info.episode_run_time;
    const durationStr = epRuntime ? `~${epRuntime}m / ep` : null;

    renderModalContent(contentEl, {
      title: displayTitle,
      originalTitle: origTitle && origTitle !== displayTitle ? origTitle : null,
      poster: proxyImageUrl(info.cover_big ?? info.cover ?? item.cover ?? null),
      backdrop: proxyImageUrl(backdropRaw),
      rating: info.rating ?? item.rating ?? null,
      year: formatYear(info.releaseDate ?? item.releaseDate ?? null),
      duration: durationStr,
      genre: info.genre ?? null,
      director: info.director ?? null,
      plot: info.plot ?? info.description ?? null,
      cast: info.cast ?? info.actors ?? null,
      country: info.country ?? null,
      trailerId: info.youtube_trailer ?? item.trailer ?? null,
      tmdbUrl: info.kinopoisk_url ?? (info.tmdb_id ? `https://www.themoviedb.org/tv/${info.tmdb_id}` : null),
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

function renderModalContent(container, {
  title, originalTitle, poster, backdrop, rating, year, duration,
  genre, director, plot, cast, country, trailerId, tmdbUrl,
  item, getItemListsFn, type,
}) {
  const rating_num = parseFloat(rating ?? 0);
  const listsContaining = getItemListsFn?.(item) ?? [];
  const starsHtml = rating_num > 0 ? buildStars(rating_num) : '';
  const genreBadges = genre
    ? String(genre).split(',').map(g => g.trim()).filter(Boolean)
        .map(g => `<span class="modal-badge modal-badge--genre">${escapeHtml(g)}</span>`).join('')
    : '';

  container.innerHTML = `
    ${backdrop ? `<div class="modal-backdrop" style="background-image:url('${escapeAttr(backdrop)}')" aria-hidden="true"></div>` : ''}
    <div class="modal-detail">
      <div class="modal-poster-col">
        ${poster
          ? `<div class="poster-wrap modal-poster-wrap"><img class="modal-poster" src="${escapeAttr(poster)}" alt="${escapeAttr(title)}" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.hidden=false;" /><div class="modal-poster-placeholder" hidden aria-hidden="true">${PLACEHOLDER_SVG}</div></div>`
          : `<div class="modal-poster-placeholder" aria-hidden="true">${PLACEHOLDER_SVG}</div>`
        }
      </div>
      <div class="modal-info-col">
        <h2 class="modal-info-title">${escapeHtml(title)}</h2>
        ${originalTitle ? `<p class="modal-original-title">${escapeHtml(originalTitle)}</p>` : ''}
        <div class="modal-meta-row">
          ${rating_num > 0 ? `
            <span class="modal-stars" aria-label="Rating ${rating_num.toFixed(1)} out of 10">${starsHtml}</span>
            <span class="modal-rating-num">${rating_num.toFixed(1)}</span>
          ` : ''}
          ${year ? `<span class="modal-badge">${escapeHtml(year)}</span>` : ''}
          ${duration ? `<span class="modal-badge modal-badge--meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${escapeHtml(duration)}
          </span>` : ''}
          ${country ? `<span class="modal-badge modal-badge--meta">${escapeHtml(country)}</span>` : ''}
        </div>
        ${genreBadges ? `<div class="modal-genre-row">${genreBadges}</div>` : ''}
        ${director ? `<p class="modal-director"><span class="modal-section-label">Director</span> ${escapeHtml(director)}</p>` : ''}
        ${plot ? `<p class="modal-plot">${escapeHtml(plot)}</p>` : ''}
        ${cast ? `
          <p class="modal-section-label">Cast</p>
          <p class="modal-cast">${escapeHtml(cast)}</p>
        ` : ''}
        <div class="modal-actions">
          <button class="btn btn-primary js-manage-lists" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            ${listsContaining.length > 0 ? 'Manage Lists' : 'Add to List'}
          </button>
          ${trailerId ? `
            <a class="btn btn-secondary modal-trailer-btn"
               href="https://www.youtube.com/watch?v=${escapeAttr(trailerId)}"
               target="_blank" rel="noopener noreferrer" aria-label="Watch trailer on YouTube">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C16.2 2.8 12 2.8 12 2.8s-4.2 0-6.8.1c-.6.1-1.9.1-3 1.3C1.3 5 1 7 1 7S.7 9.1.7 11.3v2c0 2.1.3 4.3.3 4.3s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C7.3 21.8 12 21.8 12 21.8s4.2 0 6.8-.2c.6-.1 1.9-.1 3-1.3.9-.8 1.2-2.8 1.2-2.8s.3-2.1.3-4.3v-2C23.3 9.1 23 7 23 7zM9.7 15.5V8.4l8.1 3.6-8.1 3.5z"/></svg>
              Trailer
            </a>
          ` : ''}
          ${tmdbUrl ? `
            <a class="btn btn-ghost modal-tmdb-btn"
               href="${escapeAttr(tmdbUrl)}"
               target="_blank" rel="noopener noreferrer" aria-label="View on TMDB">
              TMDB
            </a>
          ` : ''}
        </div>
        ${listsContaining.length > 0
          ? `<p class="modal-in-lists">In lists: ${listsContaining.map(escapeHtml).join(', ')}</p>`
          : ''}
      </div>
    </div>
  `;

  container.querySelector('.js-manage-lists')?.addEventListener('click', () => {
    _onListAction?.(item, type);
  });

  bindAllImageShimmers(container);
}

function buildStars(rating10) {
  // rating10 is 0–10; display as 5 stars
  const filled = Math.round((rating10 / 10) * 5);
  const STAR_FULL  = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  const STAR_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  let html = '';
  for (let i = 0; i < 5; i++) html += i < filled ? STAR_FULL : STAR_EMPTY;
  return html;
}

// ─── Lists modal (add/remove from list) ───────────────────────────────────────

/**
 * @param {object} item
 * @param {Map<string, object[]>} listsMap
 * @param {{ isInList: (name: string, item: object) => boolean, onToggle: (name: string, item: object) => void, onCreateAndAdd: (name: string, item: object) => 'ok'|'empty'|'duplicate' }} handlers
 */
export function openListsModal(item, listsMap, handlers) {
  const dialog = document.getElementById('lists-modal');
  const body = document.getElementById('lists-modal-body');
  const closeBtn = dialog.querySelector('.modal-close');

  const renderBody = () => {
    body.innerHTML = '';

    const createForm = document.createElement('form');
    createForm.className = 'lists-modal-create';
    createForm.innerHTML = `
      <input
        type="text"
        class="input lists-modal-create-input"
        placeholder="New list name…"
        aria-label="New list name"
        maxlength="60"
        autocomplete="off"
      />
      <button type="submit" class="btn btn-primary btn-sm">Create &amp; add</button>
    `;

    const createError = document.createElement('p');
    createError.className = 'lists-modal-create-error';
    createError.hidden = true;
    createError.setAttribute('role', 'alert');

    const sectionLabel = document.createElement('p');
    sectionLabel.className = 'lists-modal-section-label';
    sectionLabel.textContent = 'Your lists';

    const listWrap = document.createElement('div');
    listWrap.className = 'lists-modal-list';

    if (listsMap.size === 0) {
      const empty = document.createElement('p');
      empty.className = 'lists-modal-empty';
      empty.textContent = 'No lists yet — create one above.';
      listWrap.appendChild(empty);
    } else {
      for (const [name] of listsMap) {
        const inList = handlers.isInList(name, item);

        const row = document.createElement('button');
        row.type = 'button';
        row.className = `list-toggle-row${inList ? ' in-list' : ''}`;
        row.innerHTML = `
          <span>${escapeHtml(name)}</span>
          <span class="list-check" aria-hidden="true">
            ${inList ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
          </span>
        `;
        row.setAttribute('aria-pressed', String(inList));
        row.setAttribute('aria-label', inList ? `Remove from ${name}` : `Add to ${name}`);
        row.addEventListener('click', () => {
          handlers.onToggle(name, item);
          renderBody();
        });
        listWrap.appendChild(row);
      }
    }

    body.appendChild(createForm);
    body.appendChild(createError);
    body.appendChild(sectionLabel);
    body.appendChild(listWrap);

    const input = createForm.querySelector('.lists-modal-create-input');

    createForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      const result = handlers.onCreateAndAdd(name, item);

      if (result === 'empty') {
        createError.textContent = 'Enter a list name.';
        createError.hidden = false;
        input.focus();
        return;
      }
      if (result === 'duplicate') {
        createError.textContent = 'A list with that name already exists.';
        createError.hidden = false;
        input.focus();
        return;
      }

      createError.hidden = true;
      input.value = '';
      renderBody();
    });
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

function formatYear(value) {
  if (value == null || value === '') return null;
  const str = String(value).trim();
  const match = str.match(/\d{4}/);
  return match ? match[0] : null;
}

function formatDuration(value) {
  if (value == null || value === '') return null;
  const str = String(value).trim();
  // "HH:MM:SS" format
  const hms = str.match(/^(\d+):(\d{2}):\d{2}$/);
  if (hms) {
    const h = parseInt(hms[1], 10);
    const m = parseInt(hms[2], 10);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
  }
  // Raw seconds
  const secs = parseInt(str, 10);
  if (!isNaN(secs) && secs > 60) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
  }
  return null;
}
