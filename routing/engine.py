"""
Moteur de routage par isochrones.

Unités : positions en degrés, vitesses en nœuds, temps en secondes epoch (UTC), distances en milles.
Le vent est fourni par un WindField (u, v en m/s, convention météo : vecteur vers où va l'air).
"""
from __future__ import annotations

import csv
import math
from dataclasses import dataclass, field

import numpy as np
from global_land_mask import globe

KN_PER_MS = 1.943844
DEG2RAD = math.pi / 180


# ----------------------------------------------------------------------------- polaires


class Polar:
    """Polaire TWA x TWS -> vitesse bateau (nœuds). Interpolation bilinéaire, bornée."""

    def __init__(self, twa: np.ndarray, tws: np.ndarray, speed: np.ndarray, name: str = ''):
        order = np.argsort(twa)
        self.twa = np.asarray(twa, float)[order]
        self.tws = np.asarray(tws, float)
        self.speed = np.asarray(speed, float)[order]
        self.name = name
        # TWA 0 toujours présent et nul : pas de vitesse face au vent
        if self.twa[0] > 0:
            self.twa = np.concatenate([[0.0], self.twa])
            self.speed = np.vstack([np.zeros(len(self.tws)), self.speed])
        # TWS 0 nul pour interpoler proprement dans la pétole
        if self.tws[0] > 0:
            self.tws = np.concatenate([[0.0], self.tws])
            self.speed = np.hstack([np.zeros((len(self.twa), 1)), self.speed])

    @classmethod
    def load(cls, path: str) -> 'Polar':
        """
        Formats acceptés (séparateur ; , tabulation ou espaces) :
          - première ligne : en-tête (ex. "TWA\\TWS"), puis les TWS
          - lignes suivantes : TWA puis les vitesses
        C'est le format .pol d'Expedition / qtVlm / Adrena en export texte.
        """
        with open(path, newline='', encoding='utf-8-sig') as f:
            raw = [ln.strip() for ln in f if ln.strip() and not ln.lstrip().startswith('#')]
        sample = raw[0]
        delim = ';' if ';' in sample else '\t' if '\t' in sample else ',' if ',' in sample else None
        rows = [r for r in (csv.reader(raw, delimiter=delim) if delim else (ln.split() for ln in raw))]
        rows = [[c.strip().replace(',', '.') if delim != ',' else c.strip() for c in r if c.strip() != ''] for r in rows]
        tws = np.array([float(x) for x in rows[0][1:]])
        twa, spd = [], []
        for r in rows[1:]:
            twa.append(float(r[0]))
            vals = [float(x) for x in r[1:]]
            vals += [vals[-1]] * (len(tws) - len(vals))
            spd.append(vals[: len(tws)])
        return cls(np.array(twa), tws, np.array(spd), name=path.split('/')[-1])

    def __call__(self, twa_abs: np.ndarray, tws: np.ndarray) -> np.ndarray:
        a = np.clip(twa_abs, self.twa[0], self.twa[-1])
        w = np.clip(tws, self.tws[0], self.tws[-1])
        i = np.clip(np.searchsorted(self.twa, a) - 1, 0, len(self.twa) - 2)
        j = np.clip(np.searchsorted(self.tws, w) - 1, 0, len(self.tws) - 2)
        fa = (a - self.twa[i]) / (self.twa[i + 1] - self.twa[i])
        fw = (w - self.tws[j]) / (self.tws[j + 1] - self.tws[j])
        s = self.speed
        return (
            s[i, j] * (1 - fa) * (1 - fw)
            + s[i + 1, j] * fa * (1 - fw)
            + s[i, j + 1] * (1 - fa) * fw
            + s[i + 1, j + 1] * fa * fw
        )


# ----------------------------------------------------------------------------- vent


