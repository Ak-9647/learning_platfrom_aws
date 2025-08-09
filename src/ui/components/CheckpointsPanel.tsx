import React, { useState } from 'react';
import { useAutosave } from '../hooks/useAutosave';

interface Props {
  slideCount: number;
  initialCheckpoints?: number[]; // slide numbers
  onChange?: (checkpoints: number[]) => void;
  onSave?: (checkpoints: number[]) => Promise<void> | void;
}

export function CheckpointsPanel({ slideCount, initialCheckpoints = [], onChange, onSave }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initialCheckpoints));

  const emit = (next: Set<number>) => {
    const arr = Array.from(next).sort((a, b) => a - b);
    onChange?.(arr);
    return arr;
  };

  const toggle = (n: number) => {
    const next = new Set(selected);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setSelected(next);
    emit(next);
  };

  useAutosave({ value: Array.from(selected), delayMs: 400, onSave: onSave ?? (async () => {}) });

  return (
    <section aria-label="Checkpoints Panel" role="region">
      <p id="checkpoints-heading">Critical Checkpoints</p>
      <div role="group" aria-labelledby="checkpoints-heading" style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8 }}>
        {Array.from({ length: slideCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={selected.has(n)}
            aria-label={`Toggle checkpoint ${n}`}
            onClick={() => toggle(n)}
            style={{
              padding: '6px 8px',
              background: selected.has(n) ? '#2563eb' : '#e5e7eb',
              color: selected.has(n) ? '#fff' : '#111827',
              borderRadius: 4,
              border: '1px solid #9ca3af',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </section>
  );
}
