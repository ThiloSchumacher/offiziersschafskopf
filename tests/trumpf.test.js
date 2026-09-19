import { describe, test, assert } from './test-runner.js';
import { Card } from '../js/model/Card.js';
import {
  SUITS,
  RANKS,
  GAME_TYPES,
} from '../js/config/constants.js';
import {
  isTrumpf,
  trumpfRank,
  suitRank,
  beats,
  trumpfCount,
} from '../js/rules/trumpf.js';

const { FARB_SOLO, WENZ } = GAME_TYPES;

const card = (suit, rank) => new Card(suit, rank);

describe('isTrumpf – Farb-Solo (Solo = Herz)', () => {
  const solo = SUITS.HERZ;
  const T = (c) => isTrumpf(c, FARB_SOLO, solo);

  test('alle Ober sind Trumpf', () => {
    for (const s of Object.values(SUITS)) {
      assert.ok(T(card(s, RANKS.OBER)), `Ober ${s}`);
    }
  });

  test('alle Unter sind Trumpf', () => {
    for (const s of Object.values(SUITS)) {
      assert.ok(T(card(s, RANKS.UNTER)), `Unter ${s}`);
    }
  });

  test('alle Karten der Solo-Farbe sind Trumpf', () => {
    for (const r of Object.values(RANKS)) {
      assert.ok(T(card(SUITS.HERZ, r)), `Herz ${r}`);
    }
  });

  test('Fremdfarben-Ass/König/10/9/8/7 sind kein Trumpf', () => {
    const nonTrumpfRanks = [RANKS.ASS, RANKS.ZEHN, RANKS.KOENIG, RANKS.NEUN, RANKS.ACHT, RANKS.SIEBEN];
    for (const s of [SUITS.EICHEL, SUITS.LAUB, SUITS.SCHELLEN]) {
      for (const r of nonTrumpfRanks) {
        assert.ok(!T(card(s, r)), `${s} ${r} sollte kein Trumpf sein`);
      }
    }
  });

  test('genau 14 Trumpfkarten im Deck', () => {
    let count = 0;
    for (const s of Object.values(SUITS)) {
      for (const r of Object.values(RANKS)) {
        if (T(card(s, r))) count++;
      }
    }
    assert.equal(count, trumpfCount(FARB_SOLO));
  });

  test('wirft ohne soloSuit', () => {
    assert.throws(() => isTrumpf(card(SUITS.HERZ, RANKS.ASS), FARB_SOLO));
  });
});

describe('isTrumpf – Wenz', () => {
  const T = (c) => isTrumpf(c, WENZ);

  test('nur die Unter sind Trumpf', () => {
    for (const s of Object.values(SUITS)) {
      assert.ok(T(card(s, RANKS.UNTER)), `Unter ${s}`);
    }
  });

  test('Ober ist kein Trumpf beim Wenz', () => {
    for (const s of Object.values(SUITS)) {
      assert.ok(!T(card(s, RANKS.OBER)), `Ober ${s}`);
    }
  });

  test('Ass/König/10/9/8/7 aller Farben sind kein Trumpf', () => {
    const nonTrumpfRanks = [RANKS.ASS, RANKS.ZEHN, RANKS.KOENIG, RANKS.NEUN, RANKS.ACHT, RANKS.SIEBEN];
    for (const s of Object.values(SUITS)) {
      for (const r of nonTrumpfRanks) {
        assert.ok(!T(card(s, r)), `${s} ${r} sollte kein Trumpf sein`);
      }
    }
  });

  test('genau 4 Trumpfkarten', () => {
    let count = 0;
    for (const s of Object.values(SUITS)) {
      for (const r of Object.values(RANKS)) {
        if (T(card(s, r))) count++;
      }
    }
    assert.equal(count, trumpfCount(WENZ));
  });
});

