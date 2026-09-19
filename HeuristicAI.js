/**
 * HeuristicAI.js
 * Zugbewertung und -auswahl für die KI.
 *
 * Arbeitsweise:
 *   1. Für jeden legalen Zug wird eine Bewertung (score) berechnet.
 *   2. Der Zug mit dem höchsten Score gewinnt – bei Gleichstand der
 *      niedrigste Positions-Index (deterministisch).
 *   3. Optional: Zufallsanteil. Bei `randomness > 0` wird mit dieser
 *      Wahrscheinlichkeit ein beliebiger legaler Zug gewählt statt des
 *      besten. Das macht die KI schlagbar und variiert ihr Verhalten.
 *
 * Schwierigkeitsgrade (siehe main.js):
 *   einfach  → randomness = 0.40
 *   mittel   → randomness = 0.15
 *   schwer   → randomness = 0.00
 *
 * Die KI sieht NUR die AIView. Sie hat keinen Zugriff auf den GameState.
 * Ein Fairness-Test (siehe tests/HeuristicAI.test.js) prüft das
 * strukturell.
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
  isSoloSuitAss,
} from './strategies.js';

// Gewichte – an einer Stelle zentral, damit sie leicht justierbar sind.
const W = Object.freeze({
  CARD_VALUE_COST: 0.4,
  TRUMPF_COST: 6,

  // Nicht-Trumpf-Ass beim Anspielen: stark, weil der Gegner bedienen
  // muss und nicht trumpfen kann (wenn er die Farbe hat).
  ASS_LEAD_BONUS: 8,

  // Solo-Ass beim Anspielen: ebenfalls stark, aber nicht unschlagbar –
  // ein gegnerischer Ober kann es trumpfen. Deshalb ein eigener,
  // niedrigerer Bonus als beim Nicht-Trumpf-Ass, aber hoch genug, um
  // über König und 10 zu liegen. Balance:
  //   Nicht-Trumpf-Ass  3.6
  //   Niete             3.0
  //   Solo-Ass          2.6
  //   König            -1.6
  SOLO_ASS_LEAD_BONUS: 13,

  // Top-Trumpf (Eichel-Ober / Eichel-Unter): unschlagbar, zieht
  // Gegner-Trumpf, muss höher liegen als jedes Ass.
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
    // Das Solo-Ass ist Trumpf und wird vom Guard oben ausgeschlossen.
    // Es bekommt einen eigenen, niedrigeren Bonus – siehe W-Kommentar.
    if (isSoloSuitAss(view, card)) {
      score += W.SOLO_ASS_LEAD_BONUS;
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
 * @param {object} view  AIView
 * @param {number[]} legalIndices  Positions-Indizes aus legalMoves(state)
 * @param {object} [options]
 * @param {number} [options.randomness]  Wahrscheinlichkeit (0..1), einen
 *   zufälligen legalen Zug statt des besten zu wählen. Default 0.
 * @param {() => number} [options.rng]  Zufallsgenerator, Default Math.random
 * @returns {number}  gewählter Positions-Index
 */
export function chooseMove(view, legalIndices, options = {}) {
  if (!Array.isArray(legalIndices) || legalIndices.length === 0) {
    throw new Error('HeuristicAI: keine legalen Züge übergeben');
  }

  const randomness = options.randomness ?? 0;
  const rng = options.rng ?? Math.random;

  if (randomness < 0 || randomness > 1) {
    throw new Error(`HeuristicAI: randomness muss zwischen 0 und 1 liegen, war ${randomness}`);
  }

  // Zufallszug, wenn aktiviert und der Wurf unter der Schwelle liegt.
  if (randomness > 0 && rng() < randomness) {
    const pick = Math.floor(rng() * legalIndices.length);
    return legalIndices[pick];
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
    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  }

  return bestIndex;
}

/**
 * Schwierigkeitsgrade als benannte Presets.
 */
export const DIFFICULTY = Object.freeze({
  EASY:   { id: 'easy',   label: 'Einfach', randomness: 0.40 },
  MEDIUM: { id: 'medium', label: 'Mittel',  randomness: 0.15 },
  HARD:   { id: 'hard',   label: 'Schwer',  randomness: 0.00 },
});

export const DIFFICULTY_LIST = Object.freeze([
  DIFFICULTY.EASY,
  DIFFICULTY.MEDIUM,
  DIFFICULTY.HARD,
]);