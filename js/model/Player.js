/**
 * Player.js
 * Ein Spieler mit seinen 8 Positionen (2 Reihen à 4 Stacks).
 *
 * Datenhalter. Trifft keine Spielentscheidungen – die kommen vom
 * GameController bzw. der KI.
 *
 * Reihenaufteilung:
 *   Index 0–3  → Reihe 1 (vorne, im UI näher am Tisch)
 *   Index 4–7  → Reihe 2 (hinten)
 * Reine UI-Konvention – die Spiellogik kennt keine Reihen.
 */

import { Position } from './Position.js';
import { STACKS_PER_PLAYER } from '../config/constants.js';

export class Player {
  #name;
  #positions;

  /**
   * @param {string} name
   * @param {Position[]} [positions]  8 Stück; ohne Argument: leere Positionen
   */
  constructor(name, positions) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('Player: Name muss ein nicht-leerer String sein');
    }

    this.#name = name;

    if (positions === undefined) {
      this.#positions = Array.from({ length: STACKS_PER_PLAYER }, () => new Position());
    } else {
      if (!Array.isArray(positions) || positions.length !== STACKS_PER_PLAYER) {
        throw new Error(`Player: benötigt ${STACKS_PER_PLAYER} Positionen`);
      }
      if (!positions.every((p) => p instanceof Position)) {
        throw new Error('Player: alle Einträge müssen Position-Instanzen sein');
      }
      this.#positions = positions.slice();
    }
  }

  get name() {
    return this.#name;
  }

  /** Kopie des Positions-Arrays (Einträge selbst sind die Original-Objekte). */
  get positions() {
    return this.#positions.slice();
  }

  positionAt(index) {
    const pos = this.#positions[index];
    if (!pos) throw new Error(`Player: ungültiger Positions-Index ${index}`);
    return pos;
  }

  /** Indizes aller Positionen, aus denen gerade gespielt werden kann. */
  playableIndices() {
    const result = [];
    for (let i = 0; i < this.#positions.length; i++) {
      if (this.#positions[i].hasPlayableCard()) result.push(i);
    }
    return result;
  }

  /** Sind überhaupt noch Karten auf der Hand (verdeckt oder offen)? */
  hasCards() {
    return this.#positions.some((p) => !p.isEmpty());
  }

  /** Anzahl der noch vorhandenen Karten (verdeckt + offen). */
  cardCount() {
    let count = 0;
    for (const p of this.#positions) {
      if (p.hiddenCard !== null) count++;
      if (p.openCard !== null) count++;
    }
    return count;
  }

  /**
   * Spielt die offene Karte an dieser Position aus und liefert sie zurück.
   * @returns {Card}
   */
  playAt(index) {
    return this.positionAt(index).play();
  }

  /**
   * Deckt die verdeckte Karte dieser Position auf.
   * @returns {Card}
   */
  revealAt(index) {
    return this.positionAt(index).reveal();
  }

  /**
   * Deckt alle Positionen auf, die gespielt wurden, aber noch verdeckt sind.
   * Wird nach Abschluss eines Stichs aufgerufen.
   * @returns {{index:number, card:Card}[]}
   */
  revealAll() {
    const revealed = [];
    for (let i = 0; i < this.#positions.length; i++) {
      const pos = this.#positions[i];
      if (pos.hiddenCard !== null && pos.openCard === null) {
        revealed.push({ index: i, card: pos.reveal() });
      }
    }
    return revealed;
  }

  /**
   * Findet den Index der Position, die gerade diese Karte offen zeigt.
   * @returns {number}  Index, oder -1 wenn nicht gefunden
   */
  findPositionWithCard(card) {
    for (let i = 0; i < this.#positions.length; i++) {
      const open = this.#positions[i].openCard;
      if (open && open.equals(card)) return i;
    }
    return -1;
  }

  clone() {
    return new Player(this.#name, this.#positions.map((p) => p.clone()));
  }
}