/**
 * main.js
 * Einstiegspunkt: Screens verdrahten, GameController aufbauen,
 * Events auf Rendering, Dialoge und Animationen abbilden.
 *
 * Zwei Modi:
 *   'hotseat'  beide Spieler wechseln sich am selben Gerät ab
 *   'ai'       Spieler 0 ist der Mensch, Spieler 1 ist die KI
 *
 * KI-Verhalten im MVP:
 *   - Spielart: wählt der Mensch (Vorhand = Spieler 0).
 *   - Stoß/Nochmal: KI passt immer. Kein Dialog.
 *   - Karten: KI zieht nach kurzer Verzögerung automatisch.
 *
 * KI-Zug-Planung:
 *   Der KI-Zug wird NICHT als eigene Queue-Task geplant, sondern ans
 *   Ende der jeweiligen Animations-Task gehängt (tryRunAIMoveIfActive).
 *
 *   Wichtig: Der KI-Check nach handleCardPlayed läuft NUR, wenn
 *     a) der Mensch gezogen hat (playerIndex !== 1), UND
 *     b) der Zug nicht den Stich beendet hat.
 *
 *   Grund für (b): Wenn der Mensch den zweiten Play eines Stichs macht,
 *   hat der GameController den Stich bereits aufgelöst (currentTrick
 *   .plays.length === 0). Der passende trick:resolved-Handler liegt
 *   bereits in der Queue und übernimmt den KI-Check selbst.
 */

import { GameController } from './game/GameController.js';
import { Player } from './model/Player.js';
import { PHASES } from './game/phases.js';
import { SUITS, GAME_TYPES } from './config/constants.js';
import { renderAll, renderResult } from './ui/render.js';
import { showChoiceDialog } from './ui/components/Dialog.js';
import { legalMoves } from './rules/moves.js';
import { buildAIView } from './ai/AIView.js';
import { chooseMove } from './ai/HeuristicAI.js';
import {
  clearTrickSlots,
  fadeOut,
  findCardInStack,
  flyCard,
  nextFrame,
  waitFor,
} from './ui/animations.js';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const AI_MOVE_DELAY_MS = 600;
const RESULT_DELAY_MS = 400;
const TRICK_HOLD_MS = 650;

// ---------------------------------------------------------------------------
// Modul-Zustand
// ---------------------------------------------------------------------------

/** @type {GameController|null} */
let controller = null;

/** 'hotseat' | 'ai' | null */
let gameMode = null;

/** Solange true, werden Kartenklicks ignoriert. */
let animationInProgress = false;

/** Epoch-Zähler: bei jedem Spielstart erhöht; alte Tasks brechen ab. */
let epoch = 0;

/** Asynchrone Warteschlange für Animations-Tasks. */
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
// Partie starten
// ---------------------------------------------------------------------------

function newGame(mode) {
  if (mode !== 'hotseat' && mode !== 'ai') {
    throw new Error(`newGame: unbekannter Modus "${mode}"`);
  }
  if (controller) controller.bus.clear();

  epoch++;
  animationQueue.length = 0;
  animationInProgress = false;
  gameMode = mode;

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
  const rerender = () => renderAll(c.state, {
    onCardClick: handleCardClick,
    isPlayerInteractive,
  });
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
    enqueue(() => handleCardPlayed(payload, myEpoch));
  });

  c.bus.on('trick:resolved', (payload) => {
    enqueue(() => handleTrickResolved(payload, myEpoch));
  });

  c.bus.on('game:end', (result) => {
    enqueue(async () => {
      if (myEpoch !== epoch) return;
      await waitFor(RESULT_DELAY_MS);
      if (myEpoch !== epoch) return;
      clearTrickSlots();
      renderAll(c.state, { onCardClick: handleCardClick, isPlayerInteractive });
      renderResult(result);
      showScreen('result');
      c.finishGame(); // AUSWERTUNG → ENDE
    });
  });
}

// ---------------------------------------------------------------------------
// KI-Zug
// ---------------------------------------------------------------------------

/**
 * Prüft, ob die KI am Zug ist, und führt ihren Zug nach kurzer Pause aus.
 *
 * Aufrufer:
 *   - handleCardPlayed, wenn der Mensch gezogen hat UND der Zug den
 *     Stich nicht beendet hat.
 *   - handleTrickResolved, immer.
 *
 * @param {number} myEpoch
 */
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
  const positionIndex = chooseMove(view, legal);
  controller.playCard(1, positionIndex);
}

