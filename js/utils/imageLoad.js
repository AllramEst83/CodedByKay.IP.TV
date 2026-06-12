/**
 * Shimmer placeholder while poster images load.
 * @param {HTMLImageElement} img
 */
export function bindImageShimmer(img) {
  if (!img) return;

  const wrap = img.closest('.poster-wrap');
  if (!wrap) return;

  const finish = () => {
    wrap.classList.remove('poster-shimmer');
    img.classList.add('is-loaded');
  };

  if (img.complete && img.naturalWidth > 0) {
    finish();
    return;
  }

  wrap.classList.add('poster-shimmer');
  img.addEventListener('load', finish, { once: true });
  img.addEventListener('error', finish, { once: true });
}

/**
 * @param {ParentNode} root
 */
export function bindAllImageShimmers(root) {
  root.querySelectorAll('.poster-wrap img').forEach(bindImageShimmer);
}
