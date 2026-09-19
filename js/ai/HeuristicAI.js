/**
 * HeuristicAI.js
 * Zugbewertung und -auswahl für die KI.
 *
 * Arbeitsweise:
 *   1. Für jeden legalen Zug wird eine Bewertung (score) berechnet.
 *   2. Der Zug mit dem höchsten Score gewinnt.
 *   3. Bei Gleichstand: niedrigster Positions-Index (deterministisch).
 *
 * Kein Zufall, keine Simulation. Bewusste MVP-Entscheidung: wenige,
 * gut nachvollziehbare Regeln statt Black-Box-Optimierung.
 *
 * Die KI sieht NUR die AIView. Sie hat keinen Zugriff auf den GameState.
 * Ein Fairness-Test (siehe tests/HeuristicAI.test.js) prüft das
 * strukturell.
 *
 * Bewertungs-Heuristiken:
 *
 *   Grundkosten (immer):
 *     - Kartenwert: hohe Karten sind teuer zu verlieren.
 *       score -= card.points * 0.4
 *     - Trumpf: Trumpf ist strategisch wertvoll.
 *       score -= 6
 *
 *   Wenn ich führe:
 *     - Ass: früh ausspielen, solange der Gegner bedienen muss.
 *       score += 8
 *     - Höchster Trumpf: unschlagbar und zieht Gegner-Trumpf.
 *       score += 14
 *     - 0-Punkte-Karten: früh loswerden.
 *       score += 3
 *
 *   Wenn ich Zweiter bin:
 *     - Gewinnen möglich:
 *       score += (Stichwert + eigene Kartenpunkte) * 1.0
 *       Bonus wenn die Gewinnkarte 0 Punkte hat (Effizienz): +5
 *     - Nicht gewinnen möglich (Abwurf):
 *       0-Punkte-Karte bevorzugt: +5
 */

import {
  isTrumpfCard,
  isLeading,
  isFollowing,
  currentTrickPoints,
  wouldWinCurrentTrick,
  isWorthless,
  isAss,
  isTopTrumpf,
} from './strategies.js';

// Gewichte – an einer Stelle zentral, damit sie leicht justierbar sind.
const W = Object.freeze({
  CARD_VALUE_COST: 0.4,
  TRUMPF_COST: 6,
  ASS_LEAD_BONUS: 8,
  // Der höchste Trumpf ist die stärkste Eröffnung im Spiel: er ist
  // unschlagbar und zwingt den Gegner, einen Trumpf zuzugeben. Deshalb
  // muss dieser Bonus deutlich über dem Ass-Bonus liegen – sonst
  // rechnet die Kostenrechnung den Top-Trumpf schlechter als ein
  // Nicht-Trumpf-Ass.
  TOP_TRUMPF_LEAD_BONUS: 14,
  WORTHLESS_LEAD_BONUS: 3,
  WIN_MULT: 1.0,
  WIN_CHEAP_BONUS: 5,
  DISCARD_WORTHLESS_BONUS: 5,
});

/**
 * Bewertet einen einzelnen Zug.
 *
 * @param {object} view  AIView
 * @param {number} positionIndex
 * @param {Card} card  die Karte an dieser Position
 * @returns {number}  Score, höher = besser
 */
export function evaluateMove(view, positionIndex, card) {
  let score = 0;

  // --- Grundkosten ------------------------------------------------------

  score -= card.points * W.CARD_VALUE_COST;
  if (isTrumpfCard(view, card)) {
    score -= W.TRUMPF_COST;
  }

  // --- Situationsabhängige Bewertung ------------------------------------

  if (isLeading(view)) {
    if (isAss(card) && !isTrumpfCard(view, card)) {
      score += W.ASS_LEAD_BONUS;
    }
    if (isTopTrumpf(view, card)) {
      score += W.TOP_TRUMPF_LEAD_BONUS;
    }
    if (isWorthless(card)) {
      score += W.WORTHLESS_LEAD_BONUS;
    }
  } else if (isFollowing(view)) {
    const wouldWin = wouldWinCurrentTrick(view, card);

    if (wouldWin) {
      const trickValue = currentTrickPoints(view) + card.points;
      score += trickValue * W.WIN_MULT;
      if (isWorthless(card)) {
        score += W.WIN_CHEAP_BONUS;
      }
    } else {
      // Abwurf: keine Chance zu gewinnen.
      if (isWorthless(card)) {
        score += W.DISCARD_WORTHLESS_BONUS;
      }
    }
  }

  return score;
}

/**
 * Wählt den besten Zug aus den legalen Positions-Indizes.
 *
 * Wirft, wenn keine legalen Züge übergeben werden – das ist ein Bug
 * im Aufrufer, nicht ein normaler Spielzustand.
 *
 * @param {object} view  AIView
 * @param {number[]} legalIndices  Positions-Indizes aus legalMoves(state)
 * @returns {number}  gewählter Positions-Index
 */
export function chooseMove(view, legalIndices) {
  if (!Array.isArray(legalIndices) || legalIndices.length === 0) {
    throw new Error('HeuristicAI: keine legalen Züge übergeben');
  }

  let bestIndex = legalIndices[0];
  let bestScore = -Infinity;

  for (const idx of legalIndices) {
    const entry = view.myOpenCards.find((e) => e.positionIndex === idx);
    if (!entry) {
      throw new Error(
        `HeuristicAI: legaler Index ${idx} nicht in myOpenCards enthalten`,
      );
    }

    const score = evaluateMove(view, idx, entry.card);

    // Strictly greater: bei Gleichstand gewinnt der erste (niedrigste Index).
    // Das macht die KI deterministisch und Test-freundlich.
    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  }

  return bestIndex;
}