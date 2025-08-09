import React from 'react';
import type { Slide } from '../../parsers/DocumentTypes';

interface Props {
  slides: Slide[];
  current: number; // 1-based slide number
}

export function SlidePreview({ slides, current }: Props) {
  const slide = slides.find((s) => s.slideNumber === current);
  if (!slide) return <div role="status">No slide</div>;
  return (
    <div aria-label={`Slide ${slide.slideNumber}`}>
      <h2>{slide.title}</h2>
      <ul>
        {slide.content.map((c, idx) => (
          <li key={idx}>{c}</li>
        ))}
      </ul>
    </div>
  );
}
