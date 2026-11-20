import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ZoomControls } from './ZoomControls.js';

const props = {
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onReset: vi.fn(),
    isInteractive: true,
    onToggleInteractive: vi.fn(),
};

describe('ZoomControls', () => {
    it('shows no key button without a key handler', () => {
        render(<ZoomControls {...props} />);
        expect(screen.queryByRole('button', { name: 'Hide key' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Show key' })).toBeNull();
    });

    it('toggles the key from the toolbar', () => {
        const onToggleKey = vi.fn();
        const view = render(<ZoomControls {...props} onToggleKey={onToggleKey} />);
        fireEvent.click(screen.getByRole('button', { name: 'Hide key' }));
        expect(onToggleKey).toHaveBeenCalledTimes(1);
        view.rerender(<ZoomControls {...props} onToggleKey={onToggleKey} keyHidden />);
        expect(screen.getByRole('button', { name: 'Show key' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows no notes button without a notes handler', () => {
        render(<ZoomControls {...props} />);
        expect(screen.queryByRole('button', { name: 'Hide notes' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Show notes' })).toBeNull();
    });

    it('toggles the notes from the toolbar', () => {
        const onToggleNotes = vi.fn();
        const view = render(<ZoomControls {...props} onToggleNotes={onToggleNotes} notesOpen />);
        fireEvent.click(screen.getByRole('button', { name: 'Hide notes' }));
        expect(onToggleNotes).toHaveBeenCalledTimes(1);
        view.rerender(<ZoomControls {...props} onToggleNotes={onToggleNotes} notesOpen={false} />);
        expect(screen.getByRole('button', { name: 'Show notes' })).toHaveAttribute('aria-pressed', 'false');
    });
});
