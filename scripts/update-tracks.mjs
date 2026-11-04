#!/usr/bin/env node
/**
 * Met à jour data/tracks.json (trajectoires de toute la flotte) et data/latest.json
 * (dernier classement officiel) à partir du flux public du site officiel.
 *
 * Lancé chaque heure par .github/workflows/update-tracks.yml.
 *
 * Format de data/tracks.json (compact pour rester léger) :
 *   boats[idCourse] = [t0, lat0, lon0, dt1, dlat1, dlon1, ...]
 *   t en minutes depuis le départ, lat et lon en millièmes de degré, valeurs delta encodées.
 *
 * Usage :
 *   node scripts/update-tracks.mjs                 met à jour depuis le flux officiel
 *   node scripts/update-tracks.mjs --seed          reconstruit data/tracks.json depuis scripts/seed-geovoile.txt
 *   node scripts/update-tracks.mjs --file x.json   met à jour depuis un fichier local (tests)
 *   node scripts/update-tracks.mjs --gap x.txt     comble une période avec des points de la cartographie officielle
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACKS_FILE = path.join(ROOT, 'data', 'tracks.json');
const LATEST_FILE = path.join(ROOT, 'data', 'latest.json');
const SEED_FILE = path.join(ROOT, 'scripts', 'seed-geovoile.txt');
const SOURCE_URL = 'https://www.routedurhum.com/_functions/classement';

export const START_EPOCH = Date.parse('2026-11-01T12:02:00Z') / 1000;
export const PREC = 1000;
/** Ligne de départ (au large de la pointe du Grouin) */
export const START_POINT = [48.77, -1.89];

/** Décode un tableau delta encodé en liste de points [tMin, lat, lon]. */
export function decodeTrack(enc) {
    const pts = [];
    let t = 0;
    let la = 0;
    let lo = 0;
    for (let i = 0; i + 2 < enc.length; i += 3) {
        t += enc[i];
        la += enc[i + 1];
        lo += enc[i + 2];
        pts.push([t, la, lo]);
    }
    return pts;
}

/** Encode une liste de points entiers [tMin, lat×1000, lon×1000] en tableau delta. */
export function encodeTrack(pts) {
    const enc = [];
    let pt = 0;
    let pla = 0;
    let plo = 0;
    for (const [t, la, lo] of pts) {
        enc.push(t - pt, la - pla, lo - plo);
        pt = t;
        pla = la;
        plo = lo;
    }
    return enc;
}

/** Lit le fichier d'amorçage extrait de la cartographie (grille de 3 h). */
export function readSeed(file = SEED_FILE) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const meta = Object.fromEntries(
        lines[0]
            .split(' ')
            .slice(1)
            .filter(s => s.includes('='))
            .map(s => s.split('=')),
    );
    const stepMin = Number(meta.stepMin);
    const start = Number(meta.start);
    if (start !== START_EPOCH) {
        throw new Error(`Seed start ${start} differs from ${START_EPOCH}`);
    }
    const boats = {};
    const dataStart = lines.indexOf('DATA') + 1;
    const dataEnd = lines.indexOf('END');
    for (const line of lines.slice(dataStart, dataEnd)) {
        const [id, csv] = line.split(':');
        const v = csv.split(',').map(Number);
        const k0 = v[0];
        let la = 0;
        let lo = 0;
        const pts = [];
        for (let i = 1, k = k0; i + 1 < v.length; i += 2, k++) {
            la += v[i];
            lo += v[i + 1];
            pts.push([k * stepMin, la, lo]);
        }
        // Les bateaux sans point à l'heure du coup de canon partent de la ligne de départ
        if (pts.length && pts[0][0] > 0) {
            pts.unshift([0, Math.round(START_POINT[0] * PREC), Math.round(START_POINT[1] * PREC)]);
        }
        // Supprime les points immobiles consécutifs (bateau arrêté ou abandon)
        boats[id] = dedupe(pts);
    }
    return boats;
}

