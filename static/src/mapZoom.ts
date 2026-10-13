// Leaflet's wheel zoom hijacks page scrolling, so it stays off until Ctrl (or ⌘) is held.
// A short hint appears when someone scrolls over the map without the key.
export function ctrlScrollZoom(map: any, container: HTMLElement) {
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  const hint = document.createElement('div');
  hint.className = 'map-scroll-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = `Hold ${modifier} and scroll to zoom`;
  container.appendChild(hint);
  let timer: number | undefined;
  const setZoom = (on: boolean) => on ? map.scrollWheelZoom.enable() : map.scrollWheelZoom.disable();
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Control' || event.key === 'Meta') setZoom(event.type === 'keydown'); };
  const onBlur = () => setZoom(false);
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) { hint.classList.remove('show'); return; }
    hint.classList.add('show');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => hint.classList.remove('show'), 1200);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', onBlur);
  container.addEventListener('wheel', onWheel, { passive: true });
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', onBlur);
    container.removeEventListener('wheel', onWheel);
    hint.remove();
  };
}
