/**
 * GameController.js
 * Führt durch die Phasen und ruft die Regelmodule auf.
 *
 * Ablauf:
 *
 *   INIT
 *     ↓ start()
 *   GEBEN_1       Vorhand 4 verdeckt, Geber 4 verdeckt, Vorhand 4 offen
 *     ↓
 *   ANSAGE        Vorhand wählt Spielart
 *     ↓ chooseGameType(...)
 *   GEBEN_2       Geber 4 offen, dann Runde 2 (beide 4 verdeckt + 4 offen)
 *     ↓
 *   ANSAGE_STOSS  Gegner Stoß? Alleinspieler Nochmal?
 *     ↓ finishAnnouncements()
 *   SPIELEN       16 Stiche
 *     ↓ (nach 16. Stich)
 *   AUSWERTUNG    resultFor() wird berechnet und per Event verschickt
 *     ↓ finishGame()
 *   ENDE
 *
 * WICHTIG: State wird IMMER zuerst vollständig aktualisiert, dann werden
 * Events gefeuert. Die UI darf nie einen halbfertigen Zustand sehen.
 *
 * Mutationen laufen ausschließlich über GameState-Primitive
 * (setActivePlayer, recordPlay, ...). Kein direkter Feldzugriff.
 *
 * Events:
 *   phase:changed        { from, to }
 *   cards:dealt          { stage: 'geben1' | 'geben2' }
 *   gameType:chosen      { gameType, soloSuit, by }
 *   announcement:stoss   { by }
 *   announcement:nochmal { by }
 *   card:played          { playerIndex, positionIndex, card }
 *   trick:resolved       { winner, trick, points }
 *   game:end             { ...resultFor() }
 */

import { Deck } from '../model/Deck.js';
import { GameState } from '../model/GameState.js';
import { PHASES } from './phases.js';
import { EventBus } from './EventBus.js';
import { STACKS_PER_PLAYER, TOTAL_TRICKS } from '../config/constants.js';
import { applyTrickResult, trickPoints } from '../rules/stich.js';
import {
  announceStoss,
  announceNochmal,
} from '../rules/ansagen.js';
import { isLegalMove } from '../rules/moves.js';
import { resultFor } from '../rules/scoring.js';

export class GameController {
  #state;
  #bus;
  #rng;
  #deck;

  /**
   * @param {object} args
   * @param {Player[]} args.players  zwei Spieler mit leeren Positionen
   * @param {number} args.declarerIndex  Vorhand = künftiger Alleinspieler
   * @param {() => number} [args.rng]  Zufallsgenerator fürs Mischen
   * @param {EventBus} [args.bus]
   */
  constructor({ players, declarerIndex, rng = Math.random, bus = new EventBus() }) {
    this.#state = new GameState({ players, declarerIndex });
    this.#bus = bus;
    this.#rng = rng;
    this.#deck = null;
  }

  get state() { return this.#state; }
  get bus() { return this.#bus; }

  // -------------------------------------------------------------------------
  // Phasenübergänge
  // -------------------------------------------------------------------------

  /** INIT → GEBEN_1 → ANSAGE */
  start() {
    if (this.#state.phase !== PHASES.INIT) {
      throw new Error(`GameController.start: nur aus INIT erlaubt (Phase ${this.#state.phase})`);
    }
    this.#deck = Deck.shuffled(this.#rng);
    this.#setPhase(PHASES.GEBEN_1);
    this.#dealGeben1();
    this.#setPhase(PHASES.ANSAGE);
  }

  /** ANSAGE → GEBEN_2 → ANSAGE_STOSS */
  chooseGameType(gameType, soloSuit = null) {
    if (this.#state.phase !== PHASES.ANSAGE) {
      throw new Error(`chooseGameType: nicht in Phase ANSAGE (Phase ${this.#state.phase})`);
    }
    this.#state.setGameType(gameType, soloSuit);
    this.#bus.emit('gameType:chosen', {
      gameType,
      soloSuit,
      by: this.#state.declarerIndex,
    });
    this.#setPhase(PHASES.GEBEN_2);
    this.#dealGeben2();
    this.#setPhase(PHASES.ANSAGE_STOSS);
  }

