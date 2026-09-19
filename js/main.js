/**
 * main.js
 * Einstiegspunkt: Screens verdrahten, GameController aufbauen,
 * Events auf Rendering, Dialoge, Animationen und Sound abbilden.
 *
 * Zwei Modi:
 *   'hotseat'  beide Spieler wechseln sich am selben Gerät ab
 *   'ai'       Spieler 0 ist der Mensch, Spieler 1 ist die KI
 *
 * Sounds:
 *   - card-play  → bei jedem card:played, sofort
 *   - trick-win  → bei jedem trick:resolved, mit 200 ms Verzögerung
 *   - card-flip  → einmal pro Stich, wenn mindestens eine Karte aufgedeckt wird
 *   - game-win / game-lose → bei game:end, abhängig vom Modus
 *
 * Karten-Flug (Flicker-Fix):
 *   Der GameController.playCard läuft komplett synchron und ruft
 *   applyTrickResult → revealAll auf, BEVOR die Events feuern. Der
 *   State ist also direkt nach dem zweiten Play bereits revealed.
 *
 *   In handleCardPlayed wird deshalb bei `trickResolvedByThisPlay`
 *   KEIN volles renderAll aufgerufen, sondern nur die gespielte
 *   Stack-Position per sourceEl.remove() geleert.
 *
 *   Zweiter Flicker-Fix: `toRect` wird aus dem Trick-Slot gemessen
 *   (feste Größe laut CSS), BEVOR die Trick-Karte eingefügt wird.
 *   Dadurch entfällt das `await nextFrame()` zwischen remove und
 *   flyCard – der Ghost wird im selben synchronen Block erzeugt wie
 *   die Entfernung. So gibt es keinen Paint-Frame, in dem die Karte
 *   weder im Stack noch als Ghost sichtbar ist.
 *
 * Reveal-Flip:
 *   `pendingHiddenPositions` hält die revealed Karten während der
 *   Flip-Phase unsichtbar, damit sie nicht als Vorderseite aufblitzen,
 *   bevor der Flip-Ghost sie überdeckt.
 */

import { GameController } from './game/GameController.js';
import { Player } from './model/Player.js';
import { PHASES } from './game/phases.js';
import { SUITS, GAME_TYPES } from './config/constants.js';
import { renderAll, renderResult } from './ui/render.js';
import {
  closeOpenDialog,
  showChoiceDialog,
  showInfoDialog,
} from './ui/components/Dialog.js';
import {
  isMuted,
  playSound,
  toggleMute,
  unlockAudio,
} from './ui/sounds.js';
import { legalMoves } from './rules/moves.js';
import { buildAIView } from './ai/AIView.js';
import { chooseMove, DIFFICULTY, DIFFICULTY_LIST } from './ai/HeuristicAI.js';
import {
  loadStats,
  recordGame,
  resetStats,
} from './utils/storage.js';
import {
  clearTrickSlots,
  findCardInStack,
  flipReveal,
  flyCard,
  flyCardToTarget,
  waitFor,
} from './ui/animations.js';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const AI_MOVE_DELAY_MS = 600;
const RESULT_DELAY_MS = 400;
const TRICK_HOLD_MS = 500;
const REVEAL_FLIP_MS = 400;
const WINNER_FLY_MS = 420;
const WINNER_FLY_DELAY_MS = 60;
const TRICK_WIN_SOUND_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Regel-Text für den Hilfe-Dialog
// ---------------------------------------------------------------------------