describe('trumpfRank – Farb-Solo (Solo = Herz)', () => {
  const solo = SUITS.HERZ;
  const R = (s, r) => trumpfRank(card(s, r), FARB_SOLO, solo);

  test('Ober 1–4: Eichel, Laub, Herz, Schellen', () => {
    assert.equal(R(SUITS.EICHEL, RANKS.OBER), 1);
    assert.equal(R(SUITS.LAUB, RANKS.OBER), 2);
    assert.equal(R(SUITS.HERZ, RANKS.OBER), 3);
    assert.equal(R(SUITS.SCHELLEN, RANKS.OBER), 4);
  });

  test('Unter 5–8: Eichel, Laub, Herz, Schellen', () => {
    assert.equal(R(SUITS.EICHEL, RANKS.UNTER), 5);
    assert.equal(R(SUITS.LAUB, RANKS.UNTER), 6);
    assert.equal(R(SUITS.HERZ, RANKS.UNTER), 7);
    assert.equal(R(SUITS.SCHELLEN, RANKS.UNTER), 8);
  });

  test('Solo-Farbe 9–14: Ass, 10, König, 9, 8, 7', () => {
    assert.equal(R(SUITS.HERZ, RANKS.ASS), 9);
    assert.equal(R(SUITS.HERZ, RANKS.ZEHN), 10);
    assert.equal(R(SUITS.HERZ, RANKS.KOENIG), 11);
    assert.equal(R(SUITS.HERZ, RANKS.NEUN), 12);
    assert.equal(R(SUITS.HERZ, RANKS.ACHT), 13);
    assert.equal(R(SUITS.HERZ, RANKS.SIEBEN), 14);
  });

  test('Nicht-Trumpf liefert null', () => {
    assert.equal(R(SUITS.EICHEL, RANKS.ASS), null);
    assert.equal(R(SUITS.LAUB, RANKS.ZEHN), null);
  });
});

describe('trumpfRank – Wenz', () => {
  const R = (s, r) => trumpfRank(card(s, r), WENZ);

  test('Unter 1–4: Eichel, Laub, Herz, Schellen', () => {
    assert.equal(R(SUITS.EICHEL, RANKS.UNTER), 1);
    assert.equal(R(SUITS.LAUB, RANKS.UNTER), 2);
    assert.equal(R(SUITS.HERZ, RANKS.UNTER), 3);
    assert.equal(R(SUITS.SCHELLEN, RANKS.UNTER), 4);
  });

  test('Ober, Ass, König etc. liefern null', () => {
    assert.equal(R(SUITS.EICHEL, RANKS.OBER), null);
    assert.equal(R(SUITS.HERZ, RANKS.ASS), null);
  });
});

describe('suitRank', () => {
  test('Farb-Solo: Ober liefert null (ist Trumpf)', () => {
    assert.equal(suitRank(card(SUITS.HERZ, RANKS.OBER), FARB_SOLO), null);
  });

  test('Farb-Solo: Unter liefert null (ist Trumpf)', () => {
    assert.equal(suitRank(card(SUITS.HERZ, RANKS.UNTER), FARB_SOLO), null);
  });

  test('Farb-Solo: Ass=0, 10=1, König=2, 9=3, 8=4, 7=5', () => {
    assert.equal(suitRank(card(SUITS.EICHEL, RANKS.ASS), FARB_SOLO), 0);
    assert.equal(suitRank(card(SUITS.EICHEL, RANKS.ZEHN), FARB_SOLO), 1);
    assert.equal(suitRank(card(SUITS.EICHEL, RANKS.KOENIG), FARB_SOLO), 2);
    assert.equal(suitRank(card(SUITS.EICHEL, RANKS.NEUN), FARB_SOLO), 3);
    assert.equal(suitRank(card(SUITS.EICHEL, RANKS.ACHT), FARB_SOLO), 4);
    assert.equal(suitRank(card(SUITS.EICHEL, RANKS.SIEBEN), FARB_SOLO), 5);
  });

  test('Wenz: Unter liefert null (ist Trumpf)', () => {
    assert.equal(suitRank(card(SUITS.HERZ, RANKS.UNTER), WENZ), null);
  });

  test('Wenz: Ober ist normale Farbkarte mit Rang 3', () => {
    assert.equal(suitRank(card(SUITS.HERZ, RANKS.OBER), WENZ), 3);
  });

  test('Wenz: Ass=0, 10=1, König=2, Ober=3, 9=4, 8=5, 7=6', () => {
    assert.equal(suitRank(card(SUITS.LAUB, RANKS.ASS), WENZ), 0);
    assert.equal(suitRank(card(SUITS.LAUB, RANKS.ZEHN), WENZ), 1);
    assert.equal(suitRank(card(SUITS.LAUB, RANKS.KOENIG), WENZ), 2);
    assert.equal(suitRank(card(SUITS.LAUB, RANKS.OBER), WENZ), 3);
    assert.equal(suitRank(card(SUITS.LAUB, RANKS.NEUN), WENZ), 4);
    assert.equal(suitRank(card(SUITS.LAUB, RANKS.ACHT), WENZ), 5);
    assert.equal(suitRank(card(SUITS.LAUB, RANKS.SIEBEN), WENZ), 6);
  });
});

