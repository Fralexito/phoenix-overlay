import { createApp } from 'vue'
import { createPinia } from 'pinia';
import mitt from 'mitt';
import '@/styles/css/legacy.css';
import '@/styles/css/phoenix.css';
import App from '@/components/App.vue'
import * as ConfirmDialog from 'vuejs-confirm-dialog';
import form from '@/components/form';
import { useConfigStore } from '@/stores/configStore';
import { useOverlayStore } from '@/stores/overlayStore';

(window as any).$eventBus = mitt();
const app = createApp(App); app.use(createPinia()); app.use(ConfirmDialog);
for (const k in form) app.component(k, (form as any)[k]);
const cfg = useConfigStore(); const ov = useOverlayStore();
cfg.app.overlay.zoom = 1;
(cfg as any).app.overlay.opacity = 1;
await ov.init();
app.mount('#smashglass');

// Escenas simuladas: ?esc=ok | lag | todo
const esc = new URLSearchParams(location.search).get('esc') || 'todo';
const bus = (window as any).$eventBus;
const users = (a: [string, number][]) => ({ users: a.map(([name, latency], i) => ({ id: i + 1, name, latency })) });
if (esc === 'ok') {
  bus.emit('guest:poll', users([['Mirko', 18], ['Kaiser', 24], ['Zurdo10', 34]]));
} else if (esc === 'lag') {
  bus.emit('guest:poll', users([['Mirko', 18], ['ElTigre', 87], ['Zurdo10', 164], ['Kaiser', 41]]));
} else {
  bus.emit('guest:poll', users([['Mirko', 18], ['ElTigre', 87], ['Zurdo10', 164]]));
  bus.emit('phoenix:ticker', { items: [{ id: 7, texto: 'La jornada 5 empieza esta noche a las 21:00', nivel: 'importante' }, { id: 6, texto: 'Mantenimiento breve del servidor en 10 minutos', nivel: 'info' }] });
  bus.emit('chat:log', { message: 'Kaiser se unió a la sala' });
  bus.emit('chat:new', { user: { id: 2, name: 'Mirko' }, message: 'listo para jugar?' });
  bus.emit('phoenix:chatgeneral', { id: 90, nombre: 'FRALEX', texto: 'Buenas noches liga, hoy hay final' });
}
