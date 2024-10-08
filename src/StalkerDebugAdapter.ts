import { Disposable, DebugAdapter, DebugProtocolMessage, Event, EventEmitter, TaskExecution, DebugSession, tasks, debug, ShellExecution, TaskScope, Task, env, Uri, TaskProcessEndEvent } from 'vscode';
import { DebugProtocol } from '@vscode/debugprotocol';
import { StalkerDebugConfiguration } from './StalkerDebugConfiguration';
import findProcesses from 'find-process';

export type PreBuildTask = { name: string, commandLine: string, isBackground?: boolean, waitFor?: boolean, failOnNonZeroExitCode?: boolean };
export type PreBuildTaskExecution = { definition: PreBuildTask, task: TaskExecution | undefined, hasEnded?: boolean, exitCode?: number | undefined; };

export class StalkerDebugAdapter implements Disposable, DebugAdapter {
    private readonly sendMessage = new EventEmitter<DebugProtocolMessage>();
    onDidSendMessage: Event<DebugProtocolMessage> = this.sendMessage.event;

    private static readonly DefaultIntervalMs = 1000;

    private readonly debugConfiguration: StalkerDebugConfiguration;
    private readonly disposables: { dispose(): any }[] = [];
    private readonly processFileName: string;
    private readonly projectFileName: string;

    private attachedIncrement = 0;
    private checkProcessesInterval: NodeJS.Timeout | undefined;
    private childPid = 0;
    private debuggerIsStopping = false;
    private dotNetWatchPid = 0;
    private dotNetWatchTask: TaskExecution | undefined;
    private preBuildTasks: { [name: string]: PreBuildTaskExecution } = {};
    private responseSeq = 0;

    constructor(private readonly debugSession: DebugSession) {
        this.debugConfiguration = debugSession.configuration as StalkerDebugConfiguration;

        const projectFileName = this.debugConfiguration.project.split('/').pop();
        if (!projectFileName) throw new Error('projectToWatch is not valid');
        this.projectFileName = projectFileName;

        const processFileName = this.debugConfiguration.process.split('/').pop();
        if (!processFileName) throw new Error('processToAttach is not valid');
        this.processFileName = processFileName;

        this.disposables.push(debug.onDidStartDebugSession(e => this.handleOnDidStartDebugSession(e)));
        this.disposables.push(debug.onDidTerminateDebugSession(e => this.handleOnDidTerminateDebugSession(e)));
        this.disposables.push(debug.onDidChangeActiveDebugSession(e => this.handleOnDidChangeActiveDebugSession(e)));
        this.disposables.push(tasks.onDidEndTaskProcess(e => this.handleOnDidEndTaskProcess(e)));
    }

    private get isChildProcessRunning(): boolean { return this.childPid !== 0; }

    private get isDotNetWatchRunning(): boolean { return this.dotNetWatchPid !== 0; }

    [Symbol.dispose](): void {
        this.dispose();
    }

    dispose(): any {
        this.stopWatching(false);
        this.disposables.forEach(d => d.dispose());
    }

    async handleMessage(message: DebugProtocol.ProtocolMessage): Promise<void> {
        if (message.type === 'request') {
            const request = message as DebugProtocol.Request;

            // eslint-disable-next-line no-empty
            if (request.command === 'initialize') {
            }
            else if (request.command === 'launch') {
                await this.startDebugging();
            }
            else if (request.command === 'disconnect') {
                this.stopWatching(false);
            }
            else return; // ! only above commands continue

            this.sendMessage.fire(this.createDebugResponse(request));
        }
    }

    private createDebugResponse(request: DebugProtocol.Request): DebugProtocol.Response {
        return {
            type: 'response',
            request_seq: request.seq,
            seq: this.responseSeq++,
            command: request.command,
            success: true,
            body: {}
        };
    }

