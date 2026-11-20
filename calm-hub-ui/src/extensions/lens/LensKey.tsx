import { useState } from 'react';
import type { Theme } from '../../theme/useTheme.js';
import { fitShape } from './geometry.js';
import { ShapeParts } from './LensShape.js';
import { CANVAS, DASH, elementStyle, findMarker, findShape, relationshipStyle, type KeyEntry, type ResolvedNotation } from './styles.js';

interface LensKeyProps {
    entries: KeyEntry[];
    notation: ResolvedNotation;
    theme: Theme;
    hidden: ReadonlySet<string>;
    onToggle: (tag: string) => void;
    /** Controlled visibility. Leave out both to keep the internal state. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

/** The diagram key: each style that the diagram uses. A click dims the elements with that tag, with no request. */
export function LensKey({ entries, notation, theme, hidden, onToggle, open: controlledOpen, onOpenChange }: LensKeyProps) {
    const [internalOpen, setInternalOpen] = useState(true);
    const open = controlledOpen ?? internalOpen;
    const setOpen = onOpenChange ?? setInternalOpen;
    if (entries.length === 0) return null;
    return (
        <div className="absolute right-3 bottom-3 max-w-56 text-xs shadow-sm"
            onPointerDown={(event) => event.stopPropagation()}>
            {open ? (
                <div className="max-h-[40vh] overflow-auto rounded-lg border border-base-300 bg-base-100/95 p-2">
                    <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="font-semibold text-base-content/70">Key</p>
                        <button type="button" className="btn btn-ghost btn-xs min-h-0 h-5 px-1" aria-label="Hide key" title="Hide key"
                            aria-expanded="true" onClick={() => setOpen(false)}>
                            Hide
                        </button>
                    </div>
                    <ul className="flex flex-col gap-0.5">
                        {entries.map((entry) => {
                            const off = hidden.has(entry.tag);
                            return (
                                <li key={`${entry.kind}-${entry.tag}`}>
                                    <button type="button" aria-pressed={!off} title={off ? `Show ${entry.label}` : `Dim ${entry.label}`}
                                        className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-base-200 ${off ? 'opacity-40' : ''}`}
                                        onClick={() => onToggle(entry.tag)}>
                                        <Swatch entry={entry} notation={notation} theme={theme} />
                                        <span className="truncate">{entry.label}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : (
                <button type="button" className="btn btn-sm rounded-lg border border-base-300 bg-base-100/95 shadow-sm"
                    aria-label="Show key" title="Show key" aria-expanded="false" onClick={() => setOpen(true)}>
                    Show key
                </button>
            )}
        </div>
    );
}

function Swatch({ entry, notation, theme }: { entry: KeyEntry; notation: ResolvedNotation; theme: Theme }) {
    if (entry.kind === 'relationship') {
        const style = relationshipStyle(notation, [entry.tag], theme);
        // The ends tell relationships apart in many notations, so the key draws them as the canvas does.
        const end = (name: string | undefined, x: number, pointsRight: boolean) => {
            const marker = name ? findMarker(notation, name) : undefined;
            if (!marker) return null;
            const [minX, minY, width, height] = marker.viewBox;
            const shape = { viewBox: [minX, minY, width, height] as [number, number, number, number], parts: marker.parts };
            const scale = 8 / Math.max(width, height);
            return (
                <g transform={`translate(${x},${6 - (height * scale) / 2}) scale(${pointsRight ? scale : -scale},${scale}) translate(${-width},0)`}>
                    <ShapeParts shape={shape} fit={fitShape(shape, undefined, undefined, width, height)}
                        style={{ background: CANVAS[theme].background, color: style.color, stroke: style.color, accent: style.color, strokeWidth: 1.5, border: 'solid' }} />
                </g>
            );
        };
        return (
            <svg width={28} height={12} aria-hidden="true">
                <line x1={1} y1={6} x2={27} y2={6} stroke={style.color} strokeWidth={Math.min(style.thickness, 3)} strokeDasharray={DASH[style.style]} />
                {end(style.start, 1, false)}
                {end(style.end, 27, true)}
            </svg>
        );
    }
    // The shape of the style, kept to its ratio, so that a style that sets only a shape still shows.
    const style = elementStyle(notation, [entry.tag], theme);
    const shape = { ...findShape(notation, style.shape)!, resize: { mode: 'aspect' as const } };
    return (
        <svg width={22} height={16} aria-hidden="true">
            <g transform="translate(1,1)">
                <ShapeParts shape={shape} fit={fitShape(shape, undefined, undefined, 20, 14)} style={{ ...style, strokeWidth: 1 }} />
            </g>
        </svg>
    );
}
