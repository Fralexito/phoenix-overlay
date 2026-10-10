<script lang="ts" setup>
// Franja de "última hora": una línea fina arriba al centro. Asoma unos segundos al llegar una noticia
// y luego cada rato; las urgentes se quedan. Así avisa sin tapar el partido.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useOverlayStore } from '@/stores/overlayStore';
import OverlayWidgetView from '../OverlayWidgetView.vue';
import TickerWidget from '@/models/widgets/TickerWidget';

const props = defineProps<{ widget: TickerWidget }>();
const overlayStore = useOverlayStore();

const visible = ref(false);
const indice = ref(0);
const vistas = new Set<string | number>();
let hasta = 0, proxima = 0, inicio = 0, reloj: any = null;

const orden: Record<string, number> = { urgente: 0, importante: 1, info: 2 };
const items = computed(() => {
    const todas = [...overlayStore.ticker].sort((a, b) => (orden[a.nivel] ?? 2) - (orden[b.nivel] ?? 2));
    const urgentes = todas.filter(i => i.nivel === 'urgente');
    return urgentes.length ? urgentes : todas;
});
const actual = computed(() => items.value.length ? items.value[indice.value % items.value.length] : null);
const etiqueta = computed(() => actual.value?.nivel === 'urgente' ? 'URGENTE' : actual.value?.nivel === 'importante' ? 'IMPORTANTE' : 'ÚLTIMA HORA');

function paso() {
    const now = Date.now();
    const lista = overlayStore.ticker;
    if (lista.length === 0) { visible.value = false; return; }
    const showMs = Math.max(3, Number(props.widget.cfg.showSec) || 9) * 1000;
    const everyMs = Math.max(20, Number(props.widget.cfg.everySec) || 90) * 1000;
    const nuevas = lista.filter(i => !vistas.has(i.id));
    if (nuevas.length) {
        nuevas.forEach(i => vistas.add(i.id));
        inicio = now; hasta = now + showMs; proxima = hasta + everyMs;
    } else if (now >= proxima) {
        inicio = now; hasta = now + showMs; proxima = hasta + everyMs;
    }
    const urgente = lista.some(i => i.nivel === 'urgente');
    visible.value = urgente || now < hasta;
    if (visible.value && items.value.length > 1) indice.value = Math.floor((now - inicio) / 5000);
}
onMounted(() => { paso(); reloj = setInterval(paso, 1000); });
onBeforeUnmount(() => clearInterval(reloj));
</script>
<template>
    <div class="widget">
        <OverlayWidgetView :widget="widget">
            <div v-if="visible && actual" :key="actual.id" class="ticker" :class="'nv-' + actual.nivel">
                <span class="tk-tag"><i></i>{{ etiqueta }}</span>
                <span class="tk-text">{{ actual.texto }}</span>
                <span v-if="items.length > 1" class="tk-n">{{ (indice % items.length) + 1 }}/{{ items.length }}</span>
            </div>
        </OverlayWidgetView>
    </div>
</template>
