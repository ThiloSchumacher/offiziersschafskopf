/**
 * test-runner.js
 * Minimaler Browser-Test-Runner – Ersatz für `node --test` im Browser.
 * Bewusst klein: nur das, was wir wirklich brauchen.
 */

const tests = [];
let currentGroup = '';

export function describe(group, fn) {
  const previous = currentGroup;
  currentGroup = group;
  fn();
  currentGroup = previous;
}

export function test(name, fn) {
  tests.push({ group: currentGroup, name, fn });
}

export const assert = {
  ok(value, msg = 'Erwartet truthy') {
    if (!value) throw new Error(msg);
  },
  equal(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(msg ?? `Erwartet ${JSON.stringify(expected)}, war ${JSON.stringify(actual)}`);
    }
  },
  deepEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(msg ?? `Erwartet ${b}, war ${a}`);
  },
  throws(fn, msg = 'Erwartet Fehler, keiner geworfen') {
    let threw = false;
    try { fn(); } catch { threw = true; }
    if (!threw) throw new Error(msg);
  },
};

/** Führt alle registrierten Tests aus und rendert das Ergebnis ins DOM. */
export function runAll(targetEl = document.body) {
  const results = document.createElement('div');
  results.className = 'results';

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const row = document.createElement('div');
    row.className = 'test-row';

    try {
      t.fn();
      passed++;
      row.classList.add('pass');
      row.textContent = `✓ ${t.group ? `[${t.group}] ` : ''}${t.name}`;
    } catch (err) {
      failed++;
      row.classList.add('fail');
      row.textContent = `✗ ${t.group ? `[${t.group}] ` : ''}${t.name} – ${err.message}`;
    }
    results.appendChild(row);
  }

  const summary = document.createElement('div');
  summary.className = 'summary';
  summary.textContent = `${passed} bestanden, ${failed} fehlgeschlagen (${tests.length} gesamt)`;
  results.prepend(summary);

  targetEl.appendChild(results);
  return { passed, failed, total: tests.length };
}