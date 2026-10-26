import { createApp } from 'vue'
import { createPinia } from 'pinia';
import mitt from 'mitt';
import '@/styles/css/legacy.css';
import '@/styles/css/phoenix.css';
import '@/styles/css/phoenix-futbol.css';
import App from '@/components/App.vue'
import * as ConfirmDialog from 'vuejs-confirm-dialog';
import form from '@/components/form';
import { useConfigStore } from '@/stores/configStore';
import { useOverlayStore } from '@/stores/overlayStore';

(window as any).$eventBus = mitt();
const app = createApp(App); app.use(createPinia()); app.use(ConfirmDialog);
for (const k in form) app.component(k, (form as any)[k]);
const cfg = useConfigStore(); const ov = useOverlayStore();
cfg.app.overlay.zoom = Number(new URLSearchParams(location.search).get('zoom')) || 1;
if (cfg.app.overlay.zoom !== 1) {   // como applyOverlayZoom() del programa real
  document.documentElement.style.setProperty('--ph-zoom', String(cfg.app.overlay.zoom));
  document.body.style.transformOrigin = 'top left';
  document.body.style.transform = `scale(${cfg.app.overlay.zoom})`;
}
(cfg as any).app.overlay.opacity = 1;
await ov.init();
app.mount('#smashglass');

// Escenas simuladas: ?esc=ok | lag | todo
const esc = new URLSearchParams(location.search).get('esc') || 'todo';
const bus = (window as any).$eventBus;
const users = (a: [string, number][]) => ({ users: a.map(([name, latency], i) => ({ id: i + 1, name, latency })) });
if (esc === 'ws') {
  // Prueba de reconexión: se conecta a ws://localhost:9002 (el servidor de prueba puede abrir tarde)
  const { useSocketStore } = await import('@/stores/socketStore');
  useSocketStore().connect();
} else if (esc === 'futbol') {
  // Marcador + gol + panel de amigos (?esc=futbol&fase=en_juego|descanso|final&panel=1)
  const q = new URLSearchParams(location.search);
  const fase = q.get('fase') || 'en_juego';
  const goles = [{ m: 12, l: true, j: 'MESSI' }, { m: 34, l: false, j: 'VINICIUS' }, { m: 67, l: true, j: 'DE BRUYNE' }];
  bus.emit('phoenix:partido', { fase, minuto: fase === 'descanso' ? 45 : fase === 'final' ? 90 : 67, segundo: 10, anadido: 0, periodo: 2, reloj: true,
    local: { nombre: 'Fralex', goles: 2 }, visita: { nombre: 'ElTigre', goles: 1 }, goles });
  bus.emit('phoenix:amigos', { cargados: true, salaAbierta: q.get('sala') !== '0', lista: [
    { usuarioId: 'a1', nombre: 'Mirko', estado: 'en_partida' }, { usuarioId: 'a2', nombre: 'Kaiser', estado: 'en_sala' },
    { usuarioId: 'a3', nombre: 'Zurdo10', estado: 'disponible' }, { usuarioId: 'a4', nombre: 'Lalo', estado: 'disponible' },
    { usuarioId: 'a5', nombre: 'Nico', estado: 'ausente' }, { usuarioId: 'a6', nombre: 'Pepe', estado: 'desconectado' }] });
  if (q.get('torneo') === '1') bus.emit('phoenix:torneo', { torneo: 'Copa Relámpago', ronda: 'Cuartos', a: 'Fralex', b: 'ElTigre' });
  if (q.get('panel') === '1') ov.abrirPanelAmigos();
  if (q.get('gol') === '1') setTimeout(() => bus.emit('phoenix:partido', { fase: 'en_juego', minuto: 78, segundo: 0, anadido: 0, periodo: 2, reloj: true,
    local: { nombre: 'Fralex', goles: 3 }, visita: { nombre: 'ElTigre', goles: 1 }, goles: [...goles, { m: 78, l: true, j: 'HAALAND' }] }), 1500);
} else if (esc === 'ok') {
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
