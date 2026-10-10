import Position from "@/interfaces/Position";
import OverlayWidget from "../OverlayWidget";

export default class ChatWidget extends OverlayWidget {

    name: string = 'chat';

    enabled: boolean = true;

    active: boolean = false;

    position: Position = { position: 'bottom-left', x: 0, y: 0, w: 380, h: 120, autoHeight: true, minHeight: 40 };

    cfg = {
        showHistory: true,
        showTimestamps: true,
        scrollSpeed: 1
    };

}