// ---------------------------------------------------------------------------
// Animation: Karte wird gespielt
// ---------------------------------------------------------------------------

async function handleCardPlayed({ playerIndex, positionIndex }, myEpoch) {
  if (myEpoch !== epoch) return;

  animationInProgress = true;
  try {
    const sourceEl = findCardInStack(playerIndex, positionIndex);
    if (!sourceEl) {
      renderAll(controller.state, {
        onCardClick: handleCardClick,
        isPlayerInteractive,
      });
      return;
    }
    const fromRect = sourceEl.getBoundingClientRect();
    const imgEl = sourceEl.querySelector('.card__img');
    const imageSrc = imgEl?.src ?? null;

    renderAll(controller.state, {
      onCardClick: handleCardClick,
      isPlayerInteractive,
    });

    const trickSlot = document.querySelector(
      `.trick__slot[data-player="${playerIndex}"]`,
    );
    if (!trickSlot) return;
    trickSlot.innerHTML = '';
    const cardEl = buildTrickCardElement(controller.state, playerIndex);
    if (!cardEl) return;
    cardEl.style.opacity = '0';
    trickSlot.appendChild(cardEl);

    await nextFrame();
    if (myEpoch !== epoch) return;
    const toRect = cardEl.getBoundingClientRect();

    if (imageSrc) {
      await flyCard({ fromRect, toRect, imageSrc, duration: 280 });
    }
    if (myEpoch !== epoch) return;

    cardEl.style.opacity = '';
  } finally {
    if (myEpoch === epoch) animationInProgress = false;
  }

  // Hat dieser Zug den Stich beendet?
  // Nach applyTrickResult ist currentTrick.plays.length === 0.
  const trickResolvedByThisPlay =
    controller.state.currentTrick.plays.length === 0;

  // KI-Check nur, wenn
  //   a) der Mensch gezogen hat (playerIndex !== 1), UND
  //   b) der Zug den Stich nicht beendet hat (sonst übernimmt
  //      handleTrickResolved den KI-Check).
  if (playerIndex !== 1 && !trickResolvedByThisPlay) {
    await tryRunAIMoveIfActive(myEpoch);
  }
}

/**
 * Baut ein DOM-Element für die Karte, die gerade im aktuellen Stich
 * von `playerIndex` gespielt wurde.
 */
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

async function handleTrickResolved({ winner }, myEpoch) {
  if (myEpoch !== epoch) return;

  animationInProgress = true;
  try {
    await waitFor(TRICK_HOLD_MS);
    if (myEpoch !== epoch) return;

    const trickCards = document.querySelectorAll('.trick__slot .card');
    await Promise.all([...trickCards].map((el) => fadeOut(el, 200)));
    if (myEpoch !== epoch) return;

    clearTrickSlots();
    renderAll(controller.state, {
      onCardClick: handleCardClick,
      isPlayerInteractive,
    });
  } finally {
    if (myEpoch === epoch) animationInProgress = false;
  }

  await tryRunAIMoveIfActive(myEpoch);
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

function wireMenu() {
  document.querySelector('[data-action="start-hotseat"]')
    .addEventListener('click', () => newGame('hotseat'));
  document.querySelector('[data-action="start-ai"]')
    .addEventListener('click', () => newGame('ai'));

  document.querySelector('[data-action="back-to-menu"]').addEventListener('click', () => {
    if (controller) {
      controller.bus.clear();
      controller = null;
      window.game = null;
    }
    epoch++;
    animationQueue.length = 0;
    animationInProgress = false;
    gameMode = null;
    clearTrickSlots();
    showScreen('start');
  });
}

// ---------------------------------------------------------------------------
// Service Worker
// ---------------------------------------------------------------------------

/**
 * Registriert den Service Worker für Offline-Fähigkeit.
 * Läuft nur, wenn der Browser das unterstützt.
 * Fehler werden geloggt, aber nicht weitergegeben – die App
 * funktioniert auch ohne SW.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Bei file:// und manchen Sandbox-Umgebungen ist SW nicht erlaubt.
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

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
  showScreen('start');
  registerServiceWorker();
}

init();