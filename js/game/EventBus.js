/**
 * EventBus.js
 * Minimaler Pub/Sub.
 *
 * on() gibt eine Unsubscribe-Funktion zurück. emit() ruft die Handler
 * synchron in Registrierungsreihenfolge auf. Fehler in Handlern werden
 * NICHT gefangen – ein kaputter Handler ist ein Bug, kein Fall für
 * stilles Schlucken.
 */

export class EventBus {
  #handlers = new Map();

  /**
   * @param {string} event
   * @param {(payload: any) => void} handler
   * @returns {() => void}  Unsubscribe
   */
  on(event, handler) {
    if (typeof handler !== 'function') {
      throw new Error('EventBus.on: handler muss eine Funktion sein');
    }
    if (!this.#handlers.has(event)) {
      this.#handlers.set(event, new Set());
    }
    this.#handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const set = this.#handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }

  /** Alle Handler entfernen. Praktisch für Tests und Runden-Neustart. */
  clear() {
    this.#handlers.clear();
  }
}