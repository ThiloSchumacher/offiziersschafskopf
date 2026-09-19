import { describe, test, assert } from './test-runner.js';
import { GameState } from '../js/model/GameState.js';
import { Player } from '../js/model/Player.js';
import { Position } from '../js/model/Position.js';
import { Card } from '../js/model/Card.js';
import {
  SUITS, RANKS, GAME_TYPES, STACKS_PER_PLAYER,
} from '../js/config/constants.js';
import {
  determineWinner, trickPoints, applyTrickResult,
} from '../js/rules/stich.js';

const { FARB_SOLO, WENZ } = GAME_TYPES;
const c = (s, r) => new Card(s, r);

// ---------------------------------------------------------------------------
// Testhelfer
// ---------------------------------------------------------------------------

/** Baut einen Trick-Literal aus [playerIndex, card]-Paaren. */
function trickOf(...pairs) {
  return {
    leaderIndex: pairs[0][0],
    plays: pairs.map(([playerIndex, card], i) => ({
      playerIndex,
      positionIndex: i,
      card,
    })),
  };
}

/**
 * Baut einen State mit zwei Händen. Jede Hand ist ein Array von Karten,
 * die in den Positionen 0..n-1 offen liegen. Rest der Positionen leer.
 *
 * Verdeckter Filler ist bewusst eine Karte, die in Tests nicht vorkommt,
 * damit revealAll-Effekte eindeutig prüfbar sind.
 */
function stateWithHands({ hands, gameType, soloSuit = null, declarerIndex = 0 }) {
  const filler = c(SUITS.SCHELLEN, RANKS.SIEBEN);
  const players = hands.map((hand, i) => {
    const positions = [];
    for (let j = 0; j < STACKS_PER_PLAYER; j++) {
      if (j < hand.length) {
        positions.push(new Position(filler, hand[j]));
      } else {
        positions.push(new Position(null, null));
      }
    }
    return new Player(`P${i}`, positions);
  });
  return new GameState({ players, declarerIndex, gameType, soloSuit });
}

/**
 * Spielt auf beiden Seiten je eine Karte aus und trägt sie in den
 * currentTrick ein. Liefert den State zurück.
 */
function playInto(state, moves) {
  for (const { playerIndex, positionIndex } of moves) {
    const card = state.players[playerIndex].playAt(positionIndex);
    state.currentTrick.plays.push({ playerIndex, positionIndex, card });
  }
  return state;
}

// ---------------------------------------------------------------------------
// determineWinner
// ---------------------------------------------------------------------------

describe('stich – determineWinner (Farb-Solo, Solo = Herz)', () => {
  const solo = SUITS.HERZ;
  const W = (trick) => determineWinner(trick, FARB_SOLO, solo);

  test('wirft bei leerem Stich', () => {
    assert.throws(() => W({ leaderIndex: 0, plays: [] }));
    assert.throws(() => W(null));
  });

  test('höhere Karte derselben Farbe gewinnt', () => {
    const t = trickOf(
      [0, c(SUITS.EICHEL, RANKS.ASS)],
      [1, c(SUITS.EICHEL, RANKS.ZEHN)],
    );
    assert.equal(W(t), 0);
  });

  test('Trumpf schlägt Nicht-Trumpf', () => {
    const t = trickOf(
      [0, c(SUITS.EICHEL, RANKS.ASS)],
      [1, c(SUITS.HERZ, RANKS.SIEBEN)], // Solo-Farbe = Trumpf
    );
    assert.equal(W(t), 1);
  });

  test('höherer Trumpf schlägt niedrigeren Trumpf', () => {
    const t = trickOf(
      [0, c(SUITS.HERZ, RANKS.ASS)],  // trumpfRank 9
      [1, c(SUITS.EICHEL, RANKS.OBER)], // trumpfRank 1
    );
    assert.equal(W(t), 1);
  });

  test('Abwurf in anderer Farbe gewinnt nie', () => {
    const t = trickOf(
      [0, c(SUITS.SCHELLEN, RANKS.SIEBEN)],
      [1, c(SUITS.LAUB, RANKS.ASS)], // andere Farbe, kein Trumpf
    );
    assert.equal(W(t), 0);
  });

  test('Gewinner ist der Spieler mit dem höchsten Rang, nicht der letzte', () => {
    const t = trickOf(
      [1, c(SUITS.HERZ, RANKS.ASS)],     // Follower führt
      [0, c(SUITS.SCHELLEN, RANKS.UNTER)], // Lead als Nachspieler, Trumpf
    );
    assert.equal(W(t), 0);
  });
});

