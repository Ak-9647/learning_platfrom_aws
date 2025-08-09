import React from 'react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentEditor } from '../DocumentEditor';

const slides = [
  { slideNumber: 1, title: 'Intro', content: ['hello'], images: [] },
  { slideNumber: 2, title: 'Next', content: ['more'], images: [] },
  { slideNumber: 3, title: 'End', content: ['bye'], images: [] },
];

describe('DocumentEditor', () => {
  it('renders and navigates slides', () => {
    render(<DocumentEditor slides={slides} />);
    expect(screen.getByText('Intro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('shows goals and checkpoints panels', () => {
    render(<DocumentEditor slides={slides} initialGoal="Learn" initialCheckpoints={[1, 3]} />);
    expect(screen.getByLabelText('Goals Panel')).toBeInTheDocument();
    expect(screen.getByLabelText('Checkpoints Panel')).toBeInTheDocument();
  });
});
