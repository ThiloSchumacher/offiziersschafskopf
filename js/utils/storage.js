/**
 * storage.js
 * Kapselt localStorage-Zugriff für persistente Daten.
 *
 * Aktuell nur die Spielstatistik. Struktur:
 *
 *   {
 *     version: 1,
 *     hotseat: { games, winsDeclarer, winsDefender, schneider, schwarz, bestMultiplier },
 *     ai:      { games, winsDeclarer, winsDefender, schneider, schwarz, bestMultiplier },
 *   }
 *
 * Alle Zugriffe sind fehlertolerant:
 *   - localStorage nicht verfügbar (Privacy-Modus, SSR) → In-Memory-Fallback
 *   - defekte JSON-Daten → Defaults
 *   - falsche Version → Defaults
 *
 * Es gibt keine Migration zwischen Versionen. Bei Schema-Änderungen wird
 * die Version erhöht; alte Daten werden verworfen.
 */

const STORAGE_KEY = 'offiziersschafkopf.stats';
const CURRENT_VERSION = 1;

// ---------------------------------------------------------------------------
// In-Memory-Fallback (wenn localStorage nicht verfügbar ist)
// ---------------------------------------------------------------------------

let memoryFallback = null;

function getStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Testweise schreiben, um Privacy-Modi zu erkennen.
    const probe = '__probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function emptyModeStats() {
  return {
    games: 0,
    winsDeclarer: 0,
    winsDefender: 0,
    schneider: 0,
    schwarz: 0,
    bestMultiplier: 0,
  };
}

export function defaultStats() {
  return {
    version: CURRENT_VERSION,
    hotseat: emptyModeStats(),
    ai: emptyModeStats(),
  };
}

// ---------------------------------------------------------------------------
// Interne Prüfungen
// ---------------------------------------------------------------------------

function isValidModeStats(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const numeric = [
    'games', 'winsDeclarer', 'winsDefender',
    'schneider', 'schwarz', 'bestMultiplier',
  ];
  return numeric.every((k) => typeof obj[k] === 'number' && obj[k] >= 0);
}

function isValidStats(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.version !== CURRENT_VERSION) return false;
  return isValidModeStats(obj.hotseat) && isValidModeStats(obj.ai);
}

// ---------------------------------------------------------------------------
// Lesen / Schreiben
// ---------------------------------------------------------------------------

export function loadStats() {
  const storage = getStorage();
  if (!storage) return memoryFallback ?? defaultStats();

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw);
    if (!isValidStats(parsed)) return defaultStats();
    return parsed;
  } catch {
    return defaultStats();
  }
}

export function saveStats(stats) {
  if (!isValidStats(stats)) {
    throw new Error('storage: ungültige Stats-Struktur');
  }

  const storage = getStorage();
  if (!storage) {
    memoryFallback = stats;
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Quota überschritten oder ähnlich – dann nur In-Memory.
    memoryFallback = stats;
  }
}

// ---------------------------------------------------------------------------
// Aufzeichnung und Reset
// ---------------------------------------------------------------------------

/**
 * Trägt ein beendetes Spiel in die Statistik ein und speichert.
 *
 * @param {'hotseat'|'ai'} mode
 * @param {object} result  Rückgabe von scoring.resultFor()
 * @returns {object}  aktualisierte Stats
 */
export function recordGame(mode, result) {
  if (mode !== 'hotseat' && mode !== 'ai') {
    throw new Error(`storage: unbekannter Modus "${mode}"`);
  }

  const stats = loadStats();
  const m = stats[mode];

  m.games += 1;

  if (result.declarerWon) m.winsDeclarer += 1;
  else m.winsDefender += 1;

  if (result.result === 'schneider') m.schneider += 1;
  if (result.result === 'schwarz') m.schwarz += 1;

  if (result.totalMultiplier > m.bestMultiplier) {
    m.bestMultiplier = result.totalMultiplier;
  }

  saveStats(stats);
  return stats;
}

export function resetStats() {
  const stats = defaultStats();
  saveStats(stats);
  return stats;
}