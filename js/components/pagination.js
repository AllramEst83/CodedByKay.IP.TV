/**
 * Pagination component.
 *
 * Slices a pre-filtered + pre-sorted array and renders page controls.
 * Works independently of how items were loaded/filtered.
 */

export const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Slices items for the given page.
 *
 * @param {object[]} items  — already filtered & sorted
 * @param {number}   page
 * @param {number}   pageSize
 * @returns {{ items: object[], page: number, totalPages: number, total: number, pageSize: number }}
 */
export function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    total,
    pageSize,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}

/**
 * Renders pagination controls into `container`.
 *
 * @param {HTMLElement} container
 * @param {{ page, totalPages, total, pageSize, hasPrev, hasNext }} state
 * @param {Function} onChange  called with (newPage, newPageSize)
 */
export function renderPagination(container, state, onChange) {
  container.innerHTML = '';

  if (state.total === 0) return;

  const { page, totalPages, total, pageSize, hasPrev, hasNext } = state;

  const wrap = document.createElement('div');
  wrap.className = 'pagination';

  // ── Info text ──
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const info = document.createElement('span');
  info.className = 'pagination-info';
  info.textContent = `${start}–${end} av ${total}`;
  wrap.appendChild(info);

  // ── Controls ──
  const controls = document.createElement('div');
  controls.className = 'pagination-controls';

  // Prev
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'page-btn';
  prevBtn.setAttribute('aria-label', 'Föregående sida');
  prevBtn.disabled = !hasPrev;
  prevBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
  prevBtn.addEventListener('click', () => onChange(page - 1, pageSize));
  controls.appendChild(prevBtn);

  // Page buttons (show up to 7 pages)
  const pageButtons = buildPageRange(page, totalPages);
  for (const p of pageButtons) {
    if (p === '…') {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-ellipsis';
      ellipsis.textContent = '…';
      controls.appendChild(ellipsis);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `page-btn${p === page ? ' is-active' : ''}`;
      btn.textContent = String(p);
      if (p !== page) btn.addEventListener('click', () => onChange(p, pageSize));
      controls.appendChild(btn);
    }
  }

  // Next
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'page-btn';
  nextBtn.setAttribute('aria-label', 'Nästa sida');
  nextBtn.disabled = !hasNext;
  nextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
  nextBtn.addEventListener('click', () => onChange(page + 1, pageSize));
  controls.appendChild(nextBtn);

  wrap.appendChild(controls);

  // ── Page size selector ──
  const sizeWrap = document.createElement('div');
  sizeWrap.className = 'pagination-size';

  const sizeLabel = document.createElement('label');
  sizeLabel.textContent = 'Visa:';
  sizeLabel.className = 'pagination-size-label';

  const sizeSelect = document.createElement('select');
  sizeSelect.className = 'select select-sm';
  sizeSelect.setAttribute('aria-label', 'Antal per sida');

  for (const size of PAGE_SIZE_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = String(size);
    opt.textContent = String(size);
    opt.selected = size === pageSize;
    sizeSelect.appendChild(opt);
  }

  sizeSelect.addEventListener('change', () => {
    onChange(1, parseInt(sizeSelect.value, 10));
  });

  sizeWrap.appendChild(sizeLabel);
  sizeWrap.appendChild(sizeSelect);
  wrap.appendChild(sizeWrap);

  container.appendChild(wrap);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [];

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '…', total);
  } else if (current >= total - 3) {
    pages.push(1, '…', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '…', current - 1, current, current + 1, '…', total);
  }

  return pages;
}
