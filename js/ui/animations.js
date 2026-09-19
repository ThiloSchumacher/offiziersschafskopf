/**
 * animations.js
 * Animationen und Timing-Helfer.
 *
 * Kartenflug: Ghost als nacktes <img>.
 *   Der Ghost wird bewusst NICHT als Klon eines Stack-Elements gebaut –
 *   sonst erbt er CSS-Klassen wie .stack__top (position: absolute,
 *   top: var(--stack-offset)), die in manchen Browsern mit den Inline-
 *   Styles kollidieren und einen doppelten Frame erzeugen (sieht aus
 *   wie "Springen").
 *
 *   Stattdessen: ein reines <img> mit ausschließlich Inline-Styles.
 *   Nichts kann es überschreiben, nichts kann es verschieben.
 *
 * Bei prefers-reduced-motion: reduce liefern alle Animationen sofort
 * ein resolved Promise, ohne visuellen Effekt.
 */

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function waitFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Zwei rAFs abwarten, damit das Layout nach einem DOM-Umbau stabil ist. */
export function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * Lässt ein Ghost-Bild von `fromRect` nach `toRect` fliegen.
 * Der Ghost ist ein reines <img> mit Inline-Styles und wird am Ende
 * entfernt.
 *
 * @param {object} args
 * @param {DOMRect} args.fromRect
 * @param {DOMRect} args.toRect
 * @param {string} args.imageSrc
 * @param {number} [args.duration]
 * @returns {Promise<void>}
 */
export async function flyCard({ fromRect, toRect, imageSrc, duration = 280 }) {
  if (!fromRect || !toRect || !imageSrc) return;
  if (prefersReducedMotion() || duration === 0) return;

  const ghost = document.createElement('img');
  ghost.src = imageSrc;
  ghost.alt = '';
  ghost.draggable = false;

  // Alle Styles inline – keine Klasse, nichts, das überschreiben kann.
  ghost.style.position = 'fixed';
  ghost.style.left = `${fromRect.left}px`;
  ghost.style.top = `${fromRect.top}px`;
  ghost.style.width = `${fromRect.width}px`;
  ghost.style.height = `${fromRect.height}px`;
  ghost.style.objectFit = 'contain';
  ghost.style.margin = '0';
  ghost.style.padding = '0';
  ghost.style.border = 'none';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '9999';
  ghost.style.willChange = 'transform';
  ghost.style.transform = 'translate3d(0, 0, 0)';

  document.body.appendChild(ghost);

  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;

  const anim = ghost.animate(
    [
      { transform: 'translate3d(0, 0, 0)' },
      { transform: `translate3d(${dx}px, ${dy}px, 0)` },
    ],
    {
      duration,
      easing: 'ease-out',
      fill: 'forwards',
    },
  );

  try {
    await anim.finished;
  } catch {
    // cancel o. Ä. – egal, wir räumen trotzdem auf.
  }

  ghost.remove();
}

/**
 * Blendet ein Element aus und wartet, bis der Effekt durch ist.
 * @returns {Promise<void>}
 */
export async function fadeOut(el, duration = 200) {
  if (!el) return;

  if (prefersReducedMotion() || duration === 0) {
    el.style.opacity = '0';
    return;
  }

  const animation = el.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration, easing: 'ease-out', fill: 'forwards' },
  );

  await animation.finished.catch(() => {});
}

/** Findet das obere Karten-Element in einem Stack-Slot. */
export function findCardInStack(playerIndex, positionIndex) {
  const slot = document.querySelector(
    `.stack-slot[data-player="${playerIndex}"][data-position="${positionIndex}"]`,
  );
  if (!slot) return null;
  return slot.querySelector('.stack__top') ?? slot.querySelector('.card');
}

/** Leert die Trick-Mitte komplett. */
export function clearTrickSlots() {
  for (const slot of document.querySelectorAll('.trick__slot')) {
    slot.innerHTML = '';
  }
}