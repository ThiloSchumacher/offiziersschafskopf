/**
 * Dialog.js
 * Modale Auswahl-Dialoge.
 *
 * showChoiceDialog() gibt ein Promise zurück, das mit dem `value` der
 * angeklickten Auswahl aufgelöst wird. Solange der Dialog offen ist,
 * blockiert er die darunterliegende UI nicht technisch – aber die
 * aufrufende Stelle wartet auf das Promise und startet erst dann die
 * nächste Aktion.
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

/**
 * @param {object} args
 * @param {string} args.title
 * @param {string} [args.message]
 * @param {{label: string, value: any, variant?: 'primary'|'danger'}[]} args.choices
 * @returns {Promise<any>}
 */
export function showChoiceDialog({ title, message = '', choices }) {
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
      }
      btn.textContent = choice.label;
      btn.addEventListener('click', () => {
        layerEl.hidden = true;
        layerEl.innerHTML = '';
        open = false;
        resolve(choice.value);
      });
      actions.appendChild(btn);
    }

    dialog.appendChild(actions);
    layerEl.appendChild(dialog);
  });
}