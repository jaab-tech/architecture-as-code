import * as vscode from 'vscode';
import * as cp from 'child_process';

/**
 * Minimal stdio JSON-RPC client for one workspace MCP server
 * (`poc/mcp/dist/index.js`). No new dependencies: newline-delimited
 * JSON-RPC is all the MCP stdio transport needs for tools/call.
 * Spike scope: only the `sql` tool is proxied.
 */
export class McpBridge {
    private proc: cp.ChildProcessWithoutNullStreams | null = null;
    private serverPath: string | null = null;
    private nextId = 1;
    private pending = new Map<number, (msg: Record<string, unknown>) => void>();
    private buffer = '';
    private log: vscode.OutputChannel;

    constructor(log: vscode.OutputChannel) {
        this.log = log;
    }

    async locateServer(): Promise<string | null> {
        if (this.serverPath) return this.serverPath;
        const uris = await vscode.workspace.findFiles('**/mcp/dist/index.js');
        if (uris.length === 0) return null;
        this.serverPath = uris[0]?.fsPath ?? null;
        return this.serverPath;
    }

    private async ensureStarted(): Promise<boolean> {
        if (this.proc) return true;
        const entry = await this.locateServer();
        if (!entry) return false;
        try {
            this.proc = cp.spawn(process.execPath, [entry], { stdio: ['pipe', 'pipe', 'pipe'] });
        } catch (err) {
            this.log.appendLine(`[McpBridge] spawn failed: ${String(err)}`);
            return false;
        }
        this.proc.stdout.on('data', (chunk: Buffer) => this.onData(chunk.toString('utf8')));
        this.proc.stderr.on('data', (chunk: Buffer) =>
            this.log.appendLine(`[McpBridge:stderr] ${chunk.toString('utf8').trim()}`)
        );
        this.proc.on('exit', () => {
            this.proc = null;
        });
        const hello = await this.request('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'calm-canvas', version: '0.9.6' },
        });
        if (!hello) {
            this.stop();
            return false;
        }
        this.notify('notifications/initialized', {});
        return true;
    }

    private onData(text: string): void {
        this.buffer += text;
        let idx = this.buffer.indexOf('\n');
        while (idx >= 0) {
            const line = this.buffer.slice(0, idx).trim();
            this.buffer = this.buffer.slice(idx + 1);
            if (line) {
                try {
                    const msg = JSON.parse(line) as { id?: number } & Record<string, unknown>;
                    if (typeof msg.id === 'number') {
                        const resolve = this.pending.get(msg.id);
                        if (resolve) {
                            this.pending.delete(msg.id);
                            resolve(msg);
                        }
                    }
                } catch {
                    this.log.appendLine('[McpBridge] unparsable line from server');
                }
            }
            idx = this.buffer.indexOf('\n');
        }
    }

    private request(method: string, params: unknown): Promise<Record<string, unknown> | null> {
        return new Promise((resolve) => {
            if (!this.proc?.stdin) {
                resolve(null);
                return;
            }
            const id = this.nextId++;
            const timer = setTimeout(() => {
                this.pending.delete(id);
                resolve(null);
            }, 15000);
            this.pending.set(id, (msg) => {
                clearTimeout(timer);
                resolve(msg);
            });
            this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        });
    }

    private notify(method: string, params: unknown): void {
        this.proc?.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    }

    async querySql(sql: string): Promise<{ ok: true; rows: unknown[] } | { ok: false; error: string }> {
        if (!(await this.ensureStarted())) {
            return { ok: false, error: 'No workspace MCP server found (expected poc/mcp/dist/index.js, built).' };
        }
        const msg = await this.request('tools/call', {
            name: 'sql',
            arguments: { query: sql },
        });
        if (!msg) return { ok: false, error: 'MCP server timed out.' };
        if (msg['error']) {
            const e = msg['error'] as Record<string, unknown>;
            return { ok: false, error: (e['message'] as string) ?? 'MCP error' };
        }
        const result = msg['result'] as
            | { content?: Array<{ type?: string; text?: string }>; isError?: boolean }
            | undefined;
        const text = result?.content?.[0]?.text ?? '';
        if (result?.isError) return { ok: false, error: text || 'query rejected' };
        try {
            return { ok: true, rows: JSON.parse(text) as unknown[] };
        } catch {
            return { ok: false, error: 'unparsable rows from server' };
        }
    }

    stop(): void {
        try {
            this.proc?.kill();
        } catch {
            /* already gone */
        }
        this.proc = null;
        this.pending.clear();
        this.buffer = '';
    }
}
