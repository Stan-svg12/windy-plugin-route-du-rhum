import { ROUTES_URL, ROUTED_URL, HAS_REPO } from './config';
import { escapeHtml } from './format';

/** Routages calculés par le workflow « routing » (routing/run_routing.py) */

export type OptKey = 'opt' | 'nord' | 'sud';

export interface RoutePoint {
    t: number; // epoch ms
    lat: number;
    lon: number;
    tws: number; // nœuds, segment qui part de ce point
    twa: number; // degrés, signé (négatif = bâbord amures)
}

export interface RouteOpt {
    key: OptKey;
    label: string;
    ok: boolean;
    reason: string | null;
    eta: number | null; // epoch ms
    beyond: boolean;
    man: number;
    gate: [number, number] | null;
    pts: RoutePoint[];
}

export interface BoatRouting {
    skip: string | null;
    polar: string | null;
    opts: RouteOpt[];
}

export interface RoutesFile {
    model: string;
    horizon: number; // epoch ms
    maj: number; // epoch ms du pointage de départ
    computed: number;
    perf: Record<string, number>;
    boats: Record<string, BoatRouting>;
}

export const ORDER: OptKey[] = ['opt', 'nord', 'sud'];
export const COLORS: Record<OptKey, string> = { opt: '#ffffff', nord: '#3fe0ff', sud: '#ffd23f' };
const DASH: Record<OptKey, string | undefined> = { opt: undefined, nord: '8 6', sud: '8 6' };

const decode = (enc: number[], t0: number): RoutePoint[] => {
    const out: RoutePoint[] = [];
    let m = 0;
    let la = 0;
    let lo = 0;
    for (let i = 0; i + 4 < enc.length; i += 5) {
        m += enc[i];
        la += enc[i + 1];
        lo += enc[i + 2];
        out.push({ t: t0 + m * 60000, lat: la / 1000, lon: lo / 1000, tws: enc[i + 3] / 10, twa: enc[i + 4] });
    }
    return out;
};

const parse = (raw: any): RoutesFile => {
    const t0 = Number(raw.t0) * 1000;
    const boats: Record<string, BoatRouting> = {};
    for (const [id, b] of Object.entries<any>(raw.boats || {})) {
        boats[id] = {
            skip: b.skip || null,
            polar: b.polar || null,
            opts: ORDER.filter(k => b.opts && b.opts[k]).map(k => {
                const o = b.opts[k];
                return {
                    key: k,
                    label: String(o.label || k),
                    ok: !!o.ok,
                    reason: o.reason || null,
                    eta: typeof o.eta === 'number' ? o.eta * 1000 : null,
                    beyond: !!o.beyond,
                    man: Number(o.man) || 0,
                    gate: Array.isArray(o.gate) ? [Number(o.gate[0]), Number(o.gate[1])] : null,
                    pts: Array.isArray(o.p) ? decode(o.p.map(Number), t0) : [],
                };
            }),
        };
    }
    return {
        model: String(raw.model || ''),
        horizon: Date.parse(raw.horizon),
        maj: Date.parse(raw.maj),
        computed: Date.parse(raw.computed),
        perf: raw.perf || {},
        boats,
    };
};

export const loadRoutes = async (): Promise<RoutesFile | null> => {
    if (!HAS_REPO) {
        return null;
    }
    const url = `${ROUTES_URL}?v=${Math.floor(Date.now() / 600000)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    return parse(await res.json());
};

export const loadRoutedIds = async (): Promise<Set<string> | null> => {
    if (!HAS_REPO) {
        return null;
    }
    const res = await fetch(`${ROUTED_URL}?v=${Math.floor(Date.now() / 600000)}`, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    const ids = await res.json();
    return new Set((Array.isArray(ids) ? ids : []).map(String));
};

/** Position interpolée le long d'une route à l'instant t (ms), ou null hors de la route */
export const positionAt = (pts: RoutePoint[], t: number): RoutePoint | null => {
    if (pts.length < 2 || t < pts[0].t || t > pts[pts.length - 1].t) {
        return null;
    }
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (t <= b.t) {
            const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
            return { t, lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, tws: a.tws, twa: a.twa };
        }
    }
    return null;
};

const etaFmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});
const runFmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
});

export const etaLabel = (ms: number | null) => (ms ? etaFmt.format(new Date(ms)) : '–');

const delta = (ms: number) => {
    const h = Math.round(ms / 360000) / 10;
    if (Math.abs(h) < 0.1) {
        return '=';
    }
    const sign = h > 0 ? '+' : '−';
    const a = Math.abs(h);
    return a >= 24 ? `${sign}${Math.floor(a / 24)} j ${Math.round(a % 24)} h` : `${sign}${a.toFixed(a < 10 ? 1 : 0)} h`;
};

/** Bloc HTML inséré dans la bulle d'un bateau */
export const routingHtml = (
    boatId: string,
    state: 'off' | 'loading' | 'error' | 'on',
    r: BoatRouting | null,
    file: RoutesFile | null,
    classKey: string,
): string => {
    const id = escapeHtml(boatId);
    if (state === 'off') {
        return `<div class="rdr-route"><a href="#" class="rdr-route__btn" data-rdr-action="route" data-rdr-id="${id}">🧭 Afficher le routage</a></div>`;
    }
    if (state === 'loading') {
        return `<div class="rdr-route"><span class="rdr-route__msg">Chargement du routage…</span></div>`;
    }
    const hide = `<a href="#" class="rdr-route__btn" data-rdr-action="route" data-rdr-id="${id}">Masquer le routage</a>`;
    if (state === 'error' || !file) {
        return `<div class="rdr-route"><span class="rdr-route__msg">Routage indisponible pour le moment.</span>${hide}</div>`;
    }
    if (!r) {
        return `<div class="rdr-route"><span class="rdr-route__msg">Pas encore de routage pour ce bateau (prochain calcul sous 3 h).</span>${hide}</div>`;
    }
    if (r.skip) {
        return `<div class="rdr-route"><span class="rdr-route__msg">${escapeHtml(r.skip)}</span>${hide}</div>`;
    }
    const best = r.opts.find(o => o.key === 'opt' && o.eta);
    const rows = r.opts
        .map(o => {
            const eta = o.eta ? etaLabel(o.eta) : escapeHtml(o.reason || 'non abouti');
            const d = best && best.eta && o.eta && o.key !== 'opt' ? `<small>${delta(o.eta - best.eta)}</small>` : '';
            const flags = [o.beyond ? 'au delà des 10 j du modèle' : '', o.man ? `${o.man} manœuvre${o.man > 1 ? 's' : ''}` : '']
                .filter(Boolean)
                .join(' · ');
            return `<tr><td><i style="--rc:${COLORS[o.key]}"></i>${escapeHtml(o.label)}</td><td><b>${eta}</b> ${d}${flags ? `<br><small>${flags}</small>` : ''}</td></tr>`;
        })
        .join('');
    const perf = file.perf[classKey];
    const polar = r.polar;
    const meta = [
        escapeHtml(file.model.replace(/^ECMWF IFS 0.25° /, 'ECMWF ')),
        `départ pointage ${runFmt.format(new Date(file.maj))} UTC`,
        polar ? `polaire ${escapeHtml(polar.replace(/\.csv$/, ''))}${perf ? ` × ${Math.round(perf * 100)} %` : ''}` : '',
    ]
        .filter(Boolean)
        .join(' · ');
    return `<div class="rdr-route">
  <div class="rdr-route__title">Routage · arrivée estimée (heure de Paris)</div>
  <table class="rdr-route__grid">${rows}</table>
  <div class="rdr-route__meta">${meta}<br>La frise Windy déplace les fantômes du bateau sur chaque route.</div>
  ${hide}
</div>`;
};

/** Couche carte : les 3 routes d'un bateau, repères par jour, fantômes synchronisés sur la frise Windy */
export class RoutingLayer {
    private map: any;
    private group: any = null;
    private ghosts: { key: OptKey; pts: RoutePoint[]; marker: any }[] = [];

    constructor(map: any) {
        this.map = map;
    }

    get visible() {
        return !!this.group;
    }

    show(r: BoatRouting, horizon: number) {
        this.hide();
        const g = L.layerGroup();
        this.ghosts = [];
        // Les options d'abord, l'optimale par dessus
        for (const o of [...r.opts].reverse()) {
            if (o.pts.length < 2) {
                continue;
            }
            const color = COLORS[o.key];
            const inH = o.pts.filter(p => p.t <= horizon).map(p => [p.lat, p.lon]);
            const outH = o.pts.filter((p, i) => p.t >= horizon || (o.pts[i + 1] && o.pts[i + 1].t > horizon)).map(p => [p.lat, p.lon]);
            const all = o.pts.map(p => [p.lat, p.lon]);
            L.polyline(all as any, { color: '#000', weight: 5, opacity: 0.45, interactive: false }).addTo(g);
            if (inH.length > 1) {
                L.polyline(inH as any, { color, weight: 2.5, opacity: 0.95, dashArray: DASH[o.key], interactive: false }).addTo(g);
            }
            if (outH.length > 1) {
                L.polyline(outH as any, { color, weight: 2, opacity: 0.4, dashArray: '2 6', interactive: false }).addTo(g);
            }
            // Un repère par jour depuis le départ du routage
            const t0 = o.pts[0].t;
            for (let d = 1; ; d++) {
                const p = positionAt(o.pts, t0 + d * 86400000);
                if (!p) {
                    break;
                }
                L.circleMarker([p.lat, p.lon], {
                    radius: 3,
                    color: '#000',
                    weight: 1,
                    fillColor: color,
                    fillOpacity: 1,
                    interactive: false,
                }).addTo(g);
                if (o.key === 'opt') {
                    L.marker([p.lat, p.lon], {
                        interactive: false,
                        icon: L.divIcon({ className: 'rdr-route-day', html: `J+${d}`, iconSize: [30, 14], iconAnchor: [-6, 7] }),
                    }).addTo(g);
                }
            }
            if (o.gate) {
                L.marker(o.gate as any, {
                    interactive: false,
                    icon: L.divIcon({
                        className: 'rdr-route-gate',
                        html: `<span style="--rc:${color}">◆</span>`,
                        iconSize: [14, 14],
                        iconAnchor: [7, 7],
                    }),
                }).addTo(g);
            }
            const ghost = L.circleMarker([o.pts[0].lat, o.pts[0].lon], {
                radius: 6,
                color: '#000',
                weight: 2,
                fillColor: color,
                fillOpacity: 0.9,
                interactive: false,
            });
            ghost.addTo(g);
            this.ghosts.push({ key: o.key, pts: o.pts, marker: ghost });
        }
        g.addTo(this.map);
        this.group = g;
    }

    /** Place les fantômes à l'instant affiché par la frise Windy */
    setTime(ms: number) {
        for (const gh of this.ghosts) {
            const p = positionAt(gh.pts, ms);
            if (p) {
                gh.marker.setLatLng([p.lat, p.lon]);
                gh.marker.setStyle({ opacity: 1, fillOpacity: 0.9 });
            } else {
                gh.marker.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        }
    }

    hide() {
        if (this.group) {
            this.map.removeLayer(this.group);
            this.group = null;
        }
        this.ghosts = [];
    }
}
