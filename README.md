# logitcat for VS Code

Real-time log parsing and alerting inside VS Code — powered by the [logitcat](https://github.com/Sammug/logitcat) engine.

![VS Code extension screenshot](https://raw.githubusercontent.com/Sammug/logitcat-vscode/master/media/screenshot.png)

## Features

- **Live alert sidebar** — alerts stream in real-time via SSE from the logitcat daemon
- **Click any alert** → opens a full detail panel with parsed fields, metadata, and raw log line
- **Status bar** — shows alert count at a glance; turns red on CRITICAL alerts
- **CRITICAL notifications** — popup with "Open Dashboard" action for urgent alerts
- **Dashboard WebView** — view the logitcat web dashboard inside VS Code
- **Right-click context menu** — View Details / Copy Message / Copy Raw Line

## Requirements

You need the **logitcat binary** running as a daemon. Get it from:

```
https://github.com/Sammug/logitcat
```

Build and start:
```bash
git clone https://github.com/Sammug/logitcat
cd logitcat
go build -o /tmp/logitcat ./cmd/logitcat
/tmp/logitcat start config/example.ini
```

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `logitcat.executablePath` | _(auto-detect)_ | Path to the logitcat binary |
| `logitcat.configPath` | _(auto-detect)_ | Path to your `.ini` config file |
| `logitcat.dashboardPort` | `9090` | logitcat dashboard port |
| `logitcat.autoStart` | `true` | Connect automatically on workspace open |
| `logitcat.maxAlerts` | `200` | Max alerts to keep in the panel |

## Usage

1. Start the logitcat daemon (see Requirements above)
2. Open the **👁 logitcat** panel in the Activity Bar
3. Alerts appear live as they are matched by logitcat rules
4. **Click** any alert to see full details
5. Use `logitcat: Open Dashboard` command to view the web dashboard

## Supported Log Formats

logitcat auto-detects:
- **JSON** structured logs (matches on any field)
- **Syslog** (`/var/log/syslog`, journald output)
- **Apache / Nginx** combined access logs
- **Plaintext** — any other log format

## Commands

| Command | Description |
|---|---|
| `logitcat: Start` | Start the logitcat daemon |
| `logitcat: Stop` | Stop the logitcat daemon |
| `logitcat: Open Dashboard` | Open the web dashboard in VS Code |
| `logitcat: Clear Alerts` | Clear all alerts from the panel |

## Pipe Mode (stdin)

Pipe any tool's output directly into logitcat:
```bash
adb logcat        | logitcat pipe android.ini --source adb --dashboard
gradle build 2>&1 | logitcat pipe gradle.ini
```

## License

MIT
