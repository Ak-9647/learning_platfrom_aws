import React, { useRef, useState } from 'react';
import { useAutosave } from '../hooks/useAutosave';

interface Props {
  initialGoal?: string;
  suggestions?: string[];
  onChange?: (goal: string) => void;
  onSave?: (goal: string) => Promise<void> | void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  suggestApiUrl?: string;
  contentProvider?: () => string; // returns text to summarize for suggestions
}

export function GoalsPanel({ initialGoal = '', suggestions = [], onChange, onSave, textareaRef, suggestApiUrl, contentProvider }: Props) {
  const [goal, setGoal] = useState<string>(initialGoal);
  const [localSuggestions, setLocalSuggestions] = useState<string[]>(suggestions);
  const [loading, setLoading] = useState(false);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? localRef;

  const update = (g: string) => {
    setGoal(g);
    onChange?.(g);
  };

  useAutosave({ value: goal, delayMs: 400, onSave: onSave ?? (async () => {}) });

  const fetchSuggestions = async () => {
    if (!suggestApiUrl) return;
    setLoading(true);
    try {
      const payload = { content: contentProvider ? contentProvider() : goal, topK: 3 };
      const res = await fetch(suggestApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setLocalSuggestions(data.suggestions || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const suggestionsId = 'goal-suggestions';

  return (
    <section aria-label="Goals Panel" role="region" aria-describedby={localSuggestions.length ? suggestionsId : undefined}>
      <label htmlFor="goal-input">Learning Goal</label>
      <textarea
        id="goal-input"
        ref={ref}
        value={goal}
        onChange={(e) => update(e.target.value)}
        rows={3}
        style={{ width: '100%' }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={fetchSuggestions} disabled={!suggestApiUrl || loading} aria-busy={loading} aria-label="Fetch AI suggestions">
          {loading ? 'Suggesting…' : 'Suggest goals'}
        </button>
      </div>
      {localSuggestions.length > 0 && (
        <div id={suggestionsId} aria-label="AI Suggestions">
          <p>Suggestions:</p>
          <ul>
            {localSuggestions.map((s, i) => (
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
