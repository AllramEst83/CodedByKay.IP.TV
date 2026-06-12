/**
 * Random fun loaders — picks a variant each time one is mounted.
 */

const VARIANTS = ['washing-machine', 'ice-cream', 'polar-bear'];

/**
 * @param {HTMLElement|null} container
 */
export function mountRandomLoader(container) {
  if (!container) return;

  const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  container.innerHTML = '';
  const el = document.createElement('span');
  el.className = `fun-loader fun-loader--${variant}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Loading');
  container.appendChild(el);
}

/**
 * @param {HTMLElement|null} loadingEl  `.loading` wrapper (must contain `.loader-slot`)
 */
export function showLoadingState(loadingEl) {
  if (!loadingEl) return;
  mountRandomLoader(loadingEl.querySelector('.loader-slot'));
  loadingEl.hidden = false;
}
