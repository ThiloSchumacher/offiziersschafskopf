/**
 * Card.js
 * Eine einzelne Spielkarte.
 *
 * Reine Datenstruktur mit abgeleiteten Werten (Punkte, Bildname).
 * Enthält bewusst KEINE Trumpf-Logik – die gehört in rules/trumpf.js.
 */

import { SUITS, RANKS, CARD_POINTS, cardImageName } from '../config/constants.js';

const VALID_SUITS = new Set(Object.values(SUITS));
const VALID_RANKS = new Set(Object.values(RANKS));

export class Card {
  /**
   * @param {string} suit  eine der SUITS-Werte, z. B. "herz"
   * @param {string} rank  einer der RANKS-Werte, z. B. "koenig"
   */
  constructor(suit, rank) {
    if (!VALID_SUITS.has(suit)) {
      throw new Error(`Card: unbekannte Farbe "${suit}"`);
    }
    if (!VALID_RANKS.has(rank)) {
      throw new Error(`Card: unbekannter Rang "${rank}"`);
    }

    this.suit = suit;
    this.rank = rank;

    // Karten sind unveränderlich – verhindert versehentliche Mutationen
    // im ganzen Spielbaum und macht sie als Map-/Set-Schlüssel nutzbar.
    Object.freeze(this);
  }

  /** Punktwert (Augen) dieser Karte. */
  get points() {
    return CARD_POINTS[this.rank];
  }

  /** Ist das dieselbe Karte (gleiche Farbe UND gleicher Rang)? */
  equals(other) {
    return (
      other instanceof Card &&
      this.suit === other.suit &&
      this.rank === other.rank
    );
  }

  /** Lesbare Kurzform, z. B. "herz-koenig". */
  toString() {
    return `${this.suit}-${this.rank}`;
  }

  /** Dateiname des Kartenbildes, z. B. "herz-koenig.png". */
  toImageName() {
    return cardImageName(this.suit, this.rank);
  }

  /** Serialisierung – z. B. für localStorage oder Debug-Ausgaben. */
  toJSON() {
    return { suit: this.suit, rank: this.rank };
  }

  /** Rekonstruktion aus toJSON()-Ausgabe. */
  static fromJSON(obj) {
    return new Card(obj.suit, obj.rank);
  }
}