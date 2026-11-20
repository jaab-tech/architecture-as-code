import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Notation } from '../../model/lens.js';
import core from '../../../../calm-hub/src/main/resources/META-INF/calm-extensions/notations/core.json' with { type: 'json' };
import { LensKey } from './LensKey.js';
import type { ResolvedNotation } from './styles.js';

const notation: ResolvedNotation = {
    own: { styles: { elements: [{ tag: 'actor', background: '#e8f4fd' }] } },
    core: core as Notation,
};

describe('LensKey', () => {
    it('hides and shows the key without changing the tag selection', () => {
        const onToggle = vi.fn();
        render(<LensKey entries={[{ kind: 'element', tag: 'actor', label: 'actor' }]} notation={notation}
            theme="light" hidden={new Set()} onToggle={onToggle} />);

        expect(screen.getByRole('button', { name: 'actor' })).toHaveAttribute('title', 'Dim actor');
        fireEvent.click(screen.getByRole('button', { name: 'Hide key' }));
        expect(screen.queryByRole('button', { name: 'actor' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Show key' }));
        expect(screen.getByRole('button', { name: 'actor' })).toHaveAttribute('title', 'Dim actor');
        expect(onToggle).not.toHaveBeenCalled();
    });

    it('follows the controlled visibility', () => {
        const onToggle = vi.fn();
        const onOpenChange = vi.fn();
        const view = render(<LensKey entries={[{ kind: 'element', tag: 'actor', label: 'actor' }]} notation={notation}
            theme="light" hidden={new Set()} onToggle={onToggle} open={false} onOpenChange={onOpenChange} />);

        expect(screen.queryByRole('button', { name: 'actor' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Show key' }));
        expect(onOpenChange).toHaveBeenCalledWith(true);
        view.rerender(<LensKey entries={[{ kind: 'element', tag: 'actor', label: 'actor' }]} notation={notation}
            theme="light" hidden={new Set()} onToggle={onToggle} open onOpenChange={onOpenChange} />);
        expect(screen.getByRole('button', { name: 'actor' })).toBeInTheDocument();
    });
});
