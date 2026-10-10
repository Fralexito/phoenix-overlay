import OverlayWidget from "../OverlayWidget";
import Position from "@/interfaces/Position";

/**
 * Franja de "última hora" de Phoenix: una sola línea, arriba al centro.
 * Solo aparece cuando hay noticias, unos segundos cada cierto tiempo (no estorba al jugar).
 */
export default class TickerWidget extends OverlayWidget {

    name: string = 'ticker';

    enabled: boolean = true;

    canResize: boolean = false;

    position: Position = { position: 'top-center', x: 0, y: 0, w: 520, h: 30, minHeight: 30, autoHeight: true };

    cfg = {
        showSec: 9,     // cuánto se ve cada vez
        everySec: 90    // cada cuánto vuelve a asomar
    };

}
