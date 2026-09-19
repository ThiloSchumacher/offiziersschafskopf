/**
 * strategies.js
 * Einzelne Heuristik-Bausteine als reine Funktionen.
 *
 * Alle Funktionen arbeiten auf einer AIView (siehe AIView.js) – nicht
 * auf dem GameState. Damit ist Schummelfreiheit strukturell garantiert.
 *
 * Die eigentliche Zugbewertung liegt in HeuristicAI.js. strategies.js
 * liefert nur die Bausteine, die dort zusammengesetzt werden.
 */

import { RANKS, GAME_TYPES } from '../config/constants.js';
import { isTrumpf } from '../rules/trumpf.js';
import { beats } from '../rules/trumpf.js';

/** Ist die Karte in dieser Spielart Trumpf? */
export function isTrumpfCard(view, card) {
  return isTrumpf(card, view.gameType, view.soloSuit);
}

/** Führt die KI den aktuellen Stich an (noch keine Karte liegt)? */
export function isLeading(view) {
  return view.currentTrick.plays.length === 0;
}

/** Ist die KI Zweiter im aktuellen Stich? */
export function isFollowing(view) {
  return view.currentTrick.plays.length === 1;
}

/**
 * Punktesumme der bereits im aktuellen Stich liegenden Karten.
 * Enthält NICHT die eigene noch zu spielende Karte.
 */
export function currentTrickPoints(view) {
  return view.currentTrick.plays.reduce((sum, p) => sum + p.card.points, 0);
}

/**
 * Würde die Karte den aktuellen Stich gewinnen?
 *
 * Wenn die KI führt: trivial true (sie hat noch keinen Gegner im Stich).
 * Wenn die KI Zweiter ist: schlägt die Karte die bereits liegende?
 */
export function wouldWinCurrentTrick(view, card) {
  if (isLeading(view)) return true;
  const opponentPlay = view.currentTrick.plays[0];
  return beats(card, opponentPlay.card, view.gameType, view.soloSuit);
}

/** Karte hat 0 Punkte (9, 8, 7). */
export function isWorthless(card) {
  return card.points === 0;
}

/** Karte ist ein Ass. */
export function isAss(card) {
  return card.rank === RANKS.ASS;
}

/** Karte ist eine 10. */
export function isTen(card) {
  return card.rank === RANKS.ZEHN;
}

/**
 * Ist die Karte der höchste Trumpf im Spiel?
 * Nur Eichel-Ober beim Farb-Solo. Beim Wenz: Eichel-Unter.
 * (Unter beim Wenz: höchster ist Eichel-Unter.)
 */
export function isTopTrumpf(view, card) {
  if (!isTrumpfCard(view, card)) return false;
  if (view.gameType === GAME_TYPES.WENZ) {
    return card.rank === RANKS.UNTER && card.suit === 'eichel';
  }
  // Farb-Solo
  return card.rank === RANKS.OBER && card.suit === 'eichel';
}