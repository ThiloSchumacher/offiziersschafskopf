/**
 * trumpf.js
 * Trumpf- und Ranglogik für Farb-Solo und Wenz.
 *
 * Konvention: Kleinere Zahl = stärkere Karte.
 *   trumpfRank: 1 = höchster Trumpf
 *   suitRank:   0 = höchste Karte der jeweiligen Farbe (Ass)
 *
 * Alle Funktionen sind rein – kein versteckter Zustand, keine Mutationen.
 * `gameType` ist immer explizit, damit Tests nicht raten müssen.
 */

import {
  RANKS,
  GAME_TYPES,
  OBER_TRUMPF_ORDER,
  UNTER_TRUMPF_ORDER,
  SOLO_SUIT_TRUMPF_RANK_ORDER,
  SUIT_RANK_ORDER,
  WENZ_SUIT_RANK_ORDER,
} from '../config/constants.js';

/** Anzahl Trumpfkarten beim Farb-Solo: 4 Ober + 4 Unter + 6 Solo-Farbe. */
const TRUMPF_COUNT_FARB_SOLO = 14;

/** Anzahl Trumpfkarten beim Wenz: nur die 4 Unter. */
const TRUMPF_COUNT_WENZ = 4;

/**
 * Ist die Karte in dieser Spielart Trumpf?
 *
 * @param {Card} card
 * @param {string} gameType  GAME_TYPES.FARB_SOLO oder GAME_TYPES.WENZ
 * @param {string} [soloSuit]  nur bei Farb-Solo nötig
 */
export function isTrumpf(card, gameType, soloSuit) {
  if (gameType === GAME_TYPES.WENZ) {
    return card.rank === RANKS.UNTER;
  }
  if (gameType === GAME_TYPES.FARB_SOLO) {
    if (!soloSuit) {
      throw new Error('isTrumpf: Farb-Solo benötigt soloSuit');
    }
    return (
      card.rank === RANKS.OBER ||
      card.rank === RANKS.UNTER ||
      card.suit === soloSuit
    );
  }
  throw new Error(`isTrumpf: unbekannte Spielart "${gameType}"`);
}

/**
 * Trumpf-Rang der Karte (1 = höchster Trumpf).
 * Liefert `null`, wenn die Karte kein Trumpf ist.
 */
export function trumpfRank(card, gameType, soloSuit) {
  if (!isTrumpf(card, gameType, soloSuit)) return null;

  if (gameType === GAME_TYPES.WENZ) {
    return UNTER_TRUMPF_ORDER.indexOf(card.suit) + 1;
  }

  // Farb-Solo
  if (card.rank === RANKS.OBER) {
    return OBER_TRUMPF_ORDER.indexOf(card.suit) + 1;
  }
  if (card.rank === RANKS.UNTER) {
    return OBER_TRUMPF_ORDER.length + UNTER_TRUMPF_ORDER.indexOf(card.suit) + 1;
  }
  // Solo-Farbe
  return (
    OBER_TRUMPF_ORDER.length +
    UNTER_TRUMPF_ORDER.length +
    SOLO_SUIT_TRUMPF_RANK_ORDER.indexOf(card.rank) +
    1
  );
}

/**
 * Rang der Karte INNERHALB ihrer natürlichen Farbe (0 = Ass, stärkste).
 * Liefert `null`, wenn der Rang in dieser Spielart keine normale
 * Farbkarte ist (Ober beim Farb-Solo, Unter beim Wenz).
 *
 * Achtung: ignoriert Trumpf-Status. Beim Farb-Solo kann also
 * suitRank(herz-ass, FARB_SOLO) = 0 sein, obwohl Herz-Ass Trumpf ist.
 * Für Stich-Vergleiche immer `beats()` benutzen.
 */
export function suitRank(card, gameType) {
  const order =
    gameType === GAME_TYPES.WENZ ? WENZ_SUIT_RANK_ORDER : SUIT_RANK_ORDER;

  const idx = order.indexOf(card.rank);
  return idx === -1 ? null : idx;
}

/**
 * Schlägt Karte `a` Karte `b` im selben Stich?
 *
 * Regeln:
 *   - Trumpf schlägt Nicht-Trumpf.
 *   - Zwei Trümpfe: kleinere trumpfRank gewinnt.
 *   - Zwei Nicht-Trümpfe derselben Farbe: kleinere suitRank gewinnt.
 *   - Zwei Nicht-Trümpfe unterschiedlicher Farbe: `false`
 *     (die zweite Karte kann die erste nicht stechen, weil sie nicht bedient).
 */
export function beats(a, b, gameType, soloSuit) {
  const aTrumpf = isTrumpf(a, gameType, soloSuit);
  const bTrumpf = isTrumpf(b, gameType, soloSuit);

  if (aTrumpf && bTrumpf) {
    return trumpfRank(a, gameType, soloSuit) < trumpfRank(b, gameType, soloSuit);
  }
  if (aTrumpf) return true;
  if (bTrumpf) return false;

  if (a.suit !== b.suit) return false;
  return suitRank(a, gameType) < suitRank(b, gameType);
}

/** Praktisch für Tests und KI: wie viele Trümpfe gibt es in dieser Spielart? */
export function trumpfCount(gameType) {
  if (gameType === GAME_TYPES.WENZ) return TRUMPF_COUNT_WENZ;
  if (gameType === GAME_TYPES.FARB_SOLO) return TRUMPF_COUNT_FARB_SOLO;
  throw new Error(`trumpfCount: unbekannte Spielart "${gameType}"`);
}