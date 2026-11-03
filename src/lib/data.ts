import type { Boat, FleetClass, FleetState, Ranking, RankingLine, TracksFile } from './types';
import { HAS_REPO, LATEST_URL, PHOTO_BASE, RANKING_URL, SITE_URL, TRACKS_URL } from './config';
import { SEED_TRACKS } from './seedTracks';
import { isFinished, isRacing, prettyName } from './format';

const fetchJson = async <T>(url: string, timeoutMs = 15000): Promise<T> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as T;
    } finally {
        clearTimeout(timer);
    }
};

/** Cache de 10 minutes côté CDN GitHub, on varie l'URL pour forcer un fichier frais */
const bust = (url: string) => `${url}?v=${Math.floor(Date.now() / 600000)}`;

const isRanking = (r: unknown): r is Ranking =>
    !!r && Array.isArray((r as Ranking).classes) && typeof (r as Ranking).maj === 'string';

export const loadRanking = async (): Promise<{ ranking: Ranking; source: 'officiel' | 'secours' }> => {
    try {
        const ranking = await fetchJson<Ranking>(RANKING_URL);
        if (isRanking(ranking)) {
            return { ranking, source: 'officiel' };
        }
        throw new Error('Format inattendu');
    } catch (e) {
        if (!HAS_REPO) {
            throw e;
        }
        const ranking = await fetchJson<Ranking>(bust(LATEST_URL));
        if (!isRanking(ranking)) {
            throw e;
        }
        return { ranking, source: 'secours' };
    }
};

export const loadTracks = async (): Promise<TracksFile> => {
    if (!HAS_REPO) {
        return SEED_TRACKS;
    }
    try {
        const t = await fetchJson<TracksFile>(bust(TRACKS_URL));
        if (t && t.boats && typeof t.startEpoch === 'number' && typeof t.prec === 'number') {
            return t;
        }
    } catch (e) {
        console.warn('[route-du-rhum] Trajectoires distantes indisponibles, version embarquée utilisée', e);
    }
    return SEED_TRACKS;
};

const decodeTrack = (enc: number[] | undefined, prec: number): [number, number][] => {
    const out: [number, number][] = [];
    if (!enc) {
        return out;
    }
    let la = 0;
    let lo = 0;
    for (let i = 0; i + 2 < enc.length; i += 3) {
        la += enc[i + 1];
        lo += enc[i + 2];
        out.push([la / prec, lo / prec]);
    }
    return out;
};

const validPos = (lat: unknown, lon: unknown): boolean =>
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    !(Math.abs(lat) < 0.001 && Math.abs(lon) < 0.001);

const toBoat = (
    l: RankingLine,
    cls: { cle: string; nom: string; couleur: string; partants: number },
    tracks: TracksFile,
): Boat | null => {
    const track = decodeTrack(tracks.boats[String(l.idCourse)], tracks.prec);
    let lat = l.lat;
    let lon = l.lon;
    if (validPos(lat, lon)) {
        const last = track[track.length - 1];
        if (!last || Math.abs(last[0] - lat) > 1e-4 || Math.abs(last[1] - lon) > 1e-4) {
            track.push([lat, lon]);
        }
    } else if (track.length) {
        [lat, lon] = track[track.length - 1];
    } else {
        return null;
    }
    const firstName = prettyName(l.prenom);
    const lastName = String(l.nom || '').trim().toUpperCase();
    const photo = l.photo ? (/^https?:/.test(l.photo) ? l.photo : PHOTO_BASE + l.photo) : null;
    return {
        id: l.id || String(l.idCourse),
        idCourse: String(l.idCourse),
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        boatName: String(l.bateau || '').trim(),
        sail: String(l.voile || '').trim(),
        photo,
        country: l.pays || '',
        profileUrl: l.fiche ? (/^https?:/.test(l.fiche) ? l.fiche : SITE_URL + l.fiche) : null,
        classKey: cls.cle,
        className: cls.nom,
        classColor: cls.couleur,
        classSize: cls.partants,
        status: l.statut || 'RAC',
        racing: isRacing(l.statut || 'RAC'),
        rank: Number(l.rang) || 0,
        rankBefore: typeof l.rangAvant === 'number' ? l.rangAvant : null,
        dtf: Number(l.dtf),
        dtl: Number(l.dtl),
        speed: Number(l.vitesse),
        speed24h: typeof l.vitesse24h === 'number' ? l.vitesse24h : null,
        heading: Number(l.cap) || 0,
        vmg: typeof l.vmg === 'number' ? l.vmg : null,
        lat,
        lon,
        track,
    };
};

/** Bateaux en course ou arrivés d'abord (ordre officiel), abandons à la fin */
const statusOrder = (b: Boat) => (b.racing || isFinished(b.status) ? 0 : 1);

export const buildFleet = (
    ranking: Ranking,
    tracks: TracksFile,
    source: 'officiel' | 'secours',
): FleetState => {
    const classes: FleetClass[] = ranking.classes.map(c => {
        const boats = c.lignes
            .map(l => toBoat(l, c, tracks))
            .filter((b): b is Boat => !!b)
            .sort((a, b) => statusOrder(a) - statusOrder(b) || a.rank - b.rank);
        return { key: c.cle, name: c.nom, color: c.couleur, size: c.partants, boats };
    });
    return {
        classes,
        boats: classes.flatMap(c => c.boats),
        maj: new Date(ranking.maj),
        next: ranking.prochain ? new Date(ranking.prochain) : null,
        start: new Date(ranking.depart),
        distance: ranking.distance,
        source,
    };
};
