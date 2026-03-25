declare const process: any;

import { spawn, type ChildProcess } from 'node:child_process';

const bunExecutable = process.execPath;
const childProcesses: ChildProcess[] = [];

function startProcess(name: string, args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
	console.log(`[dev] starting ${name}: bun ${args.join(' ')}`);
	const child = spawn(bunExecutable, args, {
		stdio: 'inherit',
		env: {
			...process.env,
			...extraEnv,
		},
	});
	childProcesses.push(child);
	return child;
}

let shuttingDown = false;

function stopAll(exitCode = 0) {
	if (shuttingDown) return;
	shuttingDown = true;
	for (const child of childProcesses) {
		if (!child.killed) child.kill('SIGTERM');
	}
	setTimeout(() => {
		for (const child of childProcesses) {
			if (!child.killed) child.kill('SIGKILL');
		}
		process.exit(exitCode);
	}, 250);
}

const uiWatcher = startProcess('ui watcher', ['build', 'src_ui/app.tsx', '--outdir', 'public', '--watch', '--sourcemap=linked', '--target', 'browser', '--format', 'esm']);
const serverWatcher = startProcess('server watcher', ['--watch', './nuoadmin-diagnose.ts'], { DEV_MODE: '1' });

for (const child of [uiWatcher, serverWatcher]) {
	child.on('exit', (code, signal) => {
		if (shuttingDown) return;
		if (signal === 'SIGTERM' || signal === 'SIGINT') {
			stopAll(0);
			return;
		}
		const exitCode = typeof code === 'number' ? code : 1;
		console.error(`[dev] process exited unexpectedly with code ${exitCode}`);
		stopAll(exitCode);
	});
	child.on('error', (error) => {
		if (shuttingDown) return;
		console.error('[dev] failed to start child process', error);
		stopAll(1);
	});
}

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => stopAll(0));
}
