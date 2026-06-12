/**
 * Collapsible filter/search toolbar on narrow viewports.
 */

const MOBILE_MQ = window.matchMedia('(max-width: 768px)');

/**
 * @param {HTMLElement} toolbar
 * @param {{ getSummary?: () => string }} [opts]
 */
export function initToolbarCollapse(toolbar, { getSummary } = {}) {
  if (!toolbar || toolbar.dataset.collapseInit) return;
  toolbar.dataset.collapseInit = 'true';

  const toggle = toolbar.querySelector('.toolbar-mobile-toggle');
  const panel = toolbar.querySelector('.toolbar-panel');
  const summaryEl = toolbar.querySelector('.toolbar-mobile-summary');
  if (!toggle || !panel) return;

  const updateSummary = () => {
    if (summaryEl && getSummary) {
      const text = getSummary();
      summaryEl.textContent = text;
      summaryEl.hidden = !text;
    }
  };

  const setExpanded = (expanded) => {
    toolbar.classList.toggle('is-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
  };

  toggle.addEventListener('click', () => {
    setExpanded(!toolbar.classList.contains('is-expanded'));
  });

  const onViewportChange = () => {
    if (!MOBILE_MQ.matches) {
      setExpanded(true);
    } else if (!toolbar.classList.contains('is-expanded')) {
      setExpanded(false);
    }
  };

  MOBILE_MQ.addEventListener('change', onViewportChange);
  onViewportChange();
  updateSummary();

  toolbar._updateToolbarSummary = updateSummary;
}

/**
 * @param {'movies'|'series'} prefix
 */
export function setupViewToolbar(prefix) {
  const toolbar = document.querySelector(`#view-${prefix} .view-toolbar`);
  const categorySelect = document.getElementById(`${prefix}-category`);
  const searchInput = document.getElementById(`${prefix}-search`);
  const sortSelect = document.getElementById(`${prefix}-sort`);

  const getSummary = () => {
    const parts = [];
    const catOpt = categorySelect?.selectedOptions?.[0];
    if (categorySelect?.value && catOpt && !catOpt.disabled) {
      parts.push(catOpt.textContent.trim());
    }
    if (searchInput?.value.trim()) {
      parts.push(`"${searchInput.value.trim()}"`);
    }
    const sortOpt = sortSelect?.selectedOptions?.[0];
    if (sortSelect?.value && sortSelect.value !== 'name' && sortOpt) {
      parts.push(sortOpt.textContent.trim());
    }
    return parts.join(' · ');
  };

  initToolbarCollapse(toolbar, { getSummary });

  for (const el of [categorySelect, searchInput, sortSelect]) {
    el?.addEventListener('change', () => toolbar?._updateToolbarSummary?.());
    el?.addEventListener('input', () => toolbar?._updateToolbarSummary?.());
  }
}