describe('beats – Farb-Solo (Solo = Herz)', () => {
  const solo = SUITS.HERZ;
  const B = (a, b) => beats(a, b, FARB_SOLO, solo);

  test('Trumpf schlägt Nicht-Trumpf', () => {
    assert.ok(B(card(SUITS.HERZ, RANKS.SIEBEN), card(SUITS.EICHEL, RANKS.ASS)));
    assert.ok(B(card(SUITS.EICHEL, RANKS.UNTER), card(SUITS.LAUB, RANKS.ASS)));
  });

  test('Nicht-Trumpf schlägt keinen Trumpf', () => {
    assert.ok(!B(card(SUITS.EICHEL, RANKS.ASS), card(SUITS.HERZ, RANKS.SIEBEN)));
  });

    test('Trumpf vs. Trumpf: niedrigerer trumpfRank gewinnt', () => {
    // Ober untereinander
    assert.ok(B(card(SUITS.EICHEL, RANKS.OBER), card(SUITS.LAUB, RANKS.OBER)));
    assert.ok(!B(card(SUITS.LAUB, RANKS.OBER), card(SUITS.EICHEL, RANKS.OBER)));

    // Ober schlägt Unter
    assert.ok(B(card(SUITS.EICHEL, RANKS.OBER), card(SUITS.EICHEL, RANKS.UNTER)));
    assert.ok(!B(card(SUITS.EICHEL, RANKS.UNTER), card(SUITS.EICHEL, RANKS.OBER)));

    // Unter schlägt Solo-Ass
    assert.ok(B(card(SUITS.SCHELLEN, RANKS.UNTER), card(SUITS.HERZ, RANKS.ASS)));
    assert.ok(!B(card(SUITS.HERZ, RANKS.ASS), card(SUITS.SCHELLEN, RANKS.UNTER)));

    // Innerhalb der Solo-Farbe: Ass > 10
    assert.ok(B(card(SUITS.HERZ, RANKS.ASS), card(SUITS.HERZ, RANKS.ZEHN)));
    assert.ok(!B(card(SUITS.HERZ, RANKS.ZEHN), card(SUITS.HERZ, RANKS.ASS)));
  });

  test('gleiche Karte schlägt sich nicht', () => {
    assert.ok(!B(card(SUITS.HERZ, RANKS.ASS), card(SUITS.HERZ, RANKS.ASS)));
  });

  test('Nicht-Trumpf gleicher Farbe: Ass schlägt 10', () => {
    assert.ok(B(card(SUITS.EICHEL, RANKS.ASS), card(SUITS.EICHEL, RANKS.ZEHN)));
    assert.ok(!B(card(SUITS.EICHEL, RANKS.ZEHN), card(SUITS.EICHEL, RANKS.ASS)));
  });

  test('Nicht-Trumpf unterschiedlicher Farbe: false (nicht bedient)', () => {
    assert.ok(!B(card(SUITS.LAUB, RANKS.ASS), card(SUITS.EICHEL, RANKS.SIEBEN)));
    assert.ok(!B(card(SUITS.SCHELLEN, RANKS.ASS), card(SUITS.LAUB, RANKS.SIEBEN)));
  });
});

