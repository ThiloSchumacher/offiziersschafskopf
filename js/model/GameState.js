/**
 * GameState.js
 * Gesamtzustand einer Partie.
 *
 * Enthält Daten und reine Abfragen sowie dumme Mutations-Primitive.
 * Regel-Logik ("ist das erlaubt?") liegt in rules/*. Der GameController
 * entscheidet, WANN welche Primitive aufgerufen wird.
 *
 * Mutations-Primitive (die einzigen erlaubten Wege, den State zu ändern):
 *   - setGameType(gameType, soloSuit)   einmalig in Phase ANSAGE
 *   - setPhase(phase)
 *   - setActivePlayer(playerIndex)
 *   - recordPlay({ playerIndex, positionIndex, card })
 *   - recordCompletedTrick(winnerIndex)
 *   - addPoints(playerIndex, amount)
 *   - addTrick(playerIndex)
 *   - setStoss(playerIndex)
 *   - setNochmal(playerIndex)
 *
 * Niemand – weder rules/*, noch GameController, noch KI, noch UI –
 * darf die Felder activePlayerIndex, currentTrick, completedTricks,
 * points, tricksWon, announcements direkt setzen. Ausnahme: Tests
 * dürfen für Setup-Zwecke direkt zugreifen.
 *
 * Lebenszyklus der Spielart:
 *   - Konstruktor: gameType = null (noch nicht gewählt)
 *   - Phase ANSAGE: Vorhand wählt Spielart → setGameType(...)
 *   - Ab dann unveränderlich.
 *
 * Ein "Stich" hat die Form:
 *   {
 *     leaderIndex: 0 | 1,
 *     plays: [ { playerIndex, positionIndex, card }, ... ]
 *   }
 */

import { GAME_TYPES, STACKS_PER_PLAYER } from '../config/constants.js';
import { Player } from './Player.js';
import { Card } from './Card.js';
import { ALL_PHASES } from '../game/phases.js';

const VALID_PHASES = new Set(ALL_PHASES);

function assertPlayerIndex(index) {
  if (index !== 0 && index !== 1) {
    throw new Error(`GameState: Spieler-Index muss 0 oder 1 sein, war ${index}`);
  }
}

function validateGameTypeChoice(gameType, soloSuit) {
  if (gameType === null) {
    if (soloSuit !== null) {
      throw new Error('GameState: soloSuit ohne Spielart nicht erlaubt');
    }
    return;
  }
  if (gameType === GAME_TYPES.FARB_SOLO) {
    if (!soloSuit) {
      throw new Error('GameState: Farb-Solo benötigt soloSuit');
    }
    return;
  }
  if (gameType === GAME_TYPES.WENZ) {
    if (soloSuit !== null) {
      throw new Error('GameState: Wenz darf kein soloSuit haben');
    }
    return;
  }
  throw new Error(`GameState: unbekannte Spielart "${gameType}"`);
}

function clonePlays(plays) {
  return plays.map((p) => ({
    playerIndex: p.playerIndex,
    positionIndex: p.positionIndex,
    card: p.card, // Card ist immutable → teilen ist sicher
  }));
}

export class GameState {
  players;
  declarerIndex;
  gameType;    // null bis Phase ANSAGE
  soloSuit;    // nur bei Farb-Solo gesetzt

  phase;
  activePlayerIndex;

  currentTrick;
  completedTricks;

  points;
  tricksWon;

  announcements;

  /**
   * @param {object} args
   * @param {Player[]} args.players
   * @param {number} args.declarerIndex  Vorhand = künftiger Alleinspieler
   * @param {string|null} [args.gameType]  null bis ANSAGE
   * @param {string|null} [args.soloSuit]
   */
  constructor({ players, declarerIndex, gameType = null, soloSuit = null }) {
    if (!Array.isArray(players) || players.length !== 2) {
      throw new Error('GameState: benötigt genau 2 Spieler');
    }
    if (!players.every((p) => p instanceof Player)) {
      throw new Error('GameState: players müssen Player-Instanzen sein');
    }
    assertPlayerIndex(declarerIndex);
    validateGameTypeChoice(gameType, soloSuit);

    this.players = players;
    this.declarerIndex = declarerIndex;
    this.gameType = gameType;
    this.soloSuit = soloSuit;

    this.phase = 'init';
    this.activePlayerIndex = declarerIndex;

    this.currentTrick = { leaderIndex: declarerIndex, plays: [] };
    this.completedTricks = [];

    this.points = [0, 0];
    this.tricksWon = [0, 0];

    this.announcements = {
      stoss:   { called: false, by: null },
      nochmal: { called: false, by: null },
    };
  }

  // --- Abfragen ------------------------------------------------------------

  get declarer() {
    return this.players[this.declarerIndex];
  }

