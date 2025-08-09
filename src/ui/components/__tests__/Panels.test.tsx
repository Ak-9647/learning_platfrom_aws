import React from 'react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoalsPanel } from '../GoalsPanel';
import { CheckpointsPanel } from '../CheckpointsPanel';

describe('GoalsPanel', () => {
  it('renders and applies suggestion', () => {
    const onChange = vi.fn();
    render(<GoalsPanel initialGoal="A" suggestions={["B"]} onChange={onChange} />);
    const btn = screen.getByRole('button', { name: 'B' });
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith('B');
    expect(screen.getByDisplayValue('B')).toBeInTheDocument();
  });
});

describe('CheckpointsPanel', () => {
  it('toggles checkpoints', () => {
    const onChange = vi.fn();
    render(<CheckpointsPanel slideCount={5} initialCheckpoints={[2]} onChange={onChange} />);
    const btn3 = screen.getByRole('button', { name: '3' });
    fireEvent.click(btn3);
    expect(onChange).toHaveBeenCalledWith([2, 3]);
    const btn2 = screen.getByRole('button', { name: '2' });
    fireEvent.click(btn2);
    expect(onChange).toHaveBeenCalledWith([3]);
  });
});
