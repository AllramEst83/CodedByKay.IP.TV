/**
 * Genre filter component (factory).
 *
 * Usage:
 *   const gf = createGenreFilter(containerEl, (selectedSet) => { ... });
 *   gf.addGenres(['Drama', 'Action']);
 *   gf.setLoading(true, 10, 200);
 *   gf.reset();
 */

/**
 * Parse a raw Xtream genre string into an array of individual genre names.
 * "Drama, Action, Thriller" → ["Drama", "Action", "Thriller"]
 *
 * @param {string|null|undefined} genreStr
 * @returns {string[]}
 */
export function parseGenreString(genreStr) {
  if (!genreStr) return [];
  return genreStr
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);
}

/**
 * Create a self-contained genre filter bound to `containerEl`.
 *
 * @param {HTMLElement} containerEl  The wrapper element to render chips into
 * @param {Function}    onChange     Called with a Set<string> of selected genres
 *                                   whenever the selection changes
 * @returns {{ addGenres, setLoading, getSelected, reset }}
 */
export function createGenreFilter(containerEl, onChange) {
  /** @type {Set<string>} */
  let selected = new Set();
  /** @type {Set<string>} */
  let genres = new Set();
  let loading = false;
  let loadedCount = 0;
  let totalCount = 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  function render() {
    if (!containerEl) return;

    if (genres.size === 0 && !loading) {
      containerEl.hidden = true;
      return;
    }

    containerEl.hidden = false;

    const sorted = [...genres].sort((a, b) => a.localeCompare(b, 'sv'));

    const chipsHtml = sorted.map(g => {
      const active = selected.has(g);
      return `<button
        class="genre-chip${active ? ' is-active' : ''}"
        data-genre="${escAttr(g)}"
        type="button"
        aria-pressed="${active}"
      >${escHtml(g)}</button>`;
    }).join('');

    const loadingHtml = loading
      ? `<span class="genre-loading-text" aria-live="polite">Loading genres… ${loadedCount}/${totalCount}</span>`
      : '';

    const clearHtml = selected.size > 0
      ? `<button class="genre-clear-btn" type="button" aria-label="Clear genre filter">✕ Clear</button>`
      : '';

    containerEl.innerHTML = `
      <button class="genre-scroll-btn genre-scroll-left" type="button" aria-label="Scroll genres left" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="genre-chips-track">
        <div class="genre-chips">${chipsHtml}${loadingHtml}${clearHtml}</div>
      </div>
      <button class="genre-scroll-btn genre-scroll-right" type="button" aria-label="Scroll genres right" hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    `;

    // Wire up chip clicks
    containerEl.querySelectorAll('.genre-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.genre;
        if (selected.has(g)) selected.delete(g);
        else selected.add(g);
        onChange(new Set(selected));
        render();
      });
    });

    containerEl.querySelector('.genre-clear-btn')?.addEventListener('click', () => {
      selected.clear();
      onChange(new Set());
      render();
    });

    // Wire up scroll arrows
    const track = containerEl.querySelector('.genre-chips-track');
    const leftBtn = containerEl.querySelector('.genre-scroll-left');
    const rightBtn = containerEl.querySelector('.genre-scroll-right');

    if (track && leftBtn && rightBtn) {
      const SCROLL_STEP = 240;

      const updateArrows = () => {
        const canScrollLeft  = track.scrollLeft > 4;
        const canScrollRight = track.scrollLeft < track.scrollWidth - track.clientWidth - 4;
        leftBtn.hidden  = !canScrollLeft;
        rightBtn.hidden = !canScrollRight;
      };

      leftBtn.addEventListener('click',  () => { track.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' }); });
      rightBtn.addEventListener('click', () => { track.scrollBy({ left:  SCROLL_STEP, behavior: 'smooth' }); });
      track.addEventListener('scroll', updateArrows, { passive: true });

      // Use ResizeObserver so arrows update when the container resizes
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(updateArrows).observe(track);
      }

      // Initial state
      updateArrows();
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    /**
     * Add genres to the filter panel.
     * Accepts an iterable of genre name strings.
     * Only re-renders when new genres are actually added.
     *
     * @param {Iterable<string>} newGenres
     */
    addGenres(newGenres) {
      let changed = false;
      for (const g of newGenres) {
        if (g && !genres.has(g)) {
          genres.add(g);
          changed = true;
        }
      }
      if (changed) render();
    },

    /**
     * Update the loading indicator.
     * @param {boolean} isLoading
     * @param {number}  loaded
     * @param {number}  total
     */
    setLoading(isLoading, loaded, total) {
      loading = isLoading;
      loadedCount = loaded;
      totalCount = total;
      render();
    },

    /** @returns {Set<string>} Copy of currently selected genres */
    getSelected() {
      return new Set(selected);
    },

    /**
     * Reset all state — clears selection, genre list, and hides the container.
     * Call before loading a new category.
     */
    reset() {
      selected = new Set();
      genres = new Set();
      loading = false;
      loadedCount = 0;
      totalCount = 0;
      if (containerEl) {
        containerEl.hidden = true;
        containerEl.innerHTML = '';
      }
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