function dedupe(pts) {
    const out = [];
    for (const p of pts) {
        const last = out[out.length - 1];
        if (last && last[1] === p[1] && last[2] === p[2]) {
            continue;
        }
        out.push(p);
    }
    // Conserve toujours le dernier point (date de la dernière position connue)
    const lastIn = pts[pts.length - 1];
    if (lastIn && out[out.length - 1] !== lastIn) {
        out.push(lastIn);
    }
    return out;
}

/** Ajoute les positions d'un classement officiel aux trajectoires. Renvoie le nombre de points ajoutés. */
export function appendRanking(tracks, ranking) {
    const majEpoch = Date.parse(ranking.maj) / 1000;
    if (!Number.isFinite(majEpoch)) {
        throw new Error('Classement sans date de mise à jour');
    }
    if (tracks.lastMaj && Date.parse(tracks.lastMaj) / 1000 >= majEpoch) {
        return 0;
    }
    const tMin = Math.round((majEpoch - START_EPOCH) / 60);
    let added = 0;
    for (const cls of ranking.classes || []) {
        for (const l of cls.lignes || []) {
            const id = String(l.idCourse);
            if (!id || typeof l.lat !== 'number' || typeof l.lon !== 'number') {
                continue;
            }
            if (Math.abs(l.lat) < 0.001 && Math.abs(l.lon) < 0.001) {
                continue;
            }
            const la = Math.round(l.lat * PREC);
            const lo = Math.round(l.lon * PREC);
            const pts = tracks.boats[id] ? decodeTrack(tracks.boats[id]) : [];
            const last = pts[pts.length - 1];
            if (last && last[0] >= tMin) {
                continue;
            }
            if (last && last[1] === la && last[2] === lo) {
                continue;
            }
            pts.push([tMin, la, lo]);
            tracks.boats[id] = encodeTrack(pts);
            added++;
        }
    }
    tracks.lastMaj = ranking.maj;
    return added;
}

/**
 * Ajoute aux trajectoires des points extraits de la cartographie officielle (grille régulière),
 * pour combler une période sans relevé horaire. Format identique à scripts/seed-geovoile.txt.
 */
export function mergeGap(tracks, file) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const meta = Object.fromEntries(
        lines[0]
            .split(' ')
            .slice(1)
            .filter(s => s.includes('='))
            .map(s => s.split('=')),
    );
    if (Number(meta.start) !== START_EPOCH) {
        throw new Error(`Gap start ${meta.start} differs from ${START_EPOCH}`);
    }
    const stepMin = Number(meta.stepMin);
    let added = 0;
    for (const line of lines.slice(lines.indexOf('DATA') + 1, lines.indexOf('END'))) {
        const [id, csv] = line.split(':');
        const v = csv.split(',').map(Number);
        const gap = [[v[0] * stepMin, v[1], v[2]]];
        for (let i = 3, k = v[0] + 1; i + 1 < v.length; i += 2, k++) {
            const prev = gap[gap.length - 1];
            gap.push([k * stepMin, prev[1] + v[i], prev[2] + v[i + 1]]);
        }
        const pts = tracks.boats[id] ? decodeTrack(tracks.boats[id]) : [];
        const times = new Set(pts.map(p => p[0]));
        for (const p of gap) {
            if (!times.has(p[0])) {
                pts.push(p);
                added++;
            }
        }
        pts.sort((a, b) => a[0] - b[0]);
        tracks.boats[id] = encodeTrack(dedupe(pts));
    }
    return added;
}

/** Version allégée du classement, servie en secours au plugin si le site officiel ne répond pas. */
export function slimRanking(r) {
    return {
        phase: r.phase,
        depart: r.depart,
        maj: r.maj,
        prochain: r.prochain,
        distance: r.distance,
        intervalleMin: r.intervalleMin,
        partants: r.partants,
        classes: (r.classes || []).map(c => ({
            id: c.id,
            cle: c.cle,
            nom: c.nom,
            couleur: c.couleur,
            partants: c.partants,
            lignes: (c.lignes || []).map(l => ({
                id: l.id,
                idCourse: l.idCourse,
                prenom: l.prenom,
                nom: l.nom,
                bateau: l.bateau,
                voile: l.voile,
                photo: l.photo,
                pays: l.pays,
                fiche: l.fiche,
                statut: l.statut,
                rang: l.rang,
                dtf: l.dtf,
                dtl: l.dtl,
                vitesse: l.vitesse,
                vitesse24h: l.vitesse24h,
                cap: l.cap,
                vmg: l.vmg,
                lat: l.lat,
                lon: l.lon,
                rangAvant: l.rangAvant,
            })),
        })),
    };
}

