import { describe, test, assert } from './test-runner.js';
import { Position } from '../js/model/Position.js';
import { Card } from '../js/model/Card.js';
import { SUITS, RANKS } from '../js/config/constants.js';

const card = (s, r) => new Card(s, r);

describe('Position – Konstruktion', () => {
  test('akzeptiert Card + Card', () => {
    const p = new Position(card(SUITS.HERZ, RANKS.ASS), card(SUITS.EICHEL, RANKS.ZEHN));
    assert.ok(p.hiddenCard instanceof Card);
    assert.ok(p.openCard instanceof Card);
    assert.ok(!p.isEmpty());
  });

  test('akzeptiert Card + null (nach play)', () => {
    const p = new Position(card(SUITS.HERZ, RANKS.ASS), null);
    assert.ok(p.hiddenCard !== null);
    assert.equal(p.openCard, null);
    assert.ok(!p.isEmpty());
    assert.ok(!p.hasPlayableCard());
  });

  test('akzeptiert null + Card (nach reveal)', () => {
    const p = new Position(null, card(SUITS.HERZ, RANKS.ASS));
    assert.equal(p.hiddenCard, null);
    assert.ok(p.openCard !== null);
    assert.ok(p.hasPlayableCard());
  });

  test('akzeptiert null + null (leer)', () => {
    const p = new Position(null, null);
    assert.ok(p.isEmpty());
    assert.ok(!p.hasPlayableCard());
  });

  test('Default-Konstruktor erzeugt leere Position', () => {
    const p = new Position();
    assert.ok(p.isEmpty());
  });

  test('wirft bei Nicht-Card-Werten', () => {
    assert.throws(() => new Position('herz-ass', null));
    assert.throws(() => new Position(null, 42));
  });
});

describe('Position – play', () => {
  test('gibt die offene Karte zurück und leert das open-Feld', () => {
    const open = card(SUITS.LAUB, RANKS.KOENIG);
    const hidden = card(SUITS.SCHELLEN, RANKS.ASS);
    const p = new Position(hidden, open);

    const played = p.play();
    assert.ok(played.equals(open));
    assert.equal(p.openCard, null);
    assert.ok(p.hiddenCard.equals(hidden));
    assert.ok(!p.hasPlayableCard());
  });

  test('wirft, wenn keine offene Karte liegt', () => {
    const p = new Position(card(SUITS.HERZ, RANKS.ASS), null);
    assert.throws(() => p.play());
  });

  test('wirft auf leerer Position', () => {
    const p = new Position();
    assert.throws(() => p.play());
  });

  test('playableCard liefert die offene Karte oder null', () => {
    const open = card(SUITS.HERZ, RANKS.ZEHN);
    const p = new Position(card(SUITS.LAUB, RANKS.ASS), open);
    assert.ok(p.playableCard().equals(open));
    p.play();
    assert.equal(p.playableCard(), null);
  });
});

describe('Position – reveal', () => {
  test('verschiebt hidden → open', () => {
    const hidden = card(SUITS.SCHELLEN, RANKS.OBER);
    const p = new Position(hidden, card(SUITS.HERZ, RANKS.ASS));

    p.play(); // offene Karte weg → nur noch hidden
    const revealed = p.reveal();

    assert.ok(revealed.equals(hidden));
    assert.equal(p.hiddenCard, null);
    assert.ok(p.openCard.equals(hidden));
    assert.ok(p.hasPlayableCard());
  });

  test('wirft, wenn schon eine offene Karte liegt', () => {
    const p = new Position(card(SUITS.HERZ, RANKS.ASS), card(SUITS.LAUB, RANKS.ZEHN));
    assert.throws(() => p.reveal());
  });

  test('wirft, wenn keine verdeckte Karte vorhanden ist', () => {
    const p = new Position(null, card(SUITS.HERZ, RANKS.ASS));
    assert.throws(() => p.reveal());
  });

  test('wirft auf leerer Position', () => {
    const p = new Position();
    assert.throws(() => p.reveal());
  });
});

describe('Position – vollständiger Lebenszyklus', () => {
  test('initial → play → reveal → play → leer', () => {
    const hidden = card(SUITS.HERZ, RANKS.SIEBEN);
    const open = card(SUITS.EICHEL, RANKS.ASS);
    const p = new Position(hidden, open);

    // 1. initial
    assert.ok(p.hasPlayableCard());
    assert.ok(p.playableCard().equals(open));

    // 2. play
    const first = p.play();
    assert.ok(first.equals(open));
    assert.equal(p.hiddenCard, hidden);
    assert.ok(!p.hasPlayableCard());
    assert.ok(!p.isEmpty());

    // 3. reveal
    p.reveal();
    assert.equal(p.hiddenCard, null);
    assert.ok(p.openCard.equals(hidden));
    assert.ok(p.hasPlayableCard());

    // 4. zweites play
    const second = p.play();
    assert.ok(second.equals(hidden));
    assert.ok(p.isEmpty());
    assert.ok(!p.hasPlayableCard());
  });
});

describe('Position – Serialisierung', () => {
  test('toJSON/fromJSON erhält den Zustand (voll)', () => {
    const p = new Position(
      card(SUITS.HERZ, RANKS.ASS),
      card(SUITS.EICHEL, RANKS.OBER),
    );
    const copy = Position.fromJSON(p.toJSON());
    assert.ok(copy.hiddenCard.equals(p.hiddenCard));
    assert.ok(copy.openCard.equals(p.openCard));
  });

  test('toJSON/fromJSON erhält den Zustand (leer)', () => {
    const copy = Position.fromJSON(new Position().toJSON());
    assert.ok(copy.isEmpty());
  });

  test('toJSON/fromJSON erhält den Zustand (nur verdeckt)', () => {
    const p = new Position(card(SUITS.LAUB, RANKS.UNTER), null);
    const copy = Position.fromJSON(p.toJSON());
    assert.equal(copy.openCard, null);
    assert.ok(copy.hiddenCard.equals(p.hiddenCard));
  });
});