class WindField:
    """Champ de vent régulier lat/lon/temps. Bilinéaire en espace, linéaire en temps."""

    def __init__(self, lats, lons, times, u, v, label=''):
        lats = np.asarray(lats, float)
        if lats[0] > lats[-1]:
            lats = lats[::-1]
            u = u[:, ::-1, :]
            v = v[:, ::-1, :]
        self.lats, self.lons, self.times = lats, np.asarray(lons, float), np.asarray(times, float)
        self.u = np.asarray(u, np.float32)
        self.v = np.asarray(v, np.float32)
        self.dlat = self.lats[1] - self.lats[0]
        self.dlon = self.lons[1] - self.lons[0]
        self.label = label

    @property
    def horizon(self) -> float:
        return float(self.times[-1])

    def save(self, path):
        np.savez_compressed(path, lats=self.lats, lons=self.lons, times=self.times, u=self.u, v=self.v, label=self.label)

    @classmethod
    def open(cls, path):
        d = np.load(path)
        return cls(d['lats'], d['lons'], d['times'], d['u'], d['v'], str(d['label']))

    def _spatial(self, arr, k, lat, lon):
        y = np.clip((lat - self.lats[0]) / self.dlat, 0, len(self.lats) - 1.0001)
        x = np.clip((lon - self.lons[0]) / self.dlon, 0, len(self.lons) - 1.0001)
        i, j = y.astype(int), x.astype(int)
        fy, fx = y - i, x - j
        a = arr[k]
        return (a[i, j] * (1 - fy) * (1 - fx) + a[i + 1, j] * fy * (1 - fx) + a[i, j + 1] * (1 - fy) * fx + a[i + 1, j + 1] * fy * fx)

    def at(self, lat, lon, t):
        """Renvoie (TWS nœuds, TWD degrés d'où vient le vent). Au delà de l'horizon : dernier champ."""
        lat = np.asarray(lat, float)
        lon = np.asarray(lon, float)
        tt = min(max(t, self.times[0]), self.times[-1])
        k = int(np.clip(np.searchsorted(self.times, tt) - 1, 0, len(self.times) - 2))
        f = (tt - self.times[k]) / (self.times[k + 1] - self.times[k])
        u = self._spatial(self.u, k, lat, lon) * (1 - f) + self._spatial(self.u, k + 1, lat, lon) * f
        v = self._spatial(self.v, k, lat, lon) * (1 - f) + self._spatial(self.v, k + 1, lat, lon) * f
        tws = np.hypot(u, v) * KN_PER_MS
        twd = (np.degrees(np.arctan2(-u, -v)) + 360) % 360
        return tws, twd


# ----------------------------------------------------------------------------- géométrie


def gc_dist(lat1, lon1, lat2, lon2):
    """Distance orthodromique en milles."""
    p1, p2 = lat1 * DEG2RAD, lat2 * DEG2RAD
    dp, dl = p2 - p1, (lon2 - lon1) * DEG2RAD
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * 3440.065 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def gc_bearing(lat1, lon1, lat2, lon2):
    p1, p2 = lat1 * DEG2RAD, lat2 * DEG2RAD
    dl = (lon2 - lon1) * DEG2RAD
    y = np.sin(dl) * np.cos(p2)
    x = np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dl)
    return (np.degrees(np.arctan2(y, x)) + 360) % 360


def move(lat, lon, hdg, dist_nm):
    """Déplacement loxodromique court (pas de temps de quelques heures)."""
    h = hdg * DEG2RAD
    nlat = lat + dist_nm * np.cos(h) / 60
    mlat = (lat + nlat) / 2 * DEG2RAD
    nlon = lon + dist_nm * np.sin(h) / (60 * np.maximum(np.cos(mlat), 0.05))
    return nlat, nlon


def crosses_land(lat0, lon0, lat1, lon1, samples=6):
    """Vrai si un des points échantillonnés sur le segment est à terre."""
    hit = np.zeros(lat0.shape, bool)
    for s in np.linspace(0, 1, samples):
        la = lat0 + (lat1 - lat0) * s
        lo = lon0 + (lon1 - lon0) * s
        hit |= globe.is_land(np.clip(la, -89.9, 89.9), ((lo + 180) % 360) - 180)
    return hit


# ----------------------------------------------------------------------------- routage


@dataclass
class Gate:
    """Porte d'option : au passage du méridien lon, la latitude doit être >= lat (N) ou <= lat (S)."""

    lon: float
    lat: float
    side: str  # 'N' ou 'S'


@dataclass
class RouteOptions:
    perf: float = 0.85  # part de la polaire réellement tenue (solitaire, fatigue, réglages)
    maneuver_min: float = 8.0  # minutes perdues à chaque virement ou empannage
    headings_step: float = 5.0
    sectors: int = 360
    dt_schedule: tuple = ((12 * 3600, 3600), (10**9, 3 * 3600))  # 1 h les 12 premières heures, puis 3 h
    max_days: float = 40.0
    gate: Gate | None = None
    finish_radius_nm: float = 3.0


@dataclass
class Route:
    points: list  # [(t, lat, lon, tws, twa_signée, hdg, sog)]
    eta: float | None
    beyond_horizon: bool
    maneuvers: int
    ok: bool = True
    reason: str = ''
    meta: dict = field(default_factory=dict)


def _dt_at(elapsed, schedule):
    for until, dt in schedule:
        if elapsed < until:
            return dt
    return schedule[-1][1]


