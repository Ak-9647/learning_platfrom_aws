import React, { useState } from 'react';
import { useAutosave } from '../hooks/useAutosave';

interface Props {
  initialGoal?: string;
  suggestions?: string[];
  onChange?: (goal: string) => void;
  onSave?: (goal: string) => Promise<void> | void;
}

export function GoalsPanel({ initialGoal = '', suggestions = [], onChange, onSave }: Props) {
  const [goal, setGoal] = useState<string>(initialGoal);

  const update = (g: string) => {
    setGoal(g);
    onChange?.(g);
  };

  useAutosave({ value: goal, delayMs: 400, onSave: onSave ?? (async () => {}) });

  return (
    <div aria-label="Goals Panel">
      <label htmlFor="goal-input">Learning Goal</label>
      <textarea
        id="goal-input"
        value={goal}
        onChange={(e) => update(e.target.value)}
        rows={3}
        style={{ width: '100%' }}
      />
      {suggestions.length > 0 && (
        <div aria-label="AI Suggestions">
          <p>Suggestions:</p>
          <ul>
            {suggestions.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => update(s)}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