const RULES_SECTIONS = [
  {
    heading: 'Spielart',
    body: 'Farb-Solo: Eine Farbe wird Trumpf. Zusätzlich sind alle 4 Ober und alle 4 Unter Trumpf. '
        + 'Wenz: Nur die 4 Unter sind Trumpf, Ober zählen als normale Farbkarten.',
  },
  {
    heading: 'Trumpf-Reihenfolge (Farb-Solo)',
    body: 'Eichel-Ober > Laub-Ober > Herz-Ober > Schellen-Ober > Eichel-Unter > Laub-Unter > '
        + 'Herz-Unter > Schellen-Unter > Ass der Solo-Farbe > 10 > König > 9 > 8 > 7.',
  },
  {
    heading: 'Trumpf-Reihenfolge (Wenz)',
    body: 'Eichel-Unter > Laub-Unter > Herz-Unter > Schellen-Unter. Alle anderen Karten sind '
        + 'normale Farbkarten mit Reihenfolge Ass > 10 > König > Ober > 9 > 8 > 7.',
  },
  {
    heading: 'Punkte',
    body: 'Ass = 11, 10 = 10, König = 4, Ober = 3, Unter = 2, 9 / 8 / 7 = 0. Insgesamt 120 Punkte im Spiel.',
  },
  {
    heading: 'Ziel',
    body: 'Der Alleinspieler gewinnt ab 61 Punkten. Schneider: Verlierer unter 31 Punkten (×2). '
        + 'Schwarz: Verlierer ohne einen Stich (×3).',
  },
  {
    heading: 'Ansagen',
    body: 'Stoß: Der Gegner verdoppelt den Spielwert (×2). Nochmal: Der Alleinspieler kontert, '
        + 'vervierfacht also (×4 insgesamt).',
  },
  {
    heading: 'Bedienpflicht',
    body: 'Wer Trumpf anspielt, muss Trumpf zugeben. Wer eine Nicht-Trumpf-Farbe anspielt, muss '
        + 'diese Farbe bedienen. Ober und Unter zählen dabei nicht zur Farbe ihres Zeichens, '
        + 'sondern sind selbst Trumpf.',
  },
  {
    heading: 'Spielablauf',
    body: 'Vorhand wählt die Spielart. Jeder Stack hat eine verdeckte und eine offene Karte. Pro '
        + 'Stich legt jeder eine Karte. Nach dem Stich wird die verdeckte Karte der gespielten '
        + 'Position aufgedeckt. 16 Stiche insgesamt, dann Auswertung.',
  },
];

// ---------------------------------------------------------------------------
// Modul-Zustand
// ---------------------------------------------------------------------------

/** @type {GameController|null} */
let controller = null;

/** 'hotseat' | 'ai' | null */
let gameMode = null;

let aiDifficulty = DIFFICULTY.MEDIUM;

let animationInProgress = false;

let epoch = 0;

/**
 * Keys "playerIndex:positionIndex" für Positionen, die während der
 * Reveal-Flip-Phase unsichtbar gerendert werden sollen. Wird nur in
 * handleTrickResolved gesetzt und direkt nach den Flips wieder geleert.
 *
 * @type {Set<string>}
 */
let pendingHiddenPositions = new Set();

const animationQueue = [];
let processingQueue = false;

const SCREENS = ['start', 'game', 'result'];

// ---------------------------------------------------------------------------
// Screen-Navigation
// ---------------------------------------------------------------------------

function showScreen(name) {
  if (!SCREENS.includes(name)) {
    throw new Error(`main: unbekannter Screen "${name}"`);
  }
  for (const s of SCREENS) {
    document.getElementById(`screen-${s}`).classList.toggle('is-active', s === name);
  }
}

// ---------------------------------------------------------------------------
// Warteschlange
// ---------------------------------------------------------------------------

function enqueue(handler) {
  animationQueue.push(handler);
  processQueue();
}

async function processQueue() {
  if (processingQueue) return;
  processingQueue = true;
  try {
    while (animationQueue.length > 0) {
      const handler = animationQueue.shift();
      await handler();
    }
  } finally {
    processingQueue = false;
  }
}

// ---------------------------------------------------------------------------
// Interaktivität
// ---------------------------------------------------------------------------

function isPlayerInteractive(playerIndex) {
  if (gameMode === 'hotseat') return true;
  return playerIndex === 0;
}

// ---------------------------------------------------------------------------
// Render-Helfer
// ---------------------------------------------------------------------------

function rerender() {
  if (!controller) return;
  renderAll(controller.state, {
    onCardClick: handleCardClick,
    isPlayerInteractive,
    hiddenPositions: pendingHiddenPositions,
  });
}

// ---------------------------------------------------------------------------
// Statistik-Anzeige
// ---------------------------------------------------------------------------

