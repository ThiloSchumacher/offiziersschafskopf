import { describe, test, assert } from './test-runner.js';
import { GameState } from '../js/model/GameState.js';
import { Player } from '../js/model/Player.js';
import { Position } from '../js/model/Position.js';
import { Card } from '../js/model/Card.js';
import {
  SUITS, RANKS, GAME_TYPES, STACKS_PER_PLAYER,
} from '../js/config/constants.js';

const { FARB_SOLO, WENZ } = GAME_TYPES;
const card = (s, r) => new Card(s, r);

function makePlayers() {
  const mk = (name) => {
    const positions = Array.from({ length: STACKS_PER_PLAYER }, () =>
      new Position(
        card(SUITS.HERZ, RANKS.SIEBEN),
        card(SUITS.EICHEL, RANKS.ASS),
      ),
    );
    return new Player(name, positions);
  };
  return [mk('Anna'), mk('Bernd')];
}

/** State ohne Spielart – für INIT/GEBEN_1/ANSAGE. */
function makeStateWithoutGameType(declarerIndex = 0) {
  return new GameState({
    players: makePlayers(),
    declarerIndex,
  });
}

/** State mit gewählter Spielart – für alles ab GEBEN_2. */
function makeState() {
  return new GameState({
    players: makePlayers(),
    declarerIndex: 0,
    gameType: FARB_SOLO,
    soloSuit: SUITS.HERZ,
  });
}

describe('GameState – Konstruktion ohne Spielart', () => {
  test('gameType und soloSuit sind initial null', () => {
    const s = makeStateWithoutGameType();
    assert.equal(s.gameType, null);
    assert.equal(s.soloSuit, null);
    assert.ok(!s.hasGameType());
  });

  test('alle übrigen Initialwerte sind trotzdem gesetzt', () => {
    const s = makeStateWithoutGameType(1);
    assert.equal(s.phase, 'init');
    assert.equal(s.activePlayerIndex, 1);
    assert.equal(s.currentTrick.leaderIndex, 1);
    assert.deepEqual(s.points, [0, 0]);
    assert.deepEqual(s.tricksWon, [0, 0]);
    assert.deepEqual(s.announcements, {
      stoss:   { called: false, by: null },
      nochmal: { called: false, by: null },
    });
  });

  test('wirft, wenn soloSuit ohne gameType übergeben wird', () => {
    assert.throws(() => new GameState({
      players: makePlayers(),
      declarerIndex: 0,
      soloSuit: SUITS.HERZ,
    }));
  });

  test('wirft bei unbekannter Spielart', () => {
    assert.throws(() => new GameState({
      players: makePlayers(),
      declarerIndex: 0,
      gameType: 'ramsch',
    }));
  });
});

describe('GameState – setGameType', () => {
  test('setzt Farb-Solo mit soloSuit', () => {
    const s = makeStateWithoutGameType();
    s.setGameType(FARB_SOLO, SUITS.EICHEL);
    assert.equal(s.gameType, FARB_SOLO);
    assert.equal(s.soloSuit, SUITS.EICHEL);
    assert.ok(s.hasGameType());
  });

  test('setzt Wenz ohne soloSuit', () => {
    const s = makeStateWithoutGameType();
    s.setGameType(WENZ);
    assert.equal(s.gameType, WENZ);
    assert.equal(s.soloSuit, null);
  });

  test('wirft, wenn schon gesetzt', () => {
    const s = makeStateWithoutGameType();
    s.setGameType(FARB_SOLO, SUITS.HERZ);
    assert.throws(() => s.setGameType(WENZ));
  });

  test('wirft bei Farb-Solo ohne soloSuit', () => {
    const s = makeStateWithoutGameType();
    assert.throws(() => s.setGameType(FARB_SOLO));
  });

  test('wirft bei Wenz mit soloSuit', () => {
    const s = makeStateWithoutGameType();
    assert.throws(() => s.setGameType(WENZ, SUITS.HERZ));
  });
});

describe('GameState – Konstruktion mit Spielart', () => {
  test('Standardwerte sind gesetzt', () => {
    const s = makeState();
    assert.equal(s.phase, 'init');
    assert.equal(s.activePlayerIndex, 0);
    assert.deepEqual(s.points, [0, 0]);
    assert.deepEqual(s.tricksWon, [0, 0]);
    assert.deepEqual(s.announcements, {
      stoss:   { called: false, by: null },
      nochmal: { called: false, by: null },
    });
    assert.equal(s.currentTrick.plays.length, 0);
    assert.equal(s.completedTricks.length, 0);
  });

  test('activePlayerIndex und leaderIndex zeigen initial auf den Alleinspieler', () => {
    const s = makeState();
    assert.equal(s.activePlayerIndex, 0);
    assert.equal(s.currentTrick.leaderIndex, 0);

    const s2 = new GameState({
      players: makePlayers(),
      declarerIndex: 1,
      gameType: FARB_SOLO,
      soloSuit: SUITS.HERZ,
    });
    assert.equal(s2.activePlayerIndex, 1);
    assert.equal(s2.currentTrick.leaderIndex, 1);
  });

  test('wirft bei falscher Spielerzahl', () => {
    assert.throws(() => new GameState({
      players: [new Player('Anna')],
      declarerIndex: 0,
      gameType: WENZ,
    }));
  });

  test('wirft bei ungültigem declarerIndex', () => {
    assert.throws(() => new GameState({
      players: makePlayers(), declarerIndex: 2, gameType: WENZ,
    }));
  });

  test('Farb-Solo verlangt soloSuit', () => {
    assert.throws(() => new GameState({
      players: makePlayers(), declarerIndex: 0, gameType: FARB_SOLO,
    }));
  });

  test('Wenz verbietet soloSuit', () => {
    assert.throws(() => new GameState({
      players: makePlayers(), declarerIndex: 0, gameType: WENZ, soloSuit: SUITS.HERZ,
    }));
  });
});

