import { describe, test, assert } from './test-runner.js';
import { GameState } from '../js/model/GameState.js';
import { Player } from '../js/model/Player.js';
import { Position } from '../js/model/Position.js';
import { Card } from '../js/model/Card.js';
import {
  SUITS, RANKS, GAME_TYPES, STACKS_PER_PLAYER,
} from '../js/config/constants.js';
import {
  playCategory, playablePositions, legalMoves, isLegalMove, legalMovesWithCards,
} from '../js/rules/moves.js';

const { FARB_SOLO, WENZ } = GAME_TYPES;
const c = (s, r) => new Card(s, r);

// ---------------------------------------------------------------------------
// Testhelfer
// ---------------------------------------------------------------------------

/** Position mit offener Karte; verdeckt ist ein unauffälliger Filler. */
function filled(openCard) {
  return new Position(c(SUITS.HERZ, RANKS.SIEBEN), openCard);
}

function empty() {
  return new Position(null, null);
}

/** Spieler mit gegebener Liste offener Karten; restliche Positionen leer. */
function playerWith(name, cards) {
  const positions = [];
  for (let i = 0; i < STACKS_PER_PLAYER; i++) {
    positions.push(i < cards.length ? filled(cards[i]) : empty());
  }
  return new Player(name, positions);
}

/**
 * Baut einen State mit einem bereits ausgespielten Lead.
 * `leaderIdx` bestimmt, wer geführt hat. Aktiver Spieler ist der andere.
 */
function stateWithLead({ leaderIdx = 0, leaderCards, followerCards, gameType, soloSuit = null }) {
  const p0Cards = leaderIdx === 0 ? leaderCards : followerCards;
  const p1Cards = leaderIdx === 0 ? followerCards : leaderCards;

  const state = new GameState({
    players: [playerWith('P0', p0Cards), playerWith('P1', p1Cards)],
    declarerIndex: 0,
    gameType,
    soloSuit,
  });

  const leadCard = leaderCards[0];
  state.currentTrick.plays.push({
    playerIndex: leaderIdx,
    positionIndex: 0,
    card: leadCard,
  });
  state.activePlayerIndex = 1 - leaderIdx;
  return state;
}

// ---------------------------------------------------------------------------
// Vorbedingungen
// ---------------------------------------------------------------------------

describe('moves – Vorbedingungen', () => {
  test('wirft, wenn gameType null ist', () => {
    const s = new GameState({
      players: [playerWith('A', []), playerWith('B', [])],
      declarerIndex: 0,
    });
    assert.throws(() => legalMoves(s));
    assert.throws(() => isLegalMove(s, 0));
    assert.throws(() => playablePositions(s));
  });

  test('wirft bei ungültigem positionIndex', () => {
    const s = new GameState({
      players: [playerWith('A', [c(SUITS.HERZ, RANKS.ASS)]), playerWith('B', [])],
      declarerIndex: 0,
      gameType: WENZ,
    });
    assert.throws(() => isLegalMove(s, 8));
    assert.throws(() => isLegalMove(s, -1));
  });

  test('wirft, wenn Position nicht spielbar ist (leer)', () => {
    const s = new GameState({
      players: [playerWith('A', [c(SUITS.HERZ, RANKS.ASS)]), playerWith('B', [])],
      declarerIndex: 0,
      gameType: WENZ,
    });
    // Position 1 ist leer.
    assert.throws(() => isLegalMove(s, 1));
  });

  test('wirft, wenn aktueller Stich bereits voll ist', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.HERZ, RANKS.ASS)],
      followerCards: [c(SUITS.HERZ, RANKS.ZEHN)],
      gameType: FARB_SOLO,
      soloSuit: SUITS.SCHELLEN,
    });
    s.currentTrick.plays.push({
      playerIndex: 1,
      positionIndex: 0,
      card: c(SUITS.HERZ, RANKS.ZEHN),
    });
    assert.throws(() => legalMoves(s));
  });
});

// ---------------------------------------------------------------------------
// Erster Spieler im Stich
// ---------------------------------------------------------------------------

