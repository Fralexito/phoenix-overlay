<script lang="ts" setup>
// Panel de amigos encima del juego (Shift + | o Ctrl + Alt + A), como el de Discord:
// lista de amigos de la web con su estado y botón «Invitar» sin salir del partido.
// Datos: overlayStore.amigos (phoenix:amigos) e invitaciones (phoenix:invitacion). Invitar manda phoenix:invitar a Link.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useOverlayStore } from '@/stores/overlayStore';

const overlayStore = useOverlayStore();
const busca = ref('');
const verDesconectados = ref(false);
const campo = ref<HTMLInputElement | null>(null);

const grupos = [
    { id: 'en_partida', titulo: 'JUGANDO UN PARTIDO', clase: 'jug' },
    { id: 'en_sala', titulo: 'EN UNA SALA', clase: 'sala' },
    { id: 'disponible', titulo: 'ACTIVOS EN LA WEB', clase: 'act' },
    { id: 'ausente', titulo: 'AUSENTES', clase: 'aus' },
    { id: 'desconectado', titulo: 'DESCONECTADOS', clase: 'off' }
];

const filtrados = computed(() => {
    const q = busca.value.trim().toLowerCase();
    return overlayStore.amigos.lista.filter(a => !q || a.nombre.toLowerCase().includes(q));
});
const porGrupo = (id: string) => filtrados.value.filter(a => a.estado === id);
const activos = computed(() => overlayStore.amigos.lista.filter(a => a.estado === 'disponible' || a.estado === 'en_sala' || a.estado === 'en_partida').length);
const iniciales = (n: string) => (n.trim()[0] || '?').toUpperCase();
const textoEstado: Record<string, string> = { en_partida: 'Jugando', en_sala: 'En sala', disponible: 'Activo', ausente: 'Ausente', desconectado: 'Desconectado' };

function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape' && overlayStore.panelAmigos) { e.preventDefault(); overlayStore.cerrarPanelAmigos(); }
}
onMounted(() => window.addEventListener('keydown', tecla));
onBeforeUnmount(() => window.removeEventListener('keydown', tecla));
watch(() => overlayStore.panelAmigos, (abierto) => {
    if (abierto) setTimeout(() => campo.value?.focus(), 150); else busca.value = '';
});
</script>

<template>
    <!-- Fuera de la caja del overlay (que se escala con el zoom y recorta lo que sobresale): así el panel sale a tamaño real y a pantalla completa -->
    <Teleport to="html">
    <transition name="pf-panel">
        <div v-if="overlayStore.panelAmigos" class="pf-fondo" @mousedown.self="overlayStore.cerrarPanelAmigos()">
            <aside class="pf-panel" role="dialog" aria-label="Amigos">
                <header class="pf-cab">
                    <svg class="pf-cancha" viewBox="0 0 120 40" aria-hidden="true">
                        <rect x="1" y="1" width="118" height="38" rx="3" /><line x1="60" y1="1" x2="60" y2="39" /><circle cx="60" cy="20" r="8" />
                        <rect x="1" y="11" width="14" height="18" /><rect x="105" y="11" width="14" height="18" />
                    </svg>
                    <div class="pf-cab-txt">
                        <h2>AMIGOS</h2>
                        <p><i class="pf-vivo"></i>{{ activos }} {{ activos === 1 ? 'activo' : 'activos' }} ahora</p>
                    </div>
                    <button class="pf-x" title="Cerrar (Esc)" @click="overlayStore.cerrarPanelAmigos()">✕</button>
                </header>

                <div v-if="!overlayStore.amigos.salaAbierta" class="pf-aviso">Abre tu sala en Phoenix Link para poder invitar.</div>

                <input ref="campo" v-model="busca" class="pf-busca" type="text" placeholder="Buscar amigo…" maxlength="40" autocomplete="off" />

                <div class="pf-lista">
                    <div v-if="!overlayStore.amigos.cargados" class="pf-vacio">Cargando amigos…</div>
                    <div v-else-if="overlayStore.amigos.lista.length === 0" class="pf-vacio">Aún no tienes amigos agregados. Agrégalos desde tu perfil en la web de la liga.</div>
                    <template v-else>
                        <template v-for="g in grupos" :key="g.id">
                            <section v-if="porGrupo(g.id).length && (g.id !== 'desconectado' || verDesconectados || busca)" class="pf-grupo">
                                <h3>{{ g.titulo }} <span>{{ porGrupo(g.id).length }}</span></h3>
                                <div v-for="a in porGrupo(g.id)" :key="a.usuarioId" class="pf-amigo" :class="g.clase">
                                    <span class="pf-av">{{ iniciales(a.nombre) }}<i></i></span>
                                    <span class="pf-nom">{{ a.nombre }}<small>{{ textoEstado[a.estado] || a.estado }}</small></span>
                                    <span v-if="overlayStore.invitaciones[a.usuarioId]?.estado === 'ok'" class="pf-ok" :title="overlayStore.invitaciones[a.usuarioId].mensaje">✓ Invitado</span>
                                    <span v-else-if="overlayStore.invitaciones[a.usuarioId]?.estado === 'error'" class="pf-err" :title="overlayStore.invitaciones[a.usuarioId].mensaje">{{ overlayStore.invitaciones[a.usuarioId].mensaje || 'No se pudo' }}</span>
                                    <button v-else class="pf-inv" :disabled="!overlayStore.amigos.salaAbierta || overlayStore.invitaciones[a.usuarioId]?.estado === 'enviando'"
                                        :title="a.estado === 'desconectado' ? 'La invitación dura 2 h: la verá al conectarse.' : 'Invitar a tu sala'"
                                        @click="overlayStore.invitarAmigo(a.usuarioId)">
                                        {{ overlayStore.invitaciones[a.usuarioId]?.estado === 'enviando' ? 'Enviando…' : 'Invitar' }}
                                    </button>
                                </div>
                            </section>
                        </template>
                        <button v-if="!busca && porGrupo('desconectado').length" class="pf-mas" @click="verDesconectados = !verDesconectados">
                            {{ verDesconectados ? 'Ocultar desconectados' : `Ver desconectados (${porGrupo('desconectado').length})` }}
                        </button>
                        <div v-if="busca && filtrados.length === 0" class="pf-vacio">Nadie coincide.</div>
                    </template>
                </div>

                <footer class="pf-pie"><kbd>Esc</kbd> o <kbd>Shift</kbd>+<kbd>|</kbd> para volver al partido</footer>
            </aside>
        </div>
    </transition>
    </Teleport>
</template>
