/**
 * ansagen.js
 * Stoß und Nochmal.
 *
 * Regeln:
 *   - Stoß darf nur der Gegner des Alleinspielers ansagen.
 *   - Stoß ist nur in Phase ANSAGE_STOSS erlaubt.
 *   - Stoß ist nur einmal erlaubt.
 *   - Nochmal darf nur der Alleinspieler ansagen.
 *   - Nochmal setzt einen gefallenen Stoß voraus.
 *   - Nochmal ist nur einmal erlaubt.
 *
 * Arbeitsteilung:
 *   - canXxx(...)  → reine Entscheidung
 *   - announceXxx(...) → validiert und ruft state.setXxx()
 *   - state.setXxx()  → dummes Primitive, keine Regelprüfung
 */

import { ANNOUNCEMENT_MULTIPLIER } from '../config/constants.js';
import { PHASES } from '../game/phases.js';

export function canAnnounceStoss(state, playerIndex) {
  if (state.phase !== PHASES.ANSAGE_STOSS) return false;
  if (playerIndex === state.declarerIndex) return false;
  if (state.announcements.stoss.called) return false;
  return true;
}

export function canAnnounceNochmal(state, playerIndex) {
  if (state.phase !== PHASES.ANSAGE_STOSS) return false;
  if (playerIndex !== state.declarerIndex) return false;
  if (!state.announcements.stoss.called) return false;
  if (state.announcements.nochmal.called) return false;
  return true;
}

export function announceStoss(state, playerIndex) {
  if (!canAnnounceStoss(state, playerIndex)) {
    throw new Error(`Stoß nicht erlaubt (Spieler ${playerIndex}, Phase ${state.phase})`);
  }
  state.setStoss(playerIndex);
}

export function announceNochmal(state, playerIndex) {
  if (!canAnnounceNochmal(state, playerIndex)) {
    throw new Error(`Nochmal nicht erlaubt (Spieler ${playerIndex}, Phase ${state.phase})`);
  }
  state.setNochmal(playerIndex);
}

export function currentMultiplier(state) {
  if (state.announcements.nochmal.called) {
    return ANNOUNCEMENT_MULTIPLIER.nochmal;
  }
  if (state.announcements.stoss.called) {
    return ANNOUNCEMENT_MULTIPLIER.stoss;
  }
  return 1;
}