    private handleOnDidChangeActiveDebugSession(e: DebugSession | undefined): void {
        if (e?.id === this.debugSession.id || e?.parentSession?.id === this.debugSession.id) {
            this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🪲 Debug session became active: ${e?.name} (${e?.type})\n` } });
        }
    }

    private handleOnDidEndTaskProcess(endEvent: TaskProcessEndEvent): void {
        if (endEvent.execution === this.dotNetWatchTask) {
            this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: '⌚️ .NET Watch task stopped.\n' } });
            this.stopWatching(true); // full stop
        }
        else {
            const preBuildTask = Object.values(this.preBuildTasks).find(t => t.task === endEvent.execution);
            if (preBuildTask) {
                preBuildTask.hasEnded = true;
                preBuildTask.exitCode = endEvent.exitCode;
                preBuildTask.task = undefined;

                this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🔨 Pre-build task stopped: ${preBuildTask.definition.name} (${preBuildTask.exitCode})\n` } });

                if (preBuildTask.definition.failOnNonZeroExitCode && preBuildTask.exitCode !== 0) {
                    this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🚫 Pre-build task failed: ${preBuildTask.definition.name} (${preBuildTask.exitCode}). Stopping debugger.\n` } });
                    this.stopWatching(true); // full stop
                }
            }
        }
    }

    private handleOnDidStartDebugSession(e: DebugSession): void {
        if (e.id === this.debugSession.id || e.parentSession?.id === this.debugSession.id) {
            this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🪲 Debug session started: ${e.name} (${e.type})\n` } });
        }
    }

    private handleOnDidTerminateDebugSession(e: DebugSession): void {
        if (e.id === this.debugSession.id || e.parentSession?.id === this.debugSession.id) {
            this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🪲 Debug session terminated: ${e.name} (${e.type})\n` } });
        }
    }

    private restartCheckProcessesInterval(intervalMs: number): void {
        this.stopCheckProcessesInterval();
        this.startCheckProcessesInterval(intervalMs);
    }

    private startCheckProcessesInterval(intervalMs: number): void {
        if (!this.dotNetWatchTask) throw new Error('dotnet watch is not running'); // ! this should never happen

        this.checkProcessesInterval = setInterval(async () => {
            let processes = [];

            // NOTE: `findProcesses` returns array of objects that _do_ have a property of `bin` though not in the type definition (hence the cast to any)

            processes = await findProcesses("name", `${this.debugConfiguration.watchOptions.dotnet} watch run`);
            const dotNetWatchProcess = processes.find(p => (<any>p).bin === `${this.debugConfiguration.watchOptions.dotnet} watch run` && p.cmd.includes(this.projectFileName));

            // dotnet watch...

            if (!dotNetWatchProcess) {
                if (this.isDotNetWatchRunning) {
                    this.dotNetWatchPid = 0;
                    this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: '‼️ .NET Watch is not running. Stopping debugger.\n' } });

                    this.stopWatching(true); // full stop
                }
                return;
            }
            else if (this.dotNetWatchPid !== dotNetWatchProcess.pid) {
                this.dotNetWatchPid = dotNetWatchProcess.pid;
                this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `⌚️ .NET Watch is now running (${this.dotNetWatchPid}).\n` } });
            }

            // child process (i.e. the project being watched)...

            processes = (await findProcesses("name", this.processFileName));
            const childProcess = processes.find(p => (<any>p).bin.endsWith(`/${this.processFileName}`));

            if (!childProcess) {
                if (this.isChildProcessRunning) {
                    this.childPid = 0;
                    this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: '🔥 Child process is no longer running. A hot reload build should be in process.\n' } });

                    this.restartCheckProcessesInterval(this.debugConfiguration.attachOptions.interval ?? (StalkerDebugAdapter.DefaultIntervalMs / 2)); // (most likely) speeds up the interval
                }
                return;
            }
            else if (this.childPid !== childProcess.pid) {
                clearInterval(this.checkProcessesInterval); // will be restarted after attaching

                if (this.isChildProcessRunning) {
                    this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🔄 Child process has been restarted (${childProcess.pid}).\n` } });
                }
                else {
                    this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `✅ Child process is now running (${childProcess.pid}).\n` } });
                }

                this.childPid = childProcess.pid;

                if (await debug.startDebugging(this.debugSession.workspaceFolder, {
                    name: '.NET Stalker Attach',
                    type: 'coreclr',
                    request: 'attach',
                    processId: this.childPid,
                    ...this.debugConfiguration.attachOptions.taskProperties
                }, this.debugSession)) {
                    this.attachedIncrement++;
                    this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🔗 Attached to child process (${this.attachedIncrement}).\n` } });

                    if (this.attachedIncrement === 1 && this.debugConfiguration.attachOptions.action && this.debugConfiguration.attachOptions.action !== "nothing" && this.debugConfiguration.url) {
                        if (this.debugConfiguration.attachOptions.action === "openExternally") {
                            this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🕸️ Opening URL externally (${this.debugConfiguration.url}).\n` } });
                            await env.openExternal(Uri.parse(this.debugConfiguration.url));
                        }
                        else if (this.debugConfiguration.attachOptions.action === "debugWithChrome") {
                            this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🔍 Debugging with Google Chrome (${this.debugConfiguration.url}).\n` } });
                            await debug.startDebugging(this.debugSession.workspaceFolder, {
                                name: '.NET Stalker Chrome',
                                type: 'chrome',
                                request: 'launch',
                                url: this.debugConfiguration.url,
                                webRoot: this.debugConfiguration.webRoot
                            }, this.debugSession);
                        }
                    }
                }
                else {
                    this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: '🚫 Failed to attach to child process. Stopping debugger.\n' } });

                    this.stopWatching(true); // full stop
                    return;
                }

                this.restartCheckProcessesInterval(this.debugConfiguration.watchOptions.interval ?? StalkerDebugAdapter.DefaultIntervalMs); // (most likely) slows down the interval
            }

        }, intervalMs);
    }

    private async startDebugging(): Promise<void> {
        this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: '🚀 Starting .NET Stalker Debugger.\n' } });

        if (!await this.startPreBuildTasks()) return;
        await this.startDotNetWatch();
        this.startCheckProcessesInterval(this.debugConfiguration.attachOptions.interval ?? (StalkerDebugAdapter.DefaultIntervalMs / 2));
    }

    private async startDotNetWatch(): Promise<void> {
        if (this.dotNetWatchTask) throw new Error('dotnet watch is already running'); // ! this should never happen

        const dotNetWatchArgs = this.debugConfiguration.watchOptions.args && this.debugConfiguration.watchOptions.args.length > 0 ? ` ${this.debugConfiguration.watchOptions.args.map(a => `--property ${a}`).join(' ')}` : '';
        const childDotNetProcessArgs = this.debugConfiguration.processOptions.args && this.debugConfiguration.processOptions.args.length > 0 ? " -- " + this.debugConfiguration.processOptions.args.join(' ') : '';

        const profileArg = this.debugConfiguration.processOptions.launchProfile ? `--launch-profile ${this.debugConfiguration.processOptions.launchProfile}` : '--no-launch-profile';
        const urlsArg = !this.debugConfiguration.processOptions.launchProfile && this.debugConfiguration.url ? ` --urls=${this.debugConfiguration.url}` : '';
        const verboseArg = this.debugConfiguration.watchOptions.verbose ? ' --verbose' : '';

        const commandLine = `${this.debugConfiguration.watchOptions.dotnet} watch run ${profileArg}${verboseArg}${dotNetWatchArgs} --project ${this.debugConfiguration.project}${urlsArg}${childDotNetProcessArgs}`;
        const shellExec = new ShellExecution(commandLine, { cwd: this.debugConfiguration.cwd, env: this.debugConfiguration.env });

        const task = new Task({ type: 'process' }, TaskScope.Workspace, '.NET Stalker Watch', '.NET Stalker', shellExec, "stalker");
        task.isBackground = true;

        this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: '⌚️ Starting .NET Watch task.\n' } });

        this.dotNetWatchTask = await tasks.executeTask(task);
    }

    /**
     * @returns If task is waited for and has ended, the exit code if the task completed or undefined if it was terminated. If task is not waited for, false.
     */
    private async startPreBuildTask(preBuildTask: PreBuildTask): Promise<number | false | undefined> {
        const shellExec = new ShellExecution(preBuildTask.commandLine, { cwd: this.debugConfiguration.cwd, env: this.debugConfiguration.env });

        const task = new Task({ type: 'process' }, TaskScope.Workspace, `.NET Stalker Task: ${preBuildTask.name}`, '.NET Stalker', shellExec);
        task.isBackground = preBuildTask.isBackground ?? false;

        this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: `🔨 Starting pre-build task: ${preBuildTask.name}\n` } });

        const preBuildTaskExecution = this.preBuildTasks[preBuildTask.name] = { definition: preBuildTask, task: await tasks.executeTask(task) };

        return preBuildTask.waitFor ? this.waitForPreBuildTask(preBuildTaskExecution) : false;
    }

    /**
     * @returns If any tasks to be waited for returns a non-zero exit code or debugger is stopping, false. Otherwise, true.
     */
    private async startPreBuildTasks(): Promise<boolean> {
        if (!this.debugConfiguration.buildOptions.preBuildTasks || this.debugConfiguration.buildOptions.preBuildTasks.length === 0) return true;

        for (const preBuildTask of this.debugConfiguration.buildOptions.preBuildTasks!) {
            if (this.debuggerIsStopping) return false;

            const startPreBuildTaskResult = await this.startPreBuildTask(preBuildTask);
            if (preBuildTask.waitFor && preBuildTask.failOnNonZeroExitCode && startPreBuildTaskResult !== 0) return false; // ! full stop is handled in `tasks.onDidEndTaskProcess` in constructor
        }

        return true;
    }

    private stopCheckProcessesInterval(): void {
        if (this.checkProcessesInterval) {
            clearInterval(this.checkProcessesInterval);
            this.checkProcessesInterval = undefined;
        }
    }

    private stopDotNetWatchTask(): void {
        if (this.dotNetWatchTask) {
            this.dotNetWatchTask.terminate();
            this.dotNetWatchTask = undefined;
        }
    }

    private stopPreBuildTasks(): void {
        for (const preBuildTask of Object.values(this.preBuildTasks)) {
            preBuildTask.task?.terminate();
            preBuildTask.task = undefined;
            delete this.preBuildTasks[preBuildTask.definition.name];
        }
    }

    private stopWatching(stopDebugging: boolean): void {
        if (this.debuggerIsStopping) return;
        this.debuggerIsStopping = true;

        this.stopCheckProcessesInterval();
        this.stopPreBuildTasks();
        this.stopDotNetWatchTask();

        if (stopDebugging) {
            this.sendMessage.fire({ type: 'event', event: 'output', body: { category: 'console', output: '🛑 Stopping .NET Stalker Debugger.\n' } });
            debug.stopDebugging(this.debugSession);
        }
    }

    private async waitForPreBuildTask(preBuildTaskExecution: PreBuildTaskExecution): Promise<number | undefined> {
        return await new Promise<number | undefined>(resolve => {
            const interval = setInterval(() => {
                const preBuildTask = this.preBuildTasks[preBuildTaskExecution.definition.name];
                if (preBuildTask?.hasEnded) {
                    clearInterval(interval);
                    resolve(preBuildTask.exitCode);
                }
            }, 100);
        });
    }
}
