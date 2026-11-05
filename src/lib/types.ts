/** Ligne du classement officiel (flux public routedurhum.com/_functions/classement) */
export interface RankingLine {
    id: string;
    idCourse: string;
    prenom: string;
    nom: string;
    bateau: string;
    voile?: string;
    photo?: string;
    photoBateau?: string;
    drapeau?: string;
    pays?: string;
    filtres?: string[];
    fiche?: string;
    statut: string;
    rang: number;
    dtf: number;
    dtl: number;
    vitesse: number;
    vitesse24h?: number;
    cap: number;
    vmg?: number;
    lat: number;
    lon: number;
    rangAvant?: number;
    hist?: number[];
}

export interface RankingClass {
    id: string;
    cle: string;
    nom: string;
    couleur: string;
    icone?: string;
    partants: number;
    lignes: RankingLine[];
}

export interface Ranking {
    phase: string;
    depart: string;
    maj: string;
    prochain?: string;
    distance: number;
    intervalleMin?: number;
    partants?: number;
    classes: RankingClass[];
}

/** Fichier des trajectoires (data/tracks.json ou version embarquée) */
export interface TracksFile {
    v: number;
    startEpoch: number;
    prec: number;
    lastMaj: string | null;
    boats: Record<string, number[]>;
}

/** Livrée d'un bateau, relevée sur la cartographie officielle (data/boats.json) */
export interface BoatStyle {
    /** 1 monocoque, 2 catamaran, 3 trimaran, 4 IMOCA à foils, 5 Class40 à étrave ronde */
    type: number;
    /** Coque, pont, cockpit, puis foils ou bras */
    colors: string[];
    /** Couleur de la trace */
    main: string;
}

/** Livrées et couleurs chargées depuis le dépôt */
export interface BoatLooks {
    colors: Record<string, string>;
    styles: Record<string, BoatStyle>;
}

/** Bateau prêt à afficher */
export interface Boat {
    id: string;
    idCourse: string;
    firstName: string;
    lastName: string;
    fullName: string;
    boatName: string;
    sail: string;
    photo: string | null;
    country: string;
    profileUrl: string | null;
    classKey: string;
    className: string;
    classColor: string;
    /** Couleur du bateau sur la carte : celle de l'équipe si connue, sinon celle de la classe */
    color: string;
    /** Livrée officielle, si connue */
    style: BoatStyle | null;
    classSize: number;
    status: string;
    racing: boolean;
    rank: number;
    rankBefore: number | null;
    dtf: number;
    dtl: number;
    speed: number;
    speed24h: number | null;
    heading: number;
    vmg: number | null;
    lat: number;
    lon: number;
    track: [number, number][];
}

export interface FleetClass {
    key: string;
    name: string;
    color: string;
    size: number;
    boats: Boat[];
}

export interface FleetState {
    classes: FleetClass[];
    boats: Boat[];
    maj: Date;
    next: Date | null;
    start: Date;
    distance: number;
    source: 'officiel' | 'secours';
}
