import { describe, test, assert } from './test-runner.js';
import { GameController } from '../js/game/GameController.js';
import { EventBus } from '../js/game/EventBus.js';
import { PHASES } from '../js/game/phases.js';
import { Player } from '../js/model/Player.js';
import { Card } from '../js/model/Card.js';
import {
  SUITS, RANKS, GAME_TYPES, STACKS_PER_PLAYER, TOTAL_CARDS, TOTAL_POINTS,
} from '../js/config/constants.js';
import { createSeededRng } from '../js/utils/shuffle.js';
import { legalMoves } from '../js/rules/moves.js';

const { FARB_SOLO, WENZ } = GAME_TYPES;

// ---------------------------------------------------------------------------
// Testhelfer
// ---------------------------------------------------------------------------

function freshController(seed = 1, declarerIndex = 0) {
  const players = [new Player('A'), new Player('B')];
  const bus = new EventBus();
  const controller = new GameController({
    players,
    declarerIndex,
    rng: createSeededRng(seed),
    bus,
  });
  return { controller, bus };
}

/** Spielt das Spiel von INIT bis ANSAGE_STOSS durch. */
function setupToAnnounce(seed = 1, declarerIndex = 0) {
  const { controller, bus } = freshController(seed, declarerIndex);
  controller.start();
  controller.chooseGameType(FARB_SOLO, SUITS.HERZ);
  return { controller, bus };
}

/** Ab SPIELEN: spielt alle 16 Stiche durch. */
function playAllTricks(controller) {
  let safety = 0;
  while (controller.state.phase === PHASES.SPIELEN) {
    const active = controller.state.activePlayerIndex;
    const moves = legalMoves(controller.state);
    controller.playCard(active, moves[0]);
    if (++safety > 32) throw new Error('Endlosschleife in playAllTricks');
  }
}

// ---------------------------------------------------------------------------
// Phasenablauf
// ---------------------------------------------------------------------------

describe('GameController – Phasenablauf', () => {
  test('start() wechselt INIT → GEBEN_1 → ANSAGE', () => {
    const { controller, bus } = freshController();
    const phases = [];
    bus.on('phase:changed', (p) => phases.push(p.to));

    assert.equal(controller.state.phase, PHASES.INIT);
    controller.start();
    assert.equal(controller.state.phase, PHASES.ANSAGE);
    assert.deepEqual(phases, [PHASES.GEBEN_1, PHASES.ANSAGE]);
  });

  test('start() wirft, wenn nicht in INIT', () => {
    const { controller } = freshController();
    controller.start();
    assert.throws(() => controller.start());
  });

  test('chooseGameType() wechselt ANSAGE → GEBEN_2 → ANSAGE_STOSS', () => {
    const { controller, bus } = freshController();
    controller.start();
    const phases = [];
    bus.on('phase:changed', (p) => phases.push(p.to));
    controller.chooseGameType(WENZ);
    assert.equal(controller.state.phase, PHASES.ANSAGE_STOSS);
    assert.deepEqual(phases, [PHASES.GEBEN_2, PHASES.ANSAGE_STOSS]);
  });

  test('chooseGameType() wirft außerhalb ANSAGE', () => {
    const { controller } = freshController();
    assert.throws(() => controller.chooseGameType(WENZ));
  });

  test('finishAnnouncements() wechselt ANSAGE_STOSS → SPIELEN', () => {
    const { controller } = setupToAnnounce();
    controller.finishAnnouncements();
    assert.equal(controller.state.phase, PHASES.SPIELEN);
  });

  test('finishAnnouncements() wirft außerhalb ANSAGE_STOSS', () => {
    const { controller } = freshController();
    assert.throws(() => controller.finishAnnouncements());
  });

  test('finishGame() wechselt AUSWERTUNG → ENDE', () => {
    const { controller } = setupToAnnounce();
    controller.finishAnnouncements();
    playAllTricks(controller);
    assert.equal(controller.state.phase, PHASES.AUSWERTUNG);
    controller.finishGame();
    assert.equal(controller.state.phase, PHASES.ENDE);
  });
});

// ---------------------------------------------------------------------------
// Kartenverteilung
// ---------------------------------------------------------------------------