function renderStatsBlock() {
  const block = document.getElementById('stats-block');
  const sections = document.getElementById('stats-sections');
  if (!block || !sections) return;

  const stats = loadStats();
  const hasAny = stats.hotseat.games > 0 || stats.ai.games > 0;

  block.hidden = !hasAny;
  sections.innerHTML = '';

  if (!hasAny) return;

  if (stats.ai.games > 0) {
    sections.appendChild(makeStatsSection('Mensch vs KI', {
      'Spiele':       stats.ai.games,
      'Siege Du':     stats.ai.winsDeclarer,
      'Siege KI':     stats.ai.winsDefender,
      'Schneider':    stats.ai.schneider,
      'Schwarz':      stats.ai.schwarz,
      'Bester Wert':  `×${stats.ai.bestMultiplier}`,
    }));
  }

  if (stats.hotseat.games > 0) {
    sections.appendChild(makeStatsSection('Mensch vs Mensch', {
      'Spiele':            stats.hotseat.games,
      'Siege Vorhand':     stats.hotseat.winsDeclarer,
      'Siege Gegner':      stats.hotseat.winsDefender,
      'Schneider':         stats.hotseat.schneider,
      'Schwarz':           stats.hotseat.schwarz,
      'Bester Wert':       `×${stats.hotseat.bestMultiplier}`,
    }));
  }
}

function makeStatsSection(title, rows) {
  const section = document.createElement('div');
  section.className = 'stats__section';

  const h = document.createElement('h3');
  h.className = 'stats__section-title';
  h.textContent = title;
  section.appendChild(h);

  const dl = document.createElement('dl');
  dl.className = 'stats__list';

  for (const [label, value] of Object.entries(rows)) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  section.appendChild(dl);
  return section;
}

// ---------------------------------------------------------------------------
// Mute-Anzeige
// ---------------------------------------------------------------------------

function updateMuteIcon() {
  const el = document.querySelector('[data-bind="mute-icon"]');
  if (el) el.textContent = isMuted() ? '🔇' : '🔊';
}

// ---------------------------------------------------------------------------
// Partie starten
// ---------------------------------------------------------------------------

function newGame(mode, options = {}) {
  if (mode !== 'hotseat' && mode !== 'ai') {
    throw new Error(`newGame: unbekannter Modus "${mode}"`);
  }
  if (controller) controller.bus.clear();

  epoch++;
  animationQueue.length = 0;
  animationInProgress = false;
  pendingHiddenPositions = new Set();
  gameMode = mode;

  if (mode === 'ai') {
    aiDifficulty = options.difficulty ?? DIFFICULTY.MEDIUM;
  }

  const players = [new Player('Du'), new Player('Gegner')];
  const declarerIndex = 0;

  controller = new GameController({ players, declarerIndex });
  window.game = controller; // DEBUG

  wireControllerEvents(controller);
  clearTrickSlots();
  showScreen('game');
  controller.start();
}

// ---------------------------------------------------------------------------
// Controller-Events
// ---------------------------------------------------------------------------

function wireControllerEvents(c) {
  const myEpoch = epoch;

  c.bus.on('phase:changed', ({ to }) => {
    rerender();
    handlePhase(c, to);
  });
  c.bus.on('cards:dealt', rerender);
  c.bus.on('gameType:chosen', rerender);
  c.bus.on('announcement:stoss', rerender);
  c.bus.on('announcement:nochmal', rerender);

  c.bus.on('card:played', (payload) => {
    playSound('card-play');
    enqueue(() => handleCardPlayed(payload, myEpoch));
  });

  c.bus.on('trick:resolved', (payload) => {
    playSound('trick-win', { delayMs: TRICK_WIN_SOUND_DELAY_MS });
    enqueue(() => handleTrickResolved(payload, myEpoch));
  });

  c.bus.on('game:end', (result) => {
    try {
      recordGame(gameMode, result);
    } catch (err) {
      console.error('storage: Statistik konnte nicht gespeichert werden', err);
    }

    const humanWon = gameMode === 'ai'
      ? result.winnerIndex === 0
      : result.winnerIndex === c.state.declarerIndex;
    playSound(humanWon ? 'game-win' : 'game-lose');

    enqueue(async () => {
      if (myEpoch !== epoch) return;
      await waitFor(RESULT_DELAY_MS);
      if (myEpoch !== epoch) return;
      pendingHiddenPositions = new Set();
      clearTrickSlots();
      rerender();
      renderResult(result);
      showScreen('result');
      c.finishGame();
    });
  });
}

// ---------------------------------------------------------------------------
// KI-Zug
// ---------------------------------------------------------------------------

