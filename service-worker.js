/**
 * service-worker.js
 * Cache-Strategie: cache-first für alle App-Ressourcen.
 *
 * Bei INSTALL werden alle Dateien einmalig in den Cache geholt.
 * Bei ACTIVATE werden alte Caches gelöscht.
 * Bei FETCH wird zuerst der Cache bedient, dann das Netz.
 *
 * CACHE_VERSION bei jedem Deployment erhöhen, damit Clients die
 * neuen Dateien bekommen.
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `offiziersschafkopf-${CACHE_VERSION}`;

/**
 * Vollständige Liste aller App-Ressourcen. Wenn du eine Datei
 * hinzufügst, trag sie hier ein – sonst ist sie offline nicht
 * verfügbar.
 */
const PRECACHE_FILES = [
  // Shell
  './',
  './index.html',
  './manifest.json',

  // Stylesheets
  './css/main.css',
  './css/cards.css',
  './css/screens.css',

  // JS – Konfiguration
  './js/config/constants.js',

  // JS – Modelle
  './js/model/Card.js',
  './js/model/Deck.js',
  './js/model/Position.js',
  './js/model/Player.js',
  './js/model/GameState.js',

  // JS – Regeln
  './js/rules/trumpf.js',
  './js/rules/moves.js',
  './js/rules/stich.js',
  './js/rules/scoring.js',
  './js/rules/ansagen.js',

  // JS – Spielsteuerung
  './js/game/phases.js',
  './js/game/EventBus.js',
  './js/game/GameController.js',

  // JS – KI
  './js/ai/AIView.js',
  './js/ai/strategies.js',
  './js/ai/HeuristicAI.js',

  // JS – UI
  './js/ui/render.js',
  './js/ui/animations.js',
  './js/ui/components/CardView.js',
  './js/ui/components/StackView.js',
  './js/ui/components/Dialog.js',

  // JS – Utils
  './js/utils/shuffle.js',

  // JS – Einstieg
  './js/main.js',

  // Icons
  './icons/icon-192.png',
  './icons/icon-512.png',

  // Karten-Assets
  './assets/cards/kartenruecken.png',
  './assets/cards/leeres-feld.png',

  './assets/cards/eichel-ass.png',
  './assets/cards/eichel-10.png',
  './assets/cards/eichel-koenig.png',
  './assets/cards/eichel-ober.png',
  './assets/cards/eichel-unter.png',
  './assets/cards/eichel-9.png',
  './assets/cards/eichel-8.png',
  './assets/cards/eichel-7.png',

  './assets/cards/laub-ass.png',
  './assets/cards/laub-10.png',
  './assets/cards/laub-koenig.png',
  './assets/cards/laub-ober.png',
  './assets/cards/laub-unter.png',
  './assets/cards/laub-9.png',
  './assets/cards/laub-8.png',
  './assets/cards/laub-7.png',

  './assets/cards/herz-ass.png',
  './assets/cards/herz-10.png',
  './assets/cards/herz-koenig.png',
  './assets/cards/herz-ober.png',
  './assets/cards/herz-unter.png',
  './assets/cards/herz-9.png',
  './assets/cards/herz-8.png',
  './assets/cards/herz-7.png',

  './assets/cards/schellen-ass.png',
  './assets/cards/schellen-10.png',
  './assets/cards/schellen-koenig.png',
  './assets/cards/schellen-ober.png',
  './assets/cards/schellen-unter.png',
  './assets/cards/schellen-9.png',
  './assets/cards/schellen-8.png',
  './assets/cards/schellen-7.png',
];

// ---------------------------------------------------------------------------
// Install: Dateien in den Cache laden
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_FILES)),
  );
  // Neue SW übernimmt sofort, ohne auf Tab-Schließen zu warten.
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate: alte Caches löschen
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  // SW übernimmt sofort die Kontrolle über bereits geöffnete Tabs.
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch: cache-first
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  // Nur GET-Anfragen behandeln.
  if (event.request.method !== 'GET') return;

  // Nur Anfragen auf den eigenen Origin bedienen.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // Nicht im Cache: aus dem Netz holen und nachcachen.
      return fetch(event.request).then((response) => {
        // Nur erfolgreiche, grundlegende Antworten cachen.
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});