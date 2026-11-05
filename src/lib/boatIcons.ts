import type { BoatStyle } from './types';

/**
 * Silhouettes des bateaux vues du dessus, étrave vers le haut (cap 0).
 * Repère SVG centré sur le bateau : viewBox -20 -20 40 40, coque d'environ 25 unités de long,
 * de y = -13 (étrave) à y = 12 (tableau arrière). Le sillage occupe le bas du carré.
 *
 * Mise en couleur reprise de la cartographie officielle : coque, pont, cockpit, puis foils ou bras.
 */

type Shape = {
    /** Taille de l'icône en pixels, avant le facteur de zoom */
    size: number;
    /** Coques */
    hulls: string[];
    /** Bras de liaison des multicoques */
    beams?: string[];
    /** Les bras prennent la 4e couleur (catamarans) plutôt que celle de la coque */
    beamsAccent?: boolean;
    /** Trampolines (filets entre les coques) */
    nets?: string[];
    /** Foils, dans la 4e couleur */
    foils?: string[];
    /** Pont (2e couleur) */
    deck: string;
    /** Cockpit (3e couleur) */
    cockpit: string;
    /** Coins du tableau d'où part le sillage */
    wake: { x: number; y: number; band?: boolean };
};

const mirror = (d: string) =>
    d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, x, y) => `${-Number(x)},${y}`);

const MONO: Shape = {
    size: 32,
    hulls: [
        'M0,-12.6 C2.9,-8.7 4.3,-3.6 4.2,1.6 C4.1,6.2 3.6,9.4 2.9,11.7 L-2.9,11.7 C-3.6,9.4 -4.1,6.2 -4.2,1.6 C-4.3,-3.6 -2.9,-8.7 0,-12.6 Z',
    ],
    deck: 'M-2.6,-5.2 Q0,-6.2 2.6,-5.2 L2.9,9.6 L-2.9,9.6 Z',
    cockpit: 'M-2.1,1.2 Q0,0.2 2.1,1.2 L2.4,9.6 L-2.4,9.6 Z',
    wake: { x: 2.2, y: 11.9, band: true },
};

const IMOCA_HULL =
    'M0,-12.6 C2.8,-11.8 4.6,-7.7 5,-1.6 C5.3,3.7 5.2,8.5 4.8,11.8 L-4.8,11.8 C-5.2,8.5 -5.3,3.7 -5,-1.6 C-4.6,-7.7 -2.8,-11.8 0,-12.6 Z';

/** IMOCA à foils */
const IMOCA: Shape = {
    size: 36,
    hulls: [IMOCA_HULL],
    foils: ['M4.9,-1.4 C6.8,-1.4 8.3,-0.3 9,1.6', mirror('M4.9,-1.4 C6.8,-1.4 8.3,-0.3 9,1.6')],
    deck: 'M-3.4,-5.4 Q0,-6.6 3.4,-5.4 L3.9,10.2 L-3.9,10.2 Z',
    cockpit: 'M-2.9,1.2 Q0,0 2.9,1.2 L3.3,10.2 L-3.3,10.2 Z',
    wake: { x: 3.4, y: 12, band: true },
};

/** IMOCA à dérives droites */
const IMOCA_DERIVES: Shape = { ...IMOCA, foils: undefined };

/** Class40 à étrave ronde (scow) */
const CLASS40: Shape = {
    size: 32,
    hulls: [
        'M-2.8,-11.5 Q0,-12.9 2.8,-11.5 C4.4,-9.3 5,-5.1 5,0 C5,4.8 4.8,8.8 4.5,11.7 L-4.5,11.7 C-4.8,8.8 -5,4.8 -5,0 C-5,-5.1 -4.4,-9.3 -2.8,-11.5 Z',
    ],
    deck: 'M-3.3,-5.2 Q0,-6.2 3.3,-5.2 L3.6,9.8 L-3.6,9.8 Z',
    cockpit: 'M-2.8,1 Q0,0 2.8,1 L3.1,9.8 L-3.1,9.8 Z',
    wake: { x: 3.2, y: 11.9, band: true },
};

const trimaran = (
    size: number,
    float: string,
    beams: string[],
    central: string,
    deck: string,
    cockpit: string,
    nets?: string,
    wakeY = 11.5,
): Shape => ({
    size,
    hulls: [central, float, mirror(float)],
    beams,
    nets: nets ? [nets, mirror(nets)] : undefined,
    deck,
    cockpit,
    wake: { x: 1.5, y: wakeY, band: true },
});

