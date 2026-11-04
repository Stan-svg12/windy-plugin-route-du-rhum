/**
 * Silhouettes des bateaux vues du dessus, étrave vers le haut (cap 0).
 * Repère SVG centré sur le bateau : viewBox -20 -20 40 40, coque d'environ 25 unités de long,
 * de y = -13 (étrave) à y = 12 (tableau arrière). Le sillage occupe le bas du carré.
 */

type Shape = {
    /** Taille de l'icône en pixels, avant le facteur de zoom */
    size: number;
    /** Coques (remplies de la couleur du bateau) */
    hulls: string[];
    /** Bras de liaison des multicoques */
    beams?: string[];
    /** Trampolines (filets entre les coques) */
    nets?: string[];
    /** Foils et appendices dessinés en trait sombre */
    foils?: string[];
    /** Pont plus clair, dessiné dans la coque principale */
    deck: string;
    /** Cockpit */
    cockpit: string;
    /** Pied de mât */
    mast: [number, number];
    /** Bôme et grand voile vue du dessus */
    sail: string;
    /** Demi largeur des points d'où part le sillage, et ordonnée du tableau */
    wake: { x: number; y: number }[];
};

const mirror = (d: string) =>
    d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, x, y) => `${-Number(x)},${y}`);

const MONO: Shape = {
    size: 30,
    hulls: [
        'M0,-12.6 C2.9,-8.7 4.3,-3.6 4.2,1.6 C4.1,6.2 3.6,9.4 2.9,11.7 L-2.9,11.7 C-3.6,9.4 -4.1,6.2 -4.2,1.6 C-4.3,-3.6 -2.9,-8.7 0,-12.6 Z',
    ],
    deck: 'M0,-10.3 C2,-7.2 3,-3.1 2.9,1.4 C2.8,5.4 2.4,8 2,9.7 L-2,9.7 C-2.4,8 -2.8,5.4 -2.9,1.4 C-3,-3.1 -2,-7.2 0,-10.3 Z',
    cockpit: 'M-1.6,5.4 h3.2 v3.9 a1,1 0 0 1 -1,1 h-1.2 a1,1 0 0 1 -1,-1 Z',
    mast: [0, -3.6],
    sail: 'M0,-3.6 Q1.7,2.4 2.5,9',
    wake: [{ x: 2.2, y: 11.9 }],
};

const IMOCA: Shape = {
    size: 34,
    hulls: [
        'M0,-12.6 C2.8,-11.8 4.6,-7.7 5,-1.6 C5.3,3.7 5.2,8.5 4.8,11.8 L-4.8,11.8 C-5.2,8.5 -5.3,3.7 -5,-1.6 C-4.6,-7.7 -2.8,-11.8 0,-12.6 Z',
    ],
    foils: ['M4.9,-2.6 C6.7,-2.6 8,-1.5 8.6,0.4', mirror('M4.9,-2.6 C6.7,-2.6 8,-1.5 8.6,0.4')],
    deck: 'M0,-10.4 C2,-9.6 3.4,-6.6 3.7,-1.4 C3.9,3.3 3.8,7.4 3.5,9.9 L-3.5,9.9 C-3.8,7.4 -3.9,3.3 -3.7,-1.4 C-3.4,-6.6 -2,-9.6 0,-10.4 Z',
    cockpit: 'M-2.5,6 h5 v4.4 a1.1,1.1 0 0 1 -1.1,1.1 h-2.8 a1.1,1.1 0 0 1 -1.1,-1.1 Z',
    mast: [0, -2.6],
    sail: 'M0,-2.6 Q2,3.8 3,10.2',
    wake: [{ x: 3.4, y: 12 }],
};

const CLASS40: Shape = {
    size: 30,
    hulls: [
        'M-2.8,-11.5 Q0,-12.9 2.8,-11.5 C4.4,-9.3 5,-5.1 5,0 C5,4.8 4.8,8.8 4.5,11.7 L-4.5,11.7 C-4.8,8.8 -5,4.8 -5,0 C-5,-5.1 -4.4,-9.3 -2.8,-11.5 Z',
    ],
    deck: 'M-1.9,-9.6 Q0,-10.6 1.9,-9.6 C3.1,-7.7 3.7,-4.3 3.7,0 C3.7,4.2 3.5,7.6 3.3,9.8 L-3.3,9.8 C-3.5,7.6 -3.7,4.2 -3.7,0 C-3.7,-4.3 -3.1,-7.7 -1.9,-9.6 Z',
    cockpit: 'M-2.3,6 h4.6 v4.3 a1.1,1.1 0 0 1 -1.1,1.1 h-2.4 a1.1,1.1 0 0 1 -1.1,-1.1 Z',
    mast: [0, -2.8],
    sail: 'M0,-2.8 Q1.9,3.4 2.9,9.8',
    wake: [{ x: 3.2, y: 11.9 }],
};

