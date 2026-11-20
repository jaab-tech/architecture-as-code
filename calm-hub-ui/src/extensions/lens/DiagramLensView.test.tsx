import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionSummary } from '../../model/extensions.js';
import type { DiagramLensContribution, Notation } from '../../model/lens.js';
import { ExtensionCallError, ExtensionService } from '../../service/extension-service.js';
import core from '../../../../calm-hub/src/main/resources/META-INF/calm-extensions/notations/core.json' with { type: 'json' };
import { DiagramLensView, type DiagramLensViewProps } from './DiagramLensView.js';

const lens: DiagramLensContribution = {
    id: 'c4', title: 'C4', route: 'lens', notation: 'notation.json',
    params: { level: { values: ['context', 'container'], default: 'context' } },
};
const extension: ExtensionSummary = {
    id: 'c4', name: 'C4 model', hubApi: 0,
    routes: [{ id: 'lens', method: 'GET', path: '/lens/{namespace}', scope: 'read', readOnly: true }],
    contributes: { 'diagram-lens': [lens] },
};
const reply = {
    hubApi: 0, kind: 'graph',
    graph: {
        nodes: [
            { id: 'shop', label: 'Online Shop', tags: ['Box', 'actor'], calm: ['shop'], link: { params: { level: 'container' } } },
            { id: 'pay', label: 'Payments', tags: ['Box', 'service'], calm: ['payments'] },
        ],
        edges: [{ id: 'e', source: 'shop', target: 'pay', tags: ['connects'], label: 'Takes payment' }],
    },
    controls: [{ type: 'segmented', param: 'level', items: [{ value: 'context', label: 'Context' }, { value: 'container', label: 'Container' }] }],
    panels: [{ title: 'Notes', blocks: [{ type: 'alert', tone: 'warning', text: 'payments is guessed' }] }],
};

let call: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
    vi.spyOn(ExtensionService.prototype, 'fetchLensNotation').mockResolvedValue({});
    vi.spyOn(ExtensionService.prototype, 'fetchCoreNotation').mockResolvedValue(core as Notation);
    call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue(reply);
});
afterEach(() => vi.restoreAllMocks());

function show(props: Partial<DiagramLensViewProps> = {}) {
    const all: DiagramLensViewProps = {
        extension, lens, context: { namespace: 'finos', resourceType: 'architectures', resourceId: 'shop', version: '1.0.0' },
        params: {}, onParamsChange: vi.fn(), onSelectElement: vi.fn(), ...props,
    };
    const view = render(<MemoryRouter><DiagramLensView {...all} /></MemoryRouter>);
    return { ...all, rerender: (next: Partial<DiagramLensViewProps>) => view.rerender(<MemoryRouter><DiagramLensView {...all} {...next} /></MemoryRouter>) };
}

