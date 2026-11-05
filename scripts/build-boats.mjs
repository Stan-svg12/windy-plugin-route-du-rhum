#!/usr/bin/env node
/**
 * Construit data/boats.json à partir de scripts/geovoile-colors.txt, relevé sur la cartographie officielle.
 *
 * Ligne du relevé : "id type c1 c2 c3 [c4] m sNNNN"
 *   type : 1 monocoque, 2 catamaran, 3 trimaran, 4 IMOCA à foils, 5 Class40 à étrave ronde
 *   c1 coque, c2 pont, c3 cockpit, c4 foils ou bras (types 2 et 4)
 *   m  couleur principale (trace) : rang 1 à 4 d'une couleur précédente, ou valeur hexadécimale
 *   s  somme de contrôle de la ligne, vérifiée ici
 *
 * data/boats.json garde aussi "colors" (une couleur par bateau) pour la version 1.1.0 du plugin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'scripts', 'geovoile-colors.txt');
const OUT = path.join(ROOT, 'data', 'boats.json');

const checksum = s => [...s].reduce((a, ch, i) => a + ch.charCodeAt(0) * ((i % 7) + 1), 0);
const HEX = /^[0-9A-F]{6}$/;

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/).filter(Boolean);
const boats = {};
const colors = {};
for (const line of lines.slice(1)) {
    if (line === 'END') {
        break;
    }
    const cut = line.lastIndexOf(' s');
    const body = line.slice(0, cut);
    if (checksum(body) !== Number(line.slice(cut + 2))) {
        throw new Error(`Somme de contrôle fausse : ${line}`);
    }
    const [id, type, ...rest] = body.split(' ');
    const m = rest.pop();
    if (!rest.every(c => HEX.test(c))) {
        throw new Error(`Couleur invalide : ${line}`);
    }
    const main = /^[1-4]$/.test(m) ? rest[Number(m) - 1] : m;
    if (!HEX.test(main)) {
        throw new Error(`Couleur principale invalide : ${line}`);
    }
    boats[id] = { t: Number(type), c: rest.map(c => `#${c}`), m: `#${main}` };
    colors[id] = `#${main}`;
}

const out = {
    v: 2,
    source: 'Cartographie officielle de la course (carto.routedurhum.com), relevé du 5 novembre 2026',
    note: 'boats[idCourse] : t type de silhouette (1 monocoque, 2 catamaran, 3 trimaran, 4 IMOCA à foils, 5 Class40), c couleurs coque, pont, cockpit et foils ou bras, m couleur de la trace. colors : couleur unique par bateau, pour la version 1.1.0 du plugin.',
    colors,
    boats,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(boats).length} bateaux écrits dans ${path.relative(ROOT, OUT)}`);
