<script lang="ts" setup>
// Avisos del partido que NO estorban: nada fijo en pantalla.
// - Cartel «GOL» 7 s con cada gol.
// - Cinta del torneo («Copa · Cuartos · A vs B») 8 s al empezar y con el resultado al terminar (10 s).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useOverlayStore } from '@/stores/overlayStore';

const overlayStore = useOverlayStore();
const p = computed(() => overlayStore.partido);
const t = computed(() => overlayStore.torneo);

const gol = ref<{ equipo: string; texto: string; marcador: string } | null>(null);
const cinta = ref<{ titulo: string; detalle: string; final: boolean } | null>(null);
let golHasta = 0, cintaHasta = 0, golesVistos = -1, ultimoId = '', finalAvisado = false, reloj: any = null;

const tituloTorneo = () => (t.value ? [t.value.torneo, t.value.ronda].filter(Boolean).join(' · ') : '');

watch(t, (nuevo) => {
    if (!nuevo) { cinta.value = null; return; }
    cinta.value = { titulo: tituloTorneo(), detalle: `${nuevo.a} vs ${nuevo.b}`, final: false };
    cintaHasta = Date.now() + 8000;
}, { deep: true });

watch(p, (nuevo) => {
    if (!nuevo) { golesVistos = -1; gol.value = null; finalAvisado = false; return; }
    const ahora = Date.now();
    const id = nuevo.local.nombre + '|' + nuevo.visita.nombre;
    if (id !== ultimoId || nuevo.goles.length < Math.max(golesVistos, 0)) {
        ultimoId = id; golesVistos = nuevo.goles.length; finalAvisado = false;
        if (t.value) { cinta.value = { titulo: tituloTorneo(), detalle: `${nuevo.local.nombre} vs ${nuevo.visita.nombre}`, final: false }; cintaHasta = ahora + 8000; }
    } else if (nuevo.goles.length > golesVistos) {
        const g = nuevo.goles[nuevo.goles.length - 1];
        golesVistos = nuevo.goles.length;
        gol.value = {
            equipo: g.l ? nuevo.local.nombre : nuevo.visita.nombre,
            texto: (g.j ? g.j + ' ' : '') + g.m + "'" + (g.pp ? ' (en propia)' : ''),
            marcador: `${nuevo.local.goles} - ${nuevo.visita.goles}`
        };
        golHasta = ahora + 7000;
    }
    if (nuevo.fase === 'final' && !finalAvisado) {
        finalAvisado = true;
        cinta.value = { titulo: (tituloTorneo() || 'FINAL'), detalle: `${nuevo.local.nombre} ${nuevo.local.goles} - ${nuevo.visita.goles} ${nuevo.visita.nombre}`, final: true };
        cintaHasta = ahora + 10000;
    }
}, { deep: true });

function paso() {
    const ahora = Date.now();
    if (gol.value && ahora >= golHasta) gol.value = null;
    if (cinta.value && ahora >= cintaHasta) cinta.value = null;
}
onMounted(() => { reloj = setInterval(paso, 1000); });
onBeforeUnmount(() => clearInterval(reloj));
</script>

<template>
    <div class="pf-marcador-zona">
        <transition name="pf-gol">
            <div v-if="gol" class="pf-gol" :key="gol.texto + gol.marcador">
                <div class="pf-gol-ball">⚽</div>
                <div class="pf-gol-txt">
                    <b>¡GOOOL!</b>
                    <span class="pf-gol-eq">{{ gol.equipo }}</span>
                    <span class="pf-gol-quien">{{ gol.texto }}</span>
                </div>
                <div class="pf-gol-res">{{ gol.marcador }}</div>
            </div>
        </transition>
        <transition name="pf-marcador">
            <div v-if="cinta" class="pf-marcador" :class="{ 'fase-final': cinta.final }" :key="cinta.titulo + cinta.detalle">
                <div class="pf-fila" style="grid-template-columns: 1fr;">
                    <span class="pf-eq" style="text-align:center">{{ cinta.titulo }}</span>
                    <span class="pf-eq" style="text-align:center;font-size:14px;opacity:.85">{{ cinta.detalle }}</span>
                </div>
            </div>
        </transition>
    </div>
</template>
