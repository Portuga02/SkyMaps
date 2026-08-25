<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet-routing-machine';

const map = ref(null);
const routingControl = ref(null);
const routeInfo = ref(null);
const gpsReady = ref(false);
const gpsErro = ref(false);
let tileLayerClaro = null;
let tileLayerEscuro = null;
// Recife é usado como fallback caso o navegador negue ou não tenha GPS
const pontoFallback = [-8.0631, -34.8711];

// posicaoAtual não precisa ser reativo: só é lido dentro de handlers/closures
let posicaoAtual = [...pontoFallback];
let marcadorCarro = null;
let watchId = null;
let ultimaPosicaoRoteada = null;

const buscaTexto = ref('');
const resultadosBusca = ref([]);
const buscando = ref(false);
const buscaTentada = ref(false);
let debounceTimer = null;
let ignorarProximaBusca = false;

const headingGraus = ref(0);
const bussolaAtiva = ref(false);

const temaEscuro = ref(true);

function alternarTema() {
  temaEscuro.value = !temaEscuro.value;

  if (map.value && tileLayerClaro && tileLayerEscuro) {
    if (temaEscuro.value) {
      map.value.removeLayer(tileLayerClaro);
      tileLayerEscuro.addTo(map.value);
    } else {
      map.value.removeLayer(tileLayerEscuro);
      tileLayerClaro.addTo(map.value);
    }
  }

  try {
    localStorage.setItem('skymaps-tema', temaEscuro.value ? 'escuro' : 'claro');
  } catch (e) {
    // navegador pode bloquear localStorage (modo privado, etc.) — sem problema, só não persiste
  }
}

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
  ultimaPosicaoRoteada = null;
  routingControl.value.setWaypoints([L.latLng(posicaoAtual)]);
}

