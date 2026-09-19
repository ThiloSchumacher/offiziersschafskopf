/**
 * Deck.js
 * Ein 32-Karten-Deck (bayerisches Blatt).
 *
 * Erzeugung und Mischen liegen hier. Karten werden per draw() entnommen.
 * Das Deck ist absichtlich mutabel – "ziehen" heißt "weniger Karten".
 * Für Momentaufnahmen gibt es toArray().
 */

import { SUITS, RANKS, TOTAL_CARDS } from '../config/constants.js';
import { Card } from './Card.js';
import { shuffle } from '../utils/shuffle.js';

/** Baut die 32 Standardkarten in fester Reihenfolge (Farbe × Rang). */
function createStandardCards() {
  const cards = [];
  for (const suit of Object.values(SUITS)) {
    for (const rank of Object.values(RANKS)) {
      cards.push(new Card(suit, rank));
    }
  }
  return cards;
}

export class Deck {
  #cards;

  /** @param {Card[]} cards */
  constructor(cards) {
    this.#cards = cards.slice();
  }

  /** Frisches, ungemischtes Deck in fester Reihenfolge. */
  static create() {
    return new Deck(createStandardCards());
  }

  /**
   * Frisches, gemischtes Deck.
   * @param {() => number} [rng]  optionaler Zufallsgenerator
   */
  static shuffled(rng = Math.random) {
    return new Deck(shuffle(createStandardCards(), rng));
  }

  /** Anzahl noch verbleibender Karten. */
  get size() {
    return this.#cards.length;
  }

  /** Momentaufnahme aller Karten (Kopie). */
  toArray() {
    return this.#cards.slice();
  }

  /** Zieht die oberste Karte und entfernt sie aus dem Deck. */
  draw() {
    if (this.#cards.length === 0) {
      throw new Error('Deck ist leer');
    }
    return this.#cards.pop();
  }

  /** Zieht n Karten als Array – Reihenfolge: erste gezogene zuerst. */
  drawMany(n) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      drawn.push(this.draw());
    }
    return drawn;
  }
}