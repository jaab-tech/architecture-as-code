import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './CodeBlock.js';
import { MarkdownBlock } from './MarkdownBlock.js';

const JSON = '{\n  "name": "shop",\n  "open": true,\n  "retry": null,\n  "limit": 3\n}';

afterEach(() => vi.restoreAllMocks());

describe('CodeBlock', () => {
    it('colours JSON keys, strings, numbers and keywords', () => {
        const { container } = render(<CodeBlock code={JSON} language="json" />);
        expect(container.querySelector('.codeblock-key')).toHaveTextContent('"name"');
        expect(container.querySelector('.codeblock-string')).toHaveTextContent('"shop"');
        expect(container.querySelector('.codeblock-number')).toHaveTextContent('3');
        expect(container.querySelector('.codeblock-keyword')).toHaveTextContent('true');
    });

    it('leaves other languages plain', () => {
        const { container } = render(<CodeBlock code={'key=value'} language="ini" />);
        expect(container.querySelector('.codeblock-key')).toBeNull();
        expect(container.querySelector('pre')).toHaveTextContent('key=value');
    });

    it('copies the code to the clipboard', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        render(<CodeBlock code={JSON} language="json" />);
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON));
        expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });

    it('expands into a dialog that Escape and the backdrop close', () => {
        render(<CodeBlock code={JSON} language="json" />);
        fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
        const dialog = screen.getByRole('dialog', { name: 'Code viewer' });
        expect(dialog).toHaveTextContent('"limit"');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'Code viewer' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
        fireEvent.click(screen.getByRole('dialog', { name: 'Code viewer' }));
        expect(screen.queryByRole('dialog', { name: 'Code viewer' })).toBeNull();
    });

    it('renders fenced blocks as a viewer and keeps inline code inline', () => {
        const { container } = render(
            <MarkdownBlock text={'Copy it into a `*.calm-view.json` to reuse it.\n\n```json\n{"a": 1}\n```'} headingLevel={4} />
        );
        expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
        expect(container.querySelector('.codeblock-key')).toHaveTextContent('"a"');
        const inline = container.querySelector('p code');
        expect(inline).toHaveTextContent('*.calm-view.json');
    });
});