function iniciarGPS() {
  if (!navigator.geolocation) {
    gpsErro.value = true;
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      posicaoAtual = [pos.coords.latitude, pos.coords.longitude];
      gpsReady.value = true;
      gpsErro.value = false;

      if (marcadorCarro) {
        marcadorCarro.setLatLng(posicaoAtual);
      }

      if (!ultimaPosicaoRoteada) {
        // Primeira localização recebida: centraliza o mapa e move a origem da rota
        map.value.setView(posicaoAtual, 15);
        routingControl.value.setWaypoints([L.latLng(posicaoAtual)]);
        ultimaPosicaoRoteada = L.latLng(posicaoAtual);
      } else if (routeInfo.value) {
        // Já existe uma rota ativa: só recalcula se o carro andou o suficiente
        // (evita bater no limite de requisições do servidor de rotas a cada segundo)
        const distanciaMovida = L.latLng(posicaoAtual).distanceTo(ultimaPosicaoRoteada);
        if (distanciaMovida > 40) {
          const waypoints = routingControl.value.getWaypoints();
          const destino = waypoints[waypoints.length - 1];
          if (destino && destino.latLng) {
            routingControl.value.setWaypoints([L.latLng(posicaoAtual), destino.latLng]);
            ultimaPosicaoRoteada = L.latLng(posicaoAtual);
          }
        }
      }
    },
    () => {
      gpsErro.value = true;
      gpsReady.value = false;
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

async function buscarEndereco(texto) {
  if (texto.trim().length < 3) {
    resultadosBusca.value = [];
    buscaTentada.value = false;
    return;
  }
  buscando.value = true;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=0&q=${encodeURIComponent(texto)}`;
    const resp = await fetch(url);
    resultadosBusca.value = await resp.json();
  } catch (e) {
    resultadosBusca.value = [];
  } finally {
    buscando.value = false;
    buscaTentada.value = true;
  }
}

// Só dispara nova busca quando o texto muda por digitação do usuário.
// Quando a gente mesmo preenche o campo (ex: após escolher um resultado),
// marcamos ignorarProximaBusca para não reabrir a lista sozinha.
watch(buscaTexto, (novoTexto) => {
  if (ignorarProximaBusca) {
    ignorarProximaBusca = false;
    return;
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => buscarEndereco(novoTexto), 500);
});

function escolherResultado(resultado) {
  const destino = L.latLng(parseFloat(resultado.lat), parseFloat(resultado.lon));
  routingControl.value.setWaypoints([L.latLng(posicaoAtual), destino]);
  ultimaPosicaoRoteada = L.latLng(posicaoAtual);
  resultadosBusca.value = [];
  buscaTentada.value = false;
  ignorarProximaBusca = true;
  buscaTexto.value = resultado.display_name.split(',').slice(0, 2).join(',');
}

function limparBusca() {
  buscaTexto.value = '';
  resultadosBusca.value = [];
  buscaTentada.value = false;
}

function criarPinDestino() {
  return L.divIcon({
    className: 'skymaps-marker-wrapper',
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
    html: `
      <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"
        style="filter: drop-shadow(0 4px 8px rgba(255,79,163,0.55));">
        <path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 25 15 25s15-14 15-25C30 6.7 23.3 0 15 0z"
          fill="url(#skymapsPinGrad)" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" />
        <circle cx="15" cy="15" r="5.5" fill="#0a0e1f" />
        <defs>
          <linearGradient id="skymapsPinGrad" x1="0" y1="0" x2="30" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ff4fa3" />
            <stop offset="1" stop-color="#7c4dff" />
          </linearGradient>
        </defs>
      </svg>
    `
  });
}

function aoReceberOrientacao(evento) {
  // iOS expõe o heading verdadeiro direto; outros navegadores usam alpha (relativo)
  if (typeof evento.webkitCompassHeading === 'number') {
    headingGraus.value = evento.webkitCompassHeading;
  } else if (evento.alpha !== null) {
    headingGraus.value = 360 - evento.alpha;
  }
}

function ativarBussola() {
  const DeviceOrientationEventTyped = window.DeviceOrientationEvent;

  // iOS 13+ exige permissão explícita, só pode ser pedida a partir de um clique
  if (DeviceOrientationEventTyped && typeof DeviceOrientationEventTyped.requestPermission === 'function') {
    DeviceOrientationEventTyped.requestPermission()
      .then((resposta) => {
        if (resposta === 'granted') {
          window.addEventListener('deviceorientation', aoReceberOrientacao);
          bussolaAtiva.value = true;
        }
      })
      .catch(() => { });
  } else if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientationabsolute', aoReceberOrientacao, true);
    window.addEventListener('deviceorientation', aoReceberOrientacao, true);
    bussolaAtiva.value = true;
  }
}

function abrirMusica() {
  // Tenta abrir o app do Spotify (deep link); se não estiver instalado, cai pro player web
  const inicio = Date.now();
  window.location.href = 'spotify://';
  setTimeout(() => {
    if (Date.now() - inicio < 1500) {
      window.open('https://open.spotify.com', '_blank');
    }
  }, 800);
}

onMounted(() => {
  try {
    if (localStorage.getItem('skymaps-tema') === 'claro') {
      temaEscuro.value = false;
    }
  } catch (e) {
    // sem problema, só usa o padrão (escuro)
  }

  map.value = L.map('mapContainer', { zoomControl: false }).setView(pontoFallback, 14);

  const opcoesTile = {
    attribution: '© OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19
  };
  tileLayerClaro = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', opcoesTile);
  tileLayerEscuro = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    ...opcoesTile,
    className: 'skymaps-tile-escura'
  });
  (temaEscuro.value ? tileLayerEscuro : tileLayerClaro).addTo(map.value);


  // Aviso único no console se os tiles não carregarem (rede bloqueada, etc.)
  let avisoTileMostrado = false;
  const aoFalharTile = () => {
    if (!avisoTileMostrado) {
      avisoTileMostrado = true;
      console.warn('SkyMaps: falha ao carregar os tiles do mapa (verifique a conexão).');
    }
  };
  tileLayerClaro.on('tileerror', aoFalharTile);
  tileLayerEscuro.on('tileerror', aoFalharTile);

  routingControl.value = L.Routing.control({
    waypoints: [L.latLng(pontoFallback)],
    routeWhileDragging: false,
    language: 'pt-BR',

    show: true,
    showAlternatives: true,
    lineOptions: {
      styles: [
        { color: '#3b6bff', opacity: 0.25, weight: 14 },
        { color: '#0a0e1f', opacity: 0.9, weight: 8 },
        { color: '#7c8cff', opacity: 1, weight: 4, className: 'skymaps-route-anim' }
      ]
    },
    altLineOptions: {
      styles: [
        { color: '#05070f', opacity: 0.7, weight: 7 },
        { color: '#4b5480', opacity: 0.85, weight: 4 }
      ]
    },
    createMarker: function (i, waypoint) {
      // origem (i === 0) já tem o marcador do carro, não precisa de pino
      if (i === 0) return null;
      return L.marker(waypoint.latLng, { icon: criarPinDestino() }).bindPopup('Destino');
    }
  }).addTo(map.value);

  routingControl.value.on('routesfound', (e) => {
    const resumo = e.routes[0].summary;
    routeInfo.value = {
      distancia: formatDistancia(resumo.totalDistance),
      duracao: formatDuracao(resumo.totalTime),
      chegada: formatChegada(resumo.totalTime)
    };

    // Reenquadra o mapa pra origem + destino (o pino) sempre caberem na tela,
    // deixando espaço extra pra barra superior e pro card inferior não tampar nada
    map.value.fitBounds(L.latLngBounds(e.routes[0].coordinates), {
      paddingTopLeft: [40, 210],
      paddingBottomRight: [90, 140],
      maxZoom: 16
    });
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
  marcadorCarro = L.marker(pontoFallback, { icon: carroIcon }).addTo(map.value).bindPopup('Estou aqui!');

  map.value.on('click', function (e) {
    const destino = e.latlng;
    routingControl.value.setWaypoints([L.latLng(posicaoAtual), destino]);
    ultimaPosicaoRoteada = L.latLng(posicaoAtual);
    resultadosBusca.value = [];
  });

  iniciarGPS();
});

onBeforeUnmount(() => {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  clearTimeout(debounceTimer);
  window.removeEventListener('deviceorientation', aoReceberOrientacao);
  window.removeEventListener('deviceorientationabsolute', aoReceberOrientacao, true);
});
</script>

<template>
<div id="mapContainer" class="w-screen h-screen z-0"></div>

  <div class="fixed top-4 left-4 right-4 z-[1000] flex flex-col gap-3">
    <!-- Barra superior estilo Waze -->
    <div class="flex items-center justify-between gap-3 rounded-2xl border p-3.5 px-4 shadow-2xl backdrop-blur-xl"
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
          <p class="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
            style="color:#8891b8;">
            <span class="relative flex h-2 w-2">
              <span v-if="gpsReady" class="skymaps-pulse-dot absolute inline-flex h-full w-full rounded-full"
                style="background:#3b6bff;"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full"
                :style="{ background: gpsErro ? '#ff4fa3' : (gpsReady ? '#3b6bff' : '#8891b8') }"></span>
            </span>
            {{ gpsErro ? 'Sem sinal — usando Recife' : (gpsReady ? 'GPS conectado' : 'Buscando sinal…') }}
          </p>
        </div>
      </div>
      <span class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
        style="background: rgba(255,79,163,0.16); color:#ff4fa3;">
        Beta
      </span>
    </div>

    <!-- Busca de endereço -->
    <div class="relative">
      <div class="flex items-center gap-2 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-xl"
        style="background: rgba(19,26,51,0.85); border-color:#232c4d;">
        <span style="color:#8891b8;">🔍</span>
        <input v-model="buscaTexto" type="text" placeholder="Para onde vamos?"
          class="flex-1 bg-transparent text-sm font-medium outline-none" style="color:#f3f5ff;" />
        <button v-if="buscaTexto" @click="limparBusca" class="text-sm" style="color:#8891b8;">✕</button>
      </div>

      <div v-if="buscando || resultadosBusca.length || (buscaTentada && buscaTexto.length >= 3)"
        class="absolute left-0 right-0 mt-2 max-h-72 overflow-y-auto rounded-2xl border shadow-2xl backdrop-blur-xl"
        style="background: rgba(19,26,51,0.95); border-color:#232c4d;">
        <div v-if="buscando" class="p-4 text-center text-xs font-semibold" style="color:#8891b8;">Buscando…</div>
        <div v-else-if="resultadosBusca.length === 0" class="p-4 text-center text-xs font-semibold"
          style="color:#8891b8;">
          Nenhum endereço encontrado
        </div>
        <button v-for="(resultado, i) in resultadosBusca" :key="i" @click="escolherResultado(resultado)"
          class="flex w-full items-start gap-2 border-b px-4 py-3 text-left text-xs transition hover:bg-white/5"
          style="border-color:#232c4d; color:#d9daea;">
          <span style="color:#7c8cff;">📍</span>
          <span>{{ resultado.display_name }}</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Botões flutuantes -->
  <div class="fixed bottom-6 right-4 z-[1000] flex flex-col gap-3">
    <button @click="alternarTema"
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg shadow-xl backdrop-blur-xl transition hover:scale-105 active:scale-95"
      style="background: rgba(19,26,51,0.9); border-color:#232c4d;"
      :title="temaEscuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'">
      {{ temaEscuro ? '☀️' : '🌙' }}
    </button>
    <button @click="abrirMusica"
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg shadow-xl backdrop-blur-xl transition hover:scale-105 active:scale-95"
      style="background: rgba(19,26,51,0.9); border-color:#232c4d; color:#f3f5ff;"
      title="Abrir player de música">🎵</button>
    <button @click="ativarBussola"
      class="relative flex h-11 w-11 items-center justify-center rounded-full border shadow-xl backdrop-blur-xl transition hover:scale-105 active:scale-95"
      style="background: rgba(19,26,51,0.9); border-color:#232c4d;" title="Ativar bússola">
      <span class="text-[10px] font-bold" style="color: #ff4fa3; position:absolute; top:4px;">N</span>
      <span class="inline-block text-lg transition-transform duration-200"
        :style="{ transform: `rotate(${-headingGraus}deg)`, color: bussolaAtiva ? '#3b6bff' : '#8891b8' }">🧭</span>
    </button>
    <button @click="map.zoomIn()"
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold shadow-xl backdrop-blur-xl transition hover:scale-105 active:scale-95"
      style="background: rgba(19,26,51,0.9); border-color:#232c4d; color:#f3f5ff;">+</button>
    <button @click="map.zoomOut()"
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg font-bold shadow-xl backdrop-blur-xl transition hover:scale-105 active:scale-95"
      style="background: rgba(19,26,51,0.9); border-color:#232c4d; color:#f3f5ff;">−</button>
    <button @click="map.setView(posicaoAtual, 15, { animate: true })"
      class="flex h-11 w-11 items-center justify-center rounded-full border text-lg shadow-xl backdrop-blur-xl transition hover:scale-105 active:scale-95"
      style="background: linear-gradient(135deg,#3b6bff,#7c8cff); border-color:#232c4d; color:#f3f5ff;">📍</button>
  </div>

  <!-- Card inferior de rota, estilo Waze -->
  <transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 translate-y-6"
    enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-6">
    <div v-if="routeInfo"
      class="fixed bottom-6 left-4 right-20 z-[1000] rounded-2xl border p-4 shadow-2xl backdrop-blur-xl"
      style="background: rgba(19,26,51,0.9); border-color:#232c4d;">
      <div class="flex items-center justify-between">
        <div class="flex gap-5">
          <div>
            <p class="font-display text-2xl font-extrabold leading-none" style="color:#f3f5ff;">{{ routeInfo.duracao }}
            </p>
            <p class="mt-1 text-[10px] font-semibold uppercase tracking-wide" style="color:#8891b8;">tempo estimado</p>
          </div>
          <div class="w-px" style="background:#232c4d;"></div>
          <div>
            <p class="font-display text-2xl font-extrabold leading-none" style="color:#7c8cff;">{{ routeInfo.distancia
            }}</p>
            <p class="mt-1 text-[10px] font-semibold uppercase tracking-wide" style="color:#8891b8;">distância</p>
          </div>
          <div class="w-px" style="background:#232c4d;"></div>
          <div>
            <p class="font-display text-2xl font-extrabold leading-none" style="color:#ff4fa3;">{{ routeInfo.chegada }}
            </p>
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
    Toque no mapa ou busque um endereço acima para traçar a rota
  </div>
</template>

<style>
.skymaps-marker-wrapper {
  background: transparent !important;
  border: none !important;
}
</style>