describe('moves – Erster Spieler im Stich', () => {
  test('hat freie Wahl unter allen spielbaren Positionen', () => {
    const s = new GameState({
      players: [
        playerWith('A', [
          c(SUITS.EICHEL, RANKS.ASS),
          c(SUITS.LAUB, RANKS.ZEHN),
          c(SUITS.HERZ, RANKS.OBER),
        ]),
        playerWith('B', []),
      ],
      declarerIndex: 0,
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    assert.deepEqual(legalMoves(s), [0, 1, 2]);
    assert.equal(playablePositions(s).length, 3);
  });

  test('überspringt leere Positionen', () => {
    const s = new GameState({
      players: [
        playerWith('A', [c(SUITS.EICHEL, RANKS.ASS)]),
        playerWith('B', []),
      ],
      declarerIndex: 0,
      gameType: WENZ,
    });
    assert.deepEqual(legalMoves(s), [0]);
  });
});

// ---------------------------------------------------------------------------
// Bedienpflicht – Farb-Solo
// ---------------------------------------------------------------------------

describe('moves – Bedienpflicht (Farb-Solo, Solo = Herz)', () => {
  const solo = SUITS.HERZ;

  test('Lead Trumpf → Trumpfzwang', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.EICHEL, RANKS.OBER)], // Trumpf
      followerCards: [
        c(SUITS.EICHEL, RANKS.ASS),  // Nicht-Trumpf (Eichel)
        c(SUITS.HERZ, RANKS.SIEBEN), // Trumpf (Solo-Farbe)
        c(SUITS.LAUB, RANKS.UNTER),  // Trumpf
      ],
      gameType: FARB_SOLO,
      soloSuit: solo,
    });
    assert.deepEqual(legalMoves(s), [1, 2]);
  });

  test('Lead Trumpf, kein Trumpf auf der Hand → freie Wahl', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.EICHEL, RANKS.OBER)],
      followerCards: [
        c(SUITS.EICHEL, RANKS.ASS),
        c(SUITS.LAUB, RANKS.ASS),
      ],
      gameType: FARB_SOLO,
      soloSuit: solo,
    });
    assert.deepEqual(legalMoves(s), [0, 1]);
  });

  test('Lead Nicht-Trumpf → Farbzwang', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.EICHEL, RANKS.ASS)], // Eichel, kein Trumpf
      followerCards: [
        c(SUITS.EICHEL, RANKS.ZEHN),   // bedient
        c(SUITS.EICHEL, RANKS.KOENIG), // bedient
        c(SUITS.LAUB, RANKS.ASS),      // andere Farbe
        c(SUITS.HERZ, RANKS.SIEBEN),   // Trumpf (Solo = Herz)
      ],
      gameType: FARB_SOLO,
      soloSuit: solo,
    });
    assert.deepEqual(legalMoves(s), [0, 1]);
  });

  test('Eichel-Ober zählt NICHT als Eichel (ist Trumpf)', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.EICHEL, RANKS.ASS)], // Eichel
      followerCards: [
        c(SUITS.EICHEL, RANKS.OBER), // Trumpf, NICHT Eichel für Bedienung
        c(SUITS.LAUB, RANKS.ZEHN),   // andere Farbe
      ],
      gameType: FARB_SOLO,
      soloSuit: solo,
    });
    // Kein Eichel-Nicht-Trumpf vorhanden → freie Wahl.
    assert.deepEqual(legalMoves(s), [0, 1]);
  });

  test('Lead Nicht-Trumpf, keine Karte der Farbe → freie Wahl inkl. Trumpf', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.SCHELLEN, RANKS.ASS)],
      followerCards: [
        c(SUITS.LAUB, RANKS.ASS),
        c(SUITS.HERZ, RANKS.ASS),     // Trumpf
        c(SUITS.EICHEL, RANKS.UNTER), // Trumpf
      ],
      gameType: FARB_SOLO,
      soloSuit: solo,
    });
    assert.deepEqual(legalMoves(s), [0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Bedienpflicht – Wenz
// ---------------------------------------------------------------------------

describe('moves – Bedienpflicht (Wenz)', () => {
  test('Lead Unter → Unterzwang', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.EICHEL, RANKS.UNTER)],
      followerCards: [
        c(SUITS.HERZ, RANKS.UNTER),    // Trumpf
        c(SUITS.EICHEL, RANKS.ASS),    // nicht Trumpf
        c(SUITS.SCHELLEN, RANKS.UNTER),// Trumpf
      ],
      gameType: WENZ,
    });
    assert.deepEqual(legalMoves(s), [0, 2]);
  });

  test('Lead Ober → Ober ist normale Farbkarte', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.EICHEL, RANKS.OBER)], // Eichel (nicht Trumpf)
      followerCards: [
        c(SUITS.EICHEL, RANKS.ASS),   // Eichel, bedient
        c(SUITS.EICHEL, RANKS.ZEHN),  // Eichel, bedient
        c(SUITS.HERZ, RANKS.UNTER),   // Trumpf
      ],
      gameType: WENZ,
    });
    assert.deepEqual(legalMoves(s), [0, 1]);
  });

  test('Lead Nicht-Trumpf: Unter zählt nicht als Farbe', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.EICHEL, RANKS.ASS)],
      followerCards: [
        c(SUITS.EICHEL, RANKS.UNTER), // Trumpf – NICHT Eichel
        c(SUITS.LAUB, RANKS.KOENIG),
      ],
      gameType: WENZ,
    });
    assert.deepEqual(legalMoves(s), [0, 1]);
  });
});