describe('DiagramLensView', () => {
    it('draws the graph, its controls and its notes, and sends only the declared parameters', async () => {
        show({ params: { level: 'component', tab: 'json' } });
        expect(await screen.findByRole('button', { name: 'Online Shop' })).toBeInTheDocument();
        expect(screen.getByText('Takes payment')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Context' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('complementary', { name: 'Lens notes' })).toHaveTextContent('payments is guessed');
        expect(call).toHaveBeenCalledWith('c4', extension.routes[0],
            { namespace: 'finos', resourceType: 'architectures', resourceId: 'shop', version: '1.0.0', level: 'context' }, expect.any(AbortSignal));
    });

    it('shows the value that the reply was drawn with when the URL names none', async () => {
        const scoped = { ...lens, params: { ...lens.params, scope: { pattern: '^[a-z]+$' } } };
        call.mockResolvedValue({
            ...reply,
            controls: [{ type: 'select', param: 'scope', label: 'System', value: 'payments', items: [{ value: 'shop', label: 'Online Shop' }, { value: 'payments', label: 'Payments' }] }],
        });
        show({ lens: scoped, extension: { ...extension, contributes: { 'diagram-lens': [scoped] } } });
        expect(await screen.findByRole('combobox', { name: 'System' })).toHaveValue('payments');
        expect(screen.queryByRole('option', { name: 'Choose…' })).toBeNull();
    });

    it('selects the CALM element of a node on click, and drills down from its badge', async () => {
        const { onParamsChange, onSelectElement } = show();
        fireEvent.click(await screen.findByRole('button', { name: 'Online Shop' }));
        expect(onSelectElement).toHaveBeenCalledWith('shop');
        expect(onParamsChange).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Open Online Shop' }));
        expect(onParamsChange).toHaveBeenCalledWith({ level: 'container' }, 'shop');
        fireEvent.click(screen.getByRole('button', { name: 'Payments' }));
        expect(onSelectElement).toHaveBeenCalledWith('payments');
    });

    it('selects the container of a group on click, and drills down from its badge', async () => {
        call.mockResolvedValue({
            ...reply,
            graph: {
                ...reply.graph,
                groups: [{ id: 'group:shop', label: 'Shop container', tags: ['Box'] }],
                nodes: reply.graph.nodes.map((node) => node.id === 'pay' ? { ...node, group: 'group:shop' } : node),
            },
        });
        const { onParamsChange, onSelectElement } = show();
        fireEvent.click(await screen.findByText('Shop container'));
        expect(onSelectElement).toHaveBeenCalledWith('shop');
        expect(onParamsChange).not.toHaveBeenCalled();
        const badges = screen.getAllByRole('button', { name: 'Open Online Shop' });
        expect(badges).toHaveLength(2);
        fireEvent.click(badges[0]);
        expect(onParamsChange).toHaveBeenCalledWith({ level: 'container' }, 'shop');
    });

    it('hides the key from the canvas toolbar', async () => {
        vi.spyOn(ExtensionService.prototype, 'fetchLensNotation').mockResolvedValue({
            styles: { elements: [{ tag: 'actor', background: '#e8f4fd' }], relationships: [] },
        });
        show();
        await screen.findByRole('button', { name: 'Online Shop' });
        expect(screen.getAllByRole('button', { name: 'Hide key' })).toHaveLength(2);
        fireEvent.click(screen.getAllByRole('button', { name: 'Hide key' })[0]);
        expect(screen.queryByRole('button', { name: 'actor' })).toBeNull();
        expect(screen.getAllByRole('button', { name: 'Show key' })).toHaveLength(2);
    });

    it('hides the notes from the canvas toolbar', async () => {
        show();
        await screen.findByRole('button', { name: 'Online Shop' });
        expect(screen.getByRole('complementary', { name: 'Lens notes' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Hide notes' }));
        expect(screen.queryByRole('complementary', { name: 'Lens notes' })).toBeNull();
        expect(screen.getAllByRole('button', { name: 'Show notes' })).toHaveLength(2);
        fireEvent.click(screen.getAllByRole('button', { name: 'Show notes' })[0]);
        expect(screen.getByRole('complementary', { name: 'Lens notes' })).toBeInTheDocument();
    });

    it('marks a selection with no new request when the route does not take it', async () => {
        const view = show();
        await screen.findByRole('button', { name: 'Online Shop' });
        view.rerender({ context: { ...view.context, selectedElement: 'payments' } });
        await waitFor(() => expect(document.querySelector('[data-node="pay"] [data-selected]')).not.toBeNull());
        expect(call).toHaveBeenCalledTimes(1);
    });

    it('names the fault of a reply that is not valid', async () => {
        call.mockResolvedValue({ ...reply, graph: { nodes: [{ id: 'a', label: 'A' }], edges: [{ id: 'e', source: 'a', target: 'x' }] } });
        show();
        expect(await screen.findByRole('alert')).toHaveTextContent("The lens reply is not valid.Edge 'e' has an unknown target 'x'.");
    });

    it('shows the title and detail of a problem reply', async () => {
        call.mockRejectedValue(new ExtensionCallError({ title: 'The C4 mapping does not load', detail: 'c4-mapping has no level' }));
        show();
        expect(await screen.findByRole('alert')).toHaveTextContent('The C4 mapping does not loadc4-mapping has no level');
    });
});
