import { describe, test, assert } from './test-runner.js';
import { GameState } from '../js/model/GameState.js';
import { Player } from '../js/model/Player.js';
import { Position } from '../js/model/Position.js';
import { Card } from '../js/model/Card.js';
import {
  SUITS, RANKS, GAME_TYPES, STACKS_PER_PLAYER, TOTAL_TRICKS,
} from '../js/config/constants.js';
import { PHASES } from '../js/game/phases.js';
import { buildAIView } from '../js/ai/AIView.js';

const { FARB_SOLO, WENZ } = GAME_TYPES;
const c = (s, r) => new Card(s, r);

// ---------------------------------------------------------------------------
// Testhelfer
// ---------------------------------------------------------------------------

/**
 * Baut einen State in Phase SPIELEN mit klar unterscheidbaren Karten:
 *   - Spieler 0 (KI): Position i → hidden=herz-7, open=eichel-<rank_i>
 *   - Spieler 1:      Position i → hidden=laub-7,  open=schellen-<rank_i>
 */
function stateForAI({ phase = PHASES.SPIELEN } = {}) {
  const ranks = [RANKS.ASS, RANKS.ZEHN, RANKS.KOENIG, RANKS.OBER,
                 RANKS.UNTER, RANKS.NEUN, RANKS.ACHT, RANKS.SIEBEN];

  const mk = (hid, suit) => {
    const positions = [];
    for (let i = 0; i < STACKS_PER_PLAYER; i++) {
      positions.push(new Position(
        c(hid, RANKS.SIEBEN),
        c(suit, ranks[i]),
      ));
    }
    return positions;
  };

  const p0 = new Player('KI', mk(SUITS.HERZ, SUITS.EICHEL));
  const p1 = new Player('Gegner', mk(SUITS.LAUB, SUITS.SCHELLEN));

  const s = new GameState({
    players: [p0, p1],
    declarerIndex: 0,
    gameType: FARB_SOLO,
    soloSuit: SUITS.HERZ,
  });
  s.setPhase(phase);
  return s;
}

// ---------------------------------------------------------------------------
// Grundstruktur
// ---------------------------------------------------------------------------

describe('AIView – Grundstruktur', () => {
  test('wirft, wenn Spielart nicht gewählt', () => {
    const s = new GameState({
      players: [new Player('A'), new Player('B')],
      declarerIndex: 0,
    });
    assert.throws(() => buildAIView(s, 0));
  });

  test('wirft, wenn Phase nicht SPIELEN ist', () => {
    const s = stateForAI({ phase: PHASES.ANSAGE_STOSS });
    assert.throws(() => buildAIView(s, 0));
    s.setPhase(PHASES.AUSWERTUNG);
    assert.throws(() => buildAIView(s, 0));
    s.setPhase(PHASES.ENDE);
    assert.throws(() => buildAIView(s, 0));
  });

  test('wirft bei ungültigem playerIndex', () => {
    const s = stateForAI();
    assert.throws(() => buildAIView(s, 2));
    assert.throws(() => buildAIView(s, -1));
  });

  test('enthält Kopfdaten aus dem State', () => {
    const s = stateForAI();
    s.points = [40, 20];
    s.tricksWon = [3, 2];
    const v = buildAIView(s, 0);
    assert.equal(v.playerIndex, 0);
    assert.equal(v.opponentIndex, 1);
    assert.equal(v.gameType, FARB_SOLO);
    assert.equal(v.soloSuit, SUITS.HERZ);
    assert.equal(v.phase, PHASES.SPIELEN);
    assert.equal(v.myPoints, 40);
    assert.equal(v.oppPoints, 20);
    assert.equal(v.myTricks, 3);
    assert.equal(v.oppTricks, 2);
    assert.equal(v.completedTricksCount, 0);
    assert.equal(v.totalTricks, TOTAL_TRICKS);
    assert.equal(v.totalTricks, 16);
  });

  test('view für Spieler 1 dreht die Perspektive', () => {
    const s = stateForAI();
    const v = buildAIView(s, 1);
    assert.equal(v.playerIndex, 1);
    assert.equal(v.opponentIndex, 0);
  });
});

// ---------------------------------------------------------------------------
// Karten-Sicht
// ---------------------------------------------------------------------------