describe('GameState – Abfragen', () => {
  test('declarer/opponent zeigen auf die richtigen Spieler', () => {
    const s = makeState();
    assert.equal(s.declarer.name, 'Anna');
    assert.equal(s.opponent.name, 'Bernd');
    assert.equal(s.opponentIndex, 1);
    assert.ok(s.isDeclarer(0));
    assert.ok(!s.isDeclarer(1));
    assert.equal(s.opponentOf(0), 1);
    assert.equal(s.opponentOf(1), 0);
  });

  test('declarer/opponent funktionieren auch ohne Spielart', () => {
    const s = makeStateWithoutGameType();
    assert.equal(s.declarer.name, 'Anna');
    assert.equal(s.opponent.name, 'Bernd');
  });

  test('declarerPoints/opponentPoints liefern die richtigen Werte', () => {
    const s = makeState();
    s.addPoints(0, 20);
    s.addPoints(1, 15);
    assert.equal(s.declarerPoints(), 20);
    assert.equal(s.opponentPoints(), 15);
  });

  test('isCurrentTrickComplete erst bei 2 plays', () => {
    const s = makeState();
    assert.ok(!s.isCurrentTrickComplete());
    s.currentTrick.plays.push({ playerIndex: 0, positionIndex: 0, card: card(SUITS.HERZ, RANKS.ASS) });
    assert.ok(!s.isCurrentTrickComplete());
    s.currentTrick.plays.push({ playerIndex: 1, positionIndex: 0, card: card(SUITS.HERZ, RANKS.ASS) });
    assert.ok(s.isCurrentTrickComplete());
  });
});

describe('GameState – Mutationen', () => {
  test('addPoints wirft bei ungültigem Index oder negativem Betrag', () => {
    const s = makeState();
    assert.throws(() => s.addPoints(2, 5));
    assert.throws(() => s.addPoints(0, -1));
  });

  test('addTrick zählt pro Spieler', () => {
    const s = makeState();
    s.addTrick(0);
    s.addTrick(0);
    s.addTrick(1);
    assert.deepEqual(s.tricksWon, [2, 1]);
  });

  test('setPhase akzeptiert nur bekannte Phasen', () => {
    const s = makeState();
    s.setPhase('spielen');
    assert.equal(s.phase, 'spielen');
    assert.throws(() => s.setPhase('zaubern'));
  });

  test('setPhase akzeptiert die neuen Phasen', () => {
    const s = makeState();
    s.setPhase('geben1');
    assert.equal(s.phase, 'geben1');
    s.setPhase('ansage_stoss');
    assert.equal(s.phase, 'ansage_stoss');
  });

  test('setStoss setzt called + by', () => {
    const s = makeState();
    s.setStoss(1);
    assert.deepEqual(s.announcements.stoss, { called: true, by: 1 });
  });

  test('setNochmal setzt called + by', () => {
    const s = makeState();
    s.setNochmal(0);
    assert.deepEqual(s.announcements.nochmal, { called: true, by: 0 });
  });

  test('setStoss/setNochmal werfen bei ungültigem Spieler-Index', () => {
    const s = makeState();
    assert.throws(() => s.setStoss(2));
    assert.throws(() => s.setNochmal(-1));
  });
});

describe('GameState – clone', () => {
  test('Klon ist tief (Positionen unabhängig)', () => {
    const s = makeState();
    const copy = s.clone();
    copy.declarer.playAt(0);
    assert.ok(s.declarer.positionAt(0).openCard !== null);
    assert.equal(copy.declarer.positionAt(0).openCard, null);
  });

  test('Klon kopiert Stiche ohne geteilte Play-Objekte', () => {
    const s = makeState();
    s.currentTrick.plays.push({
      playerIndex: 0, positionIndex: 0, card: card(SUITS.HERZ, RANKS.ASS),
    });
    const copy = s.clone();
    copy.currentTrick.plays[0].positionIndex = 99;
    assert.equal(s.currentTrick.plays[0].positionIndex, 0);
  });

  test('Klon kopiert Punkte, Tricks und Ansagen', () => {
    const s = makeState();
    s.addPoints(0, 30);
    s.addTrick(1);
    s.setStoss(1);
    const copy = s.clone();
    copy.addPoints(0, 5);
    copy.setNochmal(0);
    assert.equal(s.points[0], 30);
    assert.equal(s.tricksWon[1], 1);
    assert.equal(s.announcements.nochmal.called, false);
    assert.equal(s.announcements.stoss.called, true);
    assert.equal(s.announcements.stoss.by, 1);
  });

  test('Klon kopiert Ansage-Objekte unabhängig', () => {
    const s = makeState();
    s.setStoss(1);
    const copy = s.clone();
    copy.announcements.stoss.by = 99;
    assert.equal(s.announcements.stoss.by, 1);
  });

  test('Klon erhält Phase und activePlayerIndex', () => {
    const s = makeState();
    s.setPhase('spielen');
    s.activePlayerIndex = 1;
    const copy = s.clone();
    assert.equal(copy.phase, 'spielen');
    assert.equal(copy.activePlayerIndex, 1);
  });

  test('Klon eines States ohne Spielart hat weiterhin gameType=null', () => {
    const s = makeStateWithoutGameType();
    const copy = s.clone();
    assert.equal(copy.gameType, null);
    assert.equal(copy.soloSuit, null);
    // und kann die Spielart unabhängig wählen
    copy.setGameType(WENZ);
    assert.equal(s.gameType, null);
    assert.equal(copy.gameType, WENZ);
  });
});