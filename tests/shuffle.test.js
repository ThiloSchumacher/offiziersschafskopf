import { describe, test, assert } from './test-runner.js';
import { shuffle, createSeededRng } from '../js/utils/shuffle.js';

describe('shuffle', () => {
  test('verändert die Länge nicht', () => {
    const input = [1, 2, 3, 4, 5];
    assert.equal(shuffle(input).length, 5);
  });

  test('verändert das Eingabe-Array nicht', () => {
    const input = [1, 2, 3, 4, 5];
    const snapshot = input.slice();
    shuffle(input);
    assert.deepEqual(input, snapshot);
  });

  test('enthält dieselben Elemente (Multiset bleibt erhalten)', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const result = shuffle(input);
    assert.deepEqual(result.slice().sort(), input.slice().sort());
  });

  test('kommt mit leerem Array und einem Element klar', () => {
    assert.deepEqual(shuffle([]), []);
    assert.deepEqual(shuffle([42]), [42]);
  });

  test('ist mit gleichem Seed deterministisch', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createSeededRng(12345));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createSeededRng(12345));
    assert.deepEqual(a, b);
  });

  test('unterschiedliche Seeds liefern (meist) andere Reihenfolgen', () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createSeededRng(1));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createSeededRng(2));
    // Kann theoretisch gleich sein, ist bei 8! Möglichkeiten aber extrem selten.
    assert.ok(JSON.stringify(a) !== JSON.stringify(b));
  });

  test('erzeugt Werte im erwarteten Wertebereich', () => {
    const rng = createSeededRng(99);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      assert.ok(v >= 0 && v < 1, `Wert außerhalb [0,1): ${v}`);
    }
  });
});