  /** Gegner sagt Stoß. */
  callStoss() {
    if (this.#state.phase !== PHASES.ANSAGE_STOSS) {
      throw new Error('callStoss: nicht in Phase ANSAGE_STOSS');
    }
    announceStoss(this.#state, this.#state.opponentIndex);
    this.#bus.emit('announcement:stoss', { by: this.#state.opponentIndex });
  }

  /** Alleinspieler kontert mit Nochmal. */
  callNochmal() {
    if (this.#state.phase !== PHASES.ANSAGE_STOSS) {
      throw new Error('callNochmal: nicht in Phase ANSAGE_STOSS');
    }
    announceNochmal(this.#state, this.#state.declarerIndex);
    this.#bus.emit('announcement:nochmal', { by: this.#state.declarerIndex });
  }

  /** Beendet die Stoß-Phase. */
  finishAnnouncements() {
    if (this.#state.phase !== PHASES.ANSAGE_STOSS) {
      throw new Error('finishAnnouncements: nicht in Phase ANSAGE_STOSS');
    }
    this.#setPhase(PHASES.SPIELEN);
  }

  /**
   * Aktiver Spieler legt eine Karte.
   *
   * Nach dem zweiten Play eines Stichs wird der Stich sofort aufgelöst
   * (applyTrickResult) und – falls es der 16. war – die Auswertung
   * angestoßen.
   *
   * Wichtig: Der State wird zuerst vollständig aktualisiert (inkl.
   * activePlayerIndex bzw. Stichauflösung), danach werden die Events
   * gefeuert.
   *
   * @param {number} playerIndex  muss state.activePlayerIndex sein
   * @param {number} positionIndex  0..7
   */
  playCard(playerIndex, positionIndex) {
    if (this.#state.phase !== PHASES.SPIELEN) {
      throw new Error(`playCard: nicht in Phase SPIELEN (Phase ${this.#state.phase})`);
    }
    if (playerIndex !== this.#state.activePlayerIndex) {
      throw new Error(
        `playCard: Spieler ${playerIndex} ist nicht am Zug (aktiv: ${this.#state.activePlayerIndex})`,
      );
    }
    if (!isLegalMove(this.#state, positionIndex)) {
      throw new Error(`playCard: Position ${positionIndex} ist kein legaler Zug`);
    }

    // --- 1. State komplett aktualisieren ----------------------------------

    const player = this.#state.players[playerIndex];
    const card = player.playAt(positionIndex);
    this.#state.recordPlay({ playerIndex, positionIndex, card });

    let trickResult = null;
    if (this.#state.isCurrentTrickComplete()) {
      const points = trickPoints(this.#state.currentTrick);
      const winner = applyTrickResult(this.#state);
      const trick = this.#state.completedTricks[this.#state.completedTricks.length - 1];
      trickResult = { winner, trick, points };
    } else {
      // Erster Play des Stichs: der andere Spieler ist jetzt dran.
      this.#state.setActivePlayer(1 - playerIndex);
    }

    // --- 2. Events feuern -------------------------------------------------

    this.#bus.emit('card:played', { playerIndex, positionIndex, card });

    if (trickResult) {
      this.#bus.emit('trick:resolved', trickResult);

      if (this.#state.completedTricks.length === TOTAL_TRICKS) {
        this.#setPhase(PHASES.AUSWERTUNG);
        const result = resultFor(this.#state);
        this.#bus.emit('game:end', result);
      }
    }
  }

  /** AUSWERTUNG → ENDE. */
  finishGame() {
    if (this.#state.phase !== PHASES.AUSWERTUNG) {
      throw new Error('finishGame: nicht in Phase AUSWERTUNG');
    }
    this.#setPhase(PHASES.ENDE);
  }

  // -------------------------------------------------------------------------
  // intern
  // -------------------------------------------------------------------------

  #setPhase(newPhase) {
    const oldPhase = this.#state.phase;
    if (oldPhase === newPhase) return;
    this.#state.setPhase(newPhase);
    this.#bus.emit('phase:changed', { from: oldPhase, to: newPhase });
  }

  #dealGeben1() {
    const declarer = this.#state.declarer;
    const opponent = this.#state.opponent;

    for (let i = 0; i < 4; i++) {
      declarer.positionAt(i).dealHidden(this.#deck.draw());
    }
    for (let i = 0; i < 4; i++) {
      opponent.positionAt(i).dealHidden(this.#deck.draw());
    }
    for (let i = 0; i < 4; i++) {
      declarer.positionAt(i).dealOpen(this.#deck.draw());
    }

    this.#bus.emit('cards:dealt', { stage: 'geben1' });
  }

  #dealGeben2() {
    const declarer = this.#state.declarer;
    const opponent = this.#state.opponent;

    for (let i = 0; i < 4; i++) {
      opponent.positionAt(i).dealOpen(this.#deck.draw());
    }
    for (let i = 4; i < STACKS_PER_PLAYER; i++) {
      declarer.positionAt(i).dealHidden(this.#deck.draw());
    }
    for (let i = 4; i < STACKS_PER_PLAYER; i++) {
      opponent.positionAt(i).dealHidden(this.#deck.draw());
    }
    for (let i = 4; i < STACKS_PER_PLAYER; i++) {
      declarer.positionAt(i).dealOpen(this.#deck.draw());
    }
    for (let i = 4; i < STACKS_PER_PLAYER; i++) {
      opponent.positionAt(i).dealOpen(this.#deck.draw());
    }

    this.#bus.emit('cards:dealt', { stage: 'geben2' });
  }
}