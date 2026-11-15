import { describe, it, expect } from 'vitest';
import { resolveViewSelection, viewEndpoints } from './calm-view-filter';
import type { CalmArchitecture } from './calm-editor-transformer';

function arch(nodes: unknown[], relationships: unknown[] = []): CalmArchitecture {
    return { nodes, relationships } as CalmArchitecture;
}

const N = (id: string, type = 'service') => ({ 'unique-id': id, 'node-type': type });
const CONN = (id: string, s: string, d: string) => ({
    'unique-id': id,
    'relationship-type': { connects: { source: { node: s }, destination: { node: d } } },
});

describe('viewEndpoints', () => {
    it('reads connects endpoints', () => {
        expect(viewEndpoints(CONN('r', 'a', 'b') as Record<string, unknown>)).toEqual(
            new Set(['a', 'b'])
        );
    });
    it('reads interacts actor and nodes', () => {
        const rel = {
            'relationship-type': { interacts: { actor: 'u', nodes: ['t'] } },
        } as unknown as Record<string, unknown>;
        expect(viewEndpoints(rel)).toEqual(new Set(['u', 't']));
    });
});

describe('resolveViewSelection', () => {
    const model = arch(
        [N('a'), N('b'), N('db', 'database')],
        [CONN('r1', 'a', 'b'), CONN('r2', 'b', 'db')]
    );
    it('selects listed nodes only', () => {
        const sel = resolveViewSelection(model, { nodes: ['a'] });
        expect([...sel.nodes]).toEqual(['a']);
        expect(sel.relationships.size).toBe(0);
    });
    it('selects by node-type', () => {
        const sel = resolveViewSelection(model, { 'node-types': ['database'] });
        expect([...sel.nodes]).toEqual(['db']);
    });
    it('closes over relationships with all endpoints inside', () => {
        const sel = resolveViewSelection(model, { nodes: ['a', 'b'] });
        expect(sel.relationships.has('r1')).toBe(true);
        expect(sel.relationships.has('r2')).toBe(false);
    });
    it('keeps explicitly listed relationships', () => {
        const sel = resolveViewSelection(model, {
            nodes: ['b'],
            relationships: ['r2'],
        });
        expect(sel.relationships.has('r2')).toBe(true);
    });
});
