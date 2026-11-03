/** Flux public du classement officiel (CORS ouvert, mis à jour à chaque pointage horaire) */
export const RANKING_URL = 'https://www.routedurhum.com/_functions/classement';

/**
 * Dépôt GitHub qui héberge les trajectoires mises à jour chaque heure.
 * La valeur est injectée automatiquement par le workflow de publication (owner/repo).
 */
const REPO = '__RDR_REPO__';

export const HAS_REPO = /^[\w.-]+\/[\w.-]+$/.test(REPO);
const RAW = HAS_REPO ? `https://raw.githubusercontent.com/${REPO}/main/data` : '';
export const TRACKS_URL = HAS_REPO ? `${RAW}/tracks.json` : '';
export const LATEST_URL = HAS_REPO ? `${RAW}/latest.json` : '';

export const SITE_URL = 'https://www.routedurhum.com';
export const PHOTO_BASE = 'https://static.wixstatic.com/media/';

/** Ligne de départ, au large de la pointe du Grouin */
export const START = { lat: 48.77, lon: -1.89 };
/** Arrivée devant Pointe-à-Pitre */
export const FINISH = { lat: 16.205, lon: -61.535 };

/** Rafraîchissements */
export const RANKING_POLL_MS = 5 * 60 * 1000;
export const TRACKS_POLL_MS = 30 * 60 * 1000;

export const STORAGE_PREFIX = 'windy-plugin-route-du-rhum:';
