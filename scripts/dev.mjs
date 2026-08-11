import { spawn } from 'node:child_process';

const processes = [
  { name: 'backend', workspace: '@bbw/backend' },
  { name: 'frontend', workspace: '@bbw/frontend' },
];

const children = processes.map(({ name, workspace }) => {
  const child = spawn('npm', ['run', 'dev', '--workspace', workspace], {
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (line.trim()) process.stdout.write(`[${name}] ${line}\n`);
      }
    });
  }

  child.on('exit', (code, signal) => {
    if (code && code !== 0) console.error(`[${name}] exited with code ${code}`);
    if (signal) console.error(`[${name}] stopped by ${signal}`);
  });

  return child;
});

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.once('SIGINT', () => {
  stopAll();
  process.exit(130);
});

process.once('SIGTERM', () => {
  stopAll();
  process.exit(143);
});