/** Ultim : 32 m de long pour 23 m de large, longs flotteurs et bras cintrés */
const ULTIM: Shape = {
    size: 46,
    hulls: [
        'M0,-13.2 C1.6,-8.6 2,-3 1.9,11.6 L-1.9,11.6 C-2,-3 -1.6,-8.6 0,-13.2 Z',
        'M9.1,-10.2 C10.2,-6.5 10.5,-0.5 10.2,10 L8,10 C7.7,-0.5 8,-6.5 9.1,-10.2 Z',
        mirror('M9.1,-10.2 C10.2,-6.5 10.5,-0.5 10.2,10 L8,10 C7.7,-0.5 8,-6.5 9.1,-10.2 Z'),
    ],
    beams: ['M-8.8,-3.2 Q0,-6.2 8.8,-3.2', 'M-8.8,5.4 Q0,3.6 8.8,5.4'],
    deck: 'M0,-10.8 C1,-7.6 1.2,-3 1.1,9.6 L-1.1,9.6 C-1.2,-3 -1,-7.6 0,-10.8 Z',
    cockpit: 'M-1.3,6.4 h2.6 v3.4 a0.9,0.9 0 0 1 -0.9,0.9 h-0.8 a0.9,0.9 0 0 1 -0.9,-0.9 Z',
    mast: [0, -1.8],
    sail: 'M0,-1.8 Q2,4.4 3.1,10.4',
    wake: [{ x: 1.4, y: 11.8 }],
};

/** Ocean Fifty : 15 m sur 15 m, aussi large que long, filets entre les coques */
const OCEAN_FIFTY: Shape = {
    size: 38,
    hulls: [
        'M0,-12 C1.7,-7.8 2.1,-2.2 2,10.8 L-2,10.8 C-2.1,-2.2 -1.7,-7.8 0,-12 Z',
        'M9.2,-8.6 C10.3,-5.2 10.6,0 10.3,8.8 L8.1,8.8 C7.8,0 8.1,-5.2 9.2,-8.6 Z',
        mirror('M9.2,-8.6 C10.3,-5.2 10.6,0 10.3,8.8 L8.1,8.8 C7.8,0 8.1,-5.2 9.2,-8.6 Z'),
    ],
    nets: ['M2,-3.4 L8.2,-3.4 L8.2,4.6 L2,4.6 Z', mirror('M2,-3.4 L8.2,-3.4 L8.2,4.6 L2,4.6 Z')],
    beams: ['M-8.6,-3.4 Q0,-4.6 8.6,-3.4', 'M-8.6,4.6 Q0,3.8 8.6,4.6'],
    deck: 'M0,-9.8 C1.1,-6.6 1.3,-2.2 1.2,9 L-1.2,9 C-1.3,-2.2 -1.1,-6.6 0,-9.8 Z',
    cockpit: 'M-1.4,5.6 h2.8 v3.6 a0.9,0.9 0 0 1 -0.9,0.9 h-1 a0.9,0.9 0 0 1 -0.9,-0.9 Z',
    mast: [0, -1.4],
    sail: 'M0,-1.4 Q2,4 3,9.6',
    wake: [{ x: 1.5, y: 11 }],
};

/** Multicoques de l'ancienne génération : trimarans plus étroits */
const VINTAGE_MULTI: Shape = {
    size: 34,
    hulls: [
        'M0,-12.4 C1.9,-8.2 2.4,-2.6 2.3,11.2 L-2.3,11.2 C-2.4,-2.6 -1.9,-8.2 0,-12.4 Z',
        'M7.2,-8 C8.2,-4.8 8.5,0 8.2,8.4 L6.2,8.4 C5.9,0 6.2,-4.8 7.2,-8 Z',
        mirror('M7.2,-8 C8.2,-4.8 8.5,0 8.2,8.4 L6.2,8.4 C5.9,0 6.2,-4.8 7.2,-8 Z'),
    ],
    nets: ['M2.3,-2.8 L6.3,-2.8 L6.3,4.2 L2.3,4.2 Z', mirror('M2.3,-2.8 L6.3,-2.8 L6.3,4.2 L2.3,4.2 Z')],
    beams: ['M-6.8,-2.8 Q0,-4 6.8,-2.8', 'M-6.8,4.2 Q0,3.4 6.8,4.2'],
    deck: 'M0,-10.2 C1.3,-6.9 1.6,-2.4 1.5,9.4 L-1.5,9.4 C-1.6,-2.4 -1.3,-6.9 0,-10.2 Z',
    cockpit: 'M-1.5,5.8 h3 v3.6 a0.9,0.9 0 0 1 -0.9,0.9 h-1.2 a0.9,0.9 0 0 1 -0.9,-0.9 Z',
    mast: [0, -1.6],
    sail: 'M0,-1.6 Q2,4 3,9.8',
    wake: [{ x: 1.7, y: 11.4 }],
};