describe('stich – determineWinner (Wenz)', () => {
  const W = (trick) => determineWinner(trick, WENZ, null);

  test('Unter schlägt Nicht-Trumpf', () => {
    const t = trickOf(
      [0, c(SUITS.EICHEL, RANKS.ASS)],
      [1, c(SUITS.HERZ, RANKS.UNTER)],
    );
    assert.equal(W(t), 1);
  });

  test('höherer Unter schlägt niedrigeren', () => {
    const t = trickOf(
      [0, c(SUITS.SCHELLEN, RANKS.UNTER)],
      [1, c(SUITS.EICHEL, RANKS.UNTER)],
    );
    assert.equal(W(t), 1);
  });

  test('Ober ist normale Farbkarte: Ass schlägt Ober', () => {
    const t = trickOf(
      [0, c(SUITS.EICHEL, RANKS.OBER)],
      [1, c(SUITS.EICHEL, RANKS.ASS)],
    );
    assert.equal(W(t), 1);
  });
});

// ---------------------------------------------------------------------------
// trickPoints
// ---------------------------------------------------------------------------

describe('stich – trickPoints', () => {
  test('summiert Kartenpunkte', () => {
    const t = trickOf(
      [0, c(SUITS.EICHEL, RANKS.ASS)],   // 11
      [1, c(SUITS.EICHEL, RANKS.ZEHN)],  // 10
    );
    assert.equal(trickPoints(t), 21);
  });

  test('leerer Stich zählt 0', () => {
    assert.equal(trickPoints({ leaderIndex: 0, plays: [] }), 0);
  });

  test('Nieten zählen 0', () => {
    const t = trickOf(
      [0, c(SUITS.EICHEL, RANKS.SIEBEN)],
      [1, c(SUITS.EICHEL, RANKS.ACHT)],
    );
    assert.equal(trickPoints(t), 0);
  });

  test('wirft bei ungültigem Stich', () => {
    assert.throws(() => trickPoints(null));
    assert.throws(() => trickPoints({}));
  });
});

// ---------------------------------------------------------------------------
// applyTrickResult
// ---------------------------------------------------------------------------

