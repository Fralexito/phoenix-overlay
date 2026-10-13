<script lang="ts" setup>
// Marcador de partido estilo transmisión: una pastilla pequeña abajo al centro.
// No estorba: asoma 8 s al empezar, 10 s con cada gol (con cartel «GOL»), se queda en el descanso y en el final
// con el resumen de goles, y en juego solo reaparece 6 s cada 90 s.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useOverlayStore } from '@/stores/overlayStore';

const overlayStore = useOverlayStore();
const p = computed(() => overlayStore.partido);

const visible = ref(false);
const gol = ref<{ equipo: string; texto: string; marcador: string } | null>(null);
let hasta = 0, proxima = 0, golHasta = 0, golesVistos = -1, ultimoPartidoId = '', reloj: any = null;

const enPausa = computed(() => p.value?.fase === 'descanso' || p.value?.fase === 'final');
const minutoTxt = computed(() => {
    if (!p.value) return '';
    if (p.value.fase === 'descanso') return 'DESCANSO';
    if (p.value.fase === 'final') return 'FINAL';
    const extra = p.value.anadido > 0 && p.value.minuto >= 45 ? `+${p.value.anadido}` : '';
    return `${p.value.minuto}'${extra}`;
});
const resumen = computed(() => (p.value?.goles ?? []).slice(-8));
const claseFase = computed(() => (p.value ? 'fase-' + p.value.fase : ''));

watch(p, (nuevo, viejo) => {
    if (!nuevo) { golesVistos = -1; gol.value = null; visible.value = false; return; }
    const ahora = Date.now();
    // Partido nuevo (o el marcador volvió a 0): se muestra al empezar
    const id = nuevo.local.nombre + '|' + nuevo.visita.nombre;
    if (!viejo || id !== ultimoPartidoId || nuevo.goles.length < Math.max(golesVistos, 0)) {
        ultimoPartidoId = id;
        golesVistos = nuevo.goles.length;
        hasta = ahora + 8000; proxima = hasta + 90000;
    }
    else if (nuevo.goles.length > golesVistos) {
        const g = nuevo.goles[nuevo.goles.length - 1];
        golesVistos = nuevo.goles.length;
        gol.value = {
            equipo: g.l ? nuevo.local.nombre : nuevo.visita.nombre,
            texto: (g.j ? g.j + ' ' : '') + g.m + "'" + (g.pp ? ' (en propia)' : ''),
            marcador: `${nuevo.local.goles} - ${nuevo.visita.goles}`
        };
        golHasta = ahora + 7000;
        hasta = ahora + 10000; proxima = hasta + 90000;
    }
    paso();
}, { deep: true });

function paso() {
    const ahora = Date.now();
    if (!p.value) { visible.value = false; return; }
    if (gol.value && ahora >= golHasta) gol.value = null;
    if (!enPausa.value && ahora >= proxima && ahora >= hasta) { hasta = ahora + 6000; proxima = hasta + 90000; }
    visible.value = enPausa.value || ahora < hasta;
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
            <div v-if="visible && p" class="pf-marcador" :class="claseFase">
                <div class="pf-fila">
                    <span class="pf-eq pf-eq-l">{{ p.local.nombre }}</span>
                    <span class="pf-goles"><b>{{ p.local.goles }}</b><i>-</i><b>{{ p.visita.goles }}</b></span>
                    <span class="pf-eq pf-eq-v">{{ p.visita.nombre }}</span>
                    <span class="pf-min" :class="{ pausa: p.fase === 'pausado' }"><i v-if="p.fase === 'en_juego'" class="pf-vivo"></i>{{ p.fase === 'pausado' ? 'PAUSA' : minutoTxt }}</span>
                </div>
                <div v-if="enPausa && resumen.length" class="pf-resumen">
                    <span v-for="(g, i) in resumen" :key="i" :class="g.l ? 'l' : 'v'">
                        ⚽ {{ g.m }}' <em>{{ g.j || (g.l ? p.local.nombre : p.visita.nombre) }}</em>
                    </span>
                </div>
            </div>
        </transition>
    </div>
</template>
