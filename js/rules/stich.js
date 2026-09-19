/**
 * stich.js
 * Stichauswertung.
 *
 * Drei Aufgaben:
 *   1. determineWinner(trick, ...)  → welcher Spieler hat den Stich gewonnen?
 *   2. trickPoints(trick)           → wie viele Punkte liegen im Stich?
 *   3. applyTrickResult(state)      → Stich abschließen.
 *
 * Mutationen laufen ausschließlich über GameState-Primitive
 * (addPoints, addTrick, recordCompletedTrick). Keine direkten
 * Feldzugriffe.
 *
 * Vorbedingungen (werfen):
 *   - applyTrickResult: state.hasGameType() muss true sein.
 *   - applyTrickResult: der aktuelle Stich muss vollständig sein.
 *   - determineWinner: der Stich muss mindestens einen Play enthalten.
 */

import { beats } from './trumpf.js';

/**
 * Ermittelt den Gewinner eines Stichs.
 *
 * Nutzt trumpf.beats() für den Vergleich. Der erste Play ist der Lead;
 * jeder weitere Play muss den aktuellen Gewinner schlagen, um ihn
 * abzulösen.
 *
 * @param {{plays: {playerIndex:number, card:Card}[]}} trick
 * @param {string} gameType
 * @param {string|null} soloSuit
 * @returns {number}  playerIndex des Gewinners
 */
export function determineWinner(trick, gameType, soloSuit) {
  if (!trick || !Array.isArray(trick.plays) || trick.plays.length === 0) {
    throw new Error('stich: leerer Stich kann keinen Gewinner haben');
  }

  let winnerPlay = trick.plays[0];
  for (let i = 1; i < trick.plays.length; i++) {
    const challenger = trick.plays[i];
    if (beats(challenger.card, winnerPlay.card, gameType, soloSuit)) {
      winnerPlay = challenger;
    }
  }
  return winnerPlay.playerIndex;
}

/**
 * Summe der Kartenpunkte im Stich.
 *
 * @param {{plays: {card:Card}[]}} trick
 * @returns {number}
 */
export function trickPoints(trick) {
  if (!trick || !Array.isArray(trick.plays)) {
    throw new Error('stich: ungültiger Stich');
  }
  return trick.plays.reduce((sum, p) => sum + p.card.points, 0);
}

/**
 * Schließt den aktuellen Stich ab.
 *
 * Schritte:
 *   1. Gewinner und Punkte ermitteln.
 *   2. Punkte und Tricks dem Gewinner gutschreiben.
 *   3. Stich in die Historie verschieben, neuen currentTrick anlegen,
 *      aktiven Spieler auf den Gewinner setzen (recordCompletedTrick).
 *   4. Alle gespielten Positionen beider Spieler aufdecken.
 *
 * @param {GameState} state
 * @returns {number}  playerIndex des Gewinners
 */
export function applyTrickResult(state) {
  if (!state.hasGameType()) {
    throw new Error('stich: Spielart noch nicht gewählt');
  }
  if (!state.isCurrentTrickComplete()) {
    throw new Error('stich: aktueller Stich ist nicht vollständig');
  }

  const winner = determineWinner(state.currentTrick, state.gameType, state.soloSuit);
  const points = trickPoints(state.currentTrick);

  state.addPoints(winner, points);
  state.addTrick(winner);
  state.recordCompletedTrick(winner);

  // Gespielte Positionen aufdecken – ab jetzt steht die verdeckte Karte
  // zur Wahl. revealAll überspringt alle Positionen, auf denen noch
  // eine offene Karte liegt.
  for (const player of state.players) {
    player.revealAll();
  }

  return winner;
}