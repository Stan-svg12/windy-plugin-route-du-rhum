import type { Boat } from './types';
import { boatSize, boatSvg } from './boatIcons';
import { FINISH, START } from './config';
import { deg, escapeHtml, isFinished, knots, latLon, nm, ordinal, statusLabel } from './format';

export type LabelMode = 'none' | 'leaders' | 'all';

/** Points intermédiaires de l'orthodromie (route la plus courte sur la sphère) */
const greatCircle = (a: { lat: number; lon: number }, b: { lat: number; lon: number }, n = 64) => {
    const r = Math.PI / 180;
    const [la1, lo1, la2, lo2] = [a.lat * r, a.lon * r, b.lat * r, b.lon * r];
    const d =
        2 *
        Math.asin(
            Math.sqrt(
                Math.sin((la2 - la1) / 2) ** 2 +
                    Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2,
            ),
        );
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
        const f = i / n;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
        const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
        const z = A * Math.sin(la1) + B * Math.sin(la2);
        pts.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / r, Math.atan2(y, x) / r]);
    }
    return pts;
};

export interface FreeArea {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

interface Options {
    onSelect: (id: string | null) => void;
    /** Zone de l'écran non couverte par l'interface du plugin */
    freeArea: () => FreeArea;
    mobile: boolean;
}

export class FleetLayer {
    private map: any;
    private markers = new Map<string, any>();
    private lines = new Map<string, any>();
    private boats = new Map<string, Boat>();
    private extras: any[] = [];
    private popup: any = null;
    /** Couches réellement posées sur la carte (évite de dépendre de map.hasLayer) */
    private onMap = new Set<any>();
    private visibleClasses: Set<string> | null = null;
    private showTracks = true;
    private labelMode: LabelMode = 'leaders';
    private selected: string | null = null;
    private favs = new Set<string>();
    private leaders = new Set<string>();
    private opts: Options;
    private ignoreRemove = false;
    /** Palier de zoom utilisé pour la taille des icônes */
    private zoomStep = 5;
    /** Bateaux dont le nom est affiché, après évitement des chevauchements */
    private labelled = new Set<string>();
    /** Zoom exact du dernier calcul des icônes et des étiquettes */
    private lastZoom = NaN;
    private onZoom = () => {
        const z = Number(this.map.getZoom?.());
        if (z === this.lastZoom) {
            return;
        }
        this.zoomStep = this.currentZoomStep();
        this.refreshIcons();
    };

    constructor(map: any, opts: Options) {
        this.map = map;
        this.opts = opts;
        this.zoomStep = this.currentZoomStep();
        // moveend en secours si la carte n'émet pas zoomend : rien n'est recalculé sans changement de zoom
        this.map.on?.('zoomend', this.onZoom);
        this.map.on?.('moveend', this.onZoom);
        this.drawCourse();
    }

    private currentZoomStep() {
        const z = Number(this.map.getZoom?.());
        return Number.isFinite(z) ? Math.max(2, Math.min(9, Math.round(z))) : 5;
    }

