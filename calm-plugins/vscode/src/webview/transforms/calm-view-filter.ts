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
    /** Relationship id to drawn endpoints (after container lifting). */
    lifted: Map<string, string[]>;
}

/** Child node to all its containers, transitively. */
export function containerAncestors(arch: CalmArchitecture): Map<string, Set<string>> {
    const parents = new Map<string, Set<string>>();
    const add = (child: string, parent: string) => {
        if (child === parent) return;
        if (!parents.has(child)) parents.set(child, new Set());
        parents.get(child)?.add(parent);
    };
    for (const r of arch.relationships ?? []) {
        const rt = ((r as Record<string, unknown>)['relationship-type'] as Record<string, unknown> | undefined) ?? {};
        for (const key of ['composed-of', 'deployed-in'] as const) {
            const c = rt[key] as { container?: string; nodes?: string[] } | undefined;
            if (c?.container) {
                for (const m of c.nodes ?? []) add(m, c.container);
            }
        }
    }
    const closure = new Map<string, Set<string>>();
    const walk = (n: string, seen: Set<string>): Set<string> => {
        const out = new Set<string>();
        for (const p of parents.get(n) ?? []) {
            if (seen.has(p)) continue;
            out.add(p);
            for (const q of walk(p, new Set([...seen, n]))) out.add(q);
        }
        return out;
    };
    for (const n of arch.nodes ?? []) {
        const id = (n as Record<string, unknown>)['unique-id'] as string;
        if (id) closure.set(id, walk(id, new Set()));
    }
    return closure;
}

function liftEndpoint(e: string, selected: Set<string>, ancestors: Map<string, Set<string>>): string | null {
    if (selected.has(e)) return e;
    const seen = new Set([e]);
    const queue = [e];
    while (queue.length > 0) {
        const cur = queue.shift() as string;
        for (const p of ancestors.get(cur) ?? []) {
            if (seen.has(p)) continue;
            seen.add(p);
            if (selected.has(p)) return p;
            queue.push(p);
        }
    }
    return null;
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
 * Mirrors the reference resolver: listed ids plus relationship closure, with
 * endpoints lifted to the nearest visible container (LikeC4-style derived
 * relationships). Relationships collapsing to a self-loop are dropped.
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
    const ancestors = containerAncestors(arch);
    const selectedRels = new Set<string>();
    const lifted = new Map<string, string[]>();
    const liftAll = (id: string, r: Record<string, unknown>): boolean => {
        const eps = viewEndpoints(r);
        if (eps.size === 0) return false;
        const out: string[] = [];
        for (const e of eps) {
            const l = liftEndpoint(e, selected, ancestors);
            if (l === null) return false;
            if (!out.includes(l)) out.push(l);
        }
        if (out.length <= 1) return false;
        selectedRels.add(id);
        lifted.set(id, out);
        return true;
    };
    for (const id of filter.relationships ?? []) {
        if (rels.has(id)) liftAll(id, rels.get(id) as Record<string, unknown>);
    }
    for (const [id, r] of rels) {
        if (!selectedRels.has(id)) liftAll(id, r);
    }
    return { nodes: selected, relationships: selectedRels, lifted };
}
