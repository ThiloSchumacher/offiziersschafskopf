/**
 * Position.js
 * Ein Stack aus einer verdeckten Karte (unten) und einer offenen Karte (oben).
 *
 * Lebenszyklus einer Position:
 *
 *   leer         hidden=null, open=null   Slot wartet auf Karten.
 *   nur verdeckt hidden=H,    open=null   Nach dealHidden().
 *   voll         hidden=H,    open=O      Nach dealOpen() – spielbar.
 *   nach play()  hidden=H,    open=null   Gespielte Karte weg.
 *   nach reveal()hidden=null, open=H      Verdeckte Karte aufgedeckt.
 *   leer         hidden=null, open=null   Auch die zweite Karte gespielt.
 *
 * `reveal()` wird nicht automatisch durch `play()` ausgelöst – das
 * entscheidet der GameController (typischerweise: alle Positionen eines
 * Stichs werden gemeinsam aufgedeckt, nachdem der Stich ausgewertet ist).
 *
 * Die Klasse ist mutabel: sie repräsentiert einen Platz auf dem Tisch,
 * dessen Zustand sich im Spielverlauf ändert. Die enthaltenen Karten
 * selbst bleiben unveränderlich (Card ist Object.freeze).
 */

import { Card } from './Card.js';

function assertCardOrNull(value, name) {
  if (value !== null && !(value instanceof Card)) {
    throw new Error(`Position: ${name} muss Card oder null sein`);
  }
}

export class Position {
  #hidden;
  #open;

  /**
   * @param {Card|null} hiddenCard
   * @param {Card|null} openCard
   */
  constructor(hiddenCard = null, openCard = null) {
    assertCardOrNull(hiddenCard, 'hiddenCard');
    assertCardOrNull(openCard, 'openCard');
    this.#hidden = hiddenCard;
    this.#open = openCard;
  }

  // --- Zustandsabfragen ----------------------------------------------------

  get hiddenCard() {
    return this.#hidden;
  }

  get openCard() {
    return this.#open;
  }

  /** Beide Felder leer. */
  isEmpty() {
    return this.#hidden === null && this.#open === null;
  }

  /** Kann aus dieser Position gerade gespielt werden? */
  hasPlayableCard() {
    return this.#open !== null;
  }

  /**
   * Die aktuell spielbare Karte oder null.
   * Nur die offene Karte ist spielbar – verdeckte Karten erst nach reveal().
   */
  playableCard() {
    return this.#open;
  }

  // --- Geben (Setup) -------------------------------------------------------

  /**
   * Belegt die verdeckte Karte beim Geben.
   * Nur für den Setup-Pfad gedacht – der GameController ruft das während
   * GEBEN_1 / GEBEN_2 auf. Wirft, wenn bereits belegt.
   */
  dealHidden(card) {
    if (!(card instanceof Card)) {
      throw new Error('Position.dealHidden: card muss eine Card sein');
    }
    if (this.#hidden !== null) {
      throw new Error('Position.dealHidden: verdeckte Karte bereits gesetzt');
    }
    this.#hidden = card;
  }

  /**
   * Belegt die offene Karte beim Geben.
   * Wirft, wenn bereits belegt.
   */
  dealOpen(card) {
    if (!(card instanceof Card)) {
      throw new Error('Position.dealOpen: card muss eine Card sein');
    }
    if (this.#open !== null) {
      throw new Error('Position.dealOpen: offene Karte bereits gesetzt');
    }
    this.#open = card;
  }

  // --- Spielen und Aufdecken -----------------------------------------------

  /**
   * Spielt die offene Karte aus und gibt sie zurück.
   * Wirft, wenn die Position gerade nicht spielbar ist.
   *
   * @returns {Card}
   */
  play() {
    if (this.#open === null) {
      throw new Error('Position.play: keine offene Karte zum Spielen');
    }
    const played = this.#open;
    this.#open = null;
    return played;
  }

  /**
   * Deckt die verdeckte Karte auf: sie wandert auf die offene Position.
   * Wirft, wenn schon eine offene Karte liegt oder die Position leer ist.
   *
   * @returns {Card} die neu aufgedeckte Karte
   */
  reveal() {
    if (this.#hidden === null) {
      throw new Error('Position.reveal: keine verdeckte Karte vorhanden');
    }
    if (this.#open !== null) {
      throw new Error('Position.reveal: Position hat bereits eine offene Karte');
    }
    const revealed = this.#hidden;
    this.#hidden = null;
    this.#open = revealed;
    return revealed;
  }

  // --- Kopie ---------------------------------------------------------------

  /** Flache Kopie – Karten werden geteilt (Card ist immutable). */
  clone() {
    return new Position(this.#hidden, this.#open);
  }

  // --- Serialisierung ------------------------------------------------------

  toJSON() {
    return {
      hidden: this.#hidden ? this.#hidden.toJSON() : null,
      open: this.#open ? this.#open.toJSON() : null,
    };
  }

  static fromJSON(obj) {
    return new Position(
      obj.hidden ? Card.fromJSON(obj.hidden) : null,
      obj.open ? Card.fromJSON(obj.open) : null,
    );
  }
}