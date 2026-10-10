import OverlayWidget from "../OverlayWidget";
import Position from "@/interfaces/Position";

export default class GuestsWidget extends OverlayWidget {

    name: string = 'guests';
    
    enabled: boolean = true;

    position: Position = { position: 'top-right', x: 0, y: 0, w: 220, h: 28, autoHeight: true, minHeight: 28 };

    cfg = {
        showLatency: true,
        alwaysOpen: false   // false = se encoge a un solo punto cuando todos tienen buen ping
    };

}