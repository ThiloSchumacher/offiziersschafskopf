import { describe, test, assert } from './test-runner.js';
import { GameState } from '../js/model/GameState.js';
import { Player } from '../js/model/Player.js';
import {
  SUITS, GAME_TYPES, TOTAL_POINTS,
} from '../js/config/constants.js';
import { PHASES } from '../js/game/phases.js';
import { resultFor, RESULT_KIND } from '../js/rules/scoring.js';

const { FARB_SOLO } = GAME_TYPES;

// ---------------------------------------------------------------------------
// Testhelfer
// ---------------------------------------------------------------------------

/**
 * Baut einen State in Phase AUSWERTUNG mit vorgegebenen Punkten und
 * Stichzahlen. `declarerPoints` + `opponentPoints` müssen zusammen 120
 * ergeben; das ist die Verantwortung des Tests.
 *
 * announcements:
 *   null       → keine Ansage
 *   'stoss'    → Gegner sagt Stoß
 *   'nochmal'  → Gegner Stoß + Alleinspieler Nochmal
 */
function endgameState({
  declarerIndex = 0,
  declarerPoints = 61,
  declarerTricks = 8,
  announcements = null,
}) {
  const opponentPoints = TOTAL_POINTS - declarerPoints;
  const opponentTricks = 16 - declarerTricks;

  const s = new GameState({
    players: [new Player('A'), new Player('B')],
    declarerIndex,
    gameType: FARB_SOLO,
    soloSuit: SUITS.HERZ,
  });

  // Punkte direkt setzen – schneller als addPoints für jeden Einzelwert.
  const points = [0, 0];
  points[declarerIndex] = declarerPoints;
  points[1 - declarerIndex] = opponentPoints;
  s.points = points;

  const tricks = [0, 0];
  tricks[declarerIndex] = declarerTricks;
  tricks[1 - declarerIndex] = opponentTricks;
  s.tricksWon = tricks;

  if (announcements === 'stoss') {
    s.setStoss(1 - declarerIndex);
  } else if (announcements === 'nochmal') {
    s.setStoss(1 - declarerIndex);
    s.setNochmal(declarerIndex);
  }

  s.setPhase(PHASES.AUSWERTUNG);
  return s;
}

// ---------------------------------------------------------------------------
// Vorbedingungen
// ---------------------------------------------------------------------------

describe('scoring – Vorbedingungen', () => {
  test('wirft, wenn Phase nicht AUSWERTUNG ist', () => {
    const s = endgameState({});
    s.setPhase(PHASES.SPIELEN);
    assert.throws(() => resultFor(s));
  });

  test('wirft, wenn Punkte-Summe nicht 120 ist', () => {
    const s = endgameState({});
    s.points[0] = 40; // Summe jetzt 40 + 59 = 99
    assert.throws(() => resultFor(s));
  });
});

// ---------------------------------------------------------------------------
// Sieg / Niederlage des Alleinspielers
// ---------------------------------------------------------------------------

describe('scoring – Sieg und Niederlage', () => {
  test('61 Punkte: Alleinspieler gewinnt', () => {
    const r = resultFor(endgameState({ declarerPoints: 61 }));
    assert.ok(r.declarerWon);
    assert.equal(r.winnerIndex, 0);
    assert.equal(r.loserIndex, 1);
    assert.equal(r.declarerPoints, 61);
    assert.equal(r.opponentPoints, 59);
  });

  test('60 Punkte: Alleinspieler verliert', () => {
    const r = resultFor(endgameState({ declarerPoints: 60 }));
    assert.ok(!r.declarerWon);
    assert.equal(r.winnerIndex, 1);
    assert.equal(r.loserIndex, 0);
  });

  test('120 Punkte: Alleinspieler gewinnt klar', () => {
    const r = resultFor(endgameState({
      declarerPoints: 120, declarerTricks: 16,
    }));
    assert.ok(r.declarerWon);
    assert.equal(r.result, RESULT_KIND.SCHWARZ); // Gegner ohne Stich
  });

  test('0 Punkte: Alleinspieler verliert klar', () => {
    const r = resultFor(endgameState({
      declarerPoints: 0, declarerTricks: 0,
    }));
    assert.ok(!r.declarerWon);
    assert.equal(r.result, RESULT_KIND.SCHWARZ); // Alleinspieler ohne Stich
  });
});

