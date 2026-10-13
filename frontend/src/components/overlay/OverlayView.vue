<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useOverlayStore } from '@/stores/overlayStore';
import { useConfigStore } from '@/stores/configStore';
import { useSocketStore } from '@/stores/socketStore';

import OverlayChatWidgetView from './widgets/OverlayChatWidgetView.vue';
import OverlayGuestsWidgetView from './widgets/OverlayGuestsWidgetView.vue';
import OverlayGamepadsWidgetView from './widgets/OverlayGamepadsWidgetView.vue';
import OverlayWebcamWidgetView from './widgets/OverlayWebcamWidgetView.vue';
import OverlayTickerWidgetView from './widgets/OverlayTickerWidgetView.vue';
import OverlayWidgetView from './OverlayWidgetView.vue';
import PhoenixAmigosPanelView from './widgets/PhoenixAmigosPanelView.vue';

const overlayStore = useOverlayStore();
const configStore = useConfigStore();
const socketStore = useSocketStore();

const chatWidget = computed(() => overlayStore.findWidgetByName('chat'));
const guestsWidget = computed(() => overlayStore.findWidgetByName('guests'));
const gamepadsWidget = computed(() => overlayStore.findWidgetByName('gamepads'));
const webcamWidget = computed(() => overlayStore.findWidgetByName('webcam'));
const tickerWidget = computed(() => overlayStore.findWidgetByName('ticker'));

const overlayStyle = computed(() => ({
    opacity: configStore.app.overlay.opacity,
}));

onMounted(() => {
    socketStore.connect();
})
</script>

<template>
    <div id="app" class="overlay" :style="overlayStyle">
        <OverlayChatWidgetView v-if="chatWidget?.enabled" :widget="chatWidget" />
        <OverlayGuestsWidgetView v-if="guestsWidget?.enabled" :widget="guestsWidget" />
        <OverlayTickerWidgetView v-if="tickerWidget?.enabled" :widget="tickerWidget" />
        <OverlayGamepadsWidgetView v-if="gamepadsWidget?.enabled" :widget="gamepadsWidget" />
        <OverlayWebcamWidgetView v-if="webcamWidget?.enabled" :widget="webcamWidget" />
        <PhoenixAmigosPanelView />

        <div v-if="overlayStore.interactable" class="move-banner">
            MODO MOVER · arrastra los cuadros · Ctrl+Alt+M para guardar
        </div>

        <!-- Custom Widgets -->
        <template v-for="widget in overlayStore.customWidgets">
            <OverlayWidgetView v-if="widget.enabled" :widget="widget">
                <div v-html="widget.html"></div>
            </OverlayWidgetView>
        </template>
    </div>
</template>

<style scoped lang="scss">
.move-banner {
    position: fixed;
    top: 56px;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 14px;
    background: rgba(255, 174, 0, 0.92);
    color: #111;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: .04em;
    border-radius: 6px;
    z-index: 999;
    pointer-events: none;
}

.overlay {
    position: fixed;
    inset: 0;
    overflow: hidden;
}
</style>