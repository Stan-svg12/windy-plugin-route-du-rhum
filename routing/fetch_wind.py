#!/usr/bin/env python3
"""
Télécharge le vent à 10 m (10u, 10v) du dernier run ECMWF IFS 0,25° « open data » (00 ou 12 UTC, 240 h)
et le découpe sur l'Atlantique de la Route du Rhum. Sortie : un .npz lu par run_routing.py.

Usage :
  python routing/fetch_wind.py --latest-run          affiche l'identifiant du dernier run (ex. 20261105T00)
  python routing/fetch_wind.py --out wind.npz        télécharge et découpe
  python routing/fetch_wind.py --grib x.grib2 --out wind.npz   découpe un GRIB local (tests, GRIB perso)
"""
import argparse
import datetime as dt
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from engine import WindField  # noqa: E402

BOX = dict(lat_min=0.0, lat_max=55.0, lon_min=-80.0, lon_max=5.0)
STEPS = list(range(0, 145, 3)) + list(range(150, 241, 6))
SOURCES = ('aws', 'ecmwf', 'azure')


def _client(source):
    from ecmwf.opendata import Client

    return Client(source=source, model='ifs', resol='0p25')


def latest_run():
    last = None
    for src in SOURCES:
        try:
            # Le run qui publie l'échéance 240 h est un run 00 ou 12 UTC complet
            return _client(src).latest(type='fc', step=240, param='10u'), src
        except Exception as e:  # source indisponible : on essaie la suivante
            last = e
    raise RuntimeError(f'Aucune source ECMWF disponible : {last}')


def download(target, workers=8):
    """Une requête par échéance, en parallèle, avec nouvelles tentatives : bien plus rapide et robuste."""
    import time
    from concurrent.futures import ThreadPoolExecutor

    run, src = latest_run()
    print(f'Run {run:%Y-%m-%d %H}Z, source {src}, {len(STEPS)} échéances', flush=True)
    parts_dir = target + '.parts'
    os.makedirs(parts_dir, exist_ok=True)

    def one(step):
        path = os.path.join(parts_dir, f'{step:03d}.grib2')
        last = None
        for attempt in range(4):
            for s in (src,) + tuple(x for x in SOURCES if x != src):
                try:
                    _client(s).retrieve(date=run.strftime('%Y%m%d'), time=run.hour, type='fc', step=step,
                                        param=['10u', '10v'], target=path)
                    print(f'  +{step:3d} h ok ({s})', flush=True)
                    return path
                except Exception as e:
                    last = e
            time.sleep(5 * (attempt + 1))
        raise RuntimeError(f'Échéance {step} h introuvable : {last}')

    with ThreadPoolExecutor(max_workers=workers) as ex:
        parts = list(ex.map(one, STEPS))
    with open(target, 'wb') as out:
        for path in parts:
            with open(path, 'rb') as f:
                out.write(f.read())
            os.remove(path)
    os.rmdir(parts_dir)
    return run


# ----------------------------------------------------------------------------- GFS (secours)

NOMADS = 'https://nomads.ncep.noaa.gov'
GFS_STEPS = list(range(0, 121, 3)) + list(range(126, 241, 6))


