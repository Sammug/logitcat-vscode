import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SSEClient } from './sseClient';
import { AlertProvider, AlertItem } from './alertProvider';
import { LogitcatStatusBar } from './statusBar';
import { DashboardPanel } from './dashboardPanel';
import { AlertDetailPanel } from './alertDetailPanel';
import { Alert } from './types';

let sse:        SSEClient          | undefined;
let provider:   AlertProvider      | undefined;
let statusBar:  LogitcatStatusBar  | undefined;

export function activate(context: vscode.ExtensionContext): void {
    const cfg = () => vscode.workspace.getConfiguration('logitcat');

    // ── Init provider + status bar ──────────────────────────────────
    provider  = new AlertProvider(cfg().get('maxAlerts', 200));
    statusBar = new LogitcatStatusBar();

    const treeView = vscode.window.createTreeView('logitcat.alerts', {
        treeDataProvider: provider,
        showCollapseAll:  false,
    });

    // ── Connect to running daemon (if any) ──────────────────────────
    startSSE(cfg().get('dashboardPort', 9090));

    // ── Commands ────────────────────────────────────────────────────

    context.subscriptions.push(
        vscode.commands.registerCommand('logitcat.start', async () => {
            const execPath = resolveExecutable(cfg().get('executablePath', ''));
            if (!execPath) {
                vscode.window.showErrorMessage(
                    'logitcat: binary not found. Set logitcat.executablePath in settings.'
                );
                return;
            }

            const configPath = resolveConfig(cfg().get('configPath', ''));
            if (!configPath) {
                const picked = await vscode.window.showOpenDialog({
                    canSelectFiles:  true,
                    filters:         { 'INI config': ['ini'] },
                    openLabel:       'Select logitcat config'
                });
                if (!picked?.length) { return; }
            }

            const port    = cfg().get('dashboardPort', 9090);
            const config  = configPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath + '/logitcat.ini';
            const terminal = vscode.window.createTerminal({
                name: 'logitcat',
                iconPath: new vscode.ThemeIcon('eye'),
            });
            terminal.sendText(`"${execPath}" start "${config}"`);
            terminal.show(true);

            setTimeout(() => startSSE(port), 2000);
            vscode.window.showInformationMessage('logitcat starting…');
        }),

        vscode.commands.registerCommand('logitcat.stop', async () => {
            const execPath = resolveExecutable(cfg().get('executablePath', ''));
            if (execPath) {
                const terminal = vscode.window.createTerminal({ name: 'logitcat' });
                terminal.sendText(`"${execPath}" stop`);
            }
            sse?.disconnect();
            statusBar?.setOffline();
            vscode.window.showInformationMessage('logitcat stopped.');
        }),

        vscode.commands.registerCommand('logitcat.openDashboard', () => {
            DashboardPanel.show(cfg().get('dashboardPort', 9090), context.extensionUri);
        }),

        vscode.commands.registerCommand('logitcat.clearAlerts', () => {
            provider?.clear();
            statusBar?.setRunning(0, 0);
        }),

        vscode.commands.registerCommand('logitcat.showDetail', (item?: AlertItem) => {
            if (item?.alert) {
                AlertDetailPanel.show(item.alert, context.extensionUri);
            }
        }),

        vscode.commands.registerCommand('logitcat.copyMessage', async (item?: AlertItem) => {
            const text = item?.alert?.message;
            if (text) {
                await vscode.env.clipboard.writeText(text);
                vscode.window.showInformationMessage('Message copied.');
            }
        }),

        vscode.commands.registerCommand('logitcat.copyRaw', async (item?: AlertItem) => {
            const text = item?.alert?.raw || item?.alert?.message;
            if (text) {
                await vscode.env.clipboard.writeText(text);
                vscode.window.showInformationMessage('Raw line copied.');
            }
        }),

        treeView,
        { dispose: () => { sse?.disconnect(); statusBar?.dispose(); } }
    );

    // ── Auto-start if daemon already running ────────────────────────
    if (cfg().get('autoStart', true)) {
        startSSE(cfg().get('dashboardPort', 9090));
    }
}

export function deactivate(): void {
    sse?.disconnect();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function startSSE(port: number): void {
    sse?.disconnect();
    sse = new SSEClient(port);

    sse.on('connected', () => {
        statusBar?.setRunning(provider?.count ?? 0, provider?.criticalCount() ?? 0);
        vscode.window.setStatusBarMessage('$(pass) logitcat connected', 3000);
    });

    sse.on('alert', (alert: Alert) => {
        provider?.push(alert);
        statusBar?.setRunning(provider?.count ?? 0, provider?.criticalCount() ?? 0);

        // Show notification for CRITICAL alerts
        if (alert.severity === 'CRITICAL') {
            vscode.window.showWarningMessage(
                `🚨 logitcat [${alert.rule}]: ${alert.message}`,
                'Open Dashboard'
            ).then(action => {
                if (action === 'Open Dashboard') {
                    vscode.commands.executeCommand('logitcat.openDashboard');
                }
            });
        }
    });

    sse.on('disconnected', () => {
        statusBar?.setOffline();
    });

    sse.connect();
}

function resolveExecutable(configured: string): string | undefined {
    if (configured && fs.existsSync(configured)) { return configured; }

    // Common locations
    const candidates = [
        '/tmp/logitcat',
        '/usr/local/bin/logitcat',
        path.join(process.env.HOME ?? '', '.local/bin/logitcat'),
    ];
    return candidates.find(p => fs.existsSync(p));
}

function resolveConfig(configured: string): string | undefined {
    if (configured && fs.existsSync(configured)) { return configured; }

    // Look in workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
        const candidates = [
            path.join(workspaceRoot, 'logitcat.ini'),
            path.join(workspaceRoot, '.logitcat.ini'),
            path.join(workspaceRoot, 'config', 'logitcat.ini'),
        ];
        return candidates.find(p => fs.existsSync(p));
    }
    return undefined;
}
