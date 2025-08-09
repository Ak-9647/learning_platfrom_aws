import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlidePreview } from '../SlidePreview';

const slides = [
  { slideNumber: 1, title: 'Intro', content: ['hello', 'world'], images: [] },
  { slideNumber: 2, title: 'Next', content: ['more'], images: [] },
];

describe('SlidePreview', () => {
  it('renders current slide title and content', () => {
    render(<SlidePreview slides={slides} current={1} />);
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('shows status when slide not found', () => {
    render(<SlidePreview slides={slides} current={3} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