async function tryRunAIMoveIfActive(myEpoch) {
  if (myEpoch !== epoch) return;
  if (gameMode !== 'ai') return;

  const c = controller;
  if (!c) return;
  if (c.state.phase !== PHASES.SPIELEN) return;
  if (c.state.activePlayerIndex !== 1) return;

  await waitFor(AI_MOVE_DELAY_MS);

  if (myEpoch !== epoch) return;
  if (gameMode !== 'ai') return;
  if (!controller) return;
  if (controller.state.phase !== PHASES.SPIELEN) return;
  if (controller.state.activePlayerIndex !== 1) return;

  const view = buildAIView(controller.state, 1);
  const legal = legalMoves(controller.state);
  const positionIndex = chooseMove(view, legal, {
    randomness: aiDifficulty.randomness,
  });
  controller.playCard(1, positionIndex);
}

// ---------------------------------------------------------------------------
// Animation: Karte wird gespielt
// ---------------------------------------------------------------------------

async function handleCardPlayed({ playerIndex, positionIndex }, myEpoch) {
  if (myEpoch !== epoch) return;
  if (!controller) return;

  const trickResolvedByThisPlay =
    controller.state.currentTrick.plays.length === 0;

  animationInProgress = true;
  try {
    const sourceEl = findCardInStack(playerIndex, positionIndex);
    if (!sourceEl) {
      rerender();
      return;
    }

    const fromRect = sourceEl.getBoundingClientRect();
    const imgEl = sourceEl.querySelector('.card__img');
    const imageSrc = imgEl?.src ?? null;

    const trickSlot = document.querySelector(
      `.trick__slot[data-player="${playerIndex}"]`,
    );
    if (!trickSlot) return;

    // toRect aus dem Trick-Slot messen, BEVOR die Trick-Karte eingefügt
    // wird. Der Slot hat eine feste Größe (CSS), also können wir seine
    // Position ohne Zwischen-Frame kennen. Dadurch entfällt das
    // `await nextFrame()` zwischen remove und flyCard – der Ghost wird
    // im selben synchronen Block wie sourceEl.remove() erzeugt, und
    // es gibt keinen Paint-Frame, in dem die Karte weder im Stack noch
    // als Ghost sichtbar ist.
    const toRect = trickSlot.getBoundingClientRect();

    // Trick-Karte unsichtbar vorbereiten.
    trickSlot.innerHTML = '';
    const cardEl = buildTrickCardElement(controller.state, playerIndex);
    if (!cardEl) return;
    cardEl.style.opacity = '0';
    trickSlot.appendChild(cardEl);

    // Stack-Position aktualisieren.
    if (trickResolvedByThisPlay) {
      // Stich beendet: State ist bereits revealed (durch applyTrickResult
      // → revealAll im GameController). Ein volles renderAll würde die
      // revealed Karte sofort als Vorderseite im Stack zeigen, dann
      // käme erst 500+ ms später der Flip in handleTrickResolved.
      // Deshalb nur das Quell-Element entfernen – kein Re-Render.
      sourceEl.remove();
    } else {
      // Erster Play: voller Re-Render für HUD und andere Stacks.
      rerender();
    }

    // Ghost SOFORT erzeugen (gleiche Task wie remove/rerender). flyCard
    // läuft synchron bis zum ersten await, also wird der Ghost vor dem
    // nächsten Paint im DOM eingehängt.
    if (imageSrc && fromRect) {
      await flyCard({ fromRect, toRect, imageSrc, duration: 280 });
    }
    if (myEpoch !== epoch) return;

    cardEl.style.opacity = '';
  } finally {
    if (myEpoch === epoch) animationInProgress = false;
  }

  if (playerIndex !== 1 && !trickResolvedByThisPlay) {
    await tryRunAIMoveIfActive(myEpoch);
  }
}

function buildTrickCardElement(state, playerIndex) {
  let card = null;

  const currentPlay = state.currentTrick.plays.find((p) => p.playerIndex === playerIndex);
  if (currentPlay) {
    card = currentPlay.card;
  } else {
    const lastTrick = state.completedTricks[state.completedTricks.length - 1];
    const play = lastTrick?.plays.find((p) => p.playerIndex === playerIndex);
    card = play?.card ?? null;
  }

  if (!card) return null;

  const el = document.createElement('div');
  el.className = 'card';
  const img = document.createElement('img');
  img.className = 'card__img';
  img.alt = card.toString();
  img.draggable = false;
  img.src = `assets/cards/${card.toImageName()}`;
  img.addEventListener('error', () => {
    el.textContent = card.toString();
  }, { once: true });
  el.appendChild(img);
  return el;
}