// ---------------------------------------------------------------------------
// Schneider / Schwarz
// ---------------------------------------------------------------------------

describe('scoring – Schneider und Schwarz', () => {
  test('Verlierer 30 Punkte → Schneider', () => {
    // Alleinspieler gewinnt 90:30 → Gegner ist Schneider
    const r = resultFor(endgameState({
      declarerPoints: 90, declarerTricks: 10,
    }));
    assert.equal(r.result, RESULT_KIND.SCHNEIDER);
    assert.equal(r.resultMultiplier, 2);
  });

  test('Verlierer genau 31 Punkte → nicht Schneider', () => {
    // 89:31
    const r = resultFor(endgameState({
      declarerPoints: 89, declarerTricks: 9,
    }));
    assert.equal(r.result, RESULT_KIND.NORMAL);
    assert.equal(r.resultMultiplier, 1);
  });

  test('Verlierer 0 Stiche → Schwarz (auch wenn Punkte niedrig)', () => {
    const r = resultFor(endgameState({
      declarerPoints: 120, declarerTricks: 16,
    }));
    assert.equal(r.result, RESULT_KIND.SCHWARZ);
    assert.equal(r.resultMultiplier, 3);
  });

  test('Schwarz ersetzt Schneider (nicht 6×)', () => {
    // Verlierer hat 0 Punkte UND 0 Stiche – nur Schwarz-Multiplikator.
    const r = resultFor(endgameState({
      declarerPoints: 120, declarerTricks: 16,
    }));
    assert.equal(r.resultMultiplier, 3);
  });

  test('Verlierer 0 Stiche ohne Schneider-Situation gibt es nicht', () => {
    // Wer 0 Stiche hat, hat zwangsläufig 0 Punkte. Der Test dokumentiert
    // das, indem er prüft, dass ein "reiner Schwarz ohne Schneider"
    // in der Praxis zu Schwarz führt.
    const r = resultFor(endgameState({
      declarerPoints: 120, declarerTricks: 16,
    }));
    assert.equal(r.loserTricks, 0);
    assert.equal(r.loserPoints, 0);
    assert.equal(r.result, RESULT_KIND.SCHWARZ);
  });

  test('Gegner verliert Schneider (Alleinspieler verliert nicht)', () => {
    // Gegner gewinnt 90:30 → Alleinspieler ist Schneider
    const r = resultFor(endgameState({
      declarerPoints: 30, declarerTricks: 6,
    }));
    assert.ok(!r.declarerWon);
    assert.equal(r.result, RESULT_KIND.SCHNEIDER);
    assert.equal(r.loserIndex, 0);
    assert.equal(r.loserPoints, 30);
  });

  test('Gegner verliert Schwarz', () => {
    // Alleinspieler gewinnt 120:0
    const r = resultFor(endgameState({
      declarerPoints: 120, declarerTricks: 16,
    }));
    assert.equal(r.loserIndex, 1);
    assert.equal(r.result, RESULT_KIND.SCHWARZ);
  });
});

// ---------------------------------------------------------------------------
// Ansagen-Multiplikator
// ---------------------------------------------------------------------------

describe('scoring – Ansagen', () => {
  test('ohne Ansage: announcementMultiplier = 1', () => {
    const r = resultFor(endgameState({ declarerPoints: 70, declarerTricks: 9 }));
    assert.equal(r.announcementMultiplier, 1);
  });

  test('mit Stoß: announcementMultiplier = 2', () => {
    const r = resultFor(endgameState({
      declarerPoints: 70, declarerTricks: 9, announcements: 'stoss',
    }));
    assert.equal(r.announcementMultiplier, 2);
  });

  test('mit Stoß + Nochmal: announcementMultiplier = 4', () => {
    const r = resultFor(endgameState({
      declarerPoints: 70, declarerTricks: 9, announcements: 'nochmal',
    }));
    assert.equal(r.announcementMultiplier, 4);
  });
});

