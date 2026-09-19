import { describe, test, assert } from './test-runner.js';
import { Card } from '../js/model/Card.js';
import {
  SUITS, RANKS, GAME_TYPES,
} from '../js/config/constants.js';
import { PHASES } from '../js/game/phases.js';
import { evaluateMove, chooseMove } from '../js/ai/HeuristicAI.js';

const { FARB_SOLO, WENZ } = GAME_TYPES;
const c = (s, r) => new Card(s, r);

function makeView(overrides = {}) {
  return {
    playerIndex: 0,
    opponentIndex: 1,
    gameType: FARB_SOLO,
    soloSuit: SUITS.HERZ,
    phase: PHASES.SPIELEN,
    myOpenCards: [],
    oppOpenCards: [],
    currentTrick: { leaderIndex: 0, plays: [] },
    playedCards: [],
    myPoints: 0,
    oppPoints: 0,
    myTricks: 0,
    oppTricks: 0,
    completedTricksCount: 0,
    totalTricks: 16,
    totalPoints: 120,
    announcements: {
      stoss: { called: false, by: null },
      nochmal: { called: false, by: null },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Vorbedingungen
// ---------------------------------------------------------------------------

describe('HeuristicAI – Vorbedingungen', () => {
  test('chooseMove wirft bei leerer Indexliste', () => {
    const v = makeView();
    assert.throws(() => chooseMove(v, []));
    assert.throws(() => chooseMove(v, null));
  });

  test('chooseMove wirft, wenn Index nicht in myOpenCards ist', () => {
    const v = makeView({
      myOpenCards: [{ positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) }],
    });
    assert.throws(() => chooseMove(v, [5]));
  });
});

// ---------------------------------------------------------------------------
// Führend: was wird angespielt?
// ---------------------------------------------------------------------------

describe('HeuristicAI – führend', () => {
  test('bevorzugt Nicht-Trumpf-Ass gegenüber anderen Nicht-Trumpf-Karten', () => {
    const v = makeView({
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) },
        { positionIndex: 1, card: c(SUITS.EICHEL, RANKS.KOENIG) },
      ],
    });
    assert.equal(chooseMove(v, [0, 1]), 0);
  });

  test('bevorzugt höchsten Trumpf (Eichel-Ober) beim Anspielen', () => {
    const v = makeView({
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.HERZ, RANKS.ASS) }, // Solo-Trumpf
        { positionIndex: 1, card: c(SUITS.EICHEL, RANKS.OBER) }, // höchster Trumpf
      ],
    });
    assert.equal(chooseMove(v, [0, 1]), 1);
  });

  test('bevorzugt 0-Punkte-Karte gegenüber einer 10, wenn keine Asse/Trumpf-Top', () => {
    const v = makeView({
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.EICHEL, RANKS.SIEBEN) },
        { positionIndex: 1, card: c(SUITS.EICHEL, RANKS.ZEHN) },
      ],
    });
    assert.equal(chooseMove(v, [0, 1]), 0);
  });
});

// ---------------------------------------------------------------------------
// Zweiter: gewinnen oder abwerfen?
// ---------------------------------------------------------------------------