// ---------------------------------------------------------------------------
// Animation: Stich auflösen
// ---------------------------------------------------------------------------

async function handleTrickResolved({ winner, revealed }, myEpoch) {
  if (myEpoch !== epoch) return;

  animationInProgress = true;
  try {
    await waitFor(TRICK_HOLD_MS);
    if (myEpoch !== epoch) return;

    const targetRect = getWinnerTargetRect(winner);
    if (targetRect) {
      const trickCards = [...document.querySelectorAll('.trick__slot .card')];
      await Promise.all(trickCards.map((el, i) => {
        const img = el.querySelector('.card__img');
        const imageSrc = img?.src ?? null;
        return flyCardToTarget({
          sourceEl: el,
          targetRect,
          imageSrc,
          duration: WINNER_FLY_MS,
          delayMs: i * WINNER_FLY_DELAY_MS,
          restoreVisibility: false,
        });
      }));
    }
    if (myEpoch !== epoch) return;

    clearTrickSlots();

    // Die revealed Karten im Stack vor dem Re-Render unsichtbar
    // markieren, damit der Flip-Ghost sie ohne Vorderseiten-Blitz
    // übernehmen kann.
    if (Array.isArray(revealed) && revealed.length > 0) {
      pendingHiddenPositions = new Set(
        revealed.map((r) => `${r.playerIndex}:${r.positionIndex}`),
      );
    }

    rerender();

    if (Array.isArray(revealed) && revealed.length > 0) {
      playSound('card-flip');
      await Promise.all(
        revealed.map((r) => flipRevealedCard(r, myEpoch)),
      );
      if (myEpoch !== epoch) return;
    }

    pendingHiddenPositions = new Set();
  } finally {
    if (myEpoch === epoch) animationInProgress = false;
  }

  await tryRunAIMoveIfActive(myEpoch);
}

function getWinnerTargetRect(winnerIndex) {
  const hudSelector = winnerIndex === 0 ? '.hud--bottom' : '.hud--top';
  const hud = document.querySelector(hudSelector);
  if (!hud) return null;
  const target = hud.querySelector('.hud__side--right') ?? hud;
  return target.getBoundingClientRect();
}

async function flipRevealedCard({ playerIndex, positionIndex, card }, myEpoch) {
  const targetEl = findCardInStack(playerIndex, positionIndex);
  if (!targetEl) return;

  const imageSrc = `assets/cards/${card.toImageName()}`;
  await flipReveal({ targetEl, imageSrc, duration: REVEAL_FLIP_MS });
  if (myEpoch !== epoch) return;
}

// ---------------------------------------------------------------------------
// Phasenübergänge mit Benutzereingabe
// ---------------------------------------------------------------------------

async function handlePhase(c, phase) {
  if (phase === PHASES.ANSAGE) {
    await runGameTypeDialog(c);
  } else if (phase === PHASES.ANSAGE_STOSS) {
    await runAnnouncementDialog(c);
  }
}

async function runGameTypeDialog(c) {
  const choice = await showChoiceDialog({
    title: 'Spielart wählen',
    message: 'Du bist Alleinspieler (Vorhand). Was spielst du?',
    align: 'top',
    choices: [
      { label: 'Eichel-Solo',   value: { gameType: GAME_TYPES.FARB_SOLO, soloSuit: SUITS.EICHEL } },
      { label: 'Laub-Solo',     value: { gameType: GAME_TYPES.FARB_SOLO, soloSuit: SUITS.LAUB } },
      { label: 'Herz-Solo',     value: { gameType: GAME_TYPES.FARB_SOLO, soloSuit: SUITS.HERZ } },
      { label: 'Schellen-Solo', value: { gameType: GAME_TYPES.FARB_SOLO, soloSuit: SUITS.SCHELLEN } },
      { label: 'Wenz',          value: { gameType: GAME_TYPES.WENZ } },
    ],
  });

  c.chooseGameType(choice.gameType, choice.soloSuit ?? null);
}