function emptyTracks() {
    return {
        v: 1,
        start: new Date(START_EPOCH * 1000).toISOString(),
        startEpoch: START_EPOCH,
        prec: PREC,
        lastMaj: null,
        updated: null,
        sources: 'Cartographie officielle (Géovoile), puis classements officiels horaires',
        boats: {},
    };
}

function loadTracks() {
    if (fs.existsSync(TRACKS_FILE)) {
        return JSON.parse(fs.readFileSync(TRACKS_FILE, 'utf8'));
    }
    const t = emptyTracks();
    for (const [id, pts] of Object.entries(readSeed())) {
        t.boats[id] = encodeTrack(pts);
    }
    return t;
}

export function saveJson(file, obj) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Une ligne par bateau : diff git lisible et fichier compact
    if (obj.boats) {
        const { boats, ...head } = obj;
        const body = Object.keys(boats)
            .sort((a, b) => Number(a) - Number(b))
            .map(id => `    ${JSON.stringify(id)}: ${JSON.stringify(boats[id])}`)
            .join(',\n');
        const headJson = JSON.stringify(head, null, 2).replace(/\n}$/, '');
        fs.writeFileSync(file, `${headJson},\n  "boats": {\n${body}\n  }\n}\n`);
    } else {
        fs.writeFileSync(file, JSON.stringify(obj) + '\n');
    }
}

async function fetchRanking() {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(SOURCE_URL, {
                headers: {
                    accept: 'application/json',
                    'user-agent': 'windy-plugin-route-du-rhum (GitHub Actions)',
                },
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const json = await res.json();
            if (!json || !Array.isArray(json.classes)) {
                throw new Error('Réponse inattendue');
            }
            return json;
        } catch (e) {
            lastErr = e;
            await new Promise(r => setTimeout(r, attempt * 5000));
        }
    }
    throw lastErr;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--seed')) {
        if (fs.existsSync(TRACKS_FILE)) {
            fs.unlinkSync(TRACKS_FILE);
        }
        const t = loadTracks();
        t.updated = new Date().toISOString();
        saveJson(TRACKS_FILE, t);
        console.log(`Seed: ${Object.keys(t.boats).length} bateaux écrits dans ${TRACKS_FILE}`);
        return;
    }

    const gapIdx = args.indexOf('--gap');
    if (gapIdx >= 0) {
        const t = loadTracks();
        const added = mergeGap(t, args[gapIdx + 1]);
        t.updated = new Date().toISOString();
        saveJson(TRACKS_FILE, t);
        console.log(`Comblement : ${added} points ajoutés`);
        return;
    }

    let ranking;
    const fileIdx = args.indexOf('--file');
    try {
        ranking =
            fileIdx >= 0
                ? JSON.parse(fs.readFileSync(args[fileIdx + 1], 'utf8'))
                : await fetchRanking();
    } catch (e) {
        // Pas d'échec bruyant : on réessaiera au prochain passage
        console.log(`::warning::Classement officiel indisponible (${e.message})`);
        return;
    }

    const tracks = loadTracks();
    const added = appendRanking(tracks, ranking);
    if (added > 0) {
        tracks.updated = new Date().toISOString();
        saveJson(TRACKS_FILE, tracks);
    }
    // Instantané de secours, réécrit seulement quand un nouveau pointage est publié
    let previousMaj = null;
    try {
        previousMaj = JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8')).maj;
    } catch {
        /* premier passage */
    }
    if (previousMaj !== ranking.maj) {
        saveJson(LATEST_FILE, slimRanking(ranking));
    }
    console.log(`Classement du ${ranking.maj} : ${added} positions ajoutées`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(e => {
        console.error(e);
        process.exit(1);
    });
}