// ---------------------------------------------------------------------------
// Gesamtmultiplikator (Kombination aus Ergebnis und Ansagen)
// ---------------------------------------------------------------------------

describe('scoring – Gesamtmultiplikator', () => {
  test('normal ohne Ansage: 1 × 1 = 1', () => {
    const r = resultFor(endgameState({ declarerPoints: 70, declarerTricks: 9 }));
    assert.equal(r.totalMultiplier, 1);
  });

  test('normal mit Stoß: 1 × 2 = 2', () => {
    const r = resultFor(endgameState({
      declarerPoints: 70, declarerTricks: 9, announcements: 'stoss',
    }));
    assert.equal(r.totalMultiplier, 2);
  });

  test('Schneider ohne Ansage: 2 × 1 = 2', () => {
    const r = resultFor(endgameState({ declarerPoints: 90, declarerTricks: 10 }));
    assert.equal(r.result, RESULT_KIND.SCHNEIDER);
    assert.equal(r.totalMultiplier, 2);
  });

  test('Schneider mit Stoß: 2 × 2 = 4', () => {
    const r = resultFor(endgameState({
      declarerPoints: 90, declarerTricks: 10, announcements: 'stoss',
    }));
    assert.equal(r.totalMultiplier, 4);
  });

  test('Schneider mit Stoß + Nochmal: 2 × 4 = 8', () => {
    const r = resultFor(endgameState({
      declarerPoints: 90, declarerTricks: 10, announcements: 'nochmal',
    }));
    assert.equal(r.totalMultiplier, 8);
  });

  test('Schwarz mit Stoß: 3 × 2 = 6', () => {
    const r = resultFor(endgameState({
      declarerPoints: 120, declarerTricks: 16, announcements: 'stoss',
    }));
    assert.equal(r.totalMultiplier, 6);
  });

  test('Schwarz mit Stoß + Nochmal: 3 × 4 = 12', () => {
    const r = resultFor(endgameState({
      declarerPoints: 120, declarerTricks: 16, announcements: 'nochmal',
    }));
    assert.equal(r.totalMultiplier, 12);
  });

  test('Niederlage des Alleinspielers mit Stoß: Gegner gewinnt, Multiplikator zählt', () => {
    const r = resultFor(endgameState({
      declarerPoints: 50, declarerTricks: 7, announcements: 'stoss',
    }));
    assert.ok(!r.declarerWon);
    assert.equal(r.totalMultiplier, 2);
  });
});

// ---------------------------------------------------------------------------
// Rückgabestruktur
// ---------------------------------------------------------------------------

describe('scoring – Rückgabestruktur', () => {
  test('alle Felder sind gesetzt', () => {
    const r = resultFor(endgameState({ declarerPoints: 70, declarerTricks: 9 }));
    for (const key of [
      'declarerWon', 'winnerIndex', 'loserIndex', 'result',
      'resultMultiplier', 'announcementMultiplier', 'totalMultiplier',
      'declarerPoints', 'opponentPoints', 'loserPoints', 'loserTricks',
    ]) {
      assert.ok(key in r, `Feld "${key}" fehlt`);
    }
  });

  test('declarerPoints und opponentPoints stammen aus dem State', () => {
    const s = endgameState({ declarerPoints: 75, declarerTricks: 10 });
    const r = resultFor(s);
    assert.equal(r.declarerPoints, 75);
    assert.equal(r.opponentPoints, 45);
  });

  test('loserPoints/loserTricks beziehen sich auf den Verlierer', () => {
    const r = resultFor(endgameState({
      declarerPoints: 90, declarerTricks: 11,
    }));
    // Verlierer ist der Gegner (Index 1) mit 30 Punkten und 5 Stichen.
    assert.equal(r.loserIndex, 1);
    assert.equal(r.loserPoints, 30);
    assert.equal(r.loserTricks, 5);
  });

  test('funktioniert mit declarerIndex = 1', () => {
    const r = resultFor(endgameState({
      declarerIndex: 1, declarerPoints: 70, declarerTricks: 9,
    }));
    assert.ok(r.declarerWon);
    assert.equal(r.winnerIndex, 1);
    assert.equal(r.loserIndex, 0);
  });
});