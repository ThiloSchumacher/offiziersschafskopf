/**
 * render.js
 * Zeichnet den Spielstand ins DOM.
 *
 * Re-Render-Strategie: bei jedem Aufruf wird der Tisch neu aufgebaut.
 * Der GameState bleibt die einzige Quelle der Wahrheit.
 *
 * Trick-Mitte wird NICHT von renderAll() gezeichnet – sie wird von
 * der Animations-Schicht in main.js verwaltet.
 *
 * Interaktivität: Der Aufrufer kann per handlers.isPlayerInteractive
 * steuern, welche Spieler klickbar sind. Standard: alle.
 * Im KI-Modus etwa: nur Spieler 0.
 */

import { STACKS_PER_PLAYER } from '../config/constants.js';
import { PHASES } from '../game/phases.js';
import { legalMoves } from '../rules/moves.js';
import { createStackElement } from './components/StackView.js';

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * @param {GameState} state
 * @param {object} handlers
 * @param {(positionIndex: number, playerIndex: number) => void} handlers.onCardClick
 * @param {(playerIndex: number) => boolean} [handlers.isPlayerInteractive]
 */
export function renderAll(state, handlers) {
  renderStacks(state, handlers);
  renderHud(state);
}

// ---------------------------------------------------------------------------
// Tisch – Stacks
// ---------------------------------------------------------------------------

function renderStacks(state, handlers) {
  const legal = currentLegalMoves(state);
  const canPlay = state.phase === PHASES.SPIELEN;
  const isInteractive = handlers.isPlayerInteractive ?? (() => true);

  for (let playerIndex = 0; playerIndex < 2; playerIndex++) {
    const player = state.players[playerIndex];
    const isActive = playerIndex === state.activePlayerIndex;
    const playerInteractive = isInteractive(playerIndex);

    for (let posIdx = 0; posIdx < STACKS_PER_PLAYER; posIdx++) {
      const slot = document.querySelector(
        `.stack-slot[data-player="${playerIndex}"][data-position="${posIdx}"]`,
      );
      if (!slot) continue;
      slot.innerHTML = '';

      const position = player.positionAt(posIdx);
      const isLegal = canPlay && isActive && legal.includes(posIdx);
      const isClickable = isLegal && playerInteractive;
      // Dimmen nur, wenn der Spieler auch interaktiv ist – sonst
      // würde die KI-Hand während ihres Zugs unruhig wirken.
      const shouldDim =
        canPlay && isActive && playerInteractive && !isLegal && !position.isEmpty();

      const stack = createStackElement(position, {
        clickable: isClickable,
        dimmed: shouldDim,
        onClick: isClickable
          ? () => handlers.onCardClick(posIdx, playerIndex)
          : null,
      });

      if (stack) slot.appendChild(stack);
    }
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function renderHud(state) {
  const activeIdx = state.phase === PHASES.SPIELEN ? state.activePlayerIndex : -1;

  setText('opponent-name', 'Gegner');
  setText('phase', phaseLabel(state.phase));
  setText('announcement', announcementLabel(state));

  setText('self-points', String(state.points[0]));
  setText('self-tricks', String(state.tricksWon[0]));
  setText('opponent-points', String(state.points[1]));
  setText('opponent-tricks', String(state.tricksWon[1]));

  setText('trick-progress', `${state.completedTricks.length} / 16`);

  let turnText = '';
  if (activeIdx === 0) turnText = '▶ Du bist dran';
  else if (activeIdx === 1) turnText = '▶ Gegner ist dran';
  setText('turn', turnText);

  document.querySelector('.hud--top')
    .classList.toggle('is-active', activeIdx === 1);
  document.querySelector('.hud--bottom')
    .classList.toggle('is-active', activeIdx === 0);
}

function phaseLabel(phase) {
  return {
    [PHASES.INIT]: 'Initialisierung',
    [PHASES.GEBEN_1]: 'Geben',
    [PHASES.ANSAGE]: 'Spielart wählen',
    [PHASES.GEBEN_2]: 'Geben',
    [PHASES.ANSAGE_STOSS]: 'Ansage',
    [PHASES.SPIELEN]: 'Spielen',
    [PHASES.AUSWERTUNG]: 'Auswertung',
    [PHASES.ENDE]: 'Ende',
  }[phase] ?? phase;
}

function announcementLabel(state) {
  if (state.announcements.nochmal.called) return 'Nochmal ×4';
  if (state.announcements.stoss.called) return 'Stoss ×2';
  return '';
}

// ---------------------------------------------------------------------------
// Ergebnis-Screen
// ---------------------------------------------------------------------------

export function renderResult(result) {
  const title = result.declarerWon
    ? 'Alleinspieler gewinnt'
    : 'Gegner gewinnt';
  setText('result-title', title);

  setText(
    'result-points',
    `${result.declarerPoints} : ${result.opponentPoints}`,
  );

  const kindLabel = {
    normal: 'Normal',
    schneider: 'Schneider',
    schwarz: 'Schwarz',
  }[result.result] ?? result.result;
  setText('result-kind', kindLabel);

  const mult = result.totalMultiplier;
  const parts = [];
  if (result.resultMultiplier > 1) parts.push(`Ergebnis ×${result.resultMultiplier}`);
  if (result.announcementMultiplier > 1) parts.push(`Ansagen ×${result.announcementMultiplier}`);
  setText('result-multiplier', parts.length ? `${parts.join(' · ')} = ×${mult}` : `×${mult}`);
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function currentLegalMoves(state) {
  if (state.phase !== PHASES.SPIELEN) return [];
  if (!state.hasGameType()) return [];
  return legalMoves(state);
}

function setText(bind, text) {
  const el = document.querySelector(`[data-bind="${bind}"]`);
  if (el) el.textContent = text;
}