def _get(url, timeout=60):
    import urllib.request

    req = urllib.request.Request(url, headers={'user-agent': 'windy-plugin-route-du-rhum routage'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def gfs_latest():
    now = dt.datetime.now(dt.timezone.utc)
    cyc = now.replace(minute=0, second=0, microsecond=0, hour=now.hour - now.hour % 6)
    for k in range(6):
        c = cyc - dt.timedelta(hours=6 * k)
        idx = (f'{NOMADS}/pub/data/nccf/com/gfs/prod/gfs.{c:%Y%m%d}/{c:%H}/atmos/'
               f'gfs.t{c:%H}z.pgrb2.0p25.f240.idx')
        try:
            _get(idx, timeout=20)
            return c
        except Exception:
            continue
    raise RuntimeError('Aucun run GFS complet trouvé')


def download_gfs(target, workers=4):
    """GFS 0,25° via le filtre NOMADS : uniquement le vent à 10 m sur l'Atlantique, quelques centaines de ko."""
    import time
    from concurrent.futures import ThreadPoolExecutor

    c = gfs_latest()
    print(f'Secours GFS : run {c:%Y-%m-%d %H}Z', flush=True)

    def one(step):
        url = (f'{NOMADS}/cgi-bin/filter_gfs_0p25.pl?dir=%2Fgfs.{c:%Y%m%d}%2F{c:%H}%2Fatmos'
               f'&file=gfs.t{c:%H}z.pgrb2.0p25.f{step:03d}&var_UGRD=on&var_VGRD=on&lev_10_m_above_ground=on'
               f'&subregion=&toplat=56&bottomlat=-1&leftlon=279&rightlon=359.75')
        last = None
        for attempt in range(5):
            try:
                data = _get(url)
                if not data.startswith(b'GRIB'):
                    raise RuntimeError('réponse non GRIB')
                print(f'  GFS +{step:3d} h ok', flush=True)
                return data
            except Exception as e:
                last = e
                time.sleep(5 * (attempt + 1))
        raise RuntimeError(f'GFS échéance {step} h : {last}')

    with ThreadPoolExecutor(max_workers=workers) as ex:
        parts = list(ex.map(one, GFS_STEPS))
    with open(target, 'wb') as out:
        for d in parts:
            out.write(d)
    return c


def read_grib(path, label=''):
    import eccodes

    fields = {}
    lats = lons = None
    with open(path, 'rb') as f:
        while True:
            h = eccodes.codes_grib_new_from_file(f)
            if h is None:
                break
            try:
                name = eccodes.codes_get(h, 'shortName')
                if name not in ('10u', '10v'):
                    continue
                ni, nj = eccodes.codes_get(h, 'Ni'), eccodes.codes_get(h, 'Nj')
                la1 = eccodes.codes_get(h, 'latitudeOfFirstGridPointInDegrees')
                la2 = eccodes.codes_get(h, 'latitudeOfLastGridPointInDegrees')
                lo1 = eccodes.codes_get(h, 'longitudeOfFirstGridPointInDegrees')
                lo2 = eccodes.codes_get(h, 'longitudeOfLastGridPointInDegrees')
                vals = eccodes.codes_get_values(h).reshape(nj, ni)
                date = eccodes.codes_get(h, 'dataDate')
                hour = eccodes.codes_get(h, 'dataTime') // 100
                step = eccodes.codes_get(h, 'step')
                base = dt.datetime.strptime(str(date), '%Y%m%d').replace(hour=hour, tzinfo=dt.timezone.utc)
                valid = base.timestamp() + step * 3600
                la = np.linspace(la1, la2, nj)
                if lo1 > lo2:  # 0..360 « enroulé » : on passe en -180..180
                    lo2 += 360
                lo = np.linspace(lo1, lo2, ni)
                lo = ((lo + 180) % 360) - 180
                ordl = np.argsort(lo)
                lo, vals = lo[ordl], vals[:, ordl]
                mi = (la >= BOX['lat_min'] - 0.5) & (la <= BOX['lat_max'] + 0.5)
                mj = (lo >= BOX['lon_min'] - 0.5) & (lo <= BOX['lon_max'] + 0.5)
                lats, lons = la[mi], lo[mj]
                fields[(name, valid)] = vals[np.ix_(mi, mj)].astype(np.float32)
                fields.setdefault('_base', base)
            finally:
                eccodes.codes_release(h)
    base = fields.pop('_base')
    times = sorted({t for (_, t) in fields})
    times = [t for t in times if ('10u', t) in fields and ('10v', t) in fields]
    if len(times) < 2:
        raise RuntimeError('GRIB incomplet : moins de deux échéances de vent')
    u = np.stack([fields[('10u', t)] for t in times])
    v = np.stack([fields[('10v', t)] for t in times])
    return WindField(lats, lons, np.array(times, float), u, v, label or f'ECMWF IFS 0.25° {base:%Y-%m-%d %H}Z'), base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--latest-run', action='store_true')
    ap.add_argument('--grib')
    ap.add_argument('--out', default='wind.npz')
    a = ap.parse_args()
    if a.latest_run:
        print(latest_run()[0].strftime('%Y%m%dT%H'))
        return
    grib = a.grib
    label = ''
    if not grib:
        # ECMWF d'abord, avec un budget de temps ; GFS (NOMADS, fichiers légers) si ECMWF traîne ou échoue
        from concurrent.futures import ThreadPoolExecutor, TimeoutError as FTimeout

        grib = 'ecmwf.grib2'
        ex = ThreadPoolExecutor(max_workers=1)
        fut = ex.submit(download, grib)
        try:
            fut.result(timeout=float(os.environ.get('ECMWF_BUDGET_S', 420)))
        except (FTimeout, Exception) as e:
            print(f'::warning::ECMWF indisponible ou trop lent ({type(e).__name__}: {e}), bascule sur GFS', flush=True)
            grib = 'gfs.grib2'
            c = download_gfs(grib)
            label = f'GFS 0.25° {c:%Y-%m-%d %H}Z'
        ex.shutdown(wait=False, cancel_futures=True)
    w, base = read_grib(grib, label)
    w.save(a.out)
    print(f'{w.label} : {len(w.times)} échéances, {len(w.lats)}x{len(w.lons)} points, '
          f'horizon {dt.datetime.fromtimestamp(w.horizon, dt.timezone.utc):%Y-%m-%d %H}Z -> {a.out}', flush=True)
    # Des téléchargements ECMWF abandonnés peuvent encore tourner : on sort sans les attendre
    os._exit(0)


if __name__ == '__main__':
    main()
