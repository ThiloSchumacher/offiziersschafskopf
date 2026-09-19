/**
 * sounds.js
 * Sound-Wiedergabe für das Spiel.
 *
 * Aufgaben:
 *   - Sounds vorladen (beim ersten Modul-Import)
 *   - Auf Wunsch abspielen, optional mit Verzögerung
 *   - Mute-Zustand aus localStorage lesen und persistieren
 *   - Mobile-Unlock: Browser erlauben Audio erst nach einer Nutzer-
 *     Interaktion. `unlockAudio()` spielt alle Sounds einmal stumm ab
 *     und gibt sie damit für spätere echte Wiedergabe frei.
 *
 * Alle Zugriffe sind fehlertolerant: wenn Audio nicht verfügbar ist
 * (z. B. in sehr alten Browsern), schluckt das Modul Fehler still.
 */

const SOUND_FILES = Object.freeze({
  'card-play':  'assets/sounds/card-play.mp3',
  'card-flip':  'assets/sounds/card-flip.mp3',
  'trick-win':  'assets/sounds/trick-win.mp3',
  'game-win':   'assets/sounds/game-win.mp3',
  'game-lose':  'assets/sounds/game-lose.mp3',
});

// Lautstärke pro Sound. Karten sind dezenter als Spielende-Sounds.
const SOUND_VOLUME = Object.freeze({
  'card-play':  0.5,
  'card-flip':  0.45,
  'trick-win':  0.6,
  'game-win':   0.75,
  'game-lose':  0.7,
});

const STORAGE_KEY = 'offiziersschafkopf.muted';

// ---------------------------------------------------------------------------
// Modul-Zustand
// ---------------------------------------------------------------------------

/** @type {Map<string, HTMLAudioElement>} */
const audioCache = new Map();

let muted = false;
let audioAvailable = true;

/**
 * „Versuch-zum-Unlock"-Flag. Wird beim ersten Aufruf von unlockAudio()
 * sofort gesetzt, damit weitere Aufrufe billige No-Ops sind. Die
 * play()-Promises des ersten Aufrufs laufen asynchron weiter – das ist
 * ok, weil sie nur die Freigabe für spätere echte Sounds bewirken.
 */
let unlocked = false;

// ---------------------------------------------------------------------------
// Initialisierung
// ---------------------------------------------------------------------------

function initSounds() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    muted = stored === 'true';
  } catch {
    // localStorage nicht verfügbar – Standard: nicht stumm.
  }

  if (typeof Audio === 'undefined') {
    audioAvailable = false;
    return;
  }

  for (const [name, path] of Object.entries(SOUND_FILES)) {
    try {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = SOUND_VOLUME[name] ?? 0.6;
      audioCache.set(name, audio);
    } catch {
      // Ein einzelner Fehler deaktiviert nicht das ganze Modul.
    }
  }
}

// ---------------------------------------------------------------------------
// Unlock für Mobile
// ---------------------------------------------------------------------------

/**
 * Muss bei der ersten Nutzer-Interaktion aufgerufen werden (z. B. Klick
 * auf einen Menü-Button). Spielt alle Sounds einmal stumm ab, damit
 * iOS und Android sie später ohne weitere Interaktion freigeben.
 *
 * Mehrfache Aufrufe sind unschädlich – das unlocked-Flag wird sofort
 * gesetzt, weitere Aufrufe sind No-Ops.
 */
export function unlockAudio() {
  if (unlocked || !audioAvailable) return;
  unlocked = true;

  for (const audio of audioCache.values()) {
    const originalVolume = audio.volume;
    audio.volume = 0;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = originalVolume;
      }).catch(() => {
        audio.volume = originalVolume;
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = originalVolume;
    }
  }
}

// ---------------------------------------------------------------------------
// Wiedergabe
// ---------------------------------------------------------------------------

/**
 * Spielt einen Sound. Tut nichts, wenn stumm oder wenn der Sound nicht
 * geladen werden konnte.
 *
 * @param {keyof SOUND_FILES} name
 * @param {object} [options]
 * @param {number} [options.delayMs]  Verzögerung vor der Wiedergabe.
 *   Nützlich, wenn zwei Sounds sonst gleichzeitig starten würden und
 *   sich akustisch überlagern.
 */
export function playSound(name, options = {}) {
  if (muted || !audioAvailable) return;

  const delayMs = options.delayMs ?? 0;

  const trigger = () => {
    const audio = audioCache.get(name);
    if (!audio) return;
    try {
      // Wenn der Sound noch läuft, auf Anfang zurücksetzen – sonst
      // blockiert ein zweiter schneller Play-Aufruf.
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay-Block oder fehlende Datei – ignorieren.
        });
      }
    } catch {
      // ignorieren
    }
  };

  if (delayMs > 0) {
    setTimeout(trigger, delayMs);
  } else {
    trigger();
  }
}

// ---------------------------------------------------------------------------
// Mute-Zustand
// ---------------------------------------------------------------------------

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // ignoriert – Mute funktioniert dann nur für die aktuelle Sitzung.
  }
  return muted;
}

// ---------------------------------------------------------------------------
// Selbst-Initialisierung beim Import
// ---------------------------------------------------------------------------

initSounds();