def route(start, t0, finish, polar: Polar, wind: WindField, opt: RouteOptions = RouteOptions()) -> Route:
    lat0, lon0 = start
    flat, flon = finish
    hdgs = np.arange(0, 360, opt.headings_step)

    # Isochrone courante
    cur = dict(lat=np.array([lat0]), lon=np.array([lon0]), side=np.array([0]), crossed=np.array([False]))
    history = []  # par pas : (t, lat, lon, parent, tws, twa, hdg, sog)
    t = t0
    gate = opt.gate
    max_t = t0 + opt.max_days * 86400

    while t < max_t:
        dt = _dt_at(t - t0, opt.dt_schedule)
        n = len(cur['lat'])

        # --- arrivée possible pendant ce pas ? (cap direct vers la ligne)
        d_fin = gc_dist(cur['lat'], cur['lon'], flat, flon)
        b_fin = gc_bearing(cur['lat'], cur['lon'], flat, flon)
        tws_c, twd_c = wind.at(cur['lat'], cur['lon'], t)
        twa_c = ((b_fin - twd_c + 540) % 360) - 180
        v_fin = np.maximum(polar(np.abs(twa_c), tws_c) * opt.perf, 0.1)
        t_need = np.maximum(d_fin - opt.finish_radius_nm, 0) / v_fin * 3600
        reach = (t_need <= dt) & (d_fin < 60)
        if gate is not None:
            reach &= cur['crossed']
        if reach.any():
            cand = np.where(reach)[0]
            best = cand[np.argmin(t_need[cand])]
            history.append(dict(t=t + t_need[best], lat=np.array([flat]), lon=np.array([flon]), parent=np.array([best]),
                                tws=tws_c[[best]], twa=twa_c[[best]], hdg=b_fin[[best]], sog=v_fin[[best]]))
            return _backtrack(history, t0, start, wind, finish=True, eta=t + t_need[best])

        # --- expansion
        la = np.repeat(cur['lat'], len(hdgs))
        lo = np.repeat(cur['lon'], len(hdgs))
        par = np.repeat(np.arange(n), len(hdgs))
        prev_side = np.repeat(cur['side'], len(hdgs))
        crossed = np.repeat(cur['crossed'], len(hdgs))
        hd = np.tile(hdgs, n)
        tws, twd = wind.at(la, lo, t + dt / 2)
        twa = ((hd - twd + 540) % 360) - 180
        sog = polar(np.abs(twa), tws) * opt.perf
        side = np.sign(twa).astype(int)
        lost = np.where((prev_side != 0) & (side != prev_side), opt.maneuver_min * 60, 0.0)
        dist = sog * np.maximum(dt - lost, 0) / 3600
        nla, nlo = move(la, lo, hd, dist)

        keep = (sog > 0.5) & ~crosses_land(la, lo, nla, nlo)
        if gate is not None:
            cross = (lo > gate.lon) & (nlo <= gate.lon)
            f = np.where(cross, (lo - gate.lon) / np.maximum(lo - nlo, 1e-9), 0)
            lat_at = la + (nla - la) * f
            bad = cross & ((lat_at < gate.lat) if gate.side == 'N' else (lat_at > gate.lat))
            keep &= ~bad
            crossed = crossed | cross
        if not keep.any():
            return Route([], None, False, 0, ok=False, reason='bloqué (terre ou porte)')

        idx = np.where(keep)[0]
        # --- élagage : par secteur d'azimut depuis le départ, on garde le point le plus proche de l'arrivée
        #     (plus robuste que « le plus loin du départ » quand la route s'écarte de l'orthodromie)
        brg = gc_bearing(lat0, lon0, nla[idx], nlo[idx])
        sect = (brg / (360 / opt.sectors)).astype(int)
        score = gc_dist(nla[idx], nlo[idx], flat, flon)
        if gate is not None:
            # Avant la porte, la distance à l'arrivée pénaliserait l'option : on vise d'abord la porte
            pre = ~crossed[idx]
            gd = gc_dist(nla[idx], nlo[idx], gate.lat, gate.lon) + gc_dist(gate.lat, gate.lon, flat, flon)
            score = np.where(pre, gd, score)
            sect = sect + np.where(pre, 0, opt.sectors)  # isochrones avant/après porte élaguées séparément
        order = np.lexsort((score, sect))
        sel_sorted = order[np.r_[True, sect[order][1:] != sect[order][:-1]]]
        sel = idx[sel_sorted]

        history.append(dict(t=t + dt, lat=nla[sel], lon=nlo[sel], parent=par[sel], tws=tws[sel], twa=twa[sel],
                            hdg=hd[sel], sog=sog[sel]))
        cur = dict(lat=nla[sel], lon=nlo[sel], side=side[sel], crossed=crossed[sel])
        t += dt

    # Pas arrivé dans la limite : on rend le meilleur point atteint
    d = gc_dist(cur['lat'], cur['lon'], flat, flon)
    r = _backtrack(history, t0, start, wind, finish=False, eta=None, last_index=int(np.argmin(d)))
    r.ok = False
    r.reason = 'durée maximale atteinte'
    return r


