import { useEffect, useRef, useState } from 'react';

export interface UseAutosaveOptions<T> {
  value: T;
  delayMs?: number;
  onSave: (value: T) => Promise<void> | void;
  enabled?: boolean;
}

export function useAutosave<T>({ value, delayMs = 500, onSave, enabled = true }: UseAutosaveOptions<T>) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<T>(value);

  useEffect(() => {
    latestValueRef.current = value;
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await onSave(latestValueRef.current);
        setLastSavedAt(Date.now());
      } finally {
        setIsSaving(false);
      }
    }, delayMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delayMs, onSave, enabled]);

  return { isSaving, lastSavedAt } as const;
}