describe('GameController – Kartenverteilung', () => {
  test('nach GEBEN_1: Vorhand hat 4+4 Karten, Geber 4', () => {
    const { controller } = freshController();
    controller.start();
    const declarer = controller.state.declarer;
    const opponent = controller.state.opponent;

    assert.equal(declarer.cardCount(), 8); // 4 verdeckt + 4 offen
    assert.equal(opponent.cardCount(), 4); // 4 verdeckt

    // Erste 4 Positionen der Vorhand sind voll (hidden + open).
    for (let i = 0; i < 4; i++) {
      assert.ok(declarer.positionAt(i).hiddenCard !== null);
      assert.ok(declarer.positionAt(i).openCard !== null);
    }
    // Positionen 4..7 der Vorhand sind noch leer.
    for (let i = 4; i < STACKS_PER_PLAYER; i++) {
      assert.ok(declarer.positionAt(i).isEmpty());
    }
  });

  test('nach chooseGameType(): beide haben 16 Karten', () => {
    const { controller } = setupToAnnounce();
    assert.equal(controller.state.declarer.cardCount(), 16);
    assert.equal(controller.state.opponent.cardCount(), 16);
  });

  test('alle 32 Karten sind im Spiel (jede genau einmal)', () => {
    const { controller } = setupToAnnounce();
    const seen = new Set();
    for (const player of controller.state.players) {
      for (const pos of player.positions) {
        if (pos.hiddenCard) seen.add(pos.hiddenCard.toString());
        if (pos.openCard) seen.add(pos.openCard.toString());
      }
    }
    assert.equal(seen.size, TOTAL_CARDS);
  });

  test('mit gleichem Seed werden gleiche Karten verteilt', () => {
    const a = setupToAnnounce(42).controller;
    const b = setupToAnnounce(42).controller;
    for (let p = 0; p < 2; p++) {
      for (let i = 0; i < STACKS_PER_PLAYER; i++) {
        assert.ok(
          a.state.players[p].positionAt(i).openCard
            .equals(b.state.players[p].positionAt(i).openCard),
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Spielart und Ansagen
// ---------------------------------------------------------------------------

describe('GameController – Spielart', () => {
  test('chooseGameType setzt gameType im State', () => {
    const { controller } = freshController();
    controller.start();
    controller.chooseGameType(WENZ);
    assert.equal(controller.state.gameType, WENZ);
    assert.equal(controller.state.soloSuit, null);
  });

  test('Farb-Solo mit soloSuit', () => {
    const { controller } = freshController();
    controller.start();
    controller.chooseGameType(FARB_SOLO, SUITS.EICHEL);
    assert.equal(controller.state.gameType, FARB_SOLO);
    assert.equal(controller.state.soloSuit, SUITS.EICHEL);
  });

  test('callStoss wirft außerhalb ANSAGE_STOSS', () => {
    const { controller } = freshController();
    controller.start();
    assert.throws(() => controller.callStoss());
  });
});

describe('GameController – Ansagen', () => {
  test('callStoss durch Gegner', () => {
    const { controller, bus } = setupToAnnounce();
    const events = [];
    bus.on('announcement:stoss', (e) => events.push(e));
    controller.callStoss();
    assert.deepEqual(controller.state.announcements.stoss, { called: true, by: 1 });
    assert.equal(events.length, 1);
    assert.equal(events[0].by, 1);
  });

  test('callNochmal durch Alleinspieler nach Stoß', () => {
    const { controller } = setupToAnnounce();
    controller.callStoss();
    controller.callNochmal();
    assert.deepEqual(controller.state.announcements.nochmal, { called: true, by: 0 });
  });

  test('callNochmal ohne Stoß wirft', () => {
    const { controller } = setupToAnnounce();
    assert.throws(() => controller.callNochmal());
  });

  test('mehrfacher Stoß wirft', () => {
    const { controller } = setupToAnnounce();
    controller.callStoss();
    assert.throws(() => controller.callStoss());
  });
});

// ---------------------------------------------------------------------------
// Karten spielen
// ---------------------------------------------------------------------------

describe('GameController – playCard', () => {
  test('legt die Karte und wechselt den aktiven Spieler', () => {
    const { controller } = setupToAnnounce();
    controller.finishAnnouncements();
    const active = controller.state.activePlayerIndex;
    const moves = legalMoves(controller.state);
    controller.playCard(active, moves[0]);
    assert.equal(controller.state.activePlayerIndex, 1 - active);
    assert.equal(controller.state.currentTrick.plays.length, 1);
  });

  test('zweiter Play schließt den Stich ab', () => {
    const { controller } = setupToAnnounce();
    controller.finishAnnouncements();

    const p0 = controller.state.activePlayerIndex;
    controller.playCard(p0, legalMoves(controller.state)[0]);
    const p1 = controller.state.activePlayerIndex;
    controller.playCard(p1, legalMoves(controller.state)[0]);

    assert.equal(controller.state.completedTricks.length, 1);
    assert.equal(controller.state.currentTrick.plays.length, 0);
  });

  test('wirft, wenn der falsche Spieler zieht', () => {
    const { controller } = setupToAnnounce();
    controller.finishAnnouncements();
    const active = controller.state.activePlayerIndex;
    const other = 1 - active;
    assert.throws(() => controller.playCard(other, 0));
  });

  test('wirft bei illegalem Zug', () => {
    const { controller } = setupToAnnounce();
    controller.finishAnnouncements();
    // Vor dem ersten Play prüfen wir: alle Positionen sind legal,
    // weil der aktive Spieler führt. Also einen falschen Index wählen.
    assert.throws(() => controller.playCard(controller.state.activePlayerIndex, 99));
  });

  test('wirft außerhalb Phase SPIELEN', () => {
    const { controller } = freshController();
    controller.start();
    assert.throws(() => controller.playCard(0, 0));
  });
});

// ---------------------------------------------------------------------------
// Vollständiges Spiel
// ---------------------------------------------------------------------------

describe('GameController – vollständiges Spiel', () => {
  test('16 Stiche werden gespielt, dann AUSWERTUNG', () => {
    const { controller } = setupToAnnounce();
    controller.finishAnnouncements();
    playAllTricks(controller);
    assert.equal(controller.state.completedTricks.length, 16);
    assert.equal(controller.state.phase, PHASES.AUSWERTUNG);
  });

  test('Punkte-Summe ist 120', () => {
    const { controller } = setupToAnnounce();
    controller.finishAnnouncements();
    playAllTricks(controller);
    assert.equal(controller.state.points[0] + controller.state.points[1], TOTAL_POINTS);
  });

  test('Stich-Summe ist 16', () => {
    const { controller } = setupToAnnounce();
    controller.finishAnnouncements();
    playAllTricks(controller);
    assert.equal(controller.state.tricksWon[0] + controller.state.tricksWon[1], 16);
  });

  test('game:end-Event wird gefeuert mit Ergebnis', () => {
    const { controller, bus } = setupToAnnounce();
    controller.finishAnnouncements();
    let result = null;
    bus.on('game:end', (r) => { result = r; });
    playAllTricks(controller);
    assert.ok(result !== null);
    assert.ok(typeof result.declarerWon === 'boolean');
    assert.ok(typeof result.totalMultiplier === 'number');
  });

  test('trick:resolved wird 16× gefeuert', () => {
    const { controller, bus } = setupToAnnounce();
    controller.finishAnnouncements();
    let count = 0;
    bus.on('trick:resolved', () => count++);
    playAllTricks(controller);
    assert.equal(count, 16);
  });

  test('card:played wird 32× gefeuert', () => {
    const { controller, bus } = setupToAnnounce();
    controller.finishAnnouncements();
    let count = 0;
    bus.on('card:played', () => count++);
    playAllTricks(controller);
    assert.equal(count, 32);
  });

  test('funktioniert auch mit declarerIndex = 1', () => {
    const { controller } = setupToAnnounce(7, 1);
    controller.finishAnnouncements();
    playAllTricks(controller);
    assert.equal(controller.state.phase, PHASES.AUSWERTUNG);
    assert.equal(controller.state.points[0] + controller.state.points[1], TOTAL_POINTS);
  });

  test('funktioniert auch mit Wenz', () => {
    const { controller } = freshController(99);
    controller.start();
    controller.chooseGameType(WENZ);
    controller.finishAnnouncements();
    playAllTricks(controller);
    assert.equal(controller.state.phase, PHASES.AUSWERTUNG);
  });
});