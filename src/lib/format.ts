const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const timeFmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
});
const dayFmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
});

export const nm = (v: number | null | undefined): string =>
    v === null || v === undefined || !Number.isFinite(v) ? '–' : `${nf0.format(v)} mn`;

export const knots = (v: number | null | undefined): string =>
    v === null || v === undefined || !Number.isFinite(v) ? '–' : `${nf1.format(v)} nd`;

export const deg = (v: number | null | undefined): string =>
    v === null || v === undefined || !Number.isFinite(v) ? '–' : `${Math.round(v) % 360}°`;

export const parisTime = (d: Date | null): string => (d ? timeFmt.format(d) : '–');

export const parisDay = (d: Date): string => dayFmt.format(d);

/** 46°14,1'N 28°10,6'W */
export const latLon = (lat: number, lon: number): string => {
    const f = (v: number, pos: string, neg: string) => {
        const a = Math.abs(v);
        const d = Math.floor(a);
        const m = (a - d) * 60;
        return `${d}°${nf1.format(m).padStart(4, '0')}'${v >= 0 ? pos : neg}`;
    };
    return `${f(lat, 'N', 'S')} ${f(lon, 'E', 'W')}`;
};

export const ordinal = (n: number): string => (n === 1 ? '1er' : `${n}e`);

/** Jour de course, le jour du départ étant le jour 1 */
export const raceDay = (start: Date, now: Date): number =>
    Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1);

export const elapsed = (start: Date, now: Date): string => {
    const ms = Math.max(0, now.getTime() - start.getTime());
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${d} j ${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')}`;
};

export const minutesUntil = (d: Date | null, now: Date): number | null =>
    d ? Math.round((d.getTime() - now.getTime()) / 60000) : null;

const STATUS: Record<string, string> = {
    RAC: 'En course',
    ARV: 'Arrivé',
    ARR: 'Arrivé',
    FIN: 'Arrivé',
    RET: 'Abandon',
    ABD: 'Abandon',
    DNF: 'Abandon',
    DNS: 'Non partant',
    DNC: 'Non partant',
    DSQ: 'Disqualifié',
    STB: 'Escale',
    STM: 'Escale',
    SUS: 'Suspendu',
    HLD: 'Arrêt',
};

export const statusLabel = (code: string): string => STATUS[code] || code;

export const isRacing = (code: string): boolean => code === 'RAC';

export const isFinished = (code: string): boolean => ['ARV', 'ARR', 'FIN'].includes(code);

export const escapeHtml = (s: string): string =>
    String(s ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    );

/** "HOREAU   " devient "Horeau" ; garde les particules en minuscules */
export const prettyName = (s: string): string =>
    String(s || '')
        .trim()
        .toLowerCase()
        .replace(/(^|[\s'’-])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase())
        .replace(/\b(De|Du|Des|La|Le|Van|Von|Da|Di)\b(?=\s)/g, w => w.toLowerCase())
        .replace(/^(\p{L})/u, c => c.toUpperCase());

/** Couleur plus lisible sur fond sombre */
export const readable = (hex: string): string => hex || '#8fb3d9';