/** Ultim : 32 m de long pour 23 m de large, longs flotteurs et bras cintrés */
const ULTIM = trimaran(
    46,
    'M9.1,-10.2 C10.2,-6.5 10.5,-0.5 10.2,10 L8,10 C7.7,-0.5 8,-6.5 9.1,-10.2 Z',
    ['M-8.8,-3.2 Q0,-6.2 8.8,-3.2', 'M-8.8,5.4 Q0,3.6 8.8,5.4'],
    'M0,-13.2 C1.6,-8.6 2,-3 1.9,11.6 L-1.9,11.6 C-2,-3 -1.6,-8.6 0,-13.2 Z',
    'M-1.2,-6 Q0,-6.8 1.2,-6 L1.4,9.8 L-1.4,9.8 Z',
    'M-1.1,1.4 Q0,0.6 1.1,1.4 L1.3,9.8 L-1.3,9.8 Z',
    undefined,
    11.8,
);

/** Ocean Fifty : 15 m sur 15 m, aussi large que long, filets entre les coques */
const OCEAN_FIFTY = trimaran(
    38,
    'M9.2,-8.6 C10.3,-5.2 10.6,0 10.3,8.8 L8.1,8.8 C7.8,0 8.1,-5.2 9.2,-8.6 Z',
    ['M-8.6,-3.4 Q0,-4.6 8.6,-3.4', 'M-8.6,4.6 Q0,3.8 8.6,4.6'],
    'M0,-12 C1.7,-7.8 2.1,-2.2 2,10.8 L-2,10.8 C-2.1,-2.2 -1.7,-7.8 0,-12 Z',
    'M-1.3,-5.6 Q0,-6.4 1.3,-5.6 L1.5,9.2 L-1.5,9.2 Z',
    'M-1.2,1.2 Q0,0.4 1.2,1.2 L1.4,9.2 L-1.4,9.2 Z',
    'M2,-3.4 L8.2,-3.4 L8.2,4.6 L2,4.6 Z',
    11,
);

/** Trimarans de l'ancienne génération, plus étroits */
const VINTAGE_TRI = trimaran(
    36,
    'M7.2,-8 C8.2,-4.8 8.5,0 8.2,8.4 L6.2,8.4 C5.9,0 6.2,-4.8 7.2,-8 Z',
    ['M-6.8,-2.8 Q0,-4 6.8,-2.8', 'M-6.8,4.2 Q0,3.4 6.8,4.2'],
    'M0,-12.4 C1.9,-8.2 2.4,-2.6 2.3,11.2 L-2.3,11.2 C-2.4,-2.6 -1.9,-8.2 0,-12.4 Z',
    'M-1.6,-5.6 Q0,-6.4 1.6,-5.6 L1.8,9.6 L-1.8,9.6 Z',
    'M-1.4,1.2 Q0,0.4 1.4,1.2 L1.6,9.6 L-1.6,9.6 Z',
    'M2.3,-2.8 L6.3,-2.8 L6.3,4.2 L2.3,4.2 Z',
    11.4,
);

/** Catamaran : deux coques, nacelle centrale entre les bras */
const CATAMARAN: Shape = {
    size: 36,
    hulls: [
        'M5.6,-12.4 C6.8,-8.6 7.2,-2.4 7,10.6 L4.4,10.6 C4.2,-2.4 4.5,-8.6 5.6,-12.4 Z',
        mirror('M5.6,-12.4 C6.8,-8.6 7.2,-2.4 7,10.6 L4.4,10.6 C4.2,-2.4 4.5,-8.6 5.6,-12.4 Z'),
    ],
    beams: ['M-4.6,-5 L4.6,-5', 'M-4.6,5.4 L4.6,5.4'],
    beamsAccent: true,
    deck: 'M-4.4,-3.6 L4.4,-3.6 L4.2,4 L-4.2,4 Z',
    cockpit: 'M-2.8,-1.2 L2.8,-1.2 L2.6,4 L-2.6,4 Z',
    wake: { x: 5.6, y: 10.8, band: false },
};

