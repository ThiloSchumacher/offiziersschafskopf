/**
 * shuffle.js
 * Fisher-Yates-Shuffle mit injizierbarem Zufallsgenerator.
 *
 * `rng` ist eine Funktion ohne Argumente, die eine Zahl in [0, 1) liefert.
 * Default ist Math.random – in Tests wird ein deterministischer RNG
 * übergeben, damit Ergebnisse reproduzierbar sind.
 */

/**
 * @param {Array} array  Ausgangsarray (wird nicht verändert)
 * @param {() => number} [rng]  Zufallsgenerator, liefert Werte in [0, 1)
 * @returns {Array} neue, gemischte Kopie
 */
export function shuffle(array, rng = Math.random) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Deterministischer Pseudozufallsgenerator (mulberry32).
 * Reicht für Spiele vollkommen aus – kein Anspruch auf Krypto-Qualität.
 * Gleicher Seed → gleiche Sequenz.
 *
 * @param {number} seed  32-Bit-Integer
 * @returns {() => number}  RNG-Funktion
 */
export function createSeededRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}