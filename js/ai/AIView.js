/**
 * AIView.js
 * Reduzierte Sicht auf den GameState für die KI.
 *
 * Grundprinzip: Die KI sieht NUR, was ein Mensch an ihrer Stelle sehen
 * würde. Eigene verdeckte Karten und gegnerische verdeckte Karten sind
 * nicht enthalten – nicht "versteckt", sondern gar nicht erst vorhanden.
 *
 * Damit ist Schummeln technisch unmöglich: Es gibt kein Feld, das auf
 * eine verborgene Karte zeigt.
 *
 * Aufbau:
 *   {
 *     playerIndex,        // 0 oder 1 – die eigene Position
 *     opponentIndex,      // 1 - playerIndex
 *     gameType,           // FARB_SOLO | WENZ
 *     soloSuit,           // nur bei Farb-Solo
 *     phase,
 *
 *     myOpenCards:   [{ positionIndex, card }, ...],
 *     oppOpenCards:  [{ positionIndex, card }, ...],
 *
 *     currentTrick:  { leaderIndex, plays: [...] },
 *     playedCards:   [Card, ...],   // alle bis jetzt gespielten Karten
 *
 *     myPoints, oppPoints,
 *     myTricks, oppTricks,
 *     completedTricksCount,
 *     totalTricks,
 *
 *     announcements: { stoss, nochmal },
 *   }
 *
 * Phase: nur in PHASES.SPIELEN sinnvoll. In jeder anderen Phase wirft
 * buildAIView – das ist ein Programmierfehler, kein legitimer Zustand.
 */

import { STACKS_PER_PLAYER, TOTAL_POINTS, TOTAL_TRICKS } from '../config/constants.js';
import { PHASES } from '../game/phases.js';

/**
 * Erzeugt eine AIView für den angegebenen Spieler.
 *
 * @param {GameState} state
 * @param {number} playerIndex  0 oder 1
 * @returns {object}  AIView
 */
export function buildAIView(state, playerIndex) {
  if (playerIndex !== 0 && playerIndex !== 1) {
    throw new Error(`AIView: playerIndex muss 0 oder 1 sein, war ${playerIndex}`);
  }
  if (!state.hasGameType()) {
    throw new Error('AIView: Spielart ist noch nicht gewählt');
  }
  if (state.phase !== PHASES.SPIELEN) {
    throw new Error(
      `AIView: nur in Phase SPIELEN verfügbar, war "${state.phase}"`,
    );
  }

  const opponentIndex = 1 - playerIndex;

  return Object.freeze({
    playerIndex,
    opponentIndex,
    gameType: state.gameType,
    soloSuit: state.soloSuit,
    phase: state.phase,

    myOpenCards: extractOpenCards(state.players[playerIndex]),
    oppOpenCards: extractOpenCards(state.players[opponentIndex]),

    currentTrick: {
      leaderIndex: state.currentTrick.leaderIndex,
      plays: state.currentTrick.plays.map((p) => ({
        playerIndex: p.playerIndex,
        positionIndex: p.positionIndex,
        card: p.card,
      })),
    },
    playedCards: extractPlayedCards(state),

    myPoints: state.points[playerIndex],
    oppPoints: state.points[opponentIndex],
    myTricks: state.tricksWon[playerIndex],
    oppTricks: state.tricksWon[opponentIndex],

    completedTricksCount: state.completedTricks.length,
    totalTricks: TOTAL_TRICKS,
    totalPoints: TOTAL_POINTS,

    announcements: {
      stoss: { ...state.announcements.stoss },
      nochmal: { ...state.announcements.nochmal },
    },
  });
}

// ---------------------------------------------------------------------------
// intern
// ---------------------------------------------------------------------------

function extractOpenCards(player) {
  const result = [];
  for (let i = 0; i < STACKS_PER_PLAYER; i++) {
    const pos = player.positionAt(i);
    if (pos.openCard !== null) {
      result.push({ positionIndex: i, card: pos.openCard });
    }
  }
  return result;
}

function extractPlayedCards(state) {
  const played = [];
  for (const trick of state.completedTricks) {
    for (const play of trick.plays) {
      played.push(play.card);
    }
  }
  for (const play of state.currentTrick.plays) {
    played.push(play.card);
  }
  return played;
}