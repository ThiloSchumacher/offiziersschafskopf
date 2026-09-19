import { describe, test, assert } from './test-runner.js';
import { Player } from '../js/model/Player.js';
import { Position } from '../js/model/Position.js';
import { Card } from '../js/model/Card.js';
import { SUITS, RANKS, STACKS_PER_PLAYER } from '../js/config/constants.js';

const card = (s, r) => new Card(s, r);

/** Erzeugt einen Spieler mit 8 vollen Positionen. */
function makeFullPlayer(name = 'Anna') {
  const positions = [];
  for (let i = 0; i < STACKS_PER_PLAYER; i++) {
    positions.push(new Position(
      card(SUITS.HERZ, RANKS.SIEBEN),
      card(SUITS.EICHEL, RANKS.ASS),
    ));
  }
  return new Player(name, positions);
}

describe('Player – Konstruktion', () => {
  test('erzeugt 8 leere Positionen ohne Argument', () => {
    const p = new Player('Anna');
    assert.equal(p.positions.length, STACKS_PER_PLAYER);
    assert.ok(p.positions.every((pos) => pos.isEmpty()));
    assert.ok(!p.hasCards());
    assert.equal(p.cardCount(), 0);
  });

  test('übernimmt übergebene Positionen', () => {
    const p = makeFullPlayer('Anna');
    assert.equal(p.cardCount(), 16);
    assert.ok(p.hasCards());
  });

  test('wirft bei leerem Namen', () => {
    assert.throws(() => new Player(''));
    assert.throws(() => new Player(null));
  });

  test('wirft bei falscher Positions-Anzahl', () => {
    assert.throws(() => new Player('Anna', []));
    assert.throws(() => new Player('Anna', [new Position()]));
  });

  test('wirft bei ungültigen Positions-Einträgen', () => {
    const bad = Array.from({ length: STACKS_PER_PLAYER }, () => ({}));
    assert.throws(() => new Player('Anna', bad));
  });
});

describe('Player – Abfragen', () => {
  test('playableIndices liefert alle vollen Positionen', () => {
    const p = makeFullPlayer();
    assert.deepEqual(p.playableIndices(), [0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test('playableIndices überspringt leere Positionen', () => {
    const positions = Array.from({ length: STACKS_PER_PLAYER }, () => new Position());
    positions[2] = new Position(card(SUITS.HERZ, RANKS.ASS), null); // nur verdeckt
    positions[5] = new Position(null, card(SUITS.LAUB, RANKS.ZEHN)); // nur offen
    const p = new Player('Anna', positions);
    assert.deepEqual(p.playableIndices(), [5]);
  });

  test('cardCount zählt verdeckt und offen', () => {
    const positions = Array.from({ length: STACKS_PER_PLAYER }, () => new Position());
    positions[0] = new Position(card(SUITS.HERZ, RANKS.ASS), card(SUITS.LAUB, RANKS.ZEHN));
    positions[1] = new Position(card(SUITS.HERZ, RANKS.SIEBEN), null);
    positions[2] = new Position(null, card(SUITS.EICHEL, RANKS.OBER));
    const p = new Player('Anna', positions);
    assert.equal(p.cardCount(), 4);
  });

  test('positionAt wirft bei ungültigem Index', () => {
    const p = new Player('Anna');
    assert.throws(() => p.positionAt(8));
    assert.throws(() => p.positionAt(-1));
  });

  test('positions liefert eine Kopie des Arrays', () => {
    const p = new Player('Anna');
    const arr = p.positions;
    arr.pop();
    assert.equal(p.positions.length, STACKS_PER_PLAYER);
  });
});

describe('Player – Spielen und Aufdecken', () => {
  test('revealAll lässt nicht gespielte Positionen unangetastet', () => {
    const p = makeFullPlayer();
    // Merker: ungespielte Position 0 hat verdeckt + offen
    const beforeHidden = p.positionAt(0).hiddenCard;
    const beforeOpen = p.positionAt(0).openCard;

    p.playAt(3);
    p.revealAll();

    // Position 0 muss exakt unverändert sein.
    assert.ok(p.positionAt(0).hiddenCard !== null);
    assert.ok(p.positionAt(0).openCard !== null);
    assert.ok(p.positionAt(0).hiddenCard.equals(beforeHidden));
    assert.ok(p.positionAt(0).openCard.equals(beforeOpen));

    // Position 3 hat nur noch die ursprünglich verdeckte Karte offen.
    assert.equal(p.positionAt(3).hiddenCard, null);
    assert.ok(p.positionAt(3).openCard !== null);
  });

  test('revealAt verschiebt hidden → open', () => {
    const p = makeFullPlayer();
    const hidden = p.positionAt(0).hiddenCard;
    p.playAt(0);
    p.revealAt(0);
    assert.ok(p.positionAt(0).openCard.equals(hidden));
    assert.equal(p.positionAt(0).hiddenCard, null);
  });

  test('revealAll deckt nur gespielte Positionen auf', () => {
    const p = makeFullPlayer();
    p.playAt(1);
    p.playAt(4);
    const revealed = p.revealAll();
    assert.equal(revealed.length, 2);
    assert.deepEqual(revealed.map((r) => r.index).sort(), [1, 4]);

    // Zweiter Aufruf sollte nichts mehr finden.
    assert.equal(p.revealAll().length, 0);
  });

  test('findPositionWithCard findet die richtige Position', () => {
    const positions = Array.from({ length: STACKS_PER_PLAYER }, () => new Position());
    const target = card(SUITS.SCHELLEN, RANKS.OBER);
    positions[6] = new Position(card(SUITS.HERZ, RANKS.ASS), target);
    const p = new Player('Anna', positions);
    assert.equal(p.findPositionWithCard(target), 6);
    assert.equal(p.findPositionWithCard(card(SUITS.LAUB, RANKS.ZEHN)), -1);
  });
});

describe('Player – clone', () => {
  test('Klon ist unabhängig (Play im Klon ändert Original nicht)', () => {
    const original = makeFullPlayer('Anna');
    const copy = original.clone();

    const card = copy.positionAt(2).openCard;
    copy.playAt(2);

    assert.equal(original.positionAt(2).openCard !== null, true);
    assert.equal(copy.positionAt(2).openCard, null);

    // Karten sind geteilt (immutable), aber Equals-Vergleich klappt.
    assert.ok(original.positionAt(2).openCard.equals(card));
  });

  test('Klon hat denselben Namen', () => {
    const p = new Player('Bernd');
    assert.equal(p.clone().name, 'Bernd');
  });
});