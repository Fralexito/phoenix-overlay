import { createApp } from 'vue'
import { createPinia } from 'pinia';
import mitt from 'mitt';
import '@/styles/css/legacy.css';
import '@/styles/css/phoenix.css';

import { MoveMainWindowToMonitor } from '@bindings/windowservice';

import App from './components/App.vue'
import * as ConfirmDialog from 'vuejs-confirm-dialog';
import form from './components/form';
import * as dialog from './utils/dialog';

import { useConfigStore } from './stores/configStore';
import { useOverlayStore } from './stores/overlayStore';
import { useSocketStore } from './stores/socketStore';

async function initApp() {

    // Hook eventbus
    window.$eventBus = mitt();

    const app = createApp(App)
    app.use(createPinia())
    app.use(ConfirmDialog)

    // Register form components
    for (const key in form) {
        app.component(key, form[key]);
    }

    const configStore = useConfigStore()
    const overlayStore = useOverlayStore()
    const socketStore = useSocketStore()

    // Si un paso falla, el overlay abre igual (con lo que sí funcione)
    const seguro = async (nombre: string, fn: () => Promise<any>) => {
        try { await fn(); } catch (e) { console.error(`[overlay] ${nombre} falló`, e); }
    };
    await seguro('config', () => configStore.init());
    await seguro('socket', () => socketStore.init());
    await seguro('overlay', () => overlayStore.init());

    // Dialog windows
    window.$dialog = dialog;

    // Move to the default monitor
    Promise.resolve(MoveMainWindowToMonitor(configStore.app.overlay.display)).catch(() => { });

    app.mount('#smashglass')
}

initApp()
