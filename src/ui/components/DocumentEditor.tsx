import React, { useEffect, useState } from 'react';
import type { Slide } from '../../parsers/DocumentTypes';
import { SlidePreview } from './SlidePreview';
import { GoalsPanel } from './GoalsPanel';
import { CheckpointsPanel } from './CheckpointsPanel';

interface Props {
  slides: Slide[];
  initialGoal?: string;
  initialCheckpoints?: number[];
  goalSuggestions?: string[];
  onSaveGoal?: (goal: string) => Promise<void> | void;
  onSaveCheckpoints?: (checkpoints: number[]) => Promise<void> | void;
}

export function DocumentEditor({
  slides,
  initialGoal,
  initialCheckpoints,
  goalSuggestions,
  onSaveGoal,
  onSaveCheckpoints,
}: Props) {
  const [current, setCurrent] = useState<number>(1);

  const go = (n: number) => setCurrent(Math.max(1, Math.min(slides.length || 1, n)));
  const prev = () => go(current - 1);
  const next = () => go(current + 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, slides.length]);

  return (
    <div aria-label="Document Editor" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button type="button" onClick={prev} disabled={current <= 1} aria-label="Previous slide">
            ◀ Prev
          </button>
          <span>
            Slide {current} / {slides.length || 1}
          </span>
          <button type="button" onClick={next} disabled={current >= (slides.length || 1)} aria-label="Next slide">
            Next ▶
          </button>
        </div>
        <SlidePreview slides={slides} current={current} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GoalsPanel initialGoal={initialGoal} suggestions={goalSuggestions} onSave={onSaveGoal} />
        <CheckpointsPanel
          slideCount={slides.length || 1}
          initialCheckpoints={initialCheckpoints}
          onSave={onSaveCheckpoints}
        />
      </div>
    </div>
  );
}
