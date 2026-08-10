<script setup>
import { onMounted, ref } from 'vue';
import L from 'leaflet';
import 'leaflet-routing-machine';

const map = ref(null);
const routingControl = ref(null);
const routeInfo = ref(null);
const gpsReady = ref(false);

const pontoInicial = [-8.0631, -34.8711];

function formatDistancia(metros) {
  const km = metros / 1000;
  return km < 1 ? `${Math.round(metros)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

function formatDuracao(segundos) {
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}min`;
}

function formatChegada(segundos) {
  const chegada = new Date(Date.now() + segundos * 1000);
  return chegada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function limparRota() {
  routeInfo.value = null;
  routingControl.value.setWaypoints([L.latLng(pontoInicial)]);
}

onMounted(() => {
  map.value = L.map('mapContainer', { zoomControl: false }).setView(pontoInicial, 14);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map.value);

  routingControl.value = L.Routing.control({
    waypoints: [L.latLng(pontoInicial)],
    routeWhileDragging: false,
    language: 'en',
    show: true,
    lineOptions: {
      styles: [
        { color: '#3b6bff', opacity: 0.25, weight: 14 },
        { color: '#0a0e1f', opacity: 0.9, weight: 8 },
        { color: '#7c8cff', opacity: 1, weight: 4, className: 'skymaps-route-anim' }
      ]
    },
    createMarker: function () { return null; }
  }).addTo(map.value);

  routingControl.value.on('routesfound', (e) => {
    const resumo = e.routes[0].summary;
    routeInfo.value = {
      distancia: formatDistancia(resumo.totalDistance),
      duracao: formatDuracao(resumo.totalTime),
      chegada: formatChegada(resumo.totalTime)
    };
  });

  const carroIcon = L.divIcon({
    className: 'skymaps-marker-wrapper',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `
      <div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;width:38px;height:38px;border-radius:9999px;background:#3b6bff;opacity:0.35;" class="skymaps-beacon-pulse"></span>
        <span style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:linear-gradient(135deg,#3b6bff,#7c8cff);border:2px solid rgba(255,255,255,0.85);font-size:16px;" class="skymaps-beacon">🚗</span>
      </div>
    `
  });
  L.marker(pontoInicial, { icon: carroIcon }).addTo(map.value).bindPopup('Estou aqui!');

  setTimeout(() => { gpsReady.value = true; }, 600);

  map.value.on('click', function (e) {
    const destino = e.latlng;
    routingControl.value.setWaypoints([L.latLng(pontoInicial), destino]);
  });
});
</script>

<template>
  <div id="mapContainer" class="w-screen h-screen z-0"></div>

  <!-- Barra superior estilo Waze -->
  <div
    class="fixed top-4 left-4 right-4 z-[1000] flex items-center justify-between gap-3 rounded-2xl border p-3.5 px-4 shadow-2xl backdrop-blur-xl"
    style="background: rgba(19,26,51,0.82); border-color: #232c4d;">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
        style="background: linear-gradient(135deg,#3b6bff,#ff4fa3);">
        🛰️
      </div>
      <div>
        <h1 class="font-display text-lg font-extrabold leading-none tracking-tight" style="color:#f3f5ff;">
          SKY<span style="color:#7c8cff;">MAPS</span>
        </h1>
        <p class="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style="color:#8891b8;">
          <span class="relative flex h-2 w-2">
            <span v-if="gpsReady" class="skymaps-pulse-dot absolute inline-flex h-full w-full rounded-full" style="background:#3b6bff;"></span>
            <span class="relative inline-flex h-2 w-2 rounded-full" :style="{ background: gpsReady ? '#3b6bff' : '#8891b8' }"></span>
          </span>
          {{ gpsReady ? 'GPS conectado' : 'Buscando sinal…' }}
        </p>
      </div>
    </div>
    <span class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
      style="background: rgba(255,79,163,0.16); color:#ff4fa3;">
      Beta
    </span>
  </div>

  <!-- Botões flutuantes -->
  <div class="fixed bottom-6 right-4 z-[1000] flex flex-col gap-3">
    <button @click="map.zoomIn()"
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold shadow-xl backdrop-blur-xl transition hover:scale-105 active:scale-95"
      style="background: rgba(19,26,51,0.9); border-color:#232c4d; color:#f3f5ff;">+</button>
    <button @click="map.zoomOut()"
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold shadow-xl backdrop-blur-xl transition hover:scale-105 active:scale-95"
      style="background: rgba(19,26,51,0.9); border-color:#232c4d; color:#f3f5ff;">−</button>
    <button @click="map.setView(pontoInicial, 15, { animate: true })"
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg shadow-xl backdrop-blur-xl transition hover:scale-105 active:scale-95"
      style="background: linear-gradient(135deg,#3b6bff,#7c8cff); border-color:#232c4d; color:#f3f5ff;">📍</button>
  </div>

  <!-- Card inferior de rota, estilo Waze -->
  <transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-6"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-6">
    <div v-if="routeInfo"
      class="fixed bottom-6 left-4 right-20 z-[1000] rounded-2xl border p-4 shadow-2xl backdrop-blur-xl"
      style="background: rgba(19,26,51,0.9); border-color:#232c4d;">
      <div class="flex items-center justify-between">
        <div class="flex gap-5">
          <div>
            <p class="font-display text-2xl font-extrabold leading-none" style="color:#f3f5ff;">{{ routeInfo.duracao }}</p>
            <p class="mt-1 text-[10px] font-semibold uppercase tracking-wide" style="color:#8891b8;">tempo estimado</p>
          </div>
          <div class="w-px" style="background:#232c4d;"></div>
          <div>
            <p class="font-display text-2xl font-extrabold leading-none" style="color:#7c8cff;">{{ routeInfo.distancia }}</p>
            <p class="mt-1 text-[10px] font-semibold uppercase tracking-wide" style="color:#8891b8;">distância</p>
          </div>
          <div class="w-px" style="background:#232c4d;"></div>
          <div>
            <p class="font-display text-2xl font-extrabold leading-none" style="color:#ff4fa3;">{{ routeInfo.chegada }}</p>
            <p class="mt-1 text-[10px] font-semibold uppercase tracking-wide" style="color:#8891b8;">chegada</p>
          </div>
        </div>
        <button @click="limparRota"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm transition hover:scale-105 active:scale-95"
          style="background: rgba(255,79,163,0.1); border-color:#232c4d; color:#ff4fa3;">✕</button>
      </div>
    </div>
  </transition>

  <div v-if="!routeInfo"
    class="fixed bottom-6 left-4 right-20 z-[999] rounded-2xl border p-3 text-center text-xs font-semibold shadow-xl backdrop-blur-xl"
    style="background: rgba(19,26,51,0.7); border-color:#232c4d; color:#8891b8;">
    Toque em qualquer ponto do mapa para traçar a rota
  </div>
</template>

<style>
.skymaps-marker-wrapper {
  background: transparent !important;
  border: none !important;
}
</style>
