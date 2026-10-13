import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Events } from '@wailsio/runtime';
import axios from 'axios';
import { createConfirmDialog } from 'vuejs-confirm-dialog';
import { Focus, Blur } from '../../bindings/SmashGlass/services/windowservice';
import { LoadPlugins, DeletePlugin } from '@bindings/pluginservice';
import { GetOverlayStyles, GetOverlayThemeCSS } from '@bindings/styleservice';
import { Plugin } from '@bindings/models';
import OverlayTheme from '@/models/OverlayTheme';
import OverlayWidget from '@/models/OverlayWidget';
import ChatWidget from '@/models/widgets/ChatWidget';
import GuestsWidget from '@/models/widgets/GuestsWidget';
import GamepadsWidget from '@/models/widgets/GamepadsWidget';
import WebcamWidget from '@/models/widgets/WebcamWidget';
import TickerWidget from '@/models/widgets/TickerWidget';
import RegistryDialog from '@/components/overlay/config/RegistryDialog.vue';
import AppConfig from '@/models/config/AppConfig';

import User from '@/models/User';
import ChatMessage from '@/models/chat/ChatMessage';
import ChatBubble from '@/models/chat/ChatBubble';
import Pad from '@/models/Pad';
import type { PartidoOverlay, AmigoOverlay } from '@/models/Phoenix';

import { useSocketStore } from './socketStore';
import { useConfigStore } from './configStore';