/** Silhouette d'après le type de la cartographie officielle, sinon d'après la classe */
export const shapeFor = (classKey: string, type?: number): Shape => {
    switch (type) {
        case 2:
            return CATAMARAN;
        case 3:
            return classKey === 'ultim' ? ULTIM : classKey === 'ocean-fifty' ? OCEAN_FIFTY : VINTAGE_TRI;
        case 4:
            return IMOCA;
        case 5:
            return CLASS40;
        case 1:
            return classKey === 'imoca' ? IMOCA_DERIVES : MONO;
        default:
            break;
    }
    switch (classKey) {
        case 'ultim':
            return ULTIM;
        case 'ocean-fifty':
            return OCEAN_FIFTY;
        case 'imoca':
            return IMOCA;
        case 'class40':
            return CLASS40;
        case 'vintage-mono':
            return MONO;
        default:
            return /multi|trimaran/i.test(classKey) ? VINTAGE_TRI : /catamaran/i.test(classKey) ? CATAMARAN : MONO;
    }
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const hex = (c: string) => {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
    if (!m) {
        return [120, 140, 160];
    }
    const s = m[1].length === 3 ? [...m[1]].map(ch => ch + ch).join('') : m[1];
    return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
};

/** Mélange une couleur avec du noir (f < 0) ou du blanc (f > 0) */
export const shade = (c: string, f: number) => {
    const target = f < 0 ? 0 : 255;
    const k = Math.abs(f);
    const [r, g, b] = hex(c).map(v => Math.round(v + (target - v) * k));
    return `rgb(${r},${g},${b})`;
};

/** Luminance relative, pour choisir un contour lisible sur les couleurs claires */
export const luminance = (c: string) => {
    const [r, g, b] = hex(c).map(v => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export interface BoatIconOptions {
    classKey: string;
    /** Couleur de repli (classe ou couleur principale) quand le bateau n'a pas de livrée connue */
    color: string;
    /** Livrée relevée sur la cartographie officielle */
    style?: BoatStyle | null;
    /** Vitesse en nœuds, pour la longueur du sillage */
    speed: number;
    /** Bateau arrêté (abandon, escale) : pas de sillage */
    stopped: boolean;
    /** Bateau hors course : livrée grisée */
    greyed?: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** SVG complet d'un bateau, cap 0 */
export function boatSvg({ classKey, color, style, speed, stopped, greyed }: BoatIconOptions) {
    const s = shapeFor(classKey, style?.type);
    const grey = '#8c959e';
    const c = style?.colors || [];
    const hull = greyed ? grey : c[0] || color;
    const deck = greyed ? shade(grey, 0.3) : c[1] || shade(hull, luminance(hull) > 0.45 ? -0.18 : 0.3);
    const cockpit = greyed ? shade(grey, -0.3) : c[2] || shade(hull, -0.35);
    const fourth = greyed ? shade(grey, -0.4) : c[3] || '';
    const edge = shade(hull, luminance(hull) > 0.45 ? -0.55 : -0.62);
    const parts: string[] = [];

    if (!stopped && speed > 1.5) {
        // Sillage en V derrière le tableau, plus long quand le bateau va vite
        const k = clamp(speed / 24, 0.3, 1);
        const len = 8 * k;
        const w = s.wake;
        const x0 = r2(w.x * 0.8);
        const x1 = r2(w.x + 2.6 * k + 0.8);
        const y1 = r2(w.y + len);
        parts.push(
            `<path d="M${-x0},${w.y} L${-x1},${y1} M${x0},${w.y} L${x1},${y1}" stroke="#fff" stroke-opacity=".55" stroke-width=".85" stroke-linecap="round" fill="none"/>`,
        );
        if (w.band) {
            parts.push(
                `<path d="M0,${r2(w.y + 0.3)} L0,${r2(w.y + len * 0.7)}" stroke="#fff" stroke-opacity=".28" stroke-width="${r2(Math.min(w.x, 3) * 1.1)}" stroke-linecap="round"/>`,
            );
        }
    }

    for (const d of s.nets || []) {
        parts.push(`<path d="${d}" fill="#fff" fill-opacity=".2" stroke="${edge}" stroke-opacity=".45" stroke-width=".35"/>`);
    }
    const beamColor = s.beamsAccent && fourth ? fourth : hull;
    for (const d of s.beams || []) {
        parts.push(
            `<path d="${d}" fill="none" stroke="${edge}" stroke-width="2.6" stroke-linecap="round"/>`,
            `<path d="${d}" fill="none" stroke="${beamColor}" stroke-width="1.4" stroke-linecap="round"/>`,
        );
    }
    for (const d of s.foils || []) {
        parts.push(
            `<path d="${d}" fill="none" stroke="${edge}" stroke-width="2.3" stroke-linecap="round"/>`,
            `<path d="${d}" fill="none" stroke="${fourth || edge}" stroke-width="1.2" stroke-linecap="round"/>`,
        );
    }
    for (const d of s.hulls) {
        parts.push(`<path d="${d}" fill="${hull}" stroke="${edge}" stroke-width=".9" stroke-linejoin="round"/>`);
    }
    parts.push(`<path d="${s.deck}" fill="${deck}"/>`, `<path d="${s.cockpit}" fill="${cockpit}"/>`);
    return `<svg viewBox="-20 -20 40 40" width="100%" height="100%" aria-hidden="true">${parts.join('')}</svg>`;
}

/** Taille d'affichage en pixels selon la silhouette et le zoom de la carte */
export function boatSize(classKey: string, type: number | undefined, zoom: number, selected: boolean) {
    const base = shapeFor(classKey, type).size;
    const z = zoom <= 3 ? 0.78 : zoom <= 4 ? 0.9 : zoom >= 8 ? 1.45 : zoom >= 7 ? 1.3 : zoom >= 6 ? 1.15 : 1;
    return Math.round(base * z * (selected ? 1.35 : 1));
}
