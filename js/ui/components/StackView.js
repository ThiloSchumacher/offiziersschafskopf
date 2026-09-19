/**
 * StackView.js
 * Erzeugt das DOM für einen Stack (verdeckte Karte unten + offene oben)
 * oder für einen einzelnen Kartenplatz.
 *
 * Zustände einer Position und ihre Darstellung:
 *
 *   hidden + open    → Rücken (unter) + Karte (oben)        [normal]
 *   hidden, open=null→ Rücken allein                        [nach play, vor reveal]
 *   open allein      → Karte allein                         [nach reveal]
 *   leer             → nichts (Slot bleibt ungenutzt)
 *
 * Verdeckte Karten werden IMMER als Rücken gezeigt – auch für den
 * Besitzer. Erst nach reveal() wird die ehemals verdeckte Karte sichtbar.
 */

import { createCardElement, createCardBackElement } from './CardView.js';

/**
 * @param {Position} position
 * @param {object} [options]
 * @param {boolean} [options.clickable]  ob die obere Karte klickbar ist
 * @param {boolean} [options.dimmed]
 * @param {(card: Card) => void} [options.onClick]
 * @returns {HTMLElement|null}  null, wenn Position leer
 */
export function createStackElement(position, options = {}) {
  if (position.isEmpty()) return null;

  const { hiddenCard, openCard } = position;

  // Nur eine Karte – kein Stack nötig.
  if (hiddenCard === null && openCard !== null) {
    return createCardElement(openCard, options);
  }
  if (hiddenCard !== null && openCard === null) {
    return createCardBackElement();
  }

  // Beide vorhanden – gestapelt.
  const stack = document.createElement('div');
  stack.className = 'stack';

  const under = createCardBackElement();
  under.classList.add('stack__under');

  const top = createCardElement(openCard, options);
  top.classList.add('stack__top');

  stack.appendChild(under);
  stack.appendChild(top);
  return stack;
}