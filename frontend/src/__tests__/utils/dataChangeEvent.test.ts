import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchDataChanged, onDataChanged } from '../../utils/dataChangeEvent';

describe('dataChangeEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatchDataChanged triggers registered listeners', () => {
    const callback = vi.fn();
    onDataChanged(callback);

    dispatchDataChanged();

    // CustomEvent is dispatched synchronously on window
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('onDataChanged returns unsubscribe function', () => {
    const callback = vi.fn();
    const unsubscribe = onDataChanged(callback);

    dispatchDataChanged();
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    dispatchDataChanged();
    expect(callback).toHaveBeenCalledTimes(1); // not called again
  });

  it('multiple listeners are all triggered', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    onDataChanged(cb1);
    onDataChanged(cb2);

    dispatchDataChanged();

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('listener is not called after unsubscribe even if other listeners fire', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = onDataChanged(cb1);
    onDataChanged(cb2);

    unsub1();
    dispatchDataChanged();

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});
