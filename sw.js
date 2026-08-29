// Service worker do "Rota Acessível — Paulista"
// Estratégia: cache do "app shell" (HTML/CSS/JS/ícones/Leaflet) para abrir
// rápido e funcionar offline; buscas de lugares (Nominatim/Overpass) e
// tiles do mapa sempre vão para a rede, pois dependem de dados atuais.

var CACHE_NAME = 'rota-acessivel-paulista-v4';

var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics-compat.js'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL).catch(function(){
        // Se algum recurso externo falhar (ex: sem internet na instalação),
        // não impede o service worker de ser instalado.
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_NAME; })
            .map(function(key){ return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Hosts que devem sempre ir para a rede (dados dinâmicos, não fazem sentido em cache).
var NETWORK_ONLY_HOSTS = [
  'nominatim.openstreetmap.org',
  'overpass-api.de',
  'tile.openstreetmap.org',
  'router.project-osrm.org',
  'googleapis.com',
  'firebaseapp.com',
  'google-analytics.com',
  'googletagmanager.com',
  'analytics.google.com'
];

function isNetworkOnly(url){
  return NETWORK_ONLY_HOSTS.some(function(host){ return url.indexOf(host) !== -1; });
}

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;

  if(isNetworkOnly(req.url)){
    // Rede primeiro, sem cair para cache (dados de busca/tiles precisam ser atuais).
    event.respondWith(fetch(req).catch(function(){
      return new Response('', { status: 503, statusText: 'Sem conexão' });
    }));
    return;
  }

  // App shell: cache primeiro, com atualização em segundo plano.
  event.respondWith(
    caches.match(req).then(function(cached){
      var networkFetch = fetch(req).then(function(res){
        if(res && res.status === 200){
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, resClone); });
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || networkFetch;
    })
  );
});