describe('HeuristicAI – als Zweiter', () => {
  test('gewinnt einen wertvollen Stich mit Trumpf statt abzuwerfen', () => {
    // Gegner führt Eichel-Ass (11). Wir können mit Herz-Sieben (Trumpf) gewinnen.
    const v = makeView({
      soloSuit: SUITS.HERZ,
      currentTrick: {
        leaderIndex: 1,
        plays: [{ playerIndex: 1, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) }],
      },
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.HERZ, RANKS.SIEBEN) }, // Trumpf, gewinnt
        { positionIndex: 1, card: c(SUITS.EICHEL, RANKS.SIEBEN) }, // verliert
      ],
    });
    assert.equal(chooseMove(v, [0, 1]), 0);
  });

  test('wirft 0-Punkte-Karte ab, wenn Gewinn nicht möglich', () => {
    // Gegner führt Trumpf-Ass. Wir können nicht gewinnen.
    const v = makeView({
      soloSuit: SUITS.HERZ,
      currentTrick: {
        leaderIndex: 1,
        plays: [{ playerIndex: 1, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.OBER) }],
      },
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ZEHN) }, // verliert, 10 Punkte
        { positionIndex: 1, card: c(SUITS.EICHEL, RANKS.SIEBEN) }, // verliert, 0 Punkte
      ],
    });
    assert.equal(chooseMove(v, [0, 1]), 1);
  });

  test('gewinnende 0-Punkte-Trumpf wird der gewinnenden 10 vorgezogen (Effizienz)', () => {
    // Gegner führt Herz-Ass (Solo-Farbe = Trumpf). Wir können mit Herz-10
    // (10 Punkte) oder Herz-Sieben (0 Punkte, Trumpf) gewinnen.
    const v = makeView({
      soloSuit: SUITS.HERZ,
      currentTrick: {
        leaderIndex: 1,
        plays: [{ playerIndex: 1, positionIndex: 0, card: c(SUITS.HERZ, RANKS.ASS) }],
      },
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.HERZ, RANKS.ZEHN) }, // Trumpf, gewinnt, 10 P
        { positionIndex: 1, card: c(SUITS.HERZ, RANKS.SIEBEN) }, // Trumpf, gewinnt, 0 P
      ],
    });
    assert.equal(chooseMove(v, [0, 1]), 1);
  });
});

// ---------------------------------------------------------------------------
// Determinismus
// ---------------------------------------------------------------------------

describe('HeuristicAI – Determinismus', () => {
  test('gleiche Situation → gleiche Wahl', () => {
    const v1 = makeView({
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) },
        { positionIndex: 1, card: c(SUITS.EICHEL, RANKS.KOENIG) },
      ],
    });
    const v2 = makeView({
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) },
        { positionIndex: 1, card: c(SUITS.EICHEL, RANKS.KOENIG) },
      ],
    });
    assert.equal(chooseMove(v1, [0, 1]), chooseMove(v2, [0, 1]));
  });

  test('bei Score-Gleichstand gewinnt der niedrigere Index', () => {
    const v = makeView({
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.EICHEL, RANKS.SIEBEN) },
        { positionIndex: 1, card: c(SUITS.LAUB, RANKS.SIEBEN) },
      ],
    });
    // Beide Karten sind identisch bewertet → Index 0 gewinnt.
    assert.equal(chooseMove(v, [0, 1]), 0);
  });
});

// ---------------------------------------------------------------------------
// Wenz-Variante
// ---------------------------------------------------------------------------

describe('HeuristicAI – Wenz', () => {
  test('Unter wird als Trumpf erkannt', () => {
    const v = makeView({
      gameType: WENZ,
      soloSuit: null,
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.EICHEL, RANKS.UNTER) },
        { positionIndex: 1, card: c(SUITS.EICHEL, RANKS.ASS) },
      ],
    });
    // Eichel-Unter ist top-Trumpf, sollte bevorzugt werden.
    assert.equal(chooseMove(v, [0, 1]), 0);
  });
});

// ---------------------------------------------------------------------------
// Fairness: die KI sieht keine verdeckten Karten
// ---------------------------------------------------------------------------

describe('HeuristicAI – Fairness', () => {
  test('chooseMove stürzt nicht ab, wenn myOpenCards nur die legalen Karten enthält', () => {
    // So sieht die Realität aus: nur die 8 offenen Karten sind drin.
    const v = makeView({
      myOpenCards: [
        { positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) },
        { positionIndex: 2, card: c(SUITS.LAUB, RANKS.ZEHN) },
      ],
    });
    // Beide Indizes sind legal, also funktioniert es.
    const pick = chooseMove(v, [0, 2]);
    assert.ok(pick === 0 || pick === 2);
  });
});