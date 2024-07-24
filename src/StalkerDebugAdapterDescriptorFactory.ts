import { Disposable, DebugAdapterDescriptor, DebugAdapterDescriptorFactory, DebugAdapterExecutable, DebugAdapterInlineImplementation, DebugSession, ExtensionContext, ProviderResult } from 'vscode';
import { StalkerDebugAdapter } from './StalkerDebugAdapter';

export class StalkerDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory, Disposable {
    private readonly disposables: { dispose(): any }[] = [];

    public createDebugAdapterDescriptor(debugSession: DebugSession, executable: DebugAdapterExecutable | undefined): ProviderResult<DebugAdapterDescriptor> {
        const stalkerDebugAdapter = new StalkerDebugAdapter(debugSession);
        this.disposables.push(stalkerDebugAdapter);

        return new DebugAdapterInlineImplementation(stalkerDebugAdapter);
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}