/**
 * CardView.js
 * Erzeugt DOM-Elemente für einzelne Karten.
 *
 * Reine Funktionen – keine Klasse, kein Zustand. Die Karte selbst ist
 * immutable, und die Darstellung hängt nur von den übergebenen Optionen ab.
 *
 * Fallback: Wenn das PNG fehlt oder nicht lädt, wird eine CSS-Karte mit
 * Textkürzel gezeichnet (z. B. "H-A", "E-10"). Damit bleibt das Spiel
 * spielbar, auch wenn Assets fehlen.
 *
 * Kartenrücken: lädt assets/cards/kartenruecken.png. Bei Fehler wird auf
 * die CSS-Diagonalstreifen zurückgegriffen.
 */

import { SUITS, RANKS, CARD_BACK_IMAGE } from '../../config/constants.js';

const SUIT_SHORT = {
  [SUITS.EICHEL]: 'E',
  [SUITS.LAUB]: 'L',
  [SUITS.HERZ]: 'H',
  [SUITS.SCHELLEN]: 'S',
};

const RANK_SHORT = {
  [RANKS.ASS]: 'A',
  [RANKS.ZEHN]: '10',
  [RANKS.KOENIG]: 'K',
  [RANKS.OBER]: 'O',
  [RANKS.UNTER]: 'U',
  [RANKS.NEUN]: '9',
  [RANKS.ACHT]: '8',
  [RANKS.SIEBEN]: '7',
};

const RED_SUITS = new Set([SUITS.HERZ, SUITS.SCHELLEN]);

/**
 * @param {Card} card
 * @param {object} [options]
 * @param {boolean} [options.clickable]
 * @param {boolean} [options.dimmed]
 * @param {(card: Card) => void} [options.onClick]
 * @returns {HTMLDivElement}
 */
export function createCardElement(card, options = {}) {
  const { clickable = false, dimmed = false, onClick = null } = options;

  const el = document.createElement('div');
  el.className = 'card';
  if (dimmed) el.classList.add('card--dimmed');
  if (clickable) {
    el.classList.add('card--clickable');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', card.toString());
    if (onClick) {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onClick(card);
      });
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          onClick(card);
        }
      });
    }
  }

  const img = document.createElement('img');
  img.className = 'card__img';
  img.alt = card.toString();
  img.draggable = false;
  img.src = `assets/cards/${card.toImageName()}`;
  img.addEventListener('error', () => {
    el.classList.add('card--fallback');
    if (RED_SUITS.has(card.suit)) el.classList.add('card--red');
    el.textContent = `${SUIT_SHORT[card.suit]}-${RANK_SHORT[card.rank]}`;
    img.remove();
  }, { once: true });

  el.appendChild(img);
  return el;
}

/**
 * Kartenrücken. Lädt assets/cards/kartenruecken.png.
 * Bei Fehler: CSS-Klasse `card--back` zeichnet Diagonalstreifen.
 */
export function createCardBackElement() {
  const el = document.createElement('div');
  el.className = 'card card--back';

  const img = document.createElement('img');
  img.className = 'card__img';
  img.alt = 'Kartenrücken';
  img.draggable = false;
  img.src = `assets/cards/${CARD_BACK_IMAGE}`;
  img.addEventListener('error', () => {
    // CSS-Fallback greift automatisch über .card--back.
    img.remove();
  }, { once: true });

  el.appendChild(img);
  return el;
}

/** Leeres Feld – nur sichtbar, wenn explizit gewünscht. */
export function createEmptyElement() {
  const el = document.createElement('div');
  el.className = 'card card--empty';
  return el;
}