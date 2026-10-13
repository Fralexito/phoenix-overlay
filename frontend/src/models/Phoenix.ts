// Datos que Phoenix Link manda al overlay por el WebSocket local (eventos «phoenix:...»).

/** Un gol del partido, tal como lo anota el juego. */
export interface GolOverlay {
    m: number;        // minuto
    l: boolean;       // true = local
    j?: string;       // goleador, si el juego lo dijo
    pp?: boolean;     // en propia puerta
}

/** Marcador en vivo (phoenix:partido). */
export interface PartidoOverlay {
    fase: 'en_juego' | 'pausado' | 'descanso' | 'final' | 'libre' | string;
    minuto: number;
    segundo: number;
    anadido: number;
    periodo: number;
    reloj: boolean;
    local: { nombre: string; goles: number };
    visita: { nombre: string; goles: number };
    goles: GolOverlay[];
}

/** Un amigo de la web (phoenix:amigos). */
export interface AmigoOverlay {
    usuarioId: string;
    nombre: string;
    estado: 'disponible' | 'en_sala' | 'en_partida' | 'ausente' | 'desconectado' | string;
}
