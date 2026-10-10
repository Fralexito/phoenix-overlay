<script lang="ts" setup>
// Ping de la sala. Discreto a propósito: si todos van bien es UN solo punto con el ping medio;
// solo se abre la lista cuando alguien pasa de 50 ms (o por unos segundos si entra/sale gente).
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useOverlayStore } from '@/stores/overlayStore';
import OverlayWidgetView from '../OverlayWidgetView.vue';
import GuestsWidget from '@/models/widgets/GuestsWidget';

const props = defineProps<{ widget: GuestsWidget }>();
const overlayStore = useOverlayStore();

// Verde hasta 50 ms · naranja de 50 a 120 · rojo de 120 para arriba
function tone(ms: number) {
    if (!(ms >= 0)) return 'sin';
    if (ms <= 50) return 'ok';
    if (ms <= 120) return 'mid';
    return 'bad';
}

const lista = computed(() =>
    overlayStore.guests
        .map(g => ({ id: g.id, name: g.name, ms: Number(g.latency) || 0 }))
        .sort((a, b) => b.ms - a.ms)
);
const media = computed(() => lista.value.length ? Math.round(lista.value.reduce((a, g) => a + g.ms, 0) / lista.value.length) : 0);
const peor = computed(() => lista.value.length ? lista.value[0].ms : 0);

const pestana = ref(false);          // abierto un rato por entrada/salida de gente
let cierre: any = null;
watch(() => lista.value.map(g => g.id).join(','), (n, v) => {
    if (v === undefined) return;
    pestana.value = true;
    clearTimeout(cierre);
    cierre = setTimeout(() => { pestana.value = false; }, 6000);
});
onBeforeUnmount(() => clearTimeout(cierre));

const abierto = computed(() => props.widget.cfg.alwaysOpen || pestana.value || peor.value > 50);
const barra = (ms: number) => `${Math.max(6, Math.min(100, (ms / 160) * 100))}%`;
</script>
<template>
    <div class="widget">
        <OverlayWidgetView :widget="widget">
            <div v-if="lista.length > 0" id="widget-guests" class="ping-rail">
                <div v-if="!abierto" class="ping-chip" :class="tone(media)">
                    <i class="ping-dot"></i>
                    <span class="ping-ms">{{ media }}</span><small>ms</small>
                </div>
                <div v-else class="ping-list">
                    <div v-for="g in lista" :key="g.id" class="ping-row" :class="tone(g.ms)">
                        <i class="ping-dot"></i>
                        <span class="ping-name">{{ g.name }}</span>
                        <span v-if="widget.cfg.showLatency" class="ping-ms">{{ g.ms }}<small>ms</small></span>
                        <b class="ping-bar"><u :style="{ width: barra(g.ms) }"></u></b>
                    </div>
                </div>
            </div>
        </OverlayWidgetView>
    </div>
</template>
