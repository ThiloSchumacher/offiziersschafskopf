import { describe, test, assert } from './test-runner.js';
import { GameState } from '../js/model/GameState.js';
import { Player } from '../js/model/Player.js';
import { Position } from '../js/model/Position.js';
import { Card } from '../js/model/Card.js';
import {
  SUITS, RANKS, GAME_TYPES, STACKS_PER_PLAYER,
} from '../js/config/constants.js';
import { PHASES } from '../js/game/phases.js';
import {
  canAnnounceStoss,
  canAnnounceNochmal,
  announceStoss,
  announceNochmal,
  currentMultiplier,
} from '../js/rules/ansagen.js';

const card = (s, r) => new Card(s, r);

function makeState() {
  const mk = (name) => {
    const positions = Array.from({ length: STACKS_PER_PLAYER }, () =>
      new Position(
        card(SUITS.HERZ, RANKS.SIEBEN),
        card(SUITS.EICHEL, RANKS.ASS),
      ),
    );
    return new Player(name, positions);
  };
  return new GameState({
    players: [mk('Anna'), mk('Bernd')],
    declarerIndex: 0,
    gameType: GAME_TYPES.FARB_SOLO,
    soloSuit: SUITS.HERZ,
  });
}

describe('ansagen – canAnnounceStoss', () => {
  test('in falscher Phase verboten', () => {
    const s = makeState();
    s.setPhase(PHASES.SPIELEN);
    assert.ok(!canAnnounceStoss(s, 1));
  });

  test('Alleinspieler darf nie Stoß sagen', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    assert.ok(!canAnnounceStoss(s, 0));
  });

  test('Gegner darf Stoß sagen', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    assert.ok(canAnnounceStoss(s, 1));
  });

  test('nach gefallenem Stoß nicht erneut', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    announceStoss(s, 1);
    assert.ok(!canAnnounceStoss(s, 1));
  });
});

describe('ansagen – canAnnounceNochmal', () => {
  test('ohne Stoß verboten', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    assert.ok(!canAnnounceNochmal(s, 0));
  });

  test('Gegner darf kein Nochmal sagen', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    announceStoss(s, 1);
    assert.ok(!canAnnounceNochmal(s, 1));
  });

  test('Alleinspieler darf nach Stoß Nochmal sagen', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    announceStoss(s, 1);
    assert.ok(canAnnounceNochmal(s, 0));
  });

  test('nach gefallenem Nochmal nicht erneut', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    announceStoss(s, 1);
    announceNochmal(s, 0);
    assert.ok(!canAnnounceNochmal(s, 0));
  });
});

describe('ansagen – announceStoss / announceNochmal', () => {
  test('announceStoss wirft bei unzulässiger Ansage', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    assert.throws(() => announceStoss(s, 0)); // Alleinspieler
  });

  test('announceNochmal wirft ohne Stoß', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    assert.throws(() => announceNochmal(s, 0));
  });

  test('announceStoss setzt called + by', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    announceStoss(s, 1);
    assert.deepEqual(s.announcements.stoss, { called: true, by: 1 });
  });

  test('announceNochmal setzt called + by', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    announceStoss(s, 1);
    announceNochmal(s, 0);
    assert.deepEqual(s.announcements.nochmal, { called: true, by: 0 });
  });
});

describe('ansagen – currentMultiplier', () => {
  test('ohne Ansage: 1', () => {
    assert.equal(currentMultiplier(makeState()), 1);
  });

  test('mit Stoß: 2', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    announceStoss(s, 1);
    assert.equal(currentMultiplier(s), 2);
  });

  test('mit Stoß + Nochmal: 4', () => {
    const s = makeState();
    s.setPhase(PHASES.ANSAGE_STOSS);
    announceStoss(s, 1);
    announceNochmal(s, 0);
    assert.equal(currentMultiplier(s), 4);
  });
});