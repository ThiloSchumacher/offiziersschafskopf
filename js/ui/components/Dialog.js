/**
 * Dialog.js
 * Modale Auswahl- und Info-Dialoge.
 *
 * showChoiceDialog() gibt ein Promise zurück, das mit dem `value` der
 * angeklickten Auswahl aufgelöst wird.
 *
 * showInfoDialog() gibt ein Promise zurück, das aufgelöst wird, sobald
 * der Nutzer den Schließen-Button klickt. Der Inhalt ist als strukturierte
 * Liste von Abschnitten (heading/body) übergeben – kein HTML-String,
 * damit der Aufrufer keinen HTML-Injection-Pfad hat.
 *
 * Ausrichtung: `align` steuert die vertikale Position des Dialogs.
 *   'center' (Default) – mittig.
 *   'top'             – am oberen Rand.
 *
 * isDialogOpen() erlaubt Aufrufern, vor dem Öffnen zu prüfen, ob bereits
 * ein Dialog offen ist – nützlich für Buttons, die den Dialog nur öffnen
 * sollen, wenn nichts anderes aktiv ist (z. B. der Hilfe-Button im Spiel).
 *
 * closeOpenDialog() schließt einen offenen Dialog hart (ohne Promise-
 * Auflösung) und setzt das open-Flag zurück.
 *
 * Es kann immer nur ein Dialog offen sein. Ein zweiter Aufruf während
 * eines offenen Dialogs wirft.
 */

const layer = () => {
  const el = document.getElementById('dialog-layer');
  if (!el) throw new Error('Dialog: #dialog-layer fehlt im DOM');
  return el;
};

let open = false;

function resetLayer() {
  const layerEl = layer();
  layerEl.hidden = true;
  layerEl.innerHTML = '';
  layerEl.classList.remove('dialog-layer--top');
  open = false;
}

function closeAndResolve(resolve, value) {
  resetLayer();
  resolve(value);
}

/** Ist aktuell ein Dialog offen? */
export function isDialogOpen() {
  return open;
}

/**
 * Schließt einen offenen Dialog hart. Das zugehörige Promise wird NICHT
 * aufgelöst – der aufrufende Code wartet weiter. Absicht: dieser Aufruf
 * ist ein Sicherheitsnetz für „alles abbrechen", nicht der normale
 * Schließpfad.
 */
export function closeOpenDialog() {
  if (!open) return;
  resetLayer();
}

/**
 * @param {object} args
 * @param {string} args.title
 * @param {string} [args.message]
 * @param {{label: string, value: any, variant?: 'primary'|'danger'}[]} args.choices
 * @param {'center'|'top'} [args.align]
 * @returns {Promise<any>}
 */
export function showChoiceDialog({ title, message = '', choices, align = 'center' }) {
  if (open) {
    throw new Error('Dialog: es ist bereits ein Dialog offen');
  }
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('Dialog: benötigt mindestens eine Auswahl');
  }
  open = true;

  return new Promise((resolve) => {
    const layerEl = layer();
    layerEl.innerHTML = '';
    layerEl.hidden = false;
    layerEl.classList.toggle('dialog-layer--top', align === 'top');

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('div');
    titleEl.className = 'dialog__title';
    titleEl.textContent = title;
    dialog.appendChild(titleEl);

    if (message) {
      const msgEl = document.createElement('div');
      msgEl.className = 'dialog__message';
      msgEl.textContent = message;
      dialog.appendChild(msgEl);
    }

    const actions = document.createElement('div');
    actions.className = 'dialog__actions';

    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.className = 'dialog__button';
      if (choice.variant === 'primary') {
        btn.classList.add('dialog__button--primary');
      } else if (choice.variant === 'danger') {
        btn.classList.add('dialog__button--danger');
      }
      btn.textContent = choice.label;
      btn.addEventListener('click', () => closeAndResolve(resolve, choice.value));
      actions.appendChild(btn);
    }

    dialog.appendChild(actions);
    layerEl.appendChild(dialog);
  });
}

/**
 * Info-Dialog mit Abschnitten und einem Schließen-Button.
 *
 * @param {object} args
 * @param {string} args.title
 * @param {{heading: string, body: string}[]} args.sections
 * @param {string} [args.closeLabel]
 * @returns {Promise<void>}
 */
export function showInfoDialog({ title, sections, closeLabel = 'Verstanden' }) {
  if (open) {
    throw new Error('Dialog: es ist bereits ein Dialog offen');
  }
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('Dialog: benötigt mindestens einen Abschnitt');
  }
  open = true;

  return new Promise((resolve) => {
    const layerEl = layer();
    layerEl.innerHTML = '';
    layerEl.hidden = false;
    layerEl.classList.remove('dialog-layer--top');

    const dialog = document.createElement('div');
    dialog.className = 'dialog dialog--info';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('div');
    titleEl.className = 'dialog__title';
    titleEl.textContent = title;
    dialog.appendChild(titleEl);

    const info = document.createElement('div');
    info.className = 'dialog__info';

    for (const section of sections) {
      const h = document.createElement('h3');
      h.className = 'dialog__info-heading';
      h.textContent = section.heading;
      info.appendChild(h);

      const p = document.createElement('p');
      p.className = 'dialog__info-body';
      p.textContent = section.body;
      info.appendChild(p);
    }

    dialog.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'dialog__actions';

    const btn = document.createElement('button');
    btn.className = 'dialog__button dialog__button--primary';
    btn.textContent = closeLabel;
    btn.addEventListener('click', () => closeAndResolve(resolve, undefined));
    actions.appendChild(btn);

    dialog.appendChild(actions);
    layerEl.appendChild(dialog);
  });
}