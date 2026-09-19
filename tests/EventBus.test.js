import { describe, test, assert } from './test-runner.js';
import { EventBus } from '../js/game/EventBus.js';

describe('EventBus', () => {
  test('on + emit ruft Handler auf', () => {
    const bus = new EventBus();
    let called = 0;
    bus.on('foo', () => called++);
    bus.emit('foo');
    assert.equal(called, 1);
  });

  test('mehrere Handler werden in Reihenfolge aufgerufen', () => {
    const bus = new EventBus();
    const order = [];
    bus.on('foo', () => order.push(1));
    bus.on('foo', () => order.push(2));
    bus.on('foo', () => order.push(3));
    bus.emit('foo');
    assert.deepEqual(order, [1, 2, 3]);
  });

  test('payload wird durchgereicht', () => {
    const bus = new EventBus();
    let received = null;
    bus.on('foo', (p) => { received = p; });
    bus.emit('foo', { a: 1, b: 'x' });
    assert.deepEqual(received, { a: 1, b: 'x' });
  });

  test('emit auf unbekanntes Event ist erlaubt', () => {
    const bus = new EventBus();
    bus.emit('nie-registriert');
  });

  test('Unsubscribe-Funktion entfernt Handler', () => {
    const bus = new EventBus();
    let called = 0;
    const unsub = bus.on('foo', () => called++);
    bus.emit('foo');
    unsub();
    bus.emit('foo');
    assert.equal(called, 1);
  });

  test('off entfernt Handler', () => {
    const bus = new EventBus();
    let called = 0;
    const handler = () => called++;
    bus.on('foo', handler);
    bus.off('foo', handler);
    bus.emit('foo');
    assert.equal(called, 0);
  });

  test('clear entfernt alle Handler', () => {
    const bus = new EventBus();
    let called = 0;
    bus.on('a', () => called++);
    bus.on('b', () => called++);
    bus.clear();
    bus.emit('a');
    bus.emit('b');
    assert.equal(called, 0);
  });

  test('on wirft bei Nicht-Funktion', () => {
    const bus = new EventBus();
    assert.throws(() => bus.on('foo', 42));
  });
});