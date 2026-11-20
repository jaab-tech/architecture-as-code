import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import './CodeBlock.css';

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

type Part = { text: string; kind?: 'key' | 'string' | 'number' | 'keyword' };

/** Splits JSON source into coloured parts. Anything the pattern misses stays plain text. */
function tokenize(source: string): Part[] {
    const parts: Part[] = [];
    let at = 0;
    TOKEN.lastIndex = 0;
    for (let match = TOKEN.exec(source); match !== null; match = TOKEN.exec(source)) {
        if (match.index > at) parts.push({ text: source.slice(at, match.index) });
        const [text, quoted, colon, keyword] = match;
        parts.push({
            text,
            kind: quoted ? (colon !== undefined ? 'key' : 'string') : keyword !== undefined ? 'keyword' : 'number',
        });
        at = match.index + text.length;
    }
    if (at < source.length) parts.push({ text: source.slice(at) });
    return parts;
}

function highlighted(source: string, keyPrefix: string): ReactNode {
    return tokenize(source).map((part, index) =>
        part.kind === undefined ? (
            <span key={`${keyPrefix}-${index}`}>{part.text}</span>
        ) : (
            <span key={`${keyPrefix}-${index}`} className={`codeblock-${part.kind}`}>
                {part.text}
            </span>
        )
    );
}

async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // The clipboard API is missing or refused: fall back to a selected textarea.
        try {
            const area = document.createElement('textarea');
            area.value = text;
            document.body.append(area);
            area.select();
            const done = document.execCommand('copy');
            area.remove();
            return done;
        } catch {
            return false;
        }
    }
}

/** A fenced code block with syntax colours, a copy button and a larger modal view. */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const closeRef = useRef<HTMLButtonElement>(null);
    const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
    const json = (language ?? '').toLowerCase() === 'json';
    const body = json ? highlighted(code, uid) : code;

    useEffect(() => {
        if (!expanded) return;
        closeRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setExpanded(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [expanded]);

    const copy = async () => {
        if (await copyText(code)) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }
    };

    return (
        <>
            <div className="codeblock">
                <div className="codeblock-bar">
                    <button type="button" className="btn btn-ghost btn-xs" onClick={copy}>
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setExpanded(true)} aria-haspopup="dialog">
                        Expand
                    </button>
                </div>
                <pre className="codeblock-pre">
                    <code>{body}</code>
                </pre>
            </div>
            {expanded && (
                <div className="codeblock-dialog" role="dialog" aria-modal="true" aria-label="Code viewer" onClick={() => setExpanded(false)}>
                    <div className="codeblock codeblock-frame" onClick={(event) => event.stopPropagation()}>
                        <div className="codeblock-bar">
                            <button type="button" className="btn btn-ghost btn-xs" onClick={copy}>
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                            <button type="button" ref={closeRef} className="btn btn-ghost btn-xs" onClick={() => setExpanded(false)}>
                                Close
                            </button>
                        </div>
                        <div className="codeblock-body">
                            <pre className="codeblock-pre codeblock-pre-large">
                                <code>{json ? highlighted(code, `${uid}-large`) : code}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