def _backtrack(history, t0, start, wind, finish, eta, last_index=0):
    pts = []
    k = last_index
    for step in reversed(history):
        pts.append((float(step['t']), float(step['lat'][k]), float(step['lon'][k]), float(step['tws'][k]),
                    float(step['twa'][k]), float(step['hdg'][k]), float(step['sog'][k])))
        k = int(step['parent'][k])
    pts.append((float(t0), float(start[0]), float(start[1]), np.nan, np.nan, np.nan, np.nan))
    pts.reverse()
    # Le vent/cap d'un point décrit le segment qui y arrive : on le reporte sur le point de départ du segment
    shifted = []
    for i, p in enumerate(pts):
        nxt = pts[i + 1] if i + 1 < len(pts) else p
        shifted.append((p[0], p[1], p[2], nxt[3], nxt[4], nxt[5], nxt[6]))
    signs = [np.sign(p[4]) for p in shifted if not np.isnan(p[4])]
    man = int(sum(1 for a, b in zip(signs, signs[1:]) if a != b and a != 0 and b != 0))
    end_t = eta if eta is not None else shifted[-1][0]
    return Route(points=shifted, eta=eta, beyond_horizon=end_t > wind.horizon, maneuvers=man)


# ----------------------------------------------------------------------------- 3 options


def lat_at_lon(points, lon):
    for a, b in zip(points, points[1:]):
        if (a[2] - lon) * (b[2] - lon) <= 0 and a[2] != b[2]:
            f = (a[2] - lon) / (a[2] - b[2])
            return a[1] + (b[1] - a[1]) * f
    return None


def route_legs(start, t0, waypoints, polar, wind, opt: RouteOptions):
    """Enchaîne les étapes (ex. tour de Basse-Terre). La porte d'option ne s'applique qu'à la première étape."""
    pts, man, beyond = [], 0, False
    pos, t = start, t0
    for i, wp in enumerate(waypoints):
        o = opt if i == 0 else RouteOptions(**{**opt.__dict__, 'gate': None, 'dt_schedule': ((10**9, 1800),)})
        r = route(pos, t, wp, polar, wind, o)
        if not r.ok or r.eta is None:
            r.points = pts + r.points
            return r
        pts += r.points if not pts else r.points[1:]
        man += r.maneuvers
        beyond |= r.beyond_horizon
        pos, t = wp, r.eta
    return Route(points=pts, eta=t, beyond_horizon=beyond, maneuvers=man)


def three_options(start, t0, waypoints, polar, wind, base: RouteOptions = RouteOptions(), offset_deg=None):
    """
    Optimale : route libre la plus rapide.
    Option Nord / Option Sud : même calcul, contraint à passer au moins `offset` degrés au nord / au sud
    de la route optimale au méridien situé à mi-chemin (en longitude) entre le bateau et l'arrivée.
    L'écart d'ETA mesure le coût de l'option ; l'incertitude météo dira si elle vaut le pari.
    """
    out = {}
    finish = waypoints[-1]
    best = route_legs(start, t0, waypoints, polar, wind, base)
    out['opt'] = best
    if not best.points or gc_dist(start[0], start[1], waypoints[0][0], waypoints[0][1]) < 400:
        return out
    first = waypoints[0]
    gate_lon = start[1] + (first[1] - start[1]) / 2
    lat_ref = lat_at_lon(best.points, gate_lon)
    if lat_ref is None:
        return out
    span = abs(first[1] - start[1])
    off = offset_deg if offset_deg is not None else float(np.clip(span / 10, 1.5, 4.0))
    for key, side, lat in (('nord', 'N', lat_ref + off), ('sud', 'S', lat_ref - off)):
        o = RouteOptions(**{**base.__dict__, 'gate': Gate(lon=gate_lon, lat=lat, side=side)})
        r = route_legs(start, t0, waypoints, polar, wind, o)
        r.meta = dict(gate_lon=gate_lon, gate_lat=lat, side=side, offset=off)
        out[key] = r
    best.meta = dict(gate_lon=gate_lon, lat_ref=lat_ref, offset=off)
    return out
