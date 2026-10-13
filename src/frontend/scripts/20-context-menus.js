// Suppress only the browser menu. Keep events flowing to system context handlers.
document.addEventListener('contextmenu', event => event.preventDefault(), true);

function abearcActionDetails(target) {
  const details = target.closest('details');
  if (details && /actions/i.test(details.querySelector('summary')?.getAttribute('aria-label') || '')) return details;
  return target.closest('.abearc-map-results-head')?.querySelector('.abearc-map-results-menu') || null;
}

document.addEventListener('click', event => {
  const own = event.target.closest('details');
  document.querySelectorAll('#mapPage details[open]').forEach(menu => {
    if (menu !== own && (menu.matches('.abearc-map-measure-export') || /actions/i.test(menu.querySelector('summary')?.getAttribute('aria-label') || ''))) menu.open = false;
  });
}, true);

document.addEventListener('contextmenu', event => {
  document.querySelectorAll('#mapPage .abearc-map-measure-context-menu').forEach(menu => {
    if (!menu.contains(event.target)) menu.classList.add('hidden');
  });
  const own = abearcActionDetails(event.target);
  document.querySelectorAll('#mapPage details[open]').forEach(menu => {
    if (menu !== own && (menu.matches('.abearc-map-measure-export') || /actions/i.test(menu.querySelector('summary')?.getAttribute('aria-label') || ''))) menu.open = false;
  });
  if (own && !own.classList.contains('abearc-map-layout-card-menu')) own.open = true;
}, true);

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('#mapPage .abearc-map-measure-export[open]').forEach(menu => {
    menu.open = false;
    menu.querySelector('summary')?.focus();
  });
});
