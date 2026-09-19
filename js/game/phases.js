/**
 * phases.js
 * Phasen des Spielablaufs.
 *
 * INIT ist ausschließlich der allererste Zustand direkt nach Konstruktion
 * des GameState. GameController.start() wechselt in einem Schritt auf
 * GEBEN_1, bevor irgendeine andere Aktion ausgeführt wird. INIT wird im
 * laufenden Spiel nie wieder erreicht und existiert nur als sauberer
 * Ausgangszustand (z. B. für Klone, die noch nicht gestartet sind).
 */

export const PHASES = Object.freeze({
  INIT: 'init',
  GEBEN_1: 'geben1',
  ANSAGE: 'ansage',              // Vorhand wählt Spielart
  GEBEN_2: 'geben2',             // Rest Runde 1 + komplette Runde 2
  ANSAGE_STOSS: 'ansage_stoss',  // Gegner Stoß, Alleinspieler ggf. Nochmal
  SPIELEN: 'spielen',
  AUSWERTUNG: 'auswertung',
  ENDE: 'ende',
});

export const ALL_PHASES = Object.freeze(Object.values(PHASES));