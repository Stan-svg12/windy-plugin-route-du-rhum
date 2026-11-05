#!/usr/bin/env python3
"""
Calcule les 3 routages (Optimale, Option Nord, Option Sud) de chaque IMOCA et Class40 en course,
depuis sa position au dernier pointage officiel, et écrit data/routes.json lu par le plugin.

Usage :
  python routing/run_routing.py --wind wind.npz [--ranking data/latest.json] [--only 12,45]
"""
import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ProcessPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from global_land_mask import globe  # noqa: E402
from engine import Polar, RouteOptions, WindField, three_options  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
POLARS = os.path.join(ROOT, 'polars')
OUT = os.path.join(ROOT, 'data', 'routes.json')
RANKING_URL = 'https://www.routedurhum.com/_functions/classement'
LABELS = {'opt': 'Optimale', 'nord': 'Option Nord', 'sud': 'Option Sud'}

_W = None  # champ de vent partagé par processus


def _init(path):
    global _W
    _W = WindField.open(path)


def load_ranking(path):
    if path:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    try:
        req = urllib.request.Request(RANKING_URL, headers={'user-agent': 'windy-plugin-route-du-rhum routage (GitHub Actions)'})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except Exception as e:
        print(f'::warning::Classement officiel indisponible ({e}), data/latest.json utilisé')
        with open(os.path.join(ROOT, 'data', 'latest.json'), encoding='utf-8') as f:
            return json.load(f)


def encode(points, t0):
    """
    Liste plate, 5 valeurs par point : minutes, lat×1000, lon×1000 (en écart au point précédent),
    puis TWS×10 et TWA signé du segment qui part de ce point (vitesse et cap s'en déduisent côté plugin).
    """
    out = []
    pm = pla = plo = 0
    for t, la, lo, tws, twa, hdg, sog in points:
        m, a, o = round((t - t0) / 60), round(la * 1000), round(lo * 1000)
        nan = tws != tws
        out += [m - pm, a - pla, o - plo, 0 if nan else round(tws * 10), 0 if nan else round(twa)]
        pm, pla, plo = m, a, o
    return out


def job(args):
    bid, start, t0, polar_path, perf, man, waypoints, offset = args
    polar = Polar.load(polar_path)
    opt = RouteOptions(perf=perf, maneuver_min=man)
    s = time.time()
    res = three_options(start, t0, waypoints, polar, _W, opt, offset_deg=offset)
    out = {}
    for k, r in res.items():
        out[k] = {
            'label': LABELS[k],
            'ok': bool(r.ok),
            'reason': r.reason or None,
            'eta': None if r.eta is None else round(float(r.eta)),
            'beyond': bool(r.beyond_horizon),
            'man': int(r.maneuvers),
            'gate': [round(r.meta['gate_lat'], 2), round(r.meta['gate_lon'], 2)] if 'gate_lat' in r.meta else None,
            'p': encode(r.points, t0),
        }
    return bid, out, time.time() - s, os.path.basename(polar_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--wind', required=True)
    ap.add_argument('--ranking')
    ap.add_argument('--only', help='identifiants course séparés par des virgules')
    ap.add_argument('--workers', type=int, default=os.cpu_count() or 2)
    a = ap.parse_args()

    with open(os.path.join(POLARS, 'config.json'), encoding='utf-8') as f:
        cfg = json.load(f)
    waypoints = [tuple(p) for p in cfg['waypoints']['points']]
    offset = cfg.get('option_offset_deg')
    ranking = load_ranking(a.ranking)
    t0 = dt.datetime.fromisoformat(ranking['maj'].replace('Z', '+00:00')).timestamp()
    only = set(a.only.split(',')) if a.only else None

    jobs = []
    skipped = {}
    for cls in ranking['classes']:
        ccfg = cfg['classes'].get(cls.get('cle'))
        if not ccfg:
            continue
        for l in cls['lignes']:
            bid = str(l['idCourse'])
            if l.get('statut') != 'RAC' or (only and bid not in only):
                continue
            if not isinstance(l.get('lat'), (int, float)) or abs(l['lat']) + abs(l['lon']) < 0.01:
                continue
            if globe.is_land(l['lat'], l['lon']):
                skipped[bid] = 'Bateau au port (escale technique), pas de routage'
                continue
            own = os.path.join(POLARS, 'boats', f'{bid}.csv')
            polar_path = own if os.path.exists(own) else os.path.join(POLARS, ccfg['polar'])
            jobs.append((bid, (l['lat'], l['lon']), t0, polar_path, ccfg['perf'], ccfg['maneuver_min'], waypoints, offset))

    wind = WindField.open(a.wind)
    boats = {}
    s = time.time()
    with ProcessPoolExecutor(max_workers=a.workers, initializer=_init, initargs=(a.wind,)) as ex:
        for bid, out, sec, pol in ex.map(job, jobs):
            out_meta = {'polar': pol}
            boats[bid] = {**out_meta, 'opts': out}
    for bid, why in skipped.items():
        boats[bid] = {'skip': why, 'opts': {}}
    iso = lambda ts: dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')  # noqa: E731
    doc = {
        'v': 1,
        'model': wind.label,
        'horizon': iso(wind.horizon),
        'maj': ranking['maj'],
        't0': t0,
        'computed': iso(time.time()),
        'waypoints': waypoints,
        'perf': {k: v['perf'] for k, v in cfg['classes'].items()},
        'fields': ['dmin', 'dlat1000', 'dlon1000', 'tws10', 'twa'],
        'boats': boats,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, separators=(',', ':'), ensure_ascii=False)
    print(f'{len(boats)} bateaux routés en {time.time() - s:.0f} s ({wind.label}) -> {OUT} '
          f'({os.path.getsize(OUT) // 1024} ko)')


if __name__ == '__main__':
    main()
