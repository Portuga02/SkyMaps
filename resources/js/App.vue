<script setup>
import { onMounted, ref } from 'vue';
import L from 'leaflet';
import 'leaflet-routing-machine';

const map = ref(null);
const routingControl = ref(null);

// Ponto Inicial (Marco Zero)
const pontoInicial = [-8.0631, -34.8711];

onMounted(() => {
  // 1. Inicia o Mapa
  map.value = L.map('mapContainer', { zoomControl: false }).setView(pontoInicial, 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map.value);

  // 2. Cria o Controlador de Rotas (VAZIO POR ENQUANTO)
  // Deixamos ele pronto, mas escondido, esperando ordens.
  routingControl.value = L.Routing.control({
    waypoints: [
      L.latLng(pontoInicial), // Começa aqui
      // Sem destino ainda
    ],
    routeWhileDragging: false, // Desliguei para economizar requisições e evitar travar
    language: 'en',
    show: true, 
    lineOptions: {
      styles: [{ color: '#3b82f6', opacity: 0.8, weight: 6 }]
    },
    // Tratamento de Erro (Para não quebrar se clicar na água)
    createMarker: function() { return null; } // Remove os marcadores extras feios padrão
  }).addTo(map.value);

  // 3. Adiciona o Carrinho no Início
  const carroIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
  L.marker(pontoInicial, { icon: carroIcon }).addTo(map.value).bindPopup("Estou aqui!");

  // 4. Evento de Clique Inteligente
  map.value.on('click', function(e) {
    const destino = e.latlng;
    
    // Em vez de destruir tudo, só atualizamos os pontos!
    // Isso evita o erro "TypeError: null"
    routingControl.value.setWaypoints([
      L.latLng(pontoInicial),
      destino
    ]);
  });
});
</script>

<template>
  <div id="mapContainer" class="w-screen h-screen z-0"></div>

  <div class="fixed top-4 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl z-[1000] flex justify-between items-center border border-slate-200">
    <div>
        <h1 class="font-black text-blue-600 text-xl tracking-tighter">SKY<span class="text-slate-800">MAPS</span></h1>
        <p class="text-[10px] text-slate-500 font-bold uppercase">Navegação Beta</p>
    </div>
    <div class="bg-blue-100 p-2 rounded-full">
        🚗
    </div>
  </div>
</template>

<style>
/* Corrige ícones do Leaflet que somem no build (bug comum) */
.leaflet-default-icon-path {
    background-image: url(https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png);
}
</style>