const SHAPES: Record<string, Shape> = {
    ultim: ULTIM,
    'ocean-fifty': OCEAN_FIFTY,
    imoca: IMOCA,
    class40: CLASS40,
    'vintage-multi': VINTAGE_MULTI,
    'vintage-mono': MONO,
};

/** Multicoques connus, pour les classes qui n'ont pas leur propre silhouette */
const MULTI_KEYS = /multi|ultim|fifty|trimaran|catamaran/i;

export const shapeFor = (classKey: string): Shape =>
    SHAPES[classKey] || (MULTI_KEYS.test(classKey) ? VINTAGE_MULTI : MONO);

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
    color: string;
    /** Vitesse en nœuds, pour la longueur du sillage */
    speed: number;
    /** Bateau arrêté (abandon, escale) : ni sillage ni voile */
    stopped: boolean;
}

/** SVG complet d'un bateau, cap 0 */
export function boatSvg({ classKey, color, speed, stopped }: BoatIconOptions) {
    const s = shapeFor(classKey);
    const light = luminance(color) > 0.45;
    const edge = shade(color, light ? -0.55 : -0.62);
    const deck = shade(color, light ? 0.35 : 0.28);
    const parts: string[] = [];

    if (!stopped && speed > 1.5) {
        // Sillage en V derrière le tableau, plus long quand le bateau va vite
        const k = clamp(speed / 24, 0.3, 1);
        const len = 8 * k;
        const r = (v: number) => Math.round(v * 100) / 100;
        for (const w of s.wake) {
            // w.x : demi largeur du tableau, le V part de ses deux coins
            const x0 = r(w.x * 0.8);
            const x1 = r(w.x + 2.6 * k + 0.8);
            const y1 = r(w.y + len);
            parts.push(
                `<path d="M${-x0},${w.y} L${-x1},${y1} M${x0},${w.y} L${x1},${y1}" stroke="#fff" stroke-opacity=".6" stroke-width=".85" stroke-linecap="round" fill="none"/>`,
                `<path d="M0,${r(w.y + 0.3)} L0,${r(w.y + len * 0.7)}" stroke="#fff" stroke-opacity=".3" stroke-width="${r(w.x * 1.1)}" stroke-linecap="round"/>`,
            );
        }
    }

    for (const d of s.nets || []) {
        parts.push(`<path d="${d}" fill="#fff" fill-opacity=".22" stroke="${edge}" stroke-opacity=".5" stroke-width=".35"/>`);
    }
    for (const d of s.beams || []) {
        parts.push(
            `<path d="${d}" fill="none" stroke="${edge}" stroke-width="2.5" stroke-linecap="round"/>`,
            `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>`,
        );
    }
    for (const d of s.foils || []) {
        parts.push(`<path d="${d}" fill="none" stroke="${edge}" stroke-width="1.15" stroke-linecap="round"/>`);
    }
    for (const d of s.hulls) {
        parts.push(`<path d="${d}" fill="${color}" stroke="${edge}" stroke-width=".9" stroke-linejoin="round"/>`);
    }
    parts.push(
        `<path d="${s.deck}" fill="${deck}" fill-opacity=".55"/>`,
        `<path d="${s.cockpit}" fill="${edge}" fill-opacity=".55"/>`,
    );
    if (!stopped) {
        parts.push(
            `<path d="${s.sail}" fill="none" stroke="${edge}" stroke-width="1.9" stroke-linecap="round" stroke-opacity=".55"/>`,
            `<path d="${s.sail}" fill="none" stroke="#fff" stroke-width="1.05" stroke-linecap="round"/>`,
        );
    }
    parts.push(
        `<circle cx="${s.mast[0]}" cy="${s.mast[1]}" r=".95" fill="#fff" stroke="${edge}" stroke-width=".6"/>`,
    );
    return `<svg viewBox="-20 -20 40 40" width="100%" height="100%" aria-hidden="true">${parts.join('')}</svg>`;
}

/** Taille d'affichage en pixels selon la classe et le zoom de la carte */
export function boatSize(classKey: string, zoom: number, selected: boolean) {
    const base = shapeFor(classKey).size;
    const z = zoom <= 3 ? 0.78 : zoom <= 4 ? 0.9 : zoom >= 8 ? 1.45 : zoom >= 7 ? 1.3 : zoom >= 6 ? 1.15 : 1;
    return Math.round(base * z * (selected ? 1.35 : 1));
}
