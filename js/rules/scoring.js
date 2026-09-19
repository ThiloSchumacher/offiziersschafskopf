/**
 * scoring.js
 * Endauswertung einer Partie.
 *
 * Regeln:
 *   - Alleinspieler gewinnt bei 61+ Punkten.
 *   - Gegner gewinnt, wenn der Alleinspieler 60 oder weniger hat.
 *   - Schneider: Verlierer < 31 Punkte → Multiplikator 2.
 *   - Schwarz:  Verlierer ohne einen einzigen Stich → Multiplikator 3.
 *     (Schwarz ersetzt Schneider, stapelt nicht.)
 *   - Ansagen (Stoß/Nochmal) multiplizieren zusätzlich:
 *     Stoß = 2, Stoß + Nochmal = 4.
 *   - Der Gesamtmultiplikator ergibt sich aus
 *     resultMultiplier × announcementMultiplier.
 *
 * Vorbedingungen (werfen):
 *   - state.phase muss PHASES.AUSWERTUNG sein.
 *   - Die Punkte-Summe beider Spieler muss 120 ergeben
 *     (Sicherheitsnetz gegen unvollständige Stiche).
 *
 * Reine Entscheidung ohne State gibt es hier nicht – "false"-Fälle
 * existieren in scoring nicht. Entweder der State ist auswertbar,
 * oder der Aufrufer hat einen Bug.
 */

import {
  WIN_THRESHOLD,
  SCHNEIDER_THRESHOLD,
  SCHWARZ_STICHE,
  RESULT_MULTIPLIER,
  TOTAL_POINTS,
} from '../config/constants.js';
import { PHASES } from '../game/phases.js';
import { currentMultiplier } from './ansagen.js';

export const RESULT_KIND = Object.freeze({
  NORMAL: 'normal',
  SCHNEIDER: 'schneider',
  SCHWARZ: 'schwarz',
});

function assertScoringPreconditions(state) {
  if (state.phase !== PHASES.AUSWERTUNG) {
    throw new Error(
      `scoring: State muss in Phase AUSWERTUNG sein, war "${state.phase}"`,
    );
  }
  const sum = state.points[0] + state.points[1];
  if (sum !== TOTAL_POINTS) {
    throw new Error(
      `scoring: Punkte-Summe ist ${sum}, erwartet ${TOTAL_POINTS} – Spiel unvollständig?`,
    );
  }
}

/**
 * Vollständiges Ergebnis der Partie.
 *
 * @param {GameState} state  in Phase AUSWERTUNG, alle Karten gespielt
 * @returns {{
 *   declarerWon: boolean,
 *   winnerIndex: number,
 *   loserIndex: number,
 *   result: 'normal'|'schneider'|'schwarz',
 *   resultMultiplier: number,
 *   announcementMultiplier: number,
 *   totalMultiplier: number,
 *   declarerPoints: number,
 *   opponentPoints: number,
 *   loserPoints: number,
 *   loserTricks: number,
 * }}
 */
export function resultFor(state) {
  assertScoringPreconditions(state);

  const declarerPoints = state.declarerPoints();
  const opponentPoints = state.opponentPoints();
  const declarerWon = declarerPoints >= WIN_THRESHOLD;

  const winnerIndex = declarerWon ? state.declarerIndex : state.opponentIndex;
  const loserIndex = 1 - winnerIndex;

  const loserPoints = state.points[loserIndex];
  const loserTricks = state.tricksWon[loserIndex];

  let result;
  let resultMultiplier;
  if (loserTricks === SCHWARZ_STICHE) {
    result = RESULT_KIND.SCHWARZ;
    resultMultiplier = RESULT_MULTIPLIER.SCHWARZ;
  } else if (loserPoints < SCHNEIDER_THRESHOLD) {
    result = RESULT_KIND.SCHNEIDER;
    resultMultiplier = RESULT_MULTIPLIER.SCHNEIDER;
  } else {
    result = RESULT_KIND.NORMAL;
    resultMultiplier = RESULT_MULTIPLIER.NORMAL;
  }

  const announcementMultiplier = currentMultiplier(state);
  const totalMultiplier = resultMultiplier * announcementMultiplier;

  return {
    declarerWon,
    winnerIndex,
    loserIndex,
    result,
    resultMultiplier,
    announcementMultiplier,
    totalMultiplier,
    declarerPoints,
    opponentPoints,
    loserPoints,
    loserTricks,
  };
}