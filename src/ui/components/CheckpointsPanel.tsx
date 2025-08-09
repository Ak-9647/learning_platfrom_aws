import React, { useState } from 'react';

interface Props {
  slideCount: number;
  initialCheckpoints?: number[]; // slide numbers
  onChange?: (checkpoints: number[]) => void;
}

export function CheckpointsPanel({ slideCount, initialCheckpoints = [], onChange }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initialCheckpoints));

  const toggle = (n: number) => {
    const next = new Set(selected);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setSelected(next);
    onChange?.(Array.from(next).sort((a, b) => a - b));
  };

  return (
    <div aria-label="Checkpoints Panel">
      <p>Critical Checkpoints</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8 }}>
        {Array.from({ length: slideCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={selected.has(n)}
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
    </div>
  );
}
