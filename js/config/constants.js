/**
 * constants.js
 * Grundlegende Konstanten für Offiziersschafkopf.
 *
 * Reine Daten – keine Spiellogik. Node- und browserkompatibel (ES-Module).
 * Dateinamen der Kartenbilder folgen dem Muster: `<farbe>-<rang>.png`
 * also z. B. "eichel-ass.png", "herz-koenig.png", "schellen-10.png".
 */

// ---------------------------------------------------------------------------
// Farben
// ---------------------------------------------------------------------------

export const SUITS = Object.freeze({
  EICHEL: 'eichel',
  LAUB: 'laub',
  HERZ: 'herz',
  SCHELLEN: 'schellen',
});

/** Farb-Reihenfolge (für Ober/Unter-Trumpf und Anzeige). */
export const SUIT_ORDER = Object.freeze([
  SUITS.EICHEL,
  SUITS.LAUB,
  SUITS.HERZ,
  SUITS.SCHELLEN,
]);

/** Alle Farben als Array (Alias, praktisch für Iterationen). */
export const ALL_SUITS = SUIT_ORDER;

// ---------------------------------------------------------------------------
// Ränge / Werte
// ---------------------------------------------------------------------------

export const RANKS = Object.freeze({
  ASS: 'ass',
  ZEHN: '10',
  KOENIG: 'koenig',
  OBER: 'ober',
  UNTER: 'unter',
  NEUN: '9',
  ACHT: '8',
  SIEBEN: '7',
});

/** Alle Ränge (absteigend nach „Normalwert" ohne Trumpf-Kontext). */
export const ALL_RANKS = Object.freeze([
  RANKS.ASS,
  RANKS.ZEHN,
  RANKS.KOENIG,
  RANKS.OBER,
  RANKS.UNTER,
  RANKS.NEUN,
  RANKS.ACHT,
  RANKS.SIEBEN,
]);

/**
 * Rangordnung INNERHALB einer Nicht-Trumpf-Farbe beim Farb-Solo.
 * Ober und Unter fehlen komplett, weil sie immer Trumpf sind.
 * Höchster Rang zuerst.
 */
export const SUIT_RANK_ORDER = Object.freeze([
  RANKS.ASS,
  RANKS.ZEHN,
  RANKS.KOENIG,
  RANKS.NEUN,
  RANKS.ACHT,
  RANKS.SIEBEN,
]);

/**
 * Rangordnung INNERHALB einer Nicht-Trumpf-Farbe beim Wenz.
 * Ober ist normale Farbkarte, Unter fehlt (immer Trumpf).
 * Höchster Rang zuerst.
 */
export const WENZ_SUIT_RANK_ORDER = Object.freeze([
  RANKS.ASS,
  RANKS.ZEHN,
  RANKS.KOENIG,
  RANKS.OBER,
  RANKS.NEUN,
  RANKS.ACHT,
  RANKS.SIEBEN,
]);

// ---------------------------------------------------------------------------
// Punkte (Augen)
// ---------------------------------------------------------------------------

export const CARD_POINTS = Object.freeze({
  [RANKS.ASS]: 11,
  [RANKS.ZEHN]: 10,
  [RANKS.KOENIG]: 4,
  [RANKS.OBER]: 3,
  [RANKS.UNTER]: 2,
  [RANKS.NEUN]: 0,
  [RANKS.ACHT]: 0,
  [RANKS.SIEBEN]: 0,
});

/** Gesamtpunkte im Spiel (4 × 11 + 4 × 10 + 4 × 4 + 4 × 3 + 4 × 2). */
export const TOTAL_POINTS = 120;

// ---------------------------------------------------------------------------
// Spielarten
// ---------------------------------------------------------------------------

export const GAME_TYPES = Object.freeze({
  FARB_SOLO: 'farb_solo',
  WENZ: 'wenz',
});

/** Alle im MVP verfügbaren Spielarten. */
export const ALL_GAME_TYPES = Object.freeze([
  GAME_TYPES.FARB_SOLO,
  GAME_TYPES.WENZ,
]);

// ---------------------------------------------------------------------------
// Trumpf-Reihenfolgen
// ---------------------------------------------------------------------------

