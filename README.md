# beads-ui

Web UI for [Beads](https://github.com/rsktash/beads) workspaces.

## Install

```bash
npm install -g @rsktash/beads-ui
```

## Usage

```bash
cd /path/to/your/beads-workspace
bd-ui start
```

### Commands

| Command   | Description              |
|-----------|--------------------------|
| `start`   | Start the UI server      |
| `stop`    | Stop the UI server       |
| `restart` | Restart the UI server    |

### Options

| Flag             | Description                             | Default     |
|------------------|-----------------------------------------|-------------|
| `-h, --help`     | Show help message                       |             |
| `-v, --version`  | Show version                            |             |
| `-d, --debug`    | Enable debug logging                    |             |
| `--open`         | Open browser after start                |             |
| `--host <addr>`  | Bind address                            | `127.0.0.1` |
| `--port <num>`   | Bind port                               | `3333`      |

## Environment Variables

| Variable                        | Description                                  | Default     |
|---------------------------------|----------------------------------------------|-------------|
| `PORT`                          | Server port                                  | `3333`      |
| `HOST`                          | Bind address                                 | `127.0.0.1` |
| `BEADS_DOLT_PASSWORD`           | Password for remote Dolt server connection   |             |
| `FILE_ATTACHMENT_BASE_URL` | Base URL for resolving `attach://` URIs      |             |

## Dolt Database Modes

beads-ui supports two Dolt connection modes, configured via `.beads/metadata.json`:

### Embedded (default)

Spawns a local `dolt sql-server` from `.beads/embeddeddolt/`. No extra configuration needed.

```json
{
  "backend": "dolt",
  "dolt_database": "mydb"
}
```

### Remote Server

Connects to an external Dolt server. Set `dolt_mode` to `"server"` in metadata.json:

```json
{
  "backend": "dolt",
  "dolt_mode": "server",
  "dolt_server_host": "127.0.0.1",
  "dolt_server_port": 3308,
  "dolt_server_user": "root",
  "dolt_database": "yuklar"
}
```

Password is read from the `BEADS_DOLT_PASSWORD` environment variable:

```bash
BEADS_DOLT_PASSWORD=secret bd-ui start
```

## Attachments

Markdown content supports a custom `attach://` URI scheme for portable file references. Instead of hardcoding full URLs, store references like:

```md
![Screenshot](attach://bead-42/screenshot.png)
[Log file](attach://bead-42/log.txt)
```

At render time, `attach://` URIs are resolved against `FILE_ATTACHMENT_BASE_URL`:

```bash
FILE_ATTACHMENT_BASE_URL=https://files.example.com/attachments bd-ui start
```

The above markdown resolves to:

```
https://files.example.com/attachments/bead-42/screenshot.png
https://files.example.com/attachments/bead-42/log.txt
```

Normal `http(s)://` URLs in markdown are rendered as-is.

This keeps bead content portable across environments (local dev, staging, production) without rewriting markdown.

## License

MIT
