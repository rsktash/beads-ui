/**
 * Print CLI usage to a stream-like target.
 *
 * @param {{ write: (chunk: string) => any }} out_stream
 */
export function printUsage(out_stream) {
  const lines = [
    'Usage: bdui <command> [options]',
    '',
    'Commands:',
    '  start       Start the UI server',
    '  stop        Stop the UI server',
    '  restart     Restart the UI server',
    '',
    'Options:',
    '  -h, --help        Show this help message',
    '  -v, --version     Show the CLI version',
    '  -d, --debug       Enable debug logging',
    '      --open        Open the browser after start/restart',
    '      --host <addr> Bind to a specific host (default: 127.0.0.1)',
    '      --port <num>  Bind to a specific port (default: 3000)',
    '',
    'Environment variables:',
    '  PORT                          Server port (default: 3333)',
    '  HOST                          Bind address (default: 127.0.0.1)',
    '  BEADS_DOLT_PASSWORD            Password for remote Dolt server',
    '  VITE_FILE_ATTACHMENT_BASE_URL  Base URL for attach:// URIs in markdown',
    '',
    'Dolt modes:',
    '  Embedded (default): spawns a local dolt sql-server from .beads/embeddeddolt/',
    '  Remote server: set dolt_mode: "server" in .beads/metadata.json with',
    '    dolt_server_host, dolt_server_port, dolt_server_user, dolt_database.',
    '    Password is read from BEADS_DOLT_PASSWORD env var.',
    '',
    'Attachments:',
    '  Markdown content can use attach://<path> URIs for portable file references.',
    '  Set VITE_FILE_ATTACHMENT_BASE_URL to resolve them at render time.',
    '  Example: attach://bead-42/shot.png becomes',
    '    ${VITE_FILE_ATTACHMENT_BASE_URL}/bead-42/shot.png',
    ''
  ];
  for (const line of lines) {
    out_stream.write(line + '\n');
  }
}
