#!/usr/bin/env node
// Génère src/lib/seedTracks.ts à partir de data/tracks.json : trajectoires embarquées dans le plugin,
// utilisées si le fichier distant (mis à jour chaque heure sur GitHub) est injoignable.
import fs from 'node:fs';
const t = JSON.parse(fs.readFileSync(new URL('../data/tracks.json', import.meta.url), 'utf8'));
const out = `// Fichier généré par scripts/embed-seed.mjs, ne pas éditer à la main.
import type { TracksFile } from './types';

export const SEED_TRACKS: TracksFile = ${JSON.stringify({ v: t.v, startEpoch: t.startEpoch, prec: t.prec, lastMaj: t.lastMaj, boats: t.boats })};
`;
fs.writeFileSync(new URL('../src/lib/seedTracks.ts', import.meta.url), out);
console.log('seedTracks.ts', out.length, 'octets');
