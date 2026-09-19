import { describe, test, assert } from './test-runner.js';
import { Card } from '../js/model/Card.js';
import {
  SUITS, RANKS, GAME_TYPES,
} from '../js/config/constants.js';
import { PHASES } from '../js/game/phases.js';
import {
  isTrumpfCard,
  isLeading,
  isFollowing,
  currentTrickPoints,
  wouldWinCurrentTrick,
  isWorthless,
  isAss,
  isTen,
  isTopTrumpf,
} from '../js/ai/strategies.js';

const { FARB_SOLO, WENZ } = GAME_TYPES;
const c = (s, r) => new Card(s, r);

/** Minimale AIView für Unit-Tests. */
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

describe('strategies – isTrumpfCard', () => {
  test('Farb-Solo: Ober/Unter/Solo-Farbe sind Trumpf', () => {
    const v = makeView();
    assert.ok(isTrumpfCard(v, c(SUITS.EICHEL, RANKS.OBER)));
    assert.ok(isTrumpfCard(v, c(SUITS.LAUB, RANKS.UNTER)));
    assert.ok(isTrumpfCard(v, c(SUITS.HERZ, RANKS.SIEBEN)));
    assert.ok(!isTrumpfCard(v, c(SUITS.EICHEL, RANKS.ASS)));
  });

  test('Wenz: nur Unter ist Trumpf', () => {
    const v = makeView({ gameType: WENZ, soloSuit: null });
    assert.ok(isTrumpfCard(v, c(SUITS.EICHEL, RANKS.UNTER)));
    assert.ok(!isTrumpfCard(v, c(SUITS.EICHEL, RANKS.OBER)));
    assert.ok(!isTrumpfCard(v, c(SUITS.HERZ, RANKS.ASS)));
  });
});

describe('strategies – Situationserkennung', () => {
  test('isLeading bei leerem Stich', () => {
    const v = makeView();
    assert.ok(isLeading(v));
    assert.ok(!isFollowing(v));
  });

  test('isFollowing bei einem Play im Stich', () => {
    const v = makeView({
      currentTrick: {
        leaderIndex: 1,
        plays: [{ playerIndex: 1, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) }],
      },
    });
    assert.ok(isFollowing(v));
    assert.ok(!isLeading(v));
  });
});

describe('strategies – currentTrickPoints', () => {
  test('leerer Stich: 0', () => {
    assert.equal(currentTrickPoints(makeView()), 0);
  });

  test('mit einem Play: Kartenpunkte', () => {
    const v = makeView({
      currentTrick: {
        leaderIndex: 1,
        plays: [{ playerIndex: 1, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) }],
      },
    });
    assert.equal(currentTrickPoints(v), 11);
  });

  test('mit zwei Plays: Summe', () => {
    const v = makeView({
      currentTrick: {
        leaderIndex: 0,
        plays: [
          { playerIndex: 0, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) },
          { playerIndex: 1, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ZEHN) },
        ],
      },
    });
    assert.equal(currentTrickPoints(v), 21);
  });
});

describe('strategies – wouldWinCurrentTrick', () => {
  test('führend: trivial true', () => {
    const v = makeView();
    assert.ok(wouldWinCurrentTrick(v, c(SUITS.EICHEL, RANKS.SIEBEN)));
  });

  test('als Zweiter: Trumpf schlägt Nicht-Trumpf', () => {
    const v = makeView({
      currentTrick: {
        leaderIndex: 1,
        plays: [{ playerIndex: 1, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) }],
      },
    });
    assert.ok(wouldWinCurrentTrick(v, c(SUITS.HERZ, RANKS.SIEBEN))); // Trumpf
    assert.ok(!wouldWinCurrentTrick(v, c(SUITS.EICHEL, RANKS.SIEBEN))); // niedriger
  });

  test('als Zweiter: höhere Karte derselben Farbe gewinnt nicht, wenn sie niedriger ist', () => {
    const v = makeView({
      currentTrick: {
        leaderIndex: 1,
        plays: [{ playerIndex: 1, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS) }],
      },
    });
    assert.ok(!wouldWinCurrentTrick(v, c(SUITS.EICHEL, RANKS.ZEHN)));
  });
});

describe('strategies – Kartenkategorien', () => {
  test('isWorthless', () => {
    assert.ok(isWorthless(c(SUITS.EICHEL, RANKS.SIEBEN)));
    assert.ok(isWorthless(c(SUITS.LAUB, RANKS.ACHT)));
    assert.ok(isWorthless(c(SUITS.HERZ, RANKS.NEUN)));
    assert.ok(!isWorthless(c(SUITS.HERZ, RANKS.ASS)));
    assert.ok(!isWorthless(c(SUITS.HERZ, RANKS.UNTER)));
  });

  test('isAss', () => {
    assert.ok(isAss(c(SUITS.HERZ, RANKS.ASS)));
    assert.ok(!isAss(c(SUITS.HERZ, RANKS.ZEHN)));
  });

  test('isTen', () => {
    assert.ok(isTen(c(SUITS.HERZ, RANKS.ZEHN)));
    assert.ok(!isTen(c(SUITS.HERZ, RANKS.ASS)));
  });

  test('isTopTrumpf beim Farb-Solo: Eichel-Ober', () => {
    const v = makeView({ gameType: FARB_SOLO, soloSuit: SUITS.HERZ });
    assert.ok(isTopTrumpf(v, c(SUITS.EICHEL, RANKS.OBER)));
    assert.ok(!isTopTrumpf(v, c(SUITS.LAUB, RANKS.OBER)));
    assert.ok(!isTopTrumpf(v, c(SUITS.EICHEL, RANKS.UNTER)));
  });

  test('isTopTrumpf beim Wenz: Eichel-Unter', () => {
    const v = makeView({ gameType: WENZ, soloSuit: null });
    assert.ok(isTopTrumpf(v, c(SUITS.EICHEL, RANKS.UNTER)));
    assert.ok(!isTopTrumpf(v, c(SUITS.LAUB, RANKS.UNTER)));
    assert.ok(!isTopTrumpf(v, c(SUITS.EICHEL, RANKS.OBER)));
  });
});