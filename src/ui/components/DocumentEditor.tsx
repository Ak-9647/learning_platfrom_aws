import React, { useEffect, useRef, useState } from 'react';
import type { Slide } from '../../parsers/DocumentTypes';
import { SlidePreview } from './SlidePreview';
import { GoalsPanel } from './GoalsPanel';
import { CheckpointsPanel } from './CheckpointsPanel';
import { WebSocketClient } from '../realtime/WebSocketClient';

interface Props {
  slides: Slide[];
  initialGoal?: string;
  initialCheckpoints?: number[];
  goalSuggestions?: string[];
  onSaveGoal?: (goal: string) => Promise<void> | void;
  onSaveCheckpoints?: (checkpoints: number[]) => Promise<void> | void;
  wsUrl?: string;
}

export function DocumentEditor({
  slides,
  initialGoal,
  initialCheckpoints,
  goalSuggestions,
  onSaveGoal,
  onSaveCheckpoints,
  wsUrl,
}: Props) {
  const [current, setCurrent] = useState<number>(1);
  const [checkpoints, setCheckpoints] = useState<number[]>(initialCheckpoints || []);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocketClient | null>(null);

  const go = (n: number) => setCurrent(Math.max(1, Math.min(slides.length || 1, n)));
  const prev = () => go(current - 1);
  const next = () => go(current + 1);

  useEffect(() => {
    if (wsUrl) {
      wsRef.current = new WebSocketClient(wsUrl);
      wsRef.current.connect();
    }
    return () => {
      wsRef.current = null;
    };
  }, [wsUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        goalRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const n = current;
        const exists = checkpoints.includes(n);
        const nextList = exists ? checkpoints.filter((c) => c !== n) : [...checkpoints, n].sort((a, b) => a - b);
        setCheckpoints(nextList);
        wsRef.current?.send({ type: 'checkpoint_toggled', payload: { slide: n, active: !exists } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, checkpoints]);

  const onSavedGoal = async (g: string) => {
    await onSaveGoal?.(g);
    wsRef.current?.send({ type: 'goal_updated', payload: { goal: g } });
  };

  const onSavedCheckpoints = async (cp: number[]) => {
    setCheckpoints(cp);
    await onSaveCheckpoints?.(cp);
    wsRef.current?.send({ type: 'checkpoints_updated', payload: { checkpoints: cp } });
  };

  return (
    <div aria-label="Document Editor" role="application" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <button type="button" onClick={prev} disabled={current <= 1} aria-label="Previous slide">
            ◀ Prev
          </button>
          <span role="status" aria-live="polite">
            Slide {current} / {slides.length || 1}
          </span>
          <button type="button" onClick={next} disabled={current >= (slides.length || 1)} aria-label="Next slide">
            Next ▶
          </button>
        </div>
        <SlidePreview slides={slides} current={current} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GoalsPanel initialGoal={initialGoal} suggestions={goalSuggestions} onSave={onSavedGoal} textareaRef={goalRef} />
        <CheckpointsPanel
          slideCount={slides.length || 1}
          initialCheckpoints={initialCheckpoints}
          onSave={onSavedCheckpoints}
        />
        <div aria-label="Shortcuts" role="note">
          <p>Shortcuts: ⌘/Ctrl+G focus Goals, ⌘/Ctrl+K toggle checkpoint for current slide.</p>
        </div>
      </div>
    </div>
  );
}
