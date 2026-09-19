/**
 * moves.js
 * Zug-Validierung: Welche Positionen darf der aktive Spieler spielen?
 *
 * =========================================================================
 * GRUNDPRINZIP: Vorbedingung vs. Regelverstoß
 * =========================================================================
 *
 * VORBEDINGUNG (wirft):
 *   Ein Zustand, der auf einen Bug hindeutet – nicht auf einen Spielzug
 *   des Nutzers. Wenn eine Vorbedingung verletzt ist, hat der Aufrufer
 *   (GameController, KI, UI) einen Fehler gemacht.
 *
 *     - state.gameType === null        → Spielart noch nicht gewählt
 *     - positionIndex außerhalb 0..7   → Programmierfehler im UI/Controller
 *     - Position nicht spielbar        → z. B. UI hat leeren Slot geklickt
 *     - aktueller Stich schon voll     → Spielablauf inkonsistent
 *
 * REGELVERSTOSS (liefert false / fehlt in der Liste):
 *   Ein Zug, der nach den Regeln gerade nicht erlaubt ist. Der Spieler
 *   könnte ihn spielen wollen, aber die Regeln verbieten es.
 *
 *     - Karte passt nicht zur Bedienpflicht (Farb-/Trumpfzwang)
 *
 * Damit ist klar: „false" bedeutet immer „nicht bedienen können", nie
 * „kaputter Zustand". Bugs werden laut, Regeln werden leise.
 *
 * =========================================================================
 * BEDIENPFlicht
 * =========================================================================
 *
 * Die angespielte Karte (plays[0]) definiert die Kategorie:
 *   - Trumpf → Zwang, Trumpf zu spielen (falls vorhanden)
 *   - Nicht-Trumpf-Farbe X → Zwang, eine Nicht-Trumpf-Karte der Farbe X
 *     zu spielen (falls vorhanden)
 *
 * Wichtig: Eine Karte, die Trumpf ist, zählt NICHT zu ihrer natürlichen
 * Farbe für Bedienzwecke. Beispiel (Farb-Solo, Solo = Herz):
 *   - Lead = Eichel-Ass → Kategorie „eichel".
 *   - Eichel-Ober ist Trumpf und zählt daher nicht als „Eichel".
 *     Ein Spieler mit nur Eichel-Ober hat die Farbe NICHT bedient und
 *     darf frei spielen (inkl. Trumpf).
 *
 * Beim Wenz sind Ober normale Farbkarten – Eichel-Ober bedient also
 * „eichel". Nur die 4 Unter sind Trumpf.
 *
 * =========================================================================
 */

import { PHASES } from '../game/phases.js';
import { isTrumpf } from './trumpf.js';

// ---------------------------------------------------------------------------
// Interne Vorbedingungsprüfung
// ---------------------------------------------------------------------------

function assertPreconditions(state) {
  if (!state.hasGameType()) {
    throw new Error('moves: Spielart noch nicht gewählt');
  }
  // Phase wird hier nicht geprüft: Der GameController ist dafür
  // verantwortlich, moves.* nur in Phase PHASES.SPIELEN aufzurufen.
  // Ein hasGameType()-Check reicht hier als Sicherheitsnetz.
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

/**
 * Bedienkategorie einer Karte:
 *   - 'trumpf' wenn Trumpf
 *   - sonst die Farbe (SUITS.*)
 *
 * @returns {string}
 */
export function playCategory(card, gameType, soloSuit) {
  if (isTrumpf(card, gameType, soloSuit)) return 'trumpf';
  return card.suit;
}

// ---------------------------------------------------------------------------
// Spielbare Karten und Züge
// ---------------------------------------------------------------------------

/**
 * Alle Positionen mit spielbarer (offener) Karte für den aktiven Spieler,
 * unabhängig von der Bedienpflicht.
 *
 * @returns {{positionIndex: number, card: Card}[]}
 */
export function playablePositions(state) {
  assertPreconditions(state);
  const player = state.players[state.activePlayerIndex];
  const result = [];
  for (const idx of player.playableIndices()) {
    result.push({
      positionIndex: idx,
      card: player.positionAt(idx).openCard,
    });
  }
  return result;
}

/**
 * Alle legalen Zug-Positionsindizes für den aktiven Spieler.
 *
 * @returns {number[]}  aufsteigend sortiert
 */
export function legalMoves(state) {
  assertPreconditions(state);

  if (state.currentTrick.plays.length >= 2) {
    throw new Error('moves: aktueller Stich ist bereits voll');
  }

  const playable = playablePositions(state);

  // Erster Spieler im Stich: freie Wahl.
  if (state.currentTrick.plays.length === 0) {
    return playable.map((p) => p.positionIndex);
  }

  // Zweiter Spieler: Bedienpflicht prüfen.
  const leadCard = state.currentTrick.plays[0].card;
  const category = playCategory(leadCard, state.gameType, state.soloSuit);

  const following = playable.filter(
    (p) => playCategory(p.card, state.gameType, state.soloSuit) === category,
  );

  // Wenn mindestens eine Karte bedient: nur diese sind erlaubt.
  // Sonst: freie Wahl (inkl. Trumpf).
  const allowed = following.length > 0 ? following : playable;
  return allowed.map((p) => p.positionIndex);
}

/**
 * Ist diese Position gerade ein legaler Zug?
 *
 * Wirft bei Vorbedingungsverletzungen (siehe Kopfkommentar).
 * Liefert false NUR, wenn die Karte im Prinzip spielbar ist, aber
 * die Bedienpflicht eine andere Karte verlangt.
 *
 * @returns {boolean}
 */
export function isLegalMove(state, positionIndex) {
  assertPreconditions(state);

  const player = state.players[state.activePlayerIndex];
  const position = player.positionAt(positionIndex); // wirft bei Index außerhalb

  if (!position.hasPlayableCard()) {
    throw new Error(`moves: Position ${positionIndex} ist nicht spielbar`);
  }

  return legalMoves(state).includes(positionIndex);
}

/**
 * Wie legalMoves(), liefert aber {positionIndex, card} statt nur Indizes.
 * Praktisch für UI und KI, die beides brauchen.
 *
 * @returns {{positionIndex: number, card: Card}[]}
 */
export function legalMovesWithCards(state) {
  const allowed = new Set(legalMoves(state));
  return playablePositions(state).filter((p) => allowed.has(p.positionIndex));
}