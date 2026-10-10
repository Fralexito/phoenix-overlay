import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Application, Events } from '@wailsio/runtime';

import { GetProp } from '../../bindings/SmashGlass/services/configservice';

import WSData from '@/models/WSData';

export const useSocketStore = defineStore('socketStore', () => {
    /* ---------- state ---------- */

    const conn = ref<WebSocket | null>(null);
    const isConnected = ref(false);

    async function init() {
        Events.On('socket:message', (data: any) => {
            try {
                const msg = JSON.parse(data.data.data);
                window.$eventBus.emit(msg.event, msg.data);
            } catch (e) {
                console.warn('Mensaje del servidor ilegible', e);
            }
        });
    }

    /* ---------- actions ---------- */

    // Phoenix Link puede tardar unos segundos en abrir su servidor (o abrirlo después que el overlay):
    // se reintenta cada 1,5 s. Si pasan 3 minutos sin conectar nunca, el overlay se cierra solo
    // para no quedar escondido ocupando atajos de teclado.
    const inicio = Date.now();
    let reintento = 0;
    let cerrando = false;
    let isConnectedOnce = false;

    function programar(port: number) {
        if (cerrando) return;
        if (!isConnectedOnce && Date.now() - inicio > 180000) {
            Application.Quit();
            return;
        }
        clearTimeout(reintento);
        reintento = window.setTimeout(() => abrir(port), 1500);
    }

    function abrir(port: number) {
        if (cerrando) return;

        let ws: WebSocket;
        try {
            ws = new WebSocket(`ws://localhost:${port}`);
        } catch (e) {
            programar(port);
            return;
        }
        conn.value = ws;

        ws.onopen = () => {
            console.log('Websocket connected');
            isConnected.value = true;
            isConnectedOnce = true;
        };

        ws.onclose = () => {
            const estabaConectado = isConnected.value;
            isConnected.value = false;
            if (estabaConectado) {
                // Phoenix Link se cerró (o paró la sala): el overlay se cierra con él
                console.log('Websocket disconnected');
                Application.Quit();
                return;
            }
            programar(port);
        };

        ws.onerror = () => {
            // El cierre que sigue a este error reintenta
        };

        ws.onmessage = (event: MessageEvent) => {
            onMessage(event);
        };
    }

    async function connect() {
        let port = 9002;
        try {
            const prop = await GetProp('Socket', 'port');
            const leido = parseInt(String(prop?.[0]));
            if (leido > 0 && leido < 65536) {
                port = leido;
            }
        } catch (e) {
            console.warn('No se pudo leer el puerto, se usa 9002', e);
        }
        abrir(port);
    }

    async function disconnect() {
        cerrando = true;
        clearTimeout(reintento);
        conn.value?.close();
    }

    async function send(event: string, data: any) {
        const ws = conn.value;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ event: event, data: data }));
    }

    async function onMessage(event: MessageEvent) {
        try {
            const data = new WSData(event.data);
            if (!data.event) return;
            window.$eventBus.emit(data.event, data.data);
        } catch (e) {
            // Un mensaje dañado no debe romper el overlay
            console.warn('Mensaje del servidor ilegible', e);
        }
    }

    /* ---------- expose ---------- */

    return {
        init,
        conn,
        isConnected,
        connect,
        disconnect,
        send,
        onMessage
    };
});