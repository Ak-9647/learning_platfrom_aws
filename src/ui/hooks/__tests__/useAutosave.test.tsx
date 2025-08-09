import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../useAutosave';

describe('useAutosave', () => {
  it('debounces saves and sets status', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { result, rerender } = renderHook(({ v }) => useAutosave({ value: v, onSave, delayMs: 200 }), {
      initialProps: { v: 'a' },
    });

    expect(result.current.isSaving).toBe(false);

    // Change value quickly twice
    rerender({ v: 'ab' });
    rerender({ v: 'abc' });

    // Advance less than delay - should not save yet
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    expect(onSave).not.toHaveBeenCalled();

    // Advance past delay
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(onSave).toHaveBeenCalledWith('abc');
    vi.useRealTimers();
  });
});
