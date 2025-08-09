import React, { useRef, useState } from 'react';
import { useAutosave } from '../hooks/useAutosave';

interface Props {
  initialGoal?: string;
  suggestions?: string[];
  onChange?: (goal: string) => void;
  onSave?: (goal: string) => Promise<void> | void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export function GoalsPanel({ initialGoal = '', suggestions = [], onChange, onSave, textareaRef }: Props) {
  const [goal, setGoal] = useState<string>(initialGoal);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? localRef;

  const update = (g: string) => {
    setGoal(g);
    onChange?.(g);
  };

  useAutosave({ value: goal, delayMs: 400, onSave: onSave ?? (async () => {}) });

  const suggestionsId = 'goal-suggestions';

  return (
    <section aria-label="Goals Panel" role="region" aria-describedby={suggestions.length ? suggestionsId : undefined}>
      <label htmlFor="goal-input">Learning Goal</label>
      <textarea
        id="goal-input"
        ref={ref}
        value={goal}
        onChange={(e) => update(e.target.value)}
        rows={3}
        style={{ width: '100%' }}
      />
      {suggestions.length > 0 && (
        <div id={suggestionsId} aria-label="AI Suggestions">
          <p>Suggestions:</p>
          <ul>
            {suggestions.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => update(s)} aria-label={`Use suggestion ${i + 1}`}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
