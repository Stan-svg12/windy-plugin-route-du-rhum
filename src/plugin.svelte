{#if isMobileOrTablet}
    <section class="rdr rdr--mobile">
        <div class="rdr-m__top">
            <div class="rdr-m__title">
                ⛵ Route du Rhum
                {#if fleet}<span>· {parisTime(fleet.maj)}</span>{/if}
            </div>
            <div class="rdr-m__chips">
                {#each chips as chip (chip.key)}
                    <button
                        class="rdr-chip"
                        class:active={selectedClass === chip.key}
                        style="--c:{chip.color}"
                        on:click={() => chooseClass(chip.key)}
                    >
                        {#if chip.color}<i />{/if}{chip.label}
                    </button>
                {/each}
            </div>
        </div>
        <div class="rdr-m__cards">
            {#if error && !fleet}
                <div class="rdr-m__msg">{error}</div>
            {:else if !fleet}
                <div class="rdr-m__msg">Chargement de la flotte…</div>
            {:else}
                {#each listBoats as b (b.id)}
                    <button
                        class="rdr-card"
                        class:sel={b.id === selectedId}
                        class:out={!b.racing}
                        style="--c:{b.color}"
                        on:click={() => pick(b.id)}
                    >
                        <span class="rdr-card__rank">{b.racing ? b.rank : '×'}</span>
                        <span class="rdr-card__name">{favs.has(b.id) ? '★ ' : ''}{b.lastName}</span>
                        <span class="rdr-card__sub">
                            {#if b.racing}{b.dtl > 0.05 ? `à ${nm(b.dtl)}` : nm(b.dtf)}{:else}{statusLabel(b.status)}{/if}
                        </span>
                    </button>
                {/each}
            {/if}
        </div>
    </section>
{:else}
    <section class="plugin__content rdr">
        <div
            class="plugin__title plugin__title--chevron-back"
            on:click={() => bcast.emit('rqstOpen', 'menu')}
        >
            Route du Rhum 2026
        </div>

        <header class="rdr__hero">
            {#if fleet}
                <div class="rdr__day">
                    Jour {raceDay(fleet.start, now)} <span>· {elapsed(fleet.start, now)} de course</span>
                </div>
                <div class="rdr__maj">
                    Pointage de {parisTime(fleet.maj)} (heure de Paris)
                    {#if nextIn !== null && nextIn > 0}· prochain dans {nextIn} min{:else if nextIn !== null}· prochain imminent{/if}
                </div>
                {#if fleet.source === 'secours'}
                    <div class="rdr__warn">Site officiel injoignable, dernier relevé connu affiché.</div>
                {/if}
            {:else if error}
                <div class="rdr__warn">{error}</div>
            {:else}
                <div class="rdr__maj">Chargement de la flotte…</div>
            {/if}
        </header>

        <nav class="rdr__chips">
            {#each chips as chip (chip.key)}
                <button
                    class="rdr-chip"
                    class:active={selectedClass === chip.key}
                    style="--c:{chip.color}"
                    on:click={() => chooseClass(chip.key)}
                    title={chip.title}
                >
                    {#if chip.color}<i />{/if}{chip.label}<b>{chip.count}</b>
                </button>
            {/each}
        </nav>

        <div class="rdr__tools">
            <input
                class="rdr__search"
                type="search"
                placeholder="Rechercher un skipper"
                bind:value={query}
                on:keydown={e => e.key === 'Enter' && listBoats.length === 1 && pick(listBoats[0].id)}
            />
            <button class="rdr-toggle" class:on={showTracks} on:click={toggleTracks} title="Afficher les trajectoires">
                Traces
            </button>
            <button class="rdr-toggle" class:on={labelMode !== 'none'} on:click={cycleLabels} title="Noms sur la carte">
                Noms {labelMode === 'all' ? 'tous' : labelMode === 'leaders' ? 'top 3' : 'off'}
            </button>
            <button class="rdr-toggle" on:click={() => layer?.fit(true)} title="Cadrer la carte sur la flotte">Cadrer</button>
        </div>

        <div class="rdr__list">
            {#each groups as g (g.key)}
                {#if groups.length > 1 || selectedClass === 'favs'}
                    <div class="rdr__group" style="--c:{g.color}">
                        <i />{g.name}
                        <span>{g.racing} en course{g.size > g.racing ? ` sur ${g.size}` : ''}</span>
                    </div>
                {/if}
                {#each g.boats as b (b.id)}
                    <div
                        class="rdr-row"
                        class:sel={b.id === selectedId}
                        class:out={!b.racing}
                        style="--c:{b.color}"
                        on:click={() => pick(b.id)}
                        data-rdr-row={b.id}
                    >
                        <div class="rdr-row__rank">
                            {#if b.racing}{b.rank}{:else}×{/if}
                            {#if b.racing && b.rankBefore && b.rankBefore !== b.rank}
                                <em class:up={b.rankBefore > b.rank} class:down={b.rankBefore < b.rank}>
                                    {b.rankBefore > b.rank ? '▲' : '▼'}{Math.abs(b.rankBefore - b.rank)}
                                </em>
                            {/if}
                        </div>
                        <div class="rdr-row__who">
                            <div class="rdr-row__name">{b.firstName} <b>{b.lastName}</b></div>
                            <div class="rdr-row__boat">{b.boatName}</div>
                        </div>
                        <div class="rdr-row__num">
                            {#if b.racing}
                                <div>{b.dtl > 0.05 ? `+${nm(b.dtl)}` : nm(b.dtf)}</div>
                                <small>{knots(b.speed)}</small>
                            {:else}
                                <small>{statusLabel(b.status)}</small>
                            {/if}
                        </div>
                        <button
                            class="rdr-row__fav"
                            class:on={favs.has(b.id)}
                            title={favs.has(b.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                            on:click|stopPropagation={() => toggleFav(b.id)}
                        >
                            {favs.has(b.id) ? '★' : '☆'}
                        </button>
                    </div>
                {/each}
            {:else}
                {#if fleet}<div class="rdr__empty">Aucun bateau ne correspond.</div>{/if}
            {/each}
        </div>

        <footer class="rdr__foot">
            <div>
                Classement officiel Route du Rhum Destination Guadeloupe, mis à jour à chaque pointage horaire.
                Traces issues de la cartographie officielle puis des relevés horaires.
            </div>
            <div>
                Plugin non officiel ·
                <a href="#" on:click|preventDefault={() => refresh(true)}>Actualiser</a>
                {#if lastFetch}· vérifié à {parisTime(lastFetch)}{/if}
            </div>
        </footer>
    </section>
{/if}

<script lang="ts">
    import bcast from '@windy/broadcast';
    import { map } from '@windy/map';
    import { isMobileOrTablet } from '@windy/rootScope';
    import { getLatLonInterpolator } from '@windy/interpolator';
    import store from '@windy/store';
    import { wind2obj } from '@windy/utils';
    import metrics from '@windy/metrics';

    import { onDestroy, onMount, tick } from 'svelte';

    import { FleetLayer } from './lib/fleetLayer';
    import { buildFleet, loadBoatLooks, loadRanking, loadTracks } from './lib/data';
    import { RANKING_POLL_MS, STORAGE_PREFIX, TRACKS_POLL_MS } from './lib/config';
    import { elapsed, knots, minutesUntil, nm, parisTime, raceDay, statusLabel } from './lib/format';

    import type { LabelMode } from './lib/fleetLayer';
    import type { Boat, BoatLooks, FleetState, TracksFile } from './lib/types';


    let fleet: FleetState | null = null;
    let tracks: TracksFile | null = null;
    let looks: BoatLooks = { colors: {}, styles: {} };
    let looksKey = '';
    let error: string | null = null;
    let layer: FleetLayer | null = null;
    let selectedClass = 'all';
    let selectedId: string | null = null;
    let query = '';
    let showTracks = true;
    let labelMode: LabelMode = 'leaders';
    let favs = new Set<string>();
    let now = new Date();
    let lastFetch: Date | null = null;
    let lastTracksFetch = 0;
    let pendingBoat: string | null = null;
    let busy = false;
    let firstFit = true;
    let timers: ReturnType<typeof setInterval>[] = [];

    /* Préférences de l'utilisateur, conservées dans son navigateur */
    const readPref = <T>(key: string, fallback: T): T => {
        try {
            const raw = localStorage.getItem(STORAGE_PREFIX + key);
            return raw === null ? fallback : (JSON.parse(raw) as T);
        } catch {
            return fallback;
        }
    };
    const writePref = (key: string, value: unknown) => {
        try {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        } catch {
            /* stockage indisponible */
        }
    };

    const normalize = (s: string) =>
        s
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

    $: nextIn = fleet ? minutesUntil(fleet.next, now) : null;

    $: chips = fleet
        ? [
              { key: 'all', label: 'Toutes', color: '', count: fleet.boats.length, title: 'Toute la flotte' },
              ...fleet.classes.map(c => ({
                  key: c.key,
                  label: c.name,
                  color: c.color,
                  count: c.boats.length,
                  title: `${c.name} : ${c.boats.length} bateaux`,
              })),
              ...(favs.size
                  ? [{ key: 'favs', label: '★ Favoris', color: '', count: favs.size, title: 'Mes favoris' }]
                  : []),
          ]
        : [];

    $: groups = fleet
        ? fleet.classes
              .filter(c => selectedClass === 'all' || selectedClass === 'favs' || c.key === selectedClass)
              .map(c => {
                  const q = normalize(query.trim());
                  const boats = c.boats.filter(
                      b =>
                          (selectedClass !== 'favs' || favs.has(b.id)) &&
                          (!q || normalize(`${b.fullName} ${b.boatName} ${b.sail}`).includes(q)),
                  );
                  return {
                      key: c.key,
                      name: c.name,
                      color: c.color,
                      size: c.boats.length,
                      racing: c.boats.filter(b => b.racing).length,
                      boats,
                  };
              })
              .filter(g => g.boats.length)
        : [];

    $: listBoats = groups.flatMap(g => g.boats);

    const applyClassFilter = () => {
        if (!layer || !fleet) {
            return;
        }
        if (selectedClass === 'all') {
            layer.setVisibleClasses(null);
        } else if (selectedClass === 'favs') {
            layer.setVisibleClasses(new Set(fleet.boats.filter(b => favs.has(b.id)).map(b => b.classKey)));
        } else {
            layer.setVisibleClasses(new Set([selectedClass]));
        }
    };

    const chooseClass = (key: string) => {
        selectedClass = selectedClass === key && key !== 'all' ? 'all' : key;
        applyClassFilter();
        layer?.fit(true);
    };

    const toggleTracks = () => {
        showTracks = !showTracks;
        writePref('tracks', showTracks);
        layer?.setShowTracks(showTracks);
    };

    const cycleLabels = () => {
        labelMode = labelMode === 'leaders' ? 'all' : labelMode === 'all' ? 'none' : 'leaders';
        writePref('labels', labelMode);
        layer?.setLabelMode(labelMode);
    };

    const toggleFav = (id: string) => {
        if (favs.has(id)) {
            favs.delete(id);
        } else {
            favs.add(id);
        }
        favs = new Set(favs);
        writePref('favs', [...favs]);
        layer?.setFavorites(favs);
        if (selectedClass === 'favs' && !favs.size) {
            chooseClass('all');
        }
    };

    /** Vent modèle à la position du bateau, si la couche affichée est le vent */
    const windAt = async (lat: number, lon: number): Promise<string | null> => {
        try {
            if (store.get('overlay') !== 'wind') {
                return null;
            }
            const interpolate = await getLatLonInterpolator();
            if (!interpolate) {
                return null;
            }
            // Selon la version du client Windy, l'interpolateur renvoie la valeur ou une promesse
            const values = await Promise.resolve(interpolate({ lat, lon }));
            if (!Array.isArray(values)) {
                return null;
            }
            const { dir, wind } = wind2obj(values as [number, number]);
            return `${metrics.wind.convertValue(wind)} · ${Math.round(dir)}°`;
        } catch {
            return null;
        }
    };

    const showWind = async (b: Boat) => {
        const wind = await windAt(b.lat, b.lon);
        if (wind && layer && layer.selectedId === b.id) {
            layer.openPopup(b, wind);
        }
    };

    const pick = (id: string) => {
        layer?.select(id);
    };

    const onSelect = async (id: string | null) => {
        selectedId = id;
        if (!id || !layer) {
            return;
        }
        const b = layer.getBoat(id);
        if (b) {
            showWind(b);
        }
        await tick();
        document
            .querySelector(`[data-rdr-row="${CSS.escape(id)}"]`)
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    /** Zone de carte visible, hors panneau du plugin (coordonnées écran) */
    const freeArea = () => {
        const area = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
        const root = document.querySelector('.rdr') as HTMLElement | null;
        if (root) {
            const r = root.getBoundingClientRect();
            if (isMobileOrTablet) {
                if (r.top > window.innerHeight * 0.4) {
                    area.bottom = Math.min(area.bottom, r.top);
                }
            } else if (r.left > window.innerWidth / 2) {
                area.right = Math.min(area.right, r.left - 12);
            }
        }
        return area;
    };

    /** Clic sur "Météo ici" dans la bulle d'un bateau : ouvre le picker météo Windy */
    const onDocClick = (e: MouseEvent) => {
        const el = (e.target as HTMLElement | null)?.closest?.('[data-rdr-action="weather"]') as HTMLElement | null;
        if (!el || !layer) {
            return;
        }
        e.preventDefault();
        const b = layer.getBoat(el.dataset.rdrId || '');
        if (!b) {
            return;
        }
        layer.hidePopup();
        bcast.emit('rqstOpen', isMobileOrTablet ? 'picker-mobile' : 'picker', { lat: b.lat, lon: b.lon } as any);
    };

    const resolvePending = () => {
        if (!pendingBoat || !fleet || !layer) {
            return;
        }
        const q = normalize(decodeURIComponent(pendingBoat));
        const b = fleet.boats.find(
            x =>
                x.idCourse === pendingBoat ||
                normalize(x.lastName) === q ||
                normalize(x.sail) === q ||
                normalize(x.fullName).replace(/\s+/g, '-') === q,
        );
        pendingBoat = null;
        if (b) {
            layer.select(b.id);
        }
    };

    const refresh = async (force = false) => {
        if (busy) {
            return;
        }
        busy = true;
        try {
            let colorsChanged = false;
            if (force || !tracks || Date.now() - lastTracksFetch > TRACKS_POLL_MS) {
                [tracks, looks] = await Promise.all([loadTracks(), loadBoatLooks()]);
                lastTracksFetch = Date.now();
                const key = JSON.stringify(looks);
                colorsChanged = key !== looksKey;
                looksKey = key;
            }
            const { ranking, source } = await loadRanking();
            const next = buildFleet(ranking, tracks as TracksFile, source, looks);
            const changed = !fleet || next.maj.getTime() !== fleet.maj.getTime() || force || colorsChanged;
            fleet = next;
            error = null;
            lastFetch = new Date();
            if (changed && layer) {
                layer.update(fleet.boats);
                applyClassFilter();
                if (firstFit) {
                    firstFit = false;
                    // Laisse Windy finir l'ouverture du panneau avant de cadrer, puis
                    // recadre une fois au cas où Windy repositionne la carte entre temps
                    if (!pendingBoat) {
                        setTimeout(() => layer?.fit(), 400);
                        setTimeout(() => !selectedId && layer?.fit(), 1300);
                    }
                }
                resolvePending();
                // La bulle du bateau suivi est redessinée : on y remet le vent
                const sel = selectedId ? layer.getBoat(selectedId) : null;
                if (sel) {
                    showWind(sel);
                }
            }
        } catch (e) {
            console.error('[route-du-rhum]', e);
            error = 'Classement indisponible pour le moment, nouvel essai dans quelques minutes.';
        } finally {
            busy = false;
        }
    };

    /** Rafraîchit juste après chaque pointage officiel, et au plus tard toutes les 5 minutes */
    const onTick = () => {
        now = new Date();
        if (!fleet || !lastFetch) {
            return;
        }
        const sinceFetch = now.getTime() - lastFetch.getTime();
        const due = fleet.next && now.getTime() > fleet.next.getTime() + 60000 && sinceFetch > 120000;
        if (due || sinceFetch > RANKING_POLL_MS) {
            refresh();
        }
    };

    export const onopen = (params?: { boat?: string } | null) => {
        if (params && typeof params === 'object' && params.boat) {
            pendingBoat = String(params.boat);
            resolvePending();
        }
    };

    onMount(() => {
        showTracks = readPref('tracks', true);
        labelMode = readPref<LabelMode>('labels', 'leaders');
        favs = new Set(readPref<string[]>('favs', []));

        layer = new FleetLayer(map, { onSelect, freeArea, mobile: isMobileOrTablet });
        layer.setShowTracks(showTracks);
        layer.setLabelMode(labelMode);
        layer.setFavorites(favs);

        document.addEventListener('click', onDocClick, true);
        timers.push(setInterval(onTick, 30000));
        refresh(true);
    });

    onDestroy(() => {
        timers.forEach(clearInterval);
        timers = [];
        document.removeEventListener('click', onDocClick, true);
        layer?.destroy();
        layer = null;
    });
</script>

<style lang="less">
    .rdr {
        --rdr-line: rgba(255, 255, 255, 0.12);
        --rdr-dim: rgba(255, 255, 255, 0.62);
        font-variant-numeric: tabular-nums;
        button {
            font: inherit;
            color: inherit;
            cursor: pointer;
        }
    }
    .plugin__content.rdr {
        padding-top: 5px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .rdr__hero {
        padding: 2px 2px 0;
    }
    .rdr__day {
        font-size: 17px;
        font-weight: 700;
        span {
            font-weight: 400;
            color: var(--rdr-dim);
            font-size: 13px;
        }
    }
    .rdr__maj {
        color: var(--rdr-dim);
        font-size: 12px;
        margin-top: 2px;
    }
    .rdr__warn {
        margin-top: 6px;
        font-size: 12px;
        color: #ffd27a;
    }
    .rdr__chips,
    .rdr-m__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }
    .rdr-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid var(--rdr-line);
        background: rgba(255, 255, 255, 0.06);
        border-radius: 14px;
        padding: 3px 9px;
        font-size: 12px;
        line-height: 18px;
        white-space: nowrap;
        i {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--c);
            flex: none;
        }
        b {
            font-weight: 400;
            color: var(--rdr-dim);
            font-size: 11px;
        }
        &:hover {
            background: rgba(255, 255, 255, 0.12);
        }
        &.active {
            background: #fff;
            color: #1b2733;
            border-color: #fff;
            b {
                color: #5b6875;
            }
        }
    }
    .rdr__tools {
        display: flex;
        gap: 5px;
        align-items: center;
    }
    .rdr__search {
        flex: 1;
        min-width: 0;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--rdr-line);
        border-radius: 6px;
        color: #fff;
        padding: 5px 8px;
        font-size: 12px;
        outline: none;
        &:focus {
            border-color: rgba(255, 255, 255, 0.4);
        }
    }
    .rdr-toggle {
        border: 1px solid var(--rdr-line);
        background: transparent;
        border-radius: 6px;
        padding: 4px 7px;
        font-size: 11px;
        white-space: nowrap;
        color: var(--rdr-dim);
        &.on {
            color: #fff;
            border-color: rgba(255, 255, 255, 0.35);
            background: rgba(255, 255, 255, 0.08);
        }
    }
    .rdr__group {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 12px 0 4px;
        font-weight: 700;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        i {
            width: 10px;
            height: 10px;
            border-radius: 2px;
            background: var(--c);
        }
        span {
            margin-left: auto;
            font-weight: 400;
            text-transform: none;
            letter-spacing: 0;
            color: var(--rdr-dim);
            font-size: 11px;
        }
    }
    .rdr-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 4px 5px 8px;
        border-left: 3px solid var(--c);
        border-radius: 3px;
        margin-bottom: 2px;
        cursor: pointer;
        &:hover {
            background: rgba(255, 255, 255, 0.07);
        }
        &.sel {
            background: rgba(255, 255, 255, 0.16);
        }
        &.out {
            opacity: 0.5;
            border-left-color: #8c959e;
        }
    }
    .rdr-row__rank {
        width: 26px;
        flex: none;
        text-align: right;
        font-weight: 700;
        font-size: 14px;
        line-height: 1.1;
        em {
            display: block;
            font-style: normal;
            font-weight: 400;
            font-size: 9px;
        }
    }
    .up {
        color: #7ee08a;
    }
    .down {
        color: #ff8d7e;
    }
    .rdr-row__who {
        flex: 1;
        min-width: 0;
    }
    .rdr-row__name,
    .rdr-row__boat {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .rdr-row__name {
        font-size: 13px;
    }
    .rdr-row__boat {
        font-size: 11px;
        color: var(--rdr-dim);
    }
    .rdr-row__num {
        text-align: right;
        font-size: 12px;
        white-space: nowrap;
        small {
            display: block;
            color: var(--rdr-dim);
            font-size: 11px;
        }
    }
    .rdr-row__fav {
        border: 0;
        background: transparent;
        font-size: 15px;
        padding: 0 2px;
        color: rgba(255, 255, 255, 0.35);
        &.on {
            color: #ffd34d;
        }
        &:hover {
            color: #ffd34d;
        }
    }
    .rdr__empty {
        color: var(--rdr-dim);
        font-size: 12px;
        padding: 10px 0;
    }
    .rdr__foot {
        border-top: 1px solid var(--rdr-line);
        padding-top: 8px;
        font-size: 10px;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.5);
        div + div {
            margin-top: 4px;
        }
        a {
            color: rgba(255, 255, 255, 0.8);
        }
    }

    /* Mobile : bandeau compact en bas de l'écran */
    .rdr--mobile {
        padding: 6px 8px 8px;
    }
    .rdr-m__top {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .rdr-m__title {
        font-weight: 700;
        font-size: 14px;
        span {
            font-weight: 400;
            color: var(--rdr-dim);
            font-size: 12px;
        }
    }
    .rdr-m__chips {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
    }
    .rdr-m__cards {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding: 8px 0 2px;
        scrollbar-width: none;
    }
    .rdr-m__msg {
        font-size: 12px;
        color: var(--rdr-dim);
    }
    .rdr-card {
        flex: none;
        display: grid;
        grid-template-columns: auto 1fr;
        column-gap: 6px;
        align-items: baseline;
        text-align: left;
        border: 0;
        border-left: 3px solid var(--c);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.08);
        padding: 5px 8px;
        min-width: 96px;
        &.sel {
            background: rgba(255, 255, 255, 0.22);
        }
        &.out {
            opacity: 0.5;
        }
    }
    .rdr-card__rank {
        font-weight: 700;
        grid-row: span 2;
    }
    .rdr-card__name {
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
    }
    .rdr-card__sub {
        font-size: 11px;
        color: var(--rdr-dim);
        white-space: nowrap;
    }

    /* Éléments posés sur la carte */
    :global(.rdr-boat-icon) {
        background: none !important;
        border: 0 !important;
    }
    :global(.rdr-boat) {
        position: relative;
        width: var(--s);
        height: var(--s);
    }
    :global(.rdr-boat__hull) {
        width: 100%;
        height: 100%;
        transform-origin: 50% 50%;
        filter: drop-shadow(0 1px 1.4px rgba(0, 0, 0, 0.6));
    }
    :global(.rdr-boat--out) {
        opacity: 0.6;
    }
    :global(.rdr-boat--sel)::before {
        content: '';
        position: absolute;
        inset: 12%;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.16);
        border: 2px solid #fff;
        box-shadow:
            0 0 0 2px var(--c),
            0 0 12px rgba(0, 0, 0, 0.35);
    }
    :global(.rdr-boat--sel)::after {
        content: '';
        position: absolute;
        inset: 6%;
        border-radius: 50%;
        border: 2px solid var(--c);
        animation: rdr-pulse 1.8s ease-out infinite;
    }
    @keyframes -global-rdr-pulse {
        0% {
            transform: scale(0.6);
            opacity: 1;
        }
        100% {
            transform: scale(1.5);
            opacity: 0;
        }
    }
    :global(.rdr-boat__label) {
        position: absolute;
        left: calc(50% + 0.26 * var(--s));
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 1px 6px 1px 5px;
        border-left: 3px solid var(--c);
        border-radius: 3px;
        background: rgba(12, 22, 32, 0.74);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        font: 600 11px/1.35 'Noto Sans', Arial, sans-serif;
        letter-spacing: 0.02em;
        color: #fff;
        white-space: nowrap;
        pointer-events: none;
    }
    :global(.rdr-boat__label b) {
        font-weight: 800;
        color: rgba(255, 255, 255, 0.72);
    }
    :global(.rdr-mark) {
        background: none !important;
        border: 0 !important;
    }
    :global(.rdr-mark i) {
        display: block;
        width: 10px;
        height: 10px;
        margin: 2px;
        border-radius: 50%;
        background: #fff;
        box-shadow:
            0 0 0 3px rgba(0, 0, 0, 0.35),
            0 0 6px rgba(0, 0, 0, 0.5);
    }
    :global(.rdr-mark--finish i) {
        background: #ffd34d;
    }
    :global(.rdr-mark span) {
        position: absolute;
        left: 18px;
        top: -2px;
        white-space: nowrap;
        font: 700 12px/1.2 'Noto Sans', Arial, sans-serif;
        color: #fff;
        text-shadow:
            0 0 3px #000,
            0 0 2px #000;
    }
    :global(.rdr-popup .leaflet-popup-content-wrapper),
    :global(.rdr-popup .maplibregl-popup-content) {
        border-radius: 8px;
    }
    :global(.rdr-pop) {
        font: 13px/1.35 'Noto Sans', Arial, sans-serif;
        color: #1b2733;
        min-width: 230px;
    }
    :global(.rdr-pop__head) {
        display: flex;
        gap: 9px;
        align-items: center;
        padding-bottom: 7px;
        margin-bottom: 6px;
        border-bottom: 3px solid var(--c);
    }
    :global(.rdr-pop__photo) {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        object-fit: cover;
        flex: none;
        background: #e4e8ec;
    }
    :global(.rdr-pop__name) {
        font-weight: 800;
        font-size: 15px;
    }
    :global(.rdr-pop__boat) {
        color: #44515e;
    }
    :global(.rdr-pop__class) {
        font-size: 12px;
        color: #44515e;
    }
    :global(.rdr-pop__class i) {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--c);
        margin-right: 5px;
    }
    :global(.rdr-pop__class em) {
        font-style: normal;
        font-weight: 700;
    }
    :global(.rdr-pop__class .up) {
        color: #1f9a35;
    }
    :global(.rdr-pop__class .down) {
        color: #d0402a;
    }
    :global(.rdr-pop__status) {
        color: #d0402a;
    }
    :global(.rdr-pop__grid) {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
    }
    :global(.rdr-pop__grid td) {
        padding: 3px 0;
        vertical-align: top;
        border-bottom: 1px solid #edf0f2;
    }
    :global(.rdr-pop__grid td:first-child) {
        color: #6b7783;
        padding-right: 10px;
        white-space: nowrap;
    }
    :global(.rdr-pop__grid small) {
        color: #6b7783;
    }
    :global(.rdr-pop__actions) {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 8px;
        font-weight: 700;
        font-size: 12px;
    }
    :global(.rdr-pop__actions a) {
        color: #1769c1;
        text-decoration: none;
    }
</style>