  get opponent() {
    return this.players[this.opponentIndex];
  }

  get opponentIndex() {
    return 1 - this.declarerIndex;
  }

  hasGameType() {
    return this.gameType !== null;
  }

  isDeclarer(playerIndex) {
    return playerIndex === this.declarerIndex;
  }

  opponentOf(playerIndex) {
    assertPlayerIndex(playerIndex);
    return 1 - playerIndex;
  }

  declarerPoints() {
    return this.points[this.declarerIndex];
  }

  opponentPoints() {
    return this.points[this.opponentIndex];
  }

  isCurrentTrickComplete() {
    return this.currentTrick.plays.length === 2;
  }

  // --- Mutations-Primitive -------------------------------------------------

  setGameType(gameType, soloSuit = null) {
    if (this.gameType !== null) {
      throw new Error('GameState: Spielart ist bereits gewählt');
    }
    validateGameTypeChoice(gameType, soloSuit);
    this.gameType = gameType;
    this.soloSuit = soloSuit;
  }

  setPhase(phase) {
    if (!VALID_PHASES.has(phase)) {
      throw new Error(`GameState: unbekannte Phase "${phase}"`);
    }
    this.phase = phase;
  }

  setActivePlayer(playerIndex) {
    assertPlayerIndex(playerIndex);
    this.activePlayerIndex = playerIndex;
  }

  /**
   * Trägt einen gespielten Zug in den aktuellen Stich ein.
   * Prüft NICHT, ob der Zug regelkonform ist – das ist Sache von rules/moves.
   * Prüft nur die strukturelle Integrität (Spieler-Index, Karte, Position).
   */
  recordPlay({ playerIndex, positionIndex, card }) {
    assertPlayerIndex(playerIndex);
    if (!(card instanceof Card)) {
      throw new Error('GameState.recordPlay: card muss eine Card sein');
    }
    if (
      typeof positionIndex !== 'number' ||
      !Number.isInteger(positionIndex) ||
      positionIndex < 0 ||
      positionIndex >= STACKS_PER_PLAYER
    ) {
      throw new Error(`GameState.recordPlay: ungültiger positionIndex ${positionIndex}`);
    }
    if (this.currentTrick.plays.length >= 2) {
      throw new Error('GameState.recordPlay: aktueller Stich ist bereits voll');
    }
    this.currentTrick.plays.push({ playerIndex, positionIndex, card });
  }

  /**
   * Schließt den aktuellen Stich ab:
   *   - schiebt ihn in completedTricks,
   *   - legt einen neuen currentTrick mit dem Gewinner als Leader an,
   *   - setzt den aktiven Spieler auf den Gewinner.
   *
   * Punkte werden hier NICHT vergeben – das ist Sache von addPoints/addTrick.
   */
  recordCompletedTrick(winnerIndex) {
    assertPlayerIndex(winnerIndex);
    this.completedTricks.push(this.currentTrick);
    this.currentTrick = { leaderIndex: winnerIndex, plays: [] };
    this.activePlayerIndex = winnerIndex;
  }

  addPoints(playerIndex, amount) {
    assertPlayerIndex(playerIndex);
    if (typeof amount !== 'number' || amount < 0) {
      throw new Error('GameState: Punkte müssen eine nicht-negative Zahl sein');
    }
    this.points[playerIndex] += amount;
  }

  addTrick(playerIndex) {
    assertPlayerIndex(playerIndex);
    this.tricksWon[playerIndex] += 1;
  }

  setStoss(playerIndex) {
    assertPlayerIndex(playerIndex);
    this.announcements.stoss = { called: true, by: playerIndex };
  }

  setNochmal(playerIndex) {
    assertPlayerIndex(playerIndex);
    this.announcements.nochmal = { called: true, by: playerIndex };
  }

  // --- Kopie ---------------------------------------------------------------

  clone() {
    const copy = Object.create(GameState.prototype);

    copy.players = this.players.map((p) => p.clone());
    copy.declarerIndex = this.declarerIndex;
    copy.gameType = this.gameType;
    copy.soloSuit = this.soloSuit;

    copy.phase = this.phase;
    copy.activePlayerIndex = this.activePlayerIndex;

    copy.currentTrick = {
      leaderIndex: this.currentTrick.leaderIndex,
      plays: clonePlays(this.currentTrick.plays),
    };
    copy.completedTricks = this.completedTricks.map((t) => ({
      leaderIndex: t.leaderIndex,
      plays: clonePlays(t.plays),
    }));

    copy.points = this.points.slice();
    copy.tricksWon = this.tricksWon.slice();

    copy.announcements = {
      stoss:   { ...this.announcements.stoss },
      nochmal: { ...this.announcements.nochmal },
    };

    return copy;
  }
}