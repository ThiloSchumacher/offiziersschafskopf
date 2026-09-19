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
 * Reveal-Flip: temporärer 3D-Flip-Container als Overlay.
 *   Der Ghost ist ein <div> mit zwei Kind-Elementen (Rückseite und
 *   Vorderseite), die via backface-visibility wechseln. Die Zielkarte
 *   ist währenddessen unsichtbar. Cleanup läuft in einem finally-Block.
 *
 * Gewinner-Stapel: Karten fliegen zum HUD des Gewinners.
 *   `flyCardToTarget` blendet die Quellkarte aus, während der Ghost
 *   fliegt – sonst sähe man ein Doppelbild (Karte im Stich UND Ghost
 *   gleichzeitig). Die Sichtbarkeit wird im finally-Block
 *   wiederhergestellt, falls der Aufrufer die Quelle noch braucht.
 *
 * Bei prefers-reduced-motion: reduce liefern alle Animationen sofort
 * ein resolved Promise, ohne visuellen Effekt.
 */

import { CARD_BACK_IMAGE } from '../config/constants.js';

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

  ghost.style.position = 'fixed';
  ghost.style.left = `${fromRect.left}px`;
  ghost.style.top = `${fromRect.top}px`;
  ghost.style.width = `${fromRect.width}px`;
  ghost.style.height = `${fromRect.height}px`;
  ghost.style.objectFit = 'cover';
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
 * Lässt einen Ghost von einem Quell-Element zum Ziel-Rect fliegen,
 * schrumpft und blendet ihn dabei aus. Wird für den Gewinner-Stapel
 * verwendet: die Karten wandern in Richtung HUD des Stichgewinners.
 *
 * Die Quellkarte wird während des Flugs ausgeblendet, damit kein
 * Doppelbild entsteht. Nach dem Flug wird die ursprüngliche
 * Sichtbarkeit wiederhergestellt.
 *
 * @param {object} args
 * @param {HTMLElement} args.sourceEl       Karten-Element im Trick
 * @param {DOMRect} args.targetRect          Ziel-Rechteck (HUD-Stelle)
 * @param {string} args.imageSrc             Kartenbild-URL
 * @param {number} [args.duration]
 * @param {number} [args.delayMs]            Verzögerung vor dem Flug
 * @param {number} [args.targetScale]        Endskalierung (z. B. 0.15)
 * @returns {Promise<void>}
 */
export async function flyCardToTarget({
  sourceEl,
  targetRect,
  imageSrc,
  duration = 420,
  delayMs = 0,
  targetScale = 0.15,
}) {
  if (!sourceEl || !targetRect || !imageSrc) return;
  if (prefersReducedMotion() || duration === 0) return;

  const fromRect = sourceEl.getBoundingClientRect();
  if (fromRect.width === 0 || fromRect.height === 0) return;

  // Quellkarte sofort ausblenden – sonst sieht man die Karte im Stich
  // UND den Ghost gleichzeitig. Bei zwei Karten mit Versatz würde die
  // zweite sonst stehenbleiben, während die erste schon fliegt.
  const originalVisibility = sourceEl.style.visibility;
  sourceEl.style.visibility = 'hidden';

  let ghost = null;
  try {
    if (delayMs > 0) await waitFor(delayMs);

    ghost = document.createElement('img');
    ghost.src = imageSrc;
    ghost.alt = '';
    ghost.draggable = false;

    ghost.style.position = 'fixed';
    ghost.style.left = `${fromRect.left}px`;
    ghost.style.top = `${fromRect.top}px`;
    ghost.style.width = `${fromRect.width}px`;
    ghost.style.height = `${fromRect.height}px`;
    ghost.style.objectFit = 'cover';
    ghost.style.margin = '0';
    ghost.style.padding = '0';
    ghost.style.border = 'none';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.transformOrigin = 'center center';
    ghost.style.willChange = 'transform, opacity';

    document.body.appendChild(ghost);

    // Verschiebung vom Mittelpunkt der Quelle zum Mittelpunkt des Ziels.
    const fromCx = fromRect.left + fromRect.width / 2;
    const fromCy = fromRect.top + fromRect.height / 2;
    const toCx = targetRect.left + targetRect.width / 2;
    const toCy = targetRect.top + targetRect.height / 2;
    const dx = toCx - fromCx;
    const dy = toCy - fromCy;

    const anim = ghost.animate(
      [
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${targetScale})`, opacity: 0.35 },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.55, 0, 1, 0.45)',
        fill: 'forwards',
      },
    );

    try {
      await anim.finished;
    } catch {
      // egal – wir räumen im finally auf.
    }
  } finally {
    if (ghost) ghost.remove();
    sourceEl.style.visibility = originalVisibility;
  }
}

/**
 * Reveal-Flip: eine verdeckte Karte klappt zur Vorderseite um.
 *
 * @param {object} args
 * @param {HTMLElement} args.targetEl  Karten-Element im Stack
 * @param {string} args.imageSrc       URL des Kartenbildes
 * @param {number} [args.duration]
 * @returns {Promise<void>}
 */
export async function flipReveal({ targetEl, imageSrc, duration = 400 }) {
  if (!targetEl || !imageSrc) return;
  if (prefersReducedMotion() || duration === 0) return;

  const rect = targetEl.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const borderRadius = getComputedStyle(targetEl).borderRadius;

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = `${rect.left}px`;
  wrapper.style.top = `${rect.top}px`;
  wrapper.style.width = `${rect.width}px`;
  wrapper.style.height = `${rect.height}px`;
  wrapper.style.perspective = '900px';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.zIndex = '9999';

  const inner = document.createElement('div');
  inner.style.position = 'relative';
  inner.style.width = '100%';
  inner.style.height = '100%';
  inner.style.transformStyle = 'preserve-3d';
  inner.style.transform = 'rotateY(180deg)';

  const back = document.createElement('div');
  back.className = 'card card--back';
  back.style.position = 'absolute';
  back.style.inset = '0';
  back.style.width = '100%';
  back.style.height = '100%';
  back.style.borderRadius = borderRadius;
  back.style.backfaceVisibility = 'hidden';
  back.style.transform = 'rotateY(180deg)';
  back.style.overflow = 'hidden';

  const backImg = document.createElement('img');
  backImg.src = `assets/cards/${CARD_BACK_IMAGE}`;
  backImg.alt = '';
  backImg.draggable = false;
  backImg.style.display = 'block';
  backImg.style.width = '100%';
  backImg.style.height = '100%';
  backImg.style.objectFit = 'cover';
  backImg.style.pointerEvents = 'none';
  back.appendChild(backImg);

  const front = document.createElement('img');
  front.src = imageSrc;
  front.alt = '';
  front.draggable = false;
  front.style.position = 'absolute';
  front.style.inset = '0';
  front.style.width = '100%';
  front.style.height = '100%';
  front.style.objectFit = 'cover';
  front.style.borderRadius = borderRadius;
  front.style.backfaceVisibility = 'hidden';

  inner.appendChild(front);
  inner.appendChild(back);
  wrapper.appendChild(inner);
  document.body.appendChild(wrapper);

  targetEl.style.visibility = 'hidden';

  try {
    await nextFrame();

    const anim = inner.animate(
      [
        { transform: 'rotateY(180deg)' },
        { transform: 'rotateY(0deg)' },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      },
    );

    try {
      await anim.finished;
    } catch {
      // egal – wir räumen im finally auf.
    }
  } finally {
    wrapper.remove();
    targetEl.style.visibility = '';
  }
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