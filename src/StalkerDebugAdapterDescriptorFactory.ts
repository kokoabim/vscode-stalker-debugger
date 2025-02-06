import { Disposable, DebugAdapterDescriptor, DebugAdapterDescriptorFactory, DebugAdapterExecutable, DebugAdapterInlineImplementation, DebugSession, ProviderResult } from 'vscode';
import { StalkerDebugAdapter } from './StalkerDebugAdapter';

export class StalkerDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory, Disposable {
    private readonly disposables: { dispose(): any }[] = [];

    // eslint-disable-next-line no-unused-vars
    public createDebugAdapterDescriptor(debugSession: DebugSession, executable: DebugAdapterExecutable | undefined): ProviderResult<DebugAdapterDescriptor> {
        const stalkerDebugAdapter = new StalkerDebugAdapter(debugSession);
        this.disposables.push(stalkerDebugAdapter);

        return new DebugAdapterInlineImplementation(stalkerDebugAdapter);
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}