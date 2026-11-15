import type { CalmArchitecture } from './calm-editor-transformer';

export interface CalmViewFilter {
    nodes?: string[];
    'node-types'?: string[];
    relationships?: string[];
    flows?: string[];
    decorators?: string[];
}

export interface ViewSelection {
    nodes: Set<string>;
    relationships: Set<string>;
}

/** Node unique-ids a relationship touches, by relationship-type. */
export function viewEndpoints(rel: Record<string, unknown>): Set<string> {
    const out = new Set<string>();
    const rt = (rel['relationship-type'] as Record<string, unknown> | undefined) ?? {};
    const connects = rt['connects'] as
        | { source?: { node?: string }; destination?: { node?: string } }
        | undefined;
    if (connects) {
        if (connects.source?.node) out.add(connects.source.node);
        if (connects.destination?.node) out.add(connects.destination.node);
    }
    const interacts = rt['interacts'] as
        | { actor?: string; nodes?: string[] }
        | undefined;
    if (interacts) {
        if (interacts.actor) out.add(interacts.actor);
        for (const n of interacts.nodes ?? []) out.add(n);
    }
    for (const key of ['composed-of', 'deployed-in'] as const) {
        const c = rt[key] as { container?: string; nodes?: string[] } | undefined;
        if (c) {
            if (c.container) out.add(c.container);
            for (const n of c.nodes ?? []) out.add(n);
        }
    }
    return out;
}

/**
 * Apply a CALM view filter, returning the selected node and relationship ids.
 * Mirrors the Python reference (`validate.resolve_view`): listed ids plus
 * relationship closure (a relationship is in when all its endpoints are in).
 * Flows and decorators are accepted but do not select canvas elements here.
 */
export function resolveViewSelection(
    arch: CalmArchitecture,
    filter: CalmViewFilter
): ViewSelection {
    const nodes = new Map<string, unknown>();
    for (const n of arch.nodes ?? []) {
        const id = (n as Record<string, unknown>)['unique-id'] as string;
        if (id) nodes.set(id, n);
    }
    const selected = new Set<string>(filter.nodes ?? []);
    for (const [id, n] of nodes) {
        const t = (n as Record<string, unknown>)['node-type'] as string;
        if (filter['node-types']?.includes(t)) selected.add(id);
    }
    const rels = new Map<string, Record<string, unknown>>();
    for (const r of arch.relationships ?? []) {
        const id = (r as Record<string, unknown>)['unique-id'] as string;
        if (id) rels.set(id, r as Record<string, unknown>);
    }
    const selectedRels = new Set<string>();
    for (const id of filter.relationships ?? []) {
        if (rels.has(id)) selectedRels.add(id);
    }
    for (const [id, r] of rels) {
        if (selectedRels.has(id)) continue;
        const eps = viewEndpoints(r);
        if (eps.size > 0 && [...eps].every((e) => selected.has(e))) {
            selectedRels.add(id);
        }
    }
    return { nodes: selected, relationships: selectedRels };
}
