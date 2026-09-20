/**
 * service-worker.js
 * Cache-Strategie:
 *   - HTML        → network-first (Updates kommen sofort an)
 *   - statische Assets → cache-first (Offline-Fähigkeit)
 *
 * Precache:
 *   ESSENTIAL_FILES und OPTIONAL_FILES werden beide einzeln geladen
 *   (cache.add pro Datei). Ein fehlendes Asset führt zu einer Warnung,
 *   bricht aber den Install NICHT ab. Dadurch bleibt der Service Worker
 *   auch dann aktiv, wenn ein einzelnes Bild oder ein Sound fehlt.
 *
 * CACHE_VERSION:
 *   Bei Änderungen an Dateinamen oder Entfernen von Dateien erhöhen.
 *   Bei rein inhaltlichen Änderungen ist kein Bump nötig, weil HTML
 *   network-first ist.
 */

const CACHE_VERSION = 'v8';
const CACHE_NAME = `offiziersschafkopf-${CACHE_VERSION}`;

/**
 * Essenzielle Dateien. Werden bevorzugt geladen, aber nicht atomar –
 * ein fehlender Eintrag bricht den Install nicht ab.
 */
const ESSENTIAL_FILES = [
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
  './js/ui/sounds.js',
  './js/ui/components/CardView.js',
  './js/ui/components/StackView.js',
  './js/ui/components/Dialog.js',

  // JS – Utils
  './js/utils/shuffle.js',
  './js/utils/storage.js',

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

/**
 * Optionale Dateien. Werden ebenfalls einzeln geladen; ein Fehlen
 * erzeugt nur eine Warnung.
 */
const OPTIONAL_FILES = [
  // Sounds
  './assets/sounds/card-play.mp3',
  './assets/sounds/card-flip.mp3',
  './assets/sounds/trick-win.mp3',
  './assets/sounds/game-win.mp3',
  './assets/sounds/game-lose.mp3',
];

// ---------------------------------------------------------------------------
// Install: alle Dateien einzeln cachen
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Alles einzeln laden. Fehler werden geloggt, aber nicht propagiert.
      const all = [...ESSENTIAL_FILES, ...OPTIONAL_FILES];
      const results = await Promise.allSettled(
        all.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('Precache skip:', url, err?.message ?? err);
          }),
        ),
      );

      // Diagnose in der Konsole: wie viele Dateien wurden gecacht?
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.warn(`Precache: ${failed} Datei(en) konnten nicht geladen werden.`);
      } else {
        console.log(`Precache: ${all.length} Dateien gecacht.`);
      }
    }),
  );
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
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch: HTML network-first, Assets cache-first
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match('./index.html')),
        ),
    );
    return;
  }

  // Statische Assets: cache-first.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
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