describe('beats – Wenz', () => {
  const B = (a, b) => beats(a, b, WENZ);

  test('Unter schlägt alles andere', () => {
    assert.ok(B(card(SUITS.SCHELLEN, RANKS.UNTER), card(SUITS.EICHEL, RANKS.ASS)));
    assert.ok(B(card(SUITS.SCHELLEN, RANKS.UNTER), card(SUITS.EICHEL, RANKS.OBER)));
  });

  test('Unter vs. Unter: Eichel > Laub > Herz > Schellen', () => {
    assert.ok(B(card(SUITS.EICHEL, RANKS.UNTER), card(SUITS.LAUB, RANKS.UNTER)));
    assert.ok(B(card(SUITS.LAUB, RANKS.UNTER), card(SUITS.HERZ, RANKS.UNTER)));
    assert.ok(B(card(SUITS.HERZ, RANKS.UNTER), card(SUITS.SCHELLEN, RANKS.UNTER)));
  });

  test('Ober ist normale Farbkarte: Ass schlägt Ober', () => {
    assert.ok(B(card(SUITS.HERZ, RANKS.ASS), card(SUITS.HERZ, RANKS.OBER)));
    assert.ok(!B(card(SUITS.HERZ, RANKS.OBER), card(SUITS.HERZ, RANKS.ASS)));
  });
});

describe('beats – Stichsimulation', () => {
  test('Farb-Solo: Trumpf sticht zwei Nicht-Trümpfe', () => {
    const solo = SUITS.EICHEL;
    const cards = [
      card(SUITS.HERZ, RANKS.ASS),   // Lead
      card(SUITS.HERZ, RANKS.ZEHN),
      card(SUITS.LAUB, RANKS.UNTER), // Trumpf
      card(SUITS.SCHELLEN, RANKS.KOENIG), // Abwurf
    ];
    let winner = cards[0];
    for (let i = 1; i < cards.length; i++) {
      if (beats(cards[i], winner, FARB_SOLO, solo)) winner = cards[i];
    }
    assert.equal(winner.toString(), card(SUITS.LAUB, RANKS.UNTER).toString());
  });

  test('Farb-Solo: höchster Trumpf gewinnt gegen niedrigeren Trumpf', () => {
    const solo = SUITS.HERZ;
    const cards = [
      card(SUITS.EICHEL, RANKS.ASS),   // Lead
      card(SUITS.HERZ, RANKS.UNTER),   // Trumpf (Rang 7)
      card(SUITS.LAUB, RANKS.UNTER),   // Trumpf (Rang 6) → gewinnt
    ];
    let winner = cards[0];
    for (let i = 1; i < cards.length; i++) {
      if (beats(cards[i], winner, FARB_SOLO, solo)) winner = cards[i];
    }
    assert.equal(winner.toString(), card(SUITS.LAUB, RANKS.UNTER).toString());
  });

  test('Farb-Solo: nur Lead-Farbe kann gewinnen, wenn kein Trumpf fällt', () => {
    const solo = SUITS.EICHEL;
    const cards = [
      card(SUITS.HERZ, RANKS.SIEBEN),   // Lead
      card(SUITS.LAUB, RANKS.ASS),      // Abwurf – darf nicht gewinnen
      card(SUITS.HERZ, RANKS.ZEHN),     // bedient → gewinnt
    ];
    let winner = cards[0];
    for (let i = 1; i < cards.length; i++) {
      if (beats(cards[i], winner, FARB_SOLO, solo)) winner = cards[i];
    }
    assert.equal(winner.toString(), card(SUITS.HERZ, RANKS.ZEHN).toString());
  });
});