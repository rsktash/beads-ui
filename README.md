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

| Variable                   | Description                                  | Default     |
|----------------------------|----------------------------------------------|-------------|
| `PORT`                     | Server port                                  | `3333`      |
| `HOST`                     | Bind address                                 | `127.0.0.1` |
| `BEADS_DOLT_PASSWORD`      | Password for remote Dolt server connection   |             |
| `FILE_ATTACHMENT_BASE_URL` | Base URL for resolving `attach://` URIs      |             |
| `BEADS_UI_AUTH_FILE`       | Path to users JSON file for authentication   |             |

## Authentication

Auth is optional. When `BEADS_UI_AUTH_FILE` points to a valid users file, login is required. When not set, auth is bypassed entirely.

### Users file format

```json
{
  "users": [
    { "username": "alice", "password": "secret", "role": "Developer" },
    { "username": "bob", "password": "guest", "role": "Viewer" }
  ]
}
```

### Running with auth

```bash
BEADS_UI_AUTH_FILE=/path/to/users.json bd-ui start
```

Session tokens are stored in the browser's localStorage and kept in server memory. Tokens are invalidated on server restart.

## Dolt Database Modes

Two Dolt connection modes, configured via `.beads/metadata.json`:

### Embedded (default)

Spawns a local `dolt sql-server` from `.beads/embeddeddolt/`.

```json
{
  "backend": "dolt",
  "dolt_database": "mydb"
}
```

### Remote Server

Connects to an external Dolt server:

```json
{
  "backend": "dolt",
  "dolt_mode": "server",
  "dolt_server_host": "127.0.0.1",
  "dolt_server_port": 3308,
  "dolt_server_user": "root",
  "dolt_database": "mydb"
}
```

```bash
BEADS_DOLT_PASSWORD=secret bd-ui start
```

## Docker

```yaml
services:
  beads-ui:
    image: ghcr.io/rsktash/beads-ui:latest
    ports:
      - "3333:3333"
    volumes:
      - /path/to/workspace:/workspace
    working_dir: /workspace
    environment:
      - HOST=0.0.0.0
      - BEADS_DOLT_PASSWORD=secret
      - BEADS_UI_AUTH_FILE=/workspace/.beads/users.json
      - FILE_ATTACHMENT_BASE_URL=https://files.example.com/attachments
```

Images published to `ghcr.io/rsktash/beads-ui` on version tags via GitHub Actions.

## Markdown Features

### Attachments

`attach://` URIs for portable file references, resolved against `FILE_ATTACHMENT_BASE_URL`:

```md
![Screenshot](attach://bead-42/screenshot.png)
```

### Issue Mentions

`#issue-id` auto-links to the issue detail page:

```md
See #proj-a1b for details. Depends on #proj-c3d.
```

### Deep Linking

Sections and headings get unique element IDs for fragment linking:

- Predefined sections: `#description`, `#acceptance-criteria`, `#notes`, `#design`
- Content headings: auto-slugified (e.g., `## My Heading` → `#my-heading`)

```md
[see details](/detail/proj-a1b#my-heading)
```

### Theme

Solarized Light color palette with matching syntax highlighting.

## CLI Tools

### bd-grep

Grep across beads issue content with snippet output. Uses `bd list` for issue filtering, then greps field content for pattern matches.

```bash
bd-grep <pattern> [bd-list-flags] [--field fields] [-A N] [-B N] [-C N] [-i] [-l]
```

Examples:

```bash
bd-grep "timeline"                              # open issues, description
bd-grep "timeline" --all                        # include closed
bd-grep "route" -t epic                         # epics only
bd-grep "fallback" --field description,design   # multiple fields
bd-grep "composite" -C2                         # 2 lines context
bd-grep "trip.id" -l                            # list matching IDs only
```

Requires `bd` and `jq`.

## License

MIT
