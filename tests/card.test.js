import { describe, test, assert } from './test-runner.js';
import { Card } from '../js/model/Card.js';
import { SUITS, RANKS } from '../js/config/constants.js';

describe('Card', () => {
  test('kennt ihre Punkte', () => {
    assert.equal(new Card(SUITS.HERZ, RANKS.ASS).points, 11);
    assert.equal(new Card(SUITS.EICHEL, RANKS.OBER).points, 3);
    assert.equal(new Card(SUITS.LAUB, RANKS.SIEBEN).points, 0);
  });

  test('vergleicht korrekt', () => {
    const a = new Card(SUITS.HERZ, RANKS.KOENIG);
    const b = new Card(SUITS.HERZ, RANKS.KOENIG);
    const c = new Card(SUITS.LAUB, RANKS.KOENIG);
    assert.ok(a.equals(b));
    assert.ok(!a.equals(c));
  });

  test('liefert Bildnamen', () => {
    const c = new Card(SUITS.SCHELLEN, RANKS.ZEHN);
    assert.equal(c.toImageName(), 'schellen-10.png');
  });

  test('serialisiert und rekonstruiert', () => {
    const original = new Card(SUITS.LAUB, RANKS.UNTER);
    const copy = Card.fromJSON(original.toJSON());
    assert.ok(original.equals(copy));
  });

  test('wirft bei ungültiger Farbe oder Rang', () => {
    assert.throws(() => new Card('blau', RANKS.ASS));
    assert.throws(() => new Card(SUITS.HERZ, 'drache'));
  });

  test('ist unveränderlich', () => {
    const c = new Card(SUITS.HERZ, RANKS.ASS);
    assert.throws(() => { c.rank = RANKS.ZEHN; });
  });
});