/**
 * Ober-Reihenfolge als Trumpf (höchster zuerst).
 * Gilt für Farb-Solo. Beim Wenz irrelevant (Ober ist keine Trumpfkarte).
 */
export const OBER_TRUMPF_ORDER = Object.freeze([
  SUITS.EICHEL,
  SUITS.LAUB,
  SUITS.HERZ,
  SUITS.SCHELLEN,
]);

/**
 * Unter-Reihenfolge als Trumpf (höchster zuerst).
 * Gilt für Farb-Solo UND Wenz.
 */
export const UNTER_TRUMPF_ORDER = Object.freeze([
  SUITS.EICHEL,
  SUITS.LAUB,
  SUITS.HERZ,
  SUITS.SCHELLEN,
]);

/**
 * Rangfolge der Trumpf-Karten innerhalb der Solo-Farbe beim Farb-Solo.
 * (Ass > 10 > König > 9 > 8 > 7)
 */
export const SOLO_SUIT_TRUMPF_RANK_ORDER = Object.freeze([
  RANKS.ASS,
  RANKS.ZEHN,
  RANKS.KOENIG,
  RANKS.NEUN,
  RANKS.ACHT,
  RANKS.SIEBEN,
]);

// ---------------------------------------------------------------------------
// Spielziel / Wertung
// ---------------------------------------------------------------------------

/** Ansager braucht mindestens 61 Punkte zum Sieg. */
export const WIN_THRESHOLD = 61;

/** Verlierer mit weniger als 31 Punkten → Schneider. */
export const SCHNEIDER_THRESHOLD = 31;

/** Verlierer ohne einen einzigen Stich → Schwarz. */
export const SCHWARZ_STICHE = 0;

/**
 * Multiplikator für das Spielergebnis.
 * Schwarz ersetzt Schneider (nicht multiplikativ gestapelt).
 */
export const RESULT_MULTIPLIER = Object.freeze({
  NORMAL: 1,
  SCHNEIDER: 2,
  SCHWARZ: 3,
});

// ---------------------------------------------------------------------------
// Ansagen (Stoß / Nochmal)
// ---------------------------------------------------------------------------

export const ANNOUNCEMENTS = Object.freeze({
  STOSS: 'stoss',
  NOCHMAL: 'nochmal',
});

/**
 * Gesamt-Multiplikator auf den Spielwert, wenn die Ansage gefallen ist.
 * Stoß verdoppelt. Nochmal kontert den Stoß und verdoppelt erneut → 4×.
 * (Nochmal ohne vorausgegangenen Stoß ist regelwidrig.)
 */
export const ANNOUNCEMENT_MULTIPLIER = Object.freeze({
  [ANNOUNCEMENTS.STOSS]: 2,
  [ANNOUNCEMENTS.NOCHMAL]: 4,
});

// ---------------------------------------------------------------------------
// Kartenverteilung / Stack-Struktur
// ---------------------------------------------------------------------------

/** Pro Spieler: 8 Stacks (4 in Reihe 1, 4 in Reihe 2), je 1 verdeckt + 1 offen. */
export const STACKS_PER_PLAYER = 8;

/** Karten pro Spieler (8 Stacks × 2 Karten). */
export const CARDS_PER_PLAYER = 16;

/** Gesamtzahl Karten im Deck. */
export const TOTAL_CARDS = 32;

/** Gesamtzahl Stiche pro Partie (32 Karten ÷ 2 Karten pro Stich). */
export const TOTAL_TRICKS = 16;

/** Anzahl Spieler im MVP (reines 2-Personen-Spiel). */
export const PLAYER_COUNT = 2;

// ---------------------------------------------------------------------------
// Asset-Namen
// ---------------------------------------------------------------------------

/** Dateiname des Kartenrückens (relativ zu assets/cards/). */
export const CARD_BACK_IMAGE = 'kartenruecken.png';

/** Dateiname des Platzhalters für leere Positionen (relativ zu assets/cards/). */
export const EMPTY_SLOT_IMAGE = 'leeres-feld.png';

/**
 * Liefert den Dateinamen einer Karte, z. B. "herz-koenig.png".
 * Funktioniert für alle im MVP vorkommenden Karten.
 */
export function cardImageName(suit, rank) {
  return `${suit}-${rank}.png`;
}