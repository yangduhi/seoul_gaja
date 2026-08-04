const DETAIL_ENTRY = 'sheet';
const DETAIL_PREFIX = '/places/';

const SNAPSHOT_STATES = ['available', 'carried_forward', 'unavailable', 'expired'];
const MAP_STATES = ['ready', 'unavailable'];
const HISTORY_STATES = ['ACCUMULATING', 'PROVISIONAL', 'STABLE', 'MATURE'];
const GEOLOCATION_STATES = ['idle', 'denied', 'timeout'];
const SELECTION_STATES = ['none', 'valid', 'invalid'];

function catalogPlace(catalog, areaCode) {
  return Array.isArray(catalog) && typeof areaCode === 'string'
    ? catalog.find((place) => place?.areaCode === areaCode) ?? null
    : null;
}

function canonicalPath(areaCode) {
  return `${DETAIL_PREFIX}${encodeURIComponent(areaCode)}`;
}

function detailPresentation(viewportWidth, sheetEntry) {
  if (!sheetEntry) return 'FULL_SCREEN';
  return viewportWidth >= 768 ? 'DETAIL_PANE' : 'BOTTOM_SHEET';
}

function detailAvailability(snapshot) {
  switch (snapshot) {
    case 'unavailable':
      return {
        visibleData: 'place identity only',
        warningCopy: 'Current crowd data is unavailable.',
        disabledActions: ['forecast', 'better-time'],
      };
    case 'expired':
      return {
        visibleData: 'place identity and last normal time',
        warningCopy: 'Recent data cannot be confirmed.',
        disabledActions: ['forecast', 'better-time'],
      };
    case 'carried_forward':
      return {
        visibleData: 'place identity, population range, and source time',
        warningCopy: 'Showing the most recent verified observation.',
        disabledActions: [],
      };
    default:
      return {
        visibleData: 'place identity, population range, source time, and official forecast',
        warningCopy: '',
        disabledActions: [],
      };
  }
}

function fallback() {
  return {
    kind: 'CATALOG_FALLBACK',
    path: '/',
    robots: 'noindex,nofollow',
    message: 'This official place is no longer available. Browse the current catalog.',
    announcement: 'Place not found. The current official catalog is available.',
  };
}

export function resolveDetailEntry(input) {
  const place = catalogPlace(input.catalog, input.areaCode);
  if (place === null) return fallback();

  const isReload = input.navigationType === 'reload';
  const sheetEntry = !isReload && input.historyState?.entry === DETAIL_ENTRY;
  return {
    kind: 'DETAIL',
    place,
    path: canonicalPath(place.areaCode),
    presentation: detailPresentation(input.viewportWidth, sheetEntry),
    robots: 'index,follow',
  };
}

export function createDetailNavigation(input) {
  const place = catalogPlace(input.catalog, input.areaCode);
  if (place === null) return fallback();

  const path = canonicalPath(place.areaCode);
  const result = {
    kind: 'DETAIL',
    presentation: detailPresentation(input.viewportWidth, true),
    path,
    command: { kind: 'PUSH_STATE', state: { entry: DETAIL_ENTRY }, path },
    restore: input.restore,
  };
  return SNAPSHOT_STATES.includes(input.snapshot) ? { ...result, detail: detailAvailability(input.snapshot) } : result;
}

export function closeSheet(restore) {
  return { kind: 'HISTORY_BACK', restore };
}

export function createShareRequest(input) {
  const place = catalogPlace(input.catalog, input.areaCode);
  if (place === null || typeof input.origin !== 'string') return null;
  return {
    kind: 'SHARE',
    url: new URL(canonicalPath(place.areaCode), input.origin).toString(),
    disclosure: 'This link identifies only the official place and does not include your current location.',
  };
}

function stateEntry(snapshot, map, history, geolocation, selection) {
  const availability = detailAvailability(snapshot);
  const disabledActions = [...availability.disabledActions];
  if (map === 'unavailable') disabledActions.push('map');
  if (geolocation === 'denied') disabledActions.push('near-me-sort');
  if (selection !== 'valid') disabledActions.push('share');
  if (selection === 'invalid') disabledActions.push('detail');

  const warnings = [availability.warningCopy];
  if (map === 'unavailable') warnings.push('Map is unavailable; browse the official list instead.');
  if (geolocation === 'denied') warnings.push('Location permission was not granted.');
  if (geolocation === 'timeout') warnings.push('Location request timed out.');
  if (history === 'ACCUMULATING') warnings.push('History is still accumulating.');
  if (history === 'PROVISIONAL') warnings.push('History pattern is provisional.');
  if (selection === 'invalid') warnings.push('The selected place is no longer in the official catalog.');

  const retryTarget = map === 'unavailable'
    ? 'map'
    : geolocation === 'timeout'
      ? 'geolocation'
      : snapshot === 'unavailable'
        ? 'snapshot'
        : 'none';
  const announcement = selection === 'invalid'
    ? 'Place not found. The current official catalog is available.'
    : warnings.filter(Boolean).join(' ') || 'Official place data is ready.';

  return {
    axes: { snapshot, map, history, geolocation, selection },
    visibleData: selection === 'none' ? 'official catalog browse' : availability.visibleData,
    warningCopy: warnings.filter(Boolean).join(' '),
    disabledActions,
    retryTarget,
    announcement,
  };
}

export function createStateMatrix() {
  return SNAPSHOT_STATES.flatMap((snapshot) => MAP_STATES.flatMap((map) => HISTORY_STATES.flatMap((history) => GEOLOCATION_STATES.flatMap((geolocation) => SELECTION_STATES.map((selection) => stateEntry(snapshot, map, history, geolocation, selection))))));
}