export const useOverlayStore = defineStore('overlayStore', () => {

    /**
     * The current user.
     * @type {User}
     */
    const user = ref<User>(new User());

    /**
     * Guests in the room.
     */
    const guests = ref<User[]>([]);

    /**
     * Noticias de "última hora" que manda Phoenix Link (máximo 5).
     */
    const ticker = ref<{ id: string | number; texto: string; nivel: string }[]>([]);

    /**
     * Marcador del partido que Link lee del juego (null = no hay partido que mostrar).
     */
    const partido = ref<PartidoOverlay | null>(null);

    /**
     * Amigos de la web (presencia) y panel desplegable para invitarlos sin salir del juego.
     */
    const amigos = ref<{ cargados: boolean; salaAbierta: boolean; lista: AmigoOverlay[] }>({ cargados: false, salaAbierta: false, lista: [] });
    const panelAmigos = ref(false);
    const invitaciones = ref<Record<string, { estado: 'enviando' | 'ok' | 'error'; mensaje: string }>>({});
    let latidoPanel: number | undefined;

    /**
     * The widgets to be displayed on the overlay.
     */
    const widgets = ref<OverlayWidget[]>([]);

    /**
     * The themes to be displayed on the overlay.
     */
    const themes = ref<OverlayTheme[]>([]);

    /**
     * The custom widgets to be displayed on the overlay.
     */
    const customWidgets = ref<OverlayWidget[]>([]);

    /**
     * The plugins to be loaded on the overlay.
     */
    const plugins = ref<Plugin[]>([]);

    /**
     * The overlay is locked when the menu is open.
     */
    const locked = ref(false);

    /**
     * Whether the overlay is in interactable mode or not,
     * allowing widgets to be moved and resized.
     */
    const interactable = ref(false);

    /**
     * The chat messages to be displayed on the overlay.
     */
    const chatMessages = ref<ChatMessage[]>([]);

    /**
     * The chat bubbles to be displayed on the overlay.
     */
    const chatBubbles = ref<ChatBubble[]>([]);

    /**
     * The next chat message ID.
     */
    let nextChatBubbleId = 0;

    /**
     * The gamepads to be displayed on the overlay.
     */
    const pads = ref<Pad[]>([]);

    /**
     * The user's webcam stream for the webcam widget.
     */
    const webcamStream = ref<MediaStream>(null);

    /**
     * The plugins registry list.
     */
    const pluginsRegistry = ref<any>(null);

    /**
     * The themes registry list.
     */
    const themesRegistry = ref<any>(null);

    /**
     * Initialize the store.
     */
    async function init() {

        // Cada paso va aparte: si uno falla (un tema o plugin dañado), el overlay arranca igual
        const paso = async (nombre: string, fn: () => any) => {
            try { await fn(); } catch (e) { console.error(`[overlay] ${nombre} falló`, e); }
        };
        await paso('temas', () => loadThemes());
        await paso('tema', () => applyTheme(useConfigStore().app.overlay.theme));
        await paso('plugins', () => loadPlugins());
        await paso('atajos', () => handleHotkeys());
        await paso('widgets', () => initDefaultWidgets());

        window.$eventBus.on('chat:new', (data: any) => {
            if (!data?.message) return;
            const message = new ChatMessage();
            message.user.id = data.user?.id ?? -1;
            message.user.name = data.user?.name ?? '';
            message.content = String(data.message);
            message.createdAt = new Date();
            message.createdAtFormatted = message.formatCreatedAt();
            addChatMessage(message);
        })

        window.$eventBus.on('chat:log', (data: any) => {
            const message = new ChatMessage();
            message.type = 'log';
            message.content = data.message;
            message.createdAt = new Date();
            message.createdAtFormatted = message.formatCreatedAt();
            addChatMessage(message);
        })

        // Phoenix: última hora de la liga
        window.$eventBus.on('phoenix:ticker', (data: any) => {
            const items = Array.isArray(data?.items) ? data.items : [];
            ticker.value = items
                .filter((i: any) => i && i.texto)
                .slice(0, 5)
                .map((i: any) => ({ id: i.id ?? i.texto, texto: String(i.texto), nivel: i.nivel === 'urgente' || i.nivel === 'importante' ? i.nivel : 'info' }));
        })

        // Phoenix: marcador en vivo del partido (fase «libre» = nada que mostrar)
        window.$eventBus.on('phoenix:partido', (data: any) => {
            if (!data || !data.local || !data.visita || data.fase === 'libre') { partido.value = null; return; }
            partido.value = {
                fase: String(data.fase || 'en_juego'),
                minuto: Number(data.minuto) || 0,
                segundo: Number(data.segundo) || 0,
                anadido: Number(data.anadido) || 0,
                periodo: Number(data.periodo) || 0,
                reloj: data.reloj !== false,
                local: { nombre: String(data.local.nombre || 'Local'), goles: Number(data.local.goles) || 0 },
                visita: { nombre: String(data.visita.nombre || 'Visita'), goles: Number(data.visita.goles) || 0 },
                goles: Array.isArray(data.goles) ? data.goles.slice(0, 40).map((g: any) => ({ m: Number(g.m) || 0, l: !!g.l, j: g.j ? String(g.j) : undefined, pp: !!g.pp })) : []
            };
        })

        // Phoenix: amigos de la web para el panel desplegable
        window.$eventBus.on('phoenix:amigos', (data: any) => {
            const lista = Array.isArray(data?.lista) ? data.lista : [];
            amigos.value = {
                cargados: !!data?.cargados,
                salaAbierta: !!data?.salaAbierta,
                lista: lista.filter((a: any) => a && a.usuarioId && a.nombre).map((a: any) => ({ usuarioId: String(a.usuarioId), nombre: String(a.nombre), estado: String(a.estado || 'desconectado') }))
            };
        })

        // Phoenix: respuesta de Link a una invitación pedida desde el panel
        window.$eventBus.on('phoenix:invitacion', (data: any) => {
            const id = String(data?.usuarioId || '');
            if (!id) return;
            invitaciones.value = { ...invitaciones.value, [id]: { estado: data.ok ? 'ok' : 'error', mensaje: String(data.mensaje || '') } };
            window.setTimeout(() => { const { [id]: _quitar, ...resto } = invitaciones.value; invitaciones.value = resto; }, 9000);
        })

        // Phoenix: mensajes del chat general de la liga (el mismo de la web)
        window.$eventBus.on('phoenix:chatgeneral', (data: any) => {
            if (!data?.texto) return;
            const message = new ChatMessage();
            message.type = 'general';
            message.user.id = data.id ?? -1;
            message.user.name = data.nombre || '';
            message.content = String(data.texto);
            message.createdAt = new Date();
            message.createdAtFormatted = message.formatCreatedAt();
            addChatMessage(message);
        })

        window.$eventBus.on('guest:poll', (data: any) => {
            const users = Array.isArray(data?.users) ? data.users : [];
            guests.value = users.map((user: any) => new User({
                id: user.id,
                name: user.name,
                latency: Math.round(Number(user.latency) || 0)
            }));
        })

        window.$eventBus.on('gamepad:poll', (data: any) => {
            const lista = Array.isArray(data?.gamepads) ? data.gamepads : [];
            pads.value = lista.map((pad: any) => new Pad({
                buttons: (Array.isArray(pad.buttons) ? pad.buttons : []).map((button: any) => ({
                    pressed: button,
                    touched: button,
                    value: button
                })),
                axes: pad.axes ?? [],
                owner: pad.owner ? {
                    id: "",
                    name: pad.owner.name,
                    hotseatTime: pad.owner.hotseatTime
                } : null
            }));
        })
    }

    /**
     * Loads all custom themes for Smash Soda overlay.
     */
    async function loadThemes() {
       
        const loadedThemes = await GetOverlayStyles();

        themes.value = loadedThemes.map(theme => new OverlayTheme({
            id: theme.ID,
            meta: {
                name: theme.Meta?.name || theme.ID,
                author: theme.Meta?.author || 'Unknown',
                description: theme.Meta?.description || ''
            }
        }));

    }

    /**
     * Apply custom style sheet to overlay.
     * @param {string} theme
     */
    async function applyTheme(theme: string) {
        if (theme === 'default') {
            document.getElementById('custom-css').innerHTML = '';
            return;
        }
        try {
            console.log(`Applying theme: ${theme}`);
            const themeCSS = await GetOverlayThemeCSS(theme);
            console.log(themeCSS);
            document.getElementById('custom-css').innerHTML = themeCSS;
        } catch (error) {
            document.getElementById('custom-css').innerHTML = '';
        }
    }

    /**
     * Checks if a theme is loaded.
     * @param {string} theme
     */
    function isThemeLoaded(theme: string) {
        return themes.value.find(t => t.id === theme);
    }

    /**
     * Loads all custom stylesheets for Smash Soda overlay.
     */
    async function loadPlugins() {
        const loadedPlugins = await LoadPlugins();
        const configStore = useConfigStore();
        
        (loadedPlugins ?? []).forEach(plugin => {
          try {

            // Skip plugins already loaded
            if (plugins.value.find(p => p.Meta.id === plugin.Meta.id)) {
                return;
            }

            plugins.value.push(plugin);

            // Create a config if one does not exist
            if (!configStore.app.overlay.widgets.custom[plugin.Meta.name]) {
                configStore.app.overlay.widgets.custom[plugin.Meta.name] = {
                    position: plugin.Config.position,
                    enabled: false,
                    active: false,
                    cfg: plugin.Config
                };
            } else {
                // Add any missing keys to the config
                Object.keys(plugin.Config).forEach(key => {
                    if (configStore.app.overlay.widgets.custom[plugin.Meta.name].cfg[key] === undefined) {
                        configStore.app.overlay.widgets.custom[plugin.Meta.name].cfg[key] = plugin.Config[key];
                    }
                })
            }

            // Create a widget
            const widget = new OverlayWidget({
                id: plugin.Meta.id,
                name: plugin.Meta.name,
                html: plugin.HTML,
                css: plugin.CSS,
                custom: true,
                position: plugin.Config.position,
                enabled: false,
                active: false,
                cfg: plugin.Config
            });
            customWidgets.value.push(widget);

            // Enable the widget if it is enabled in the config
            if (configStore.app.overlay.widgets.custom[plugin.Meta.name].enabled) {
                enableCustomWidget(plugin.Meta.name, true);
            }

            // Evaluate the plugin's JS
            if (plugin.JS) {
                eval(plugin.JS);
            }

            window.$eventBus.emit(`plugin:loaded:${plugin.Meta.id}`, configStore.app.overlay.widgets.custom[plugin.Meta.name].cfg);

          } catch (e) {
            // Un plugin dañado no debe impedir que el overlay abra
            console.error('[overlay] plugin falló', plugin?.Name, e);
          }
        });
    }

    /**
     * Checks if a plugin is loaded.
     * @param {string} pluginName
     */
    function isPluginLoaded(pluginName: string) {
        return plugins.value.find(p => p.Meta.name === pluginName);
    }

    /**
     * Enables a custom widget.
     * 
     * @param widgetName The name of the widget to enable.
     */
    function enableCustomWidget(widgetName: string, state: boolean) {

        // Find the widget
        const widget = customWidgets.value.find(widget => widget.name === widgetName);
        if (widget) {
            widget.enabled = state;

            // Find a style tag with id style-widgetName
            const styleTag = document.getElementById(`style-${widgetName}`);

            if (widget.enabled) {
                if (!styleTag) {
                    // Create a new style tag
                    const styleTag = document.createElement('style');
                    styleTag.id = `style-${widgetName}`;
                    styleTag.innerHTML = widget.css;
                    document.head.appendChild(styleTag);
                }
                window.$eventBus.emit(`plugin:enabled:${widget.id}`);
            } else if (styleTag) {
                styleTag.remove();
                window.$eventBus.emit(`plugin:disabled:${widget.id}`);
            }
        }

    }

    /**
     * Deletes a plugin.
     * 
     * @param pluginId The id of the plugin to delete.
     */
    function deletePlugin(pluginId: string|number) {
        
        window.$dialog.confirm(() => {
            
            // Find the plugin
            const plugin = plugins.value.find(plugin => plugin.Meta.id === pluginId);
            if (plugin) {
                plugins.value.splice(plugins.value.indexOf(plugin), 1);

                // Remove the plugin's widget
                const widget = customWidgets.value.find(widget => widget.name === plugin.Meta.name);
                if (widget) {
                    window.$eventBus.emit(`plugin:unloaded:${plugin.Meta.id}`);

                    // Remove the style tag
                    const styleTag = document.getElementById(`style-${plugin.Meta.name}`);
                    if (styleTag) {
                        styleTag.remove();
                    }

                    customWidgets.value.splice(customWidgets.value.indexOf(widget), 1);
                }

                // Remove the plugin's config
                const config = useConfigStore().app.overlay.widgets.custom[plugin.Meta.name];
                if (config) {
                    delete useConfigStore().app.overlay.widgets.custom[plugin.Meta.name];
                }

                // Delete files
                try {
                    DeletePlugin(plugin.Meta.id);
                } catch (error) {}

            }

        }, 'Are you sure you want to delete this plugin?', 'Delete Plugin');

    }

    /**
     * Gets all themes.
     */
    async function getThemes() {
        if (themesRegistry.value === null) {
            const url = 'https://raw.githubusercontent.com/trybuchet/smash-soda-registry/main/overlay/themes/index.json';
            const response = await axios.get(url, {
                responseType: 'json',
                timeout: 5000,
            });
            themesRegistry.value = response.data;
        }

        const { reveal, onConfirm, onCancel } = createConfirmDialog(RegistryDialog as any, {
            type: 'themes',
            registry: themesRegistry.value,
        });

        reveal();
    }

    /**
     * Gets all plugins.
     */
    async function getPlugins() {
        if (pluginsRegistry.value === null) {
            const url = 'https://raw.githubusercontent.com/trybuchet/smash-soda-registry/main/overlay/plugins/index.json';
            const response = await axios.get(url, {
                responseType: 'json',
                timeout: 5000,
            });
            pluginsRegistry.value = response.data;
        }

        const { reveal, onConfirm, onCancel } = createConfirmDialog(RegistryDialog as any, {
            type: 'plugins',
            registry: pluginsRegistry.value,
        });

        reveal();
    }

    /**
     * Handles the hotkey events.
     */
    async function handleHotkeys() {

        Events.On('hotkey:chat', () => {
            if (locked.value || interactable.value) return;
            // Find chat widget
            const chatWidget = findWidgetByName('chat');
            if (chatWidget) {
                chatWidget.active = !chatWidget.active;

                if (chatWidget.active) {
                    Focus();
                } else {
                    Blur();
                }
            }
        });

        Events.On('hotkey:amigos', () => alternarPanelAmigos());

        Events.On('hotkey:move', () => {
            if (locked.value) return;
            interactable.value = !interactable.value;

            if (interactable.value) {
                Focus();
            } else {
                Blur();
            }
        });

    }

    /**
     * Find a widget by its name.
     * 
     * @param name The name of the widget to find.
     * @returns The widget, or undefined if not found.
     */
    function findWidgetByName(name: string) {
        const widget = widgets.value.find(widget => widget.name === name);
        if (widget) return widget;
        return customWidgets.value.find(widget => widget.name === name);
    }

    /**
     * Initialize the default widgets.
     * 
     * @returns void
     */
    function initDefaultWidgets() {

        const configStore = useConfigStore();

        try {
            const chatWidget = new ChatWidget();
            Object.assign(chatWidget, {
                enabled: configStore.app.overlay.widgets.default.chat.enabled,
                position: {
                    ...chatWidget.position,
                    ...(configStore.app.overlay.widgets.default.chat.position as any)
                },
                cfg: {
                    ...chatWidget.cfg,
                    ...configStore.app.overlay.widgets.default.chat.cfg
                }
            });

            const guestsWidget = new GuestsWidget();
            Object.assign(guestsWidget, {
                enabled: configStore.app.overlay.widgets.default.guests.enabled,
                position: {
                    ...guestsWidget.position,
                    ...(configStore.app.overlay.widgets.default.guests.position as any)
                },
                cfg: {
                    ...guestsWidget.cfg,
                    ...configStore.app.overlay.widgets.default.guests.cfg
                }
            });

            const gamepadsWidget = new GamepadsWidget();
            Object.assign(gamepadsWidget, {
                enabled: configStore.app.overlay.widgets.default.gamepads.enabled,
                position: {
                    ...gamepadsWidget.position,
                    ...(configStore.app.overlay.widgets.default.gamepads.position as any)
                },
                cfg: {
                    ...gamepadsWidget.cfg,
                    ...configStore.app.overlay.widgets.default.gamepads.cfg
                }
            });

            // const webcamWidget = new WebcamWidget();
            // Object.assign(webcamWidget, {
            //     enabled: configStore.app.overlay.widgets.default.webcam.enabled,
            //     position: {
            //         ...webcamWidget.position,
            //         ...(configStore.app.overlay.widgets.default.webcam.position as any)
            //     },
            //     cfg: {
            //         ...webcamWidget.cfg,
            //         ...configStore.app.overlay.widgets.default.webcam.cfg
            //     }
            // });

            // La franja de última hora es nueva: una configuración guardada antes no la trae
            const tickerCfg = (configStore.app.overlay.widgets.default as any).ticker
                ?? ((configStore.app.overlay.widgets.default as any).ticker = new AppConfig().overlay.widgets.default.ticker);
            const tickerWidget = new TickerWidget();
            Object.assign(tickerWidget, {
                enabled: tickerCfg.enabled,
                position: { ...tickerWidget.position, ...(tickerCfg.position as any) },
                cfg: { ...tickerWidget.cfg, ...tickerCfg.cfg }
            });

            // Phoenix: tamaños rotos guardados por una versión anterior (recuadros encogidos a 50 px
            // al arrancar con la ventana sin medir) vuelven a los de fábrica.
            const fabrica: Record<string, { w: number, h: number }> = {
                chat: new ChatWidget().position, guests: new GuestsWidget().position,
                ticker: new TickerWidget().position, gamepads: new GamepadsWidget().position,
            };
            for (const w of [chatWidget, guestsWidget, tickerWidget, gamepadsWidget]) {
                const f = fabrica[w.name];
                if (f && w.position.position !== 'custom' && !w.position.autoWidth && w.position.w < f.w * 0.6) {
                    w.position.w = f.w;
                }
            }

            widgets.value = [chatWidget, guestsWidget, tickerWidget, gamepadsWidget];

            // Enable webcam?
            // if (configStore.app.overlay.widgets.default.webcam.enabled) {
            //     // Get webcam device
            //     navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: configStore.app.overlay.widgets.default.webcam.cfg.deviceId } } }).then(stream => {
            //         webcamStream.value = stream;
            //     });
            // }
        } catch (error) {
            console.warn('Failed to apply widget config, resetting to defaults.', error);
            configStore.resetConfig();
            widgets.value = [new ChatWidget(), new GuestsWidget(), new TickerWidget(), new GamepadsWidget()];
        }
    }

    /**
     * Add a chat message to the store.
     * 
     * @param message The message to add.
     */
    function addChatMessage(message: ChatMessage) {
        const chatMessage = new ChatMessage(message);

        chatMessages.value.unshift(chatMessage);
        // Sin tope, una sala larga llenaría la memoria con mensajes viejos
        if (chatMessages.value.length > 200) chatMessages.value.length = 200;

        const chatBubble = new ChatBubble(message);
        chatBubble.id = nextChatBubbleId++;
        chatBubbles.value.unshift(chatBubble);
        if (chatBubbles.value.length > 30) chatBubbles.value.length = 30;
        chatBubble.exitTimeout = setTimeout(() => {
            const bubble = chatBubbles.value.find(b => b.id === chatBubble.id);
            if (!bubble) return;

            bubble.exit = true;

            bubble.deleteTimeout = setTimeout(() => {
                const index = chatBubbles.value.indexOf(bubble);
                if (index !== -1) {
                    chatBubbles.value.splice(index, 1);
                }
            }, 5000);
        }, 10000);
    }

    /**
     * Send a message to the chat.
     * 
     * @param message The message to send.
     */
    function sendMessage(message: string) {
        const texto = String(message ?? '').trim().slice(0, 400);
        if (!texto) return;
        const socketStore = useSocketStore();
        socketStore.send('chat:send', texto);
    }

    /**
     * Panel de amigos (atajo Shift+| o Ctrl+Alt+A): se abre encima del juego, captura el ratón para
     * poder pulsar «Invitar» y lo suelta al cerrar. Mientras está abierto avisa a Link cada 4 s para que
     * sondee los amigos aunque su ventana no se vea.
     */
    function avisarPanel(abierto: boolean) {
        try { useSocketStore().send('phoenix:panel', { abierto }); } catch (e) { /* sin conexión: no pasa nada */ }
    }

    function abrirPanelAmigos() {
        if (locked.value || interactable.value || panelAmigos.value) return;
        panelAmigos.value = true;
        Focus();
        avisarPanel(true);
        window.clearInterval(latidoPanel);
        latidoPanel = window.setInterval(() => avisarPanel(true), 4000);
    }

    function cerrarPanelAmigos() {
        if (!panelAmigos.value) return;
        panelAmigos.value = false;
        window.clearInterval(latidoPanel);
        latidoPanel = undefined;
        avisarPanel(false);
        Blur();
    }

    function alternarPanelAmigos() {
        if (panelAmigos.value) cerrarPanelAmigos(); else abrirPanelAmigos();
    }

    function invitarAmigo(usuarioId: string) {
        if (invitaciones.value[usuarioId]?.estado === 'enviando') return;
        invitaciones.value = { ...invitaciones.value, [usuarioId]: { estado: 'enviando', mensaje: '' } };
        useSocketStore().send('phoenix:invitar', { usuarioId });
        // Si Link no contesta en 20 s se avisa en vez de quedarse esperando
        window.setTimeout(() => {
            if (invitaciones.value[usuarioId]?.estado === 'enviando') {
                invitaciones.value = { ...invitaciones.value, [usuarioId]: { estado: 'error', mensaje: 'Link no contestó. Prueba de nuevo.' } };
            }
        }, 20000);
    }

    return {
        partido,
        amigos,
        panelAmigos,
        invitaciones,
        abrirPanelAmigos,
        cerrarPanelAmigos,
        alternarPanelAmigos,
        invitarAmigo,
        widgets,
        themes,
        customWidgets,
        plugins,
        loadThemes,
        getThemes,
        applyTheme,
        isThemeLoaded,
        loadPlugins,
        getPlugins,
        isPluginLoaded,
        findWidgetByName,
        enableCustomWidget,
        deletePlugin,
        chatMessages,
        chatBubbles,
        addChatMessage,
        sendMessage,
        webcamStream,
        locked,
        user,
        guests,
        ticker,
        pads,
        interactable,
        init
    }

})