async function runAnnouncementDialog(c) {
  if (gameMode === 'ai') {
    c.finishAnnouncements();
    return;
  }

  const opponentChoice = await showChoiceDialog({
    title: 'Stoss?',
    message: 'Willst du den Spielwert verdoppeln?',
    choices: [
      { label: 'Stoss',   value: 'stoss', variant: 'primary' },
      { label: 'Weiter', value: 'pass' },
    ],
  });

  if (opponentChoice === 'stoss') {
    c.callStoss();

    const declarerChoice = await showChoiceDialog({
      title: 'Nochmal?',
      message: 'Der Gegner hat Stoss gesagt. Willst du auf ×4 erhöhen?',
      choices: [
        { label: 'Nochmal', value: 'nochmal', variant: 'primary' },
        { label: 'Passen',  value: 'pass' },
      ],
    });

    if (declarerChoice === 'nochmal') {
      c.callNochmal();
    }
  }

  c.finishAnnouncements();
}

// ---------------------------------------------------------------------------
// Kartenklick
// ---------------------------------------------------------------------------

function handleCardClick(positionIndex, playerIndex) {
  if (!controller) return;
  if (animationInProgress || processingQueue || animationQueue.length > 0) return;

  const c = controller;
  if (c.state.phase !== PHASES.SPIELEN) return;
  if (playerIndex !== c.state.activePlayerIndex) return;

  if (gameMode === 'ai' && playerIndex !== 0) return;

  try {
    c.playCard(playerIndex, positionIndex);
  } catch (err) {
    console.error('playCard:', err);
  }
}

// ---------------------------------------------------------------------------
// Menü
// ---------------------------------------------------------------------------

async function startAIGameWithDifficultyDialog() {
  const difficulty = await showChoiceDialog({
    title: 'Schwierigkeit',
    message: 'Wie stark soll der Computer spielen?',
    choices: DIFFICULTY_LIST.map((d, i) => ({
      label: d.label,
      value: d,
      variant: i === 1 ? 'primary' : undefined,
    })),
  });

  if (!difficulty) return;

  newGame('ai', { difficulty });
}

async function showRulesDialog() {
  await showInfoDialog({
    title: 'Spielregeln',
    sections: RULES_SECTIONS,
    closeLabel: 'Verstanden',
  });
}

async function confirmResetStats() {
  const choice = await showChoiceDialog({
    title: 'Statistik zurücksetzen?',
    message: 'Alle gespeicherten Werte gehen verloren.',
    choices: [
      { label: 'Abbrechen', value: 'cancel', variant: 'primary' },
      { label: 'Zurücksetzen', value: 'reset', variant: 'danger' },
    ],
  });

  if (choice !== 'reset') return;

  resetStats();
  renderStatsBlock();
}

function wireMenu() {
  document.addEventListener('click', () => unlockAudio(), { capture: true });

  document.querySelector('[data-action="start-hotseat"]')
    .addEventListener('click', () => newGame('hotseat'));
  document.querySelector('[data-action="start-ai"]')
    .addEventListener('click', startAIGameWithDifficultyDialog);
  document.querySelector('[data-action="show-rules"]')
    .addEventListener('click', showRulesDialog);
  document.querySelector('[data-action="reset-stats"]')
    .addEventListener('click', confirmResetStats);
  document.querySelector('[data-action="toggle-mute"]')
    .addEventListener('click', () => {
      toggleMute();
      updateMuteIcon();
    });

  document.querySelector('[data-action="back-to-menu"]')
    .addEventListener('click', returnToMenu);

  document.querySelector('[data-action="quit-game"]').addEventListener('click', async () => {
    const choice = await showChoiceDialog({
      title: 'Partie aufgeben?',
      message: 'Der aktuelle Spielstand geht verloren.',
      choices: [
        { label: 'Weiterspielen', value: 'continue', variant: 'primary' },
        { label: 'Aufgeben',      value: 'quit' },
      ],
    });
    if (choice !== 'quit') return;
    returnToMenu();
  });
}

function returnToMenu() {
  closeOpenDialog();

  if (controller) {
    controller.bus.clear();
    controller = null;
    window.game = null;
  }
  epoch++;
  animationQueue.length = 0;
  animationInProgress = false;
  pendingHiddenPositions = new Set();
  gameMode = null;
  clearTrickSlots();
  renderStatsBlock();
  showScreen('start');
}

// ---------------------------------------------------------------------------
// Service Worker
// ---------------------------------------------------------------------------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const isLocalhost =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (location.protocol !== 'https:' && !isLocalhost) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js', { scope: './' })
      .catch((err) => {
        console.warn('Service Worker konnte nicht registriert werden:', err);
      });
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  wireMenu();
  renderStatsBlock();
  updateMuteIcon();
  showScreen('start');
  registerServiceWorker();
}

init();