// ---------------------------------------------------------------------------
// isLegalMove
// ---------------------------------------------------------------------------

describe('moves – isLegalMove', () => {
  test('true für legale, false für regelwidrige Züge', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.EICHEL, RANKS.ASS)], // Eichel
      followerCards: [
        c(SUITS.EICHEL, RANKS.ZEHN),  // bedient → legal
        c(SUITS.LAUB, RANKS.ASS),     // andere Farbe → illegal
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    assert.ok(isLegalMove(s, 0));
    assert.ok(!isLegalMove(s, 1));
  });

  test('deckt sich mit legalMoves()', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.SCHELLEN, RANKS.ASS)],
      followerCards: [
        c(SUITS.SCHELLEN, RANKS.ZEHN),
        c(SUITS.SCHELLEN, RANKS.KOENIG),
        c(SUITS.LAUB, RANKS.ASS),
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    const legal = new Set(legalMoves(s));
    for (const idx of [0, 1, 2]) {
      assert.equal(isLegalMove(s, idx), legal.has(idx));
    }
  });
});

// ---------------------------------------------------------------------------
// playCategory und legalMovesWithCards
// ---------------------------------------------------------------------------

describe('moves – playCategory', () => {
  test('Farb-Solo: Ober/Unter/Solo-Farbe = trumpf', () => {
    assert.equal(playCategory(c(SUITS.EICHEL, RANKS.OBER), FARB_SOLO, SUITS.HERZ), 'trumpf');
    assert.equal(playCategory(c(SUITS.LAUB, RANKS.UNTER), FARB_SOLO, SUITS.HERZ), 'trumpf');
    assert.equal(playCategory(c(SUITS.HERZ, RANKS.SIEBEN), FARB_SOLO, SUITS.HERZ), 'trumpf');
  });

  test('Farb-Solo: Fremdfarbe = ihre Farbe', () => {
    assert.equal(playCategory(c(SUITS.EICHEL, RANKS.ASS), FARB_SOLO, SUITS.HERZ), SUITS.EICHEL);
  });

  test('Wenz: nur Unter = trumpf, Ober = Farbe', () => {
    assert.equal(playCategory(c(SUITS.EICHEL, RANKS.UNTER), WENZ), 'trumpf');
    assert.equal(playCategory(c(SUITS.EICHEL, RANKS.OBER), WENZ), SUITS.EICHEL);
  });
});

describe('moves – legalMovesWithCards', () => {
  test('liefert Position und Karte der legalen Züge', () => {
    const s = stateWithLead({
      leaderCards: [c(SUITS.EICHEL, RANKS.ASS)],
      followerCards: [
        c(SUITS.EICHEL, RANKS.ZEHN),
        c(SUITS.LAUB, RANKS.ASS),
        c(SUITS.EICHEL, RANKS.KOENIG),
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    const moves = legalMovesWithCards(s);
    assert.equal(moves.length, 2);
    assert.deepEqual(moves.map((m) => m.positionIndex), [0, 2]);
    assert.ok(moves[0].card.equals(c(SUITS.EICHEL, RANKS.ZEHN)));
    assert.ok(moves[1].card.equals(c(SUITS.EICHEL, RANKS.KOENIG)));
  });
});