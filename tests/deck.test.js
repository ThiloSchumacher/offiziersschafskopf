import { describe, test, assert } from './test-runner.js';
import { Deck } from '../js/model/Deck.js';
import { Card } from '../js/model/Card.js';
import { SUITS, RANKS, TOTAL_CARDS } from '../js/config/constants.js';
import { createSeededRng } from '../js/utils/shuffle.js';

describe('Deck', () => {
  test('enthält genau 32 Karten', () => {
    assert.equal(Deck.create().size, TOTAL_CARDS);
  });

  test('enthält jede Karte genau einmal', () => {
    const cards = Deck.create().toArray();
    const seen = new Set(cards.map((c) => c.toString()));
    assert.equal(seen.size, TOTAL_CARDS);
  });

  test('enthält 4 Karten pro Farbe und je eine pro (Farbe, Rang)', () => {
    const cards = Deck.create().toArray();
    for (const suit of Object.values(SUITS)) {
      const inSuit = cards.filter((c) => c.suit === suit);
      assert.equal(inSuit.length, Object.values(RANKS).length, `Farbe ${suit}`);
      const ranks = new Set(inSuit.map((c) => c.rank));
      assert.equal(ranks.size, Object.values(RANKS).length, `Ränge in ${suit}`);
    }
  });

  test('Alle Karten sind Card-Instanzen', () => {
    const cards = Deck.create().toArray();
    assert.ok(cards.every((c) => c instanceof Card));
  });

  test('shuffled() hat dieselben Karten wie create()', () => {
    const fresh = Deck.create().toArray().map((c) => c.toString()).sort();
    const mixed = Deck.shuffled(createSeededRng(7)).toArray().map((c) => c.toString()).sort();
    assert.deepEqual(mixed, fresh);
  });

  test('shuffled() ist mit gleichem Seed deterministisch', () => {
    const a = Deck.shuffled(createSeededRng(2024)).toArray().map((c) => c.toString());
    const b = Deck.shuffled(createSeededRng(2024)).toArray().map((c) => c.toString());
    assert.deepEqual(a, b);
  });

  test('draw() verkleinert das Deck und liefert eine Card', () => {
    const deck = Deck.create();
    const before = deck.size;
    const card = deck.draw();
    assert.ok(card instanceof Card);
    assert.equal(deck.size, before - 1);
  });

  test('draw() auf leerem Deck wirft', () => {
    const deck = new Deck([]);
    assert.throws(() => deck.draw());
  });

  test('drawMany(n) liefert n Karten', () => {
    const deck = Deck.create();
    const drawn = deck.drawMany(5);
    assert.equal(drawn.length, 5);
    assert.equal(deck.size, TOTAL_CARDS - 5);
  });

  test('toArray() liefert eine Kopie (Mutation beeinflusst Deck nicht)', () => {
    const deck = Deck.create();
    const copy = deck.toArray();
    copy.pop();
    assert.equal(deck.size, TOTAL_CARDS);
  });
});