describe('stich – applyTrickResult: Vorbedingungen', () => {
  test('wirft, wenn keine Spielart gewählt ist', () => {
    const state = new GameState({
      players: [new Player('A'), new Player('B')],
      declarerIndex: 0,
    });
    state.currentTrick.plays.push(
      { playerIndex: 0, positionIndex: 0, card: c(SUITS.HERZ, RANKS.ASS) },
      { playerIndex: 1, positionIndex: 0, card: c(SUITS.HERZ, RANKS.ZEHN) },
    );
    assert.throws(() => applyTrickResult(state));
  });

  test('wirft, wenn der Stich nicht vollständig ist', () => {
    const state = stateWithHands({
      hands: [
        [c(SUITS.HERZ, RANKS.ASS), c(SUITS.HERZ, RANKS.ZEHN)],
        [c(SUITS.LAUB, RANKS.KOENIG), c(SUITS.LAUB, RANKS.ASS)],
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    state.players[0].playAt(0);
    state.currentTrick.plays.push({
      playerIndex: 0, positionIndex: 0, card: c(SUITS.HERZ, RANKS.ASS),
    });
    assert.throws(() => applyTrickResult(state));
  });
});

describe('stich – applyTrickResult: Erfolgsfall', () => {
  test('schreibt Punkte und Tricks dem Gewinner gut', () => {
    // P0 führt Eichel-Ass (11), P1 bedient Eichel-10 (10). P0 gewinnt.
    const state = stateWithHands({
      hands: [
        [c(SUITS.EICHEL, RANKS.ASS), c(SUITS.HERZ, RANKS.SIEBEN)],
        [c(SUITS.EICHEL, RANKS.ZEHN), c(SUITS.LAUB, RANKS.KOENIG)],
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    playInto(state, [
      { playerIndex: 0, positionIndex: 0 },
      { playerIndex: 1, positionIndex: 0 },
    ]);

    const winner = applyTrickResult(state);
    assert.equal(winner, 0);
    assert.deepEqual(state.points, [21, 0]);
    assert.deepEqual(state.tricksWon, [1, 0]);
  });

  test('verschiebt Stich in die Historie und startet einen neuen', () => {
    const state = stateWithHands({
      hands: [
        [c(SUITS.EICHEL, RANKS.ASS), c(SUITS.HERZ, RANKS.SIEBEN)],
        [c(SUITS.EICHEL, RANKS.ZEHN), c(SUITS.LAUB, RANKS.KOENIG)],
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    playInto(state, [
      { playerIndex: 0, positionIndex: 0 },
      { playerIndex: 1, positionIndex: 0 },
    ]);
    applyTrickResult(state);

    assert.equal(state.completedTricks.length, 1);
    assert.equal(state.completedTricks[0].plays.length, 2);
    assert.equal(state.currentTrick.plays.length, 0);
    assert.equal(state.currentTrick.leaderIndex, 0);
  });

  test('setzt activePlayerIndex auf den Gewinner', () => {
    const state = stateWithHands({
      hands: [
        [c(SUITS.EICHEL, RANKS.ASS)],
        [c(SUITS.EICHEL, RANKS.ZEHN)],
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    // Gegner führt und verliert
    playInto(state, [
      { playerIndex: 1, positionIndex: 0 },
      { playerIndex: 0, positionIndex: 0 },
    ]);
    applyTrickResult(state);
    assert.equal(state.activePlayerIndex, 0);
  });

  test('deckt die gespielten Positionen beider Spieler auf', () => {
    const state = stateWithHands({
      hands: [
        [c(SUITS.EICHEL, RANKS.ASS), c(SUITS.HERZ, RANKS.SIEBEN)],
        [c(SUITS.LAUB, RANKS.ASS), c(SUITS.EICHEL, RANKS.ZEHN)],
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    playInto(state, [
      { playerIndex: 0, positionIndex: 0 },
      { playerIndex: 1, positionIndex: 1 },
    ]);
    applyTrickResult(state);

    // Position 0 bei P0 wurde gespielt → verdeckte Karte jetzt offen.
    assert.equal(state.players[0].positionAt(0).hiddenCard, null);
    assert.ok(state.players[0].positionAt(0).openCard !== null);

    // Position 1 bei P1 (nicht gespielt) bleibt voll.
    assert.ok(state.players[1].positionAt(0).hiddenCard !== null);
    assert.ok(state.players[1].positionAt(0).openCard !== null);

    // Position 1 bei P1 wurde gespielt → aufgedeckt.
    assert.equal(state.players[1].positionAt(1).hiddenCard, null);
  });

  test('stellt Positionen nach dem Stich wieder spielbar her', () => {
    const state = stateWithHands({
      hands: [
        [c(SUITS.EICHEL, RANKS.ASS)],
        [c(SUITS.EICHEL, RANKS.ZEHN)],
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    playInto(state, [
      { playerIndex: 0, positionIndex: 0 },
      { playerIndex: 1, positionIndex: 0 },
    ]);
    applyTrickResult(state);

    assert.ok(state.players[0].positionAt(0).hasPlayableCard());
    assert.ok(state.players[1].positionAt(0).hasPlayableCard());
  });

  test('Trumpf schlägt Nicht-Trumpf: Follower gewinnt', () => {
    const state = stateWithHands({
      hands: [
        [c(SUITS.EICHEL, RANKS.ASS)],    // 11
        [c(SUITS.HERZ, RANKS.SIEBEN)],   // Trumpf (Solo = Herz), 0 Punkte
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    playInto(state, [
      { playerIndex: 0, positionIndex: 0 },
      { playerIndex: 1, positionIndex: 0 },
    ]);
    const winner = applyTrickResult(state);
    assert.equal(winner, 1);
    assert.deepEqual(state.points, [0, 11]);
  });

  test('mehrere Stiche hintereinander summieren korrekt', () => {
    const state = stateWithHands({
      hands: [
        [
          c(SUITS.EICHEL, RANKS.ASS),     // P0 Position 0
          c(SUITS.LAUB, RANKS.ZEHN),      // P0 Position 1
        ],
        [
          c(SUITS.EICHEL, RANKS.ZEHN),    // P1 Position 0
          c(SUITS.LAUB, RANKS.ASS),       // P1 Position 1
        ],
      ],
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });

    // Stich 1: P0 führt Eichel-Ass (11), P1 bedient Eichel-10 (10) → P0 gewinnt.
    playInto(state, [
      { playerIndex: 0, positionIndex: 0 },
      { playerIndex: 1, positionIndex: 0 },
    ]);
    applyTrickResult(state);

    // Stich 2: P0 führt Laub-10 (10), P1 bedient Laub-Ass (11) → P1 gewinnt.
    playInto(state, [
      { playerIndex: 0, positionIndex: 1 },
      { playerIndex: 1, positionIndex: 1 },
    ]);
    applyTrickResult(state);

    assert.deepEqual(state.points, [21, 21]);
    assert.deepEqual(state.tricksWon, [1, 1]);
    assert.equal(state.completedTricks.length, 2);
  });

    test('funktioniert auch mit Wenz', () => {
        const state = stateWithHands({
        hands: [
            [c(SUITS.EICHEL, RANKS.ASS)],       // 11 Punkte
            [c(SUITS.SCHELLEN, RANKS.UNTER)],   // 2 Punkte, Trumpf
        ],
        gameType: WENZ,
    });
    playInto(state, [
      { playerIndex: 0, positionIndex: 0 },
      { playerIndex: 1, positionIndex: 0 },
    ]);
    const winner = applyTrickResult(state);
    assert.equal(winner, 1);
    // Beide Karten wandern zum Gewinner: Ass (11) + Unter (2) = 13.
    assert.deepEqual(state.points, [0, 13]);
  });
});