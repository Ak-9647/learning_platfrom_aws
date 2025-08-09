import React, { useState } from 'react';
import { useAutosave } from '../hooks/useAutosave';

export interface AssessmentConfig {
  title: string;
  numQuestions: number;
  passPercent: number; // 0-100
}

interface Props {
  initial?: AssessmentConfig;
  onSave?: (cfg: AssessmentConfig) => Promise<void> | void;
}

export function AssessmentPanel({ initial, onSave }: Props) {
  const [cfg, setCfg] = useState<AssessmentConfig>(
    initial ?? { title: '', numQuestions: 5, passPercent: 70 }
  );

  const update = (patch: Partial<AssessmentConfig>) => setCfg((c) => ({ ...c, ...patch }));

  useAutosave({ value: cfg, delayMs: 500, onSave: onSave ?? (async () => {}) });

  return (
    <section aria-label="Assessment Panel" role="region">
      <h3>Assessment Configuration</h3>
      <div>
        <label htmlFor="assess-title">Title</label>
        <input
          id="assess-title"
          type="text"
          value={cfg.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="assess-num">Number of Questions</label>
        <input
          id="assess-num"
          type="number"
          min={1}
          max={50}
          value={cfg.numQuestions}
          onChange={(e) => update({ numQuestions: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
        />
      </div>
      <div>
        <label htmlFor="assess-pass">Pass Threshold (%)</label>
        <input
          id="assess-pass"
          type="number"
          min={0}
          max={100}
          value={cfg.passPercent}
          onChange={(e) => update({ passPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
        />
      </div>
    </section>
  );
}