describe('AIView – Karten-Sicht', () => {
  test('meine offenen Karten sind sichtbar', () => {
    const s = stateForAI();
    const v = buildAIView(s, 0);
    assert.equal(v.myOpenCards.length, 8);
    assert.equal(v.myOpenCards[0].positionIndex, 0);
    assert.ok(v.myOpenCards[0].card.equals(c(SUITS.EICHEL, RANKS.ASS)));
  });

  test('gegnerische offene Karten sind sichtbar', () => {
    const s = stateForAI();
    const v = buildAIView(s, 0);
    assert.equal(v.oppOpenCards.length, 8);
    assert.equal(v.oppOpenCards[0].positionIndex, 0);
    assert.ok(v.oppOpenCards[0].card.equals(c(SUITS.SCHELLEN, RANKS.ASS)));
  });

  test('verborgene Karten sind NICHT enthalten', () => {
    const s = stateForAI();
    const v = buildAIView(s, 0);

    // Kein Feld "myHiddenCards" oder "oppHiddenCards".
    assert.ok(!('myHiddenCards' in v));
    assert.ok(!('oppHiddenCards' in v));

    // Karten werden über Card.toString() serialisiert – das liefert
    // "herz-7", nicht "herz-sieben". Die Prüfstrings müssen deshalb
    // aus dem tatsächlichen toString() kommen, sonst testet der Test
    // nur, dass die falschen Literale nicht auftauchen.
    const hidden0 = c(SUITS.HERZ, RANKS.SIEBEN).toString();
    const hidden1 = c(SUITS.LAUB, RANKS.SIEBEN).toString();
    assert.equal(hidden0, 'herz-7');
    assert.equal(hidden1, 'laub-7');

    const allCardStrings = JSON.stringify(v, (k, val) => {
      if (val instanceof Card) return val.toString();
      return val;
    });
    assert.ok(!allCardStrings.includes(hidden0), `verdeckte Karte ${hidden0} durchgesickert`);
    assert.ok(!allCardStrings.includes(hidden1), `verdeckte Karte ${hidden1} durchgesickert`);
  });

  test('nach play() fehlt die gespielte Karte aus meinen offenen', () => {
    const s = stateForAI();
    s.players[0].playAt(0);
    s.currentTrick.plays.push({
      playerIndex: 0, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS),
    });

    const v = buildAIView(s, 0);
    assert.equal(v.myOpenCards.length, 7);
    assert.ok(!v.myOpenCards.some((e) => e.positionIndex === 0));
    assert.ok(v.playedCards.some((card) => card.equals(c(SUITS.EICHEL, RANKS.ASS))));
  });

  test('nach reveal() ist die ehemals verborgene Karte sichtbar', () => {
    const s = stateForAI();
    s.players[0].playAt(0);
    s.players[0].revealAt(0);

    const v = buildAIView(s, 0);
    assert.equal(v.myOpenCards.length, 8);
    const pos0 = v.myOpenCards.find((e) => e.positionIndex === 0);
    assert.ok(pos0.card.equals(c(SUITS.HERZ, RANKS.SIEBEN)));
  });
});

// ---------------------------------------------------------------------------
// Stich-Historie
// ---------------------------------------------------------------------------

describe('AIView – Stich-Historie', () => {
  test('playedCards enthält Karten aus abgeschlossenen und laufendem Stich', () => {
    const s = stateForAI();
    s.completedTricks.push({
      leaderIndex: 0,
      plays: [
        { playerIndex: 0, positionIndex: 5, card: c(SUITS.HERZ, RANKS.ASS) },
        { playerIndex: 1, positionIndex: 5, card: c(SUITS.HERZ, RANKS.ZEHN) },
      ],
    });
    s.currentTrick.plays.push({
      playerIndex: 0, positionIndex: 6, card: c(SUITS.EICHEL, RANKS.SIEBEN),
    });

    const v = buildAIView(s, 0);
    assert.equal(v.playedCards.length, 3);
  });

  test('currentTrick ist eine flache Kopie', () => {
    const s = stateForAI();
    s.currentTrick.plays.push({
      playerIndex: 0, positionIndex: 0, card: c(SUITS.EICHEL, RANKS.ASS),
    });
    const v = buildAIView(s, 0);
    v.currentTrick.plays[0].positionIndex = 99;
    assert.equal(s.currentTrick.plays[0].positionIndex, 0);
  });
});

// ---------------------------------------------------------------------------
// Spielart-Varianten
// ---------------------------------------------------------------------------

describe('AIView – Spielart-Varianten', () => {
  test('Wenz: soloSuit ist null', () => {
    const s = new GameState({
      players: [new Player('A'), new Player('B')],
      declarerIndex: 0,
      gameType: WENZ,
    });
    s.setPhase(PHASES.SPIELEN);
    const v = buildAIView(s, 0);
    assert.equal(v.gameType, WENZ);
    assert.equal(v.soloSuit, null);
  });
});