    private drawCourse() {
        const route = L.polyline(greatCircle(START, FINISH), {
            color: '#ffffff',
            weight: 1.2,
            opacity: 0.45,
            dashArray: '3 7',
            interactive: false,
        }).addTo(this.map);
        const mk = (p: { lat: number; lon: number }, label: string, cls: string) =>
            L.marker([p.lat, p.lon], {
                interactive: false,
                keyboard: false,
                zIndexOffset: -1000,
                icon: L.divIcon({
                    className: `rdr-mark ${cls}`,
                    html: `<i></i><span>${label}</span>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                }),
            }).addTo(this.map);
        this.extras.push(route, mk(START, 'Départ', 'rdr-mark--start'), mk(FINISH, 'Arrivée', 'rdr-mark--finish'));
    }

    setFavorites(favs: Set<string>) {
        this.favs = new Set(favs);
        this.refreshIcons();
    }

    setLabelMode(mode: LabelMode) {
        this.labelMode = mode;
        this.refreshIcons();
    }

    setShowTracks(show: boolean) {
        this.showTracks = show;
        this.syncVisibility();
    }

    setVisibleClasses(keys: Set<string> | null) {
        this.visibleClasses = keys ? new Set(keys) : null;
        const sel = this.selected ? this.boats.get(this.selected) : null;
        if (sel && !this.isVisible(sel)) {
            this.select(null);
        }
        this.computeLeaders();
        this.syncVisibility();
        this.refreshIcons();
    }

    /** Ajoute ou met à jour tous les bateaux */
    update(boats: Boat[]) {
        const seen = new Set<string>();
        for (const b of boats) {
            seen.add(b.id);
            this.boats.set(b.id, b);
            const latlngs = b.track.length > 1 ? b.track : [[b.lat, b.lon]];
            let line = this.lines.get(b.id);
            if (line) {
                line.setLatLngs(latlngs);
                line.setStyle(this.lineStyle(b));
            } else {
                line = L.polyline(latlngs as any, this.lineStyle(b));
                line.on('click', () => this.select(b.id, true));
                this.lines.set(b.id, line);
            }
            let marker = this.markers.get(b.id);
            if (marker) {
                marker.setLatLng([b.lat, b.lon]);
            } else {
                marker = L.marker([b.lat, b.lon], {
                    icon: this.icon(b),
                    riseOnHover: true,
                    title: `${b.fullName} · ${b.boatName}`,
                });
                marker.on('click', () => this.select(b.id, true));
                this.markers.set(b.id, marker);
            }
        }
        for (const id of [...this.markers.keys()]) {
            if (!seen.has(id)) {
                this.place(this.markers.get(id), false);
                this.place(this.lines.get(id), false);
                this.markers.delete(id);
                this.lines.delete(id);
                this.boats.delete(id);
            }
        }
        this.computeLeaders();
        this.syncVisibility();
        this.refreshIcons();
        if (this.selected && this.popup && this.boats.has(this.selected)) {
            this.openPopup(this.boats.get(this.selected) as Boat);
        }
    }

    private computeLeaders() {
        this.leaders.clear();
        const perClass = new Map<string, number>();
        const sorted = [...this.boats.values()]
            .filter(b => b.racing || isFinished(b.status))
            .sort((a, b) => a.rank - b.rank);
        for (const b of sorted) {
            const n = perClass.get(b.classKey) || 0;
            if (n < 3) {
                this.leaders.add(b.id);
                perClass.set(b.classKey, n + 1);
            }
        }
    }

    private isVisible(b: Boat) {
        return !this.visibleClasses || this.visibleClasses.has(b.classKey);
    }

    private syncVisibility() {
        for (const [id, b] of this.boats) {
            const vis = this.isVisible(b);
            const marker = this.markers.get(id);
            const line = this.lines.get(id);
            this.place(marker, vis);
            this.place(line, vis && (this.showTracks || id === this.selected));
        }
        if (this.selected) {
            this.lines.get(this.selected)?.bringToFront?.();
        }
    }

    private place(layer: any, show: boolean) {
        if (show && !this.onMap.has(layer)) {
            layer.addTo(this.map);
            this.onMap.add(layer);
        } else if (!show && this.onMap.has(layer)) {
            this.map.removeLayer(layer);
            this.onMap.delete(layer);
        }
    }

    private lineStyle(b: Boat) {
        const sel = b.id === this.selected;
        const dim = !!this.selected && !sel;
        const out = !b.racing && !isFinished(b.status);
        return {
            color: out ? '#9aa4ad' : b.color,
            weight: sel ? 3.2 : 1.6,
            opacity: sel ? 1 : dim ? 0.3 : out ? 0.35 : 0.7,
            interactive: true,
        };
    }

    private showLabel(b: Boat) {
        if (b.id === this.selected || this.favs.has(b.id)) {
            return true;
        }
        if (this.labelMode === 'all') {
            return true;
        }
        return this.labelMode === 'leaders' && this.leaders.has(b.id);
    }

    private icon(b: Boat) {
        const sel = b.id === this.selected;
        const out = !b.racing && !isFinished(b.status);
        const color = out ? '#8c959e' : b.color;
        const size = boatSize(b.classKey, this.zoomStep, sel);
        const svg = boatSvg({
            classKey: b.classKey,
            color,
            speed: b.speed,
            stopped: !b.racing,
        });
        const rank = b.racing && b.rank ? `<b>${b.rank}</b>` : '';
        const label = this.labelled.has(b.id)
            ? `<span class="rdr-boat__label">${rank}${this.favs.has(b.id) ? '★ ' : ''}${escapeHtml(b.lastName)}</span>`
            : '';
        const classes = ['rdr-boat', sel ? 'rdr-boat--sel' : '', out ? 'rdr-boat--out' : ''].join(' ');
        return L.divIcon({
            className: 'rdr-boat-icon',
            html: `<div class="${classes}" style="--c:${color};--s:${size}px"><div class="rdr-boat__hull" style="transform:rotate(${Math.round(
                b.heading,
            )}deg)">${svg}</div>${label}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }

    /** Position écran d'un point, pour comparer les étiquettes entre elles */
    private toScreen(lat: number, lon: number): { x: number; y: number } | null {
        const m = this.map;
        try {
            if (typeof m.latLngToContainerPoint === 'function') {
                return m.latLngToContainerPoint([lat, lon]);
            }
            const z = m.getZoom();
            const c = m.project(m.getCenter(), z);
            const q = m.project([lat, lon], z);
            return { x: q.x - c.x, y: q.y - c.y };
        } catch {
            return null;
        }
    }

    /**
     * Choisit les noms à afficher : sélection et favoris toujours, puis les autres par ordre
     * de priorité tant qu'ils ne chevauchent pas une étiquette déjà posée.
     */
    private computeLabels() {
        this.labelled.clear();
        const prio = (b: Boat) =>
            b.id === this.selected ? -2 : this.favs.has(b.id) ? -1 : (this.leaders.has(b.id) ? 0 : 1000) + b.rank;
        const candidates = [...this.boats.values()]
            .filter(b => this.isVisible(b) && this.showLabel(b))
            .sort((a, b) => prio(a) - prio(b));
        const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
        for (const b of candidates) {
            const must = b.id === this.selected || this.favs.has(b.id);
            const p = this.toScreen(b.lat, b.lon);
            if (!p) {
                this.labelled.add(b.id);
                continue;
            }
            const size = boatSize(b.classKey, this.zoomStep, b.id === this.selected);
            const chars = b.lastName.length + (b.racing && b.rank ? String(b.rank).length + 1 : 0) + (this.favs.has(b.id) ? 2 : 0);
            const x0 = p.x + 0.26 * size;
            const r = { x0, y0: p.y - 9, x1: x0 + 14 + chars * 6.8, y1: p.y + 9 };
            const hit = placed.some(q => r.x0 < q.x1 + 3 && r.x1 + 3 > q.x0 && r.y0 < q.y1 + 1 && r.y1 + 1 > q.y0);
            if (must || !hit) {
                placed.push(r);
                this.labelled.add(b.id);
            }
        }
    }

    private refreshIcons() {
        this.lastZoom = Number(this.map.getZoom?.());
        this.computeLabels();
        for (const [id, b] of this.boats) {
            const m = this.markers.get(id);
            m.setIcon(this.icon(b));
            const z = id === this.selected ? 2000 : this.favs.has(id) ? 1000 : this.leaders.has(id) ? 500 : 0;
            m.setZIndexOffset(z);
            this.lines.get(id)?.setStyle(this.lineStyle(b));
        }
        this.syncVisibility();
    }

    select(id: string | null, fromMap = false) {
        if (id === this.selected && !fromMap) {
            const b = id ? this.boats.get(id) : null;
            if (b) {
                this.flyTo(b);
                this.openPopup(b);
                this.opts.onSelect(this.selected);
            }
            return;
        }
        this.selected = id && this.boats.has(id) ? id : null;
        this.refreshIcons();
        const b = this.selected ? this.boats.get(this.selected) : null;
        if (b) {
            if (!fromMap) {
                this.flyTo(b);
            }
            this.openPopup(b);
        } else {
            this.closePopup();
        }
        this.opts.onSelect(this.selected);
    }

    private flyTo(b: Boat) {
        // setView plutôt que flyTo : dans Leaflet GL, flyTo ajoute un niveau de zoom
        const current = this.map.getZoom ? this.map.getZoom() : 5;
        const zoom = Math.max(current, 6);
        try {
            this.map.setView([b.lat, b.lon], zoom, { animate: true });
        } catch {
            this.map.setView([b.lat, b.lon], zoom);
        }
    }

    private closePopup() {
        if (this.popup) {
            this.map.removeLayer(this.popup);
            this.popup = null;
        }
    }

    popupHtml(b: Boat, wind: string | null) {
        const move = b.rankBefore ? b.rankBefore - b.rank : 0;
        const moveHtml = move > 0 ? `<em class="up">▲${move}</em>` : move < 0 ? `<em class="down">▼${-move}</em>` : '';
        const gap = b.dtl > 0.05 ? `à ${nm(b.dtl)} du leader` : b.racing ? 'Leader de la classe' : '';
        const photo = b.photo
            ? `<img class="rdr-pop__photo" src="${escapeHtml(b.photo)}" alt="" onerror="this.remove()">`
            : '';
        const status = b.racing
            ? `${ordinal(b.rank)} / ${b.classSize} ${moveHtml}`
            : `<b class="rdr-pop__status">${escapeHtml(statusLabel(b.status))}</b>`;
        return `<div class="rdr-pop" style="--c:${b.classColor}">
  <div class="rdr-pop__head">${photo}<div>
    <div class="rdr-pop__name">${escapeHtml(b.fullName)}</div>
    <div class="rdr-pop__boat">${escapeHtml(b.boatName)}${b.sail ? ` · ${escapeHtml(b.sail)}` : ''}</div>
    <div class="rdr-pop__class"><i></i>${escapeHtml(b.className)} · ${status}</div>
  </div></div>
  <table class="rdr-pop__grid">
    <tr><td>Arrivée</td><td><b>${nm(b.dtf)}</b>${gap ? `<br><small>${gap}</small>` : ''}</td></tr>
    <tr><td>Vitesse</td><td><b>${knots(b.speed)}</b>${b.speed24h !== null ? `<br><small>moyenne 24 h ${knots(b.speed24h)}</small>` : ''}</td></tr>
    <tr><td>Cap</td><td>${deg(b.heading)}${b.vmg !== null ? ` · VMG ${knots(b.vmg)}` : ''}</td></tr>
    <tr><td>Position</td><td>${latLon(b.lat, b.lon)}</td></tr>
    ${wind ? `<tr><td>Vent carte</td><td><b>${wind}</b></td></tr>` : ''}
  </table>
  <div class="rdr-pop__actions">
    <a href="#" data-rdr-action="weather" data-rdr-id="${escapeHtml(b.id)}">☁ Météo ici</a>
    ${b.profileUrl ? `<a href="${escapeHtml(b.profileUrl)}" target="_blank" rel="noopener">Fiche skipper ↗</a>` : ''}
  </div>
</div>`;
    }

    openPopup(b: Boat, wind: string | null = null) {
        const html = this.popupHtml(b, wind);
        if (this.popup) {
            this.popup.setLatLng([b.lat, b.lon]);
            this.popup.setContent(html);
            return;
        }
        this.popup = L.popup({
            className: 'rdr-popup',
            maxWidth: 300,
            minWidth: 240,
            autoPan: true,
            closeButton: true,
            offset: [0, -10],
        } as any)
            .setLatLng([b.lat, b.lon])
            .setContent(html)
            .openOn(this.map);
        const popup = this.popup;
        popup.on?.('remove', () => {
            if (!this.ignoreRemove && this.popup === popup) {
                this.popup = null;
                if (this.selected) {
                    this.selected = null;
                    this.refreshIcons();
                    this.opts.onSelect(null);
                }
            }
        });
    }

    /** Ferme la bulle en gardant le bateau sélectionné (avant d'ouvrir la météo Windy) */
    hidePopup() {
        if (this.popup) {
            this.ignoreRemove = true;
            this.map.removeLayer(this.popup);
            this.popup = null;
            this.ignoreRemove = false;
        }
    }

    getBoat(id: string) {
        return this.boats.get(id);
    }

    get selectedId() {
        return this.selected;
    }

    /**
     * Cadre la carte sur les bateaux visibles, dans la zone de carte réellement libre
     * (hors panneau du plugin). Windy décale lui même le conteneur de la carte quand un
     * panneau est ouvert : on travaille donc en coordonnées écran converties en
     * coordonnées du conteneur, sans s'appuyer sur fitBounds.
     */
    fit(animate = false) {
        const pts = [...this.boats.values()].filter(b => this.isVisible(b));
        if (!pts.length) {
            return;
        }
        const S = Math.min(...pts.map(b => b.lat));
        const N = Math.max(...pts.map(b => b.lat));
        const W = Math.min(...pts.map(b => b.lon));
        const E = Math.max(...pts.map(b => b.lon));
        const m = this.map;
        try {
            const size = m.getSize();
            const rect = (m.getContainer() as HTMLElement).getBoundingClientRect();
            const free = this.opts.freeArea();
            const pad = this.opts.mobile
                ? { l: 24, t: 70, r: 24, b: 24 }
                : { l: 70, t: 100, r: 60, b: 130 };
            const x0 = free.left + pad.l - rect.left;
            const x1 = free.right - pad.r - rect.left;
            const y0 = free.top + pad.t - rect.top;
            const y1 = free.bottom - pad.b - rect.top;
            const availW = Math.max(100, x1 - x0);
            const availH = Math.max(100, y1 - y0);
            const sw0 = m.project([S, W], 0);
            const ne0 = m.project([N, E], 0);
            const dx = Math.max(1e-6, Math.abs(ne0.x - sw0.x));
            const dy = Math.max(1e-6, Math.abs(sw0.y - ne0.y));
            let zoom = Math.min(Math.log2(availW / dx), Math.log2(availH / dy));
            zoom = Math.max(2, Math.min(8, Math.floor(zoom * 4) / 4));
            const sw = m.project([S, W], zoom);
            const ne = m.project([N, E], zoom);
            const bcx = (sw.x + ne.x) / 2;
            const bcy = (sw.y + ne.y) / 2;
            // Le centre de la carte s'affiche au milieu du conteneur
            const center = m.unproject(
                new L.Point(bcx - ((x0 + x1) / 2 - size.x / 2), bcy - ((y0 + y1) / 2 - size.y / 2)),
                zoom,
            );
            m.setView(center, zoom, { animate });
        } catch (e) {
            console.warn('[route-du-rhum] cadrage simplifié', e);
            m.setView([(S + N) / 2, (W + E) / 2], 4);
        }
    }

    destroy() {
        this.map.off?.('zoomend', this.onZoom);
        this.map.off?.('moveend', this.onZoom);
        this.closePopup();
        for (const layer of this.onMap) {
            this.map.removeLayer(layer);
        }
        this.onMap.clear();
        for (const e of this.extras) {
            this.map.removeLayer(e);
        }
        this.markers.clear();
        this.lines.clear();
        this.boats.clear();
        this.extras = [];
    }
}
