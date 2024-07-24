import { debug, Disposable, ExtensionContext } from "vscode";
import { StalkerDebugConfigurationProvider } from "./StalkerDebugConfigurationProvider";
import { StalkerDebugAdapterDescriptorFactory } from "./StalkerDebugAdapterDescriptorFactory";

export class StalkerDebuggerVSCodeExtension implements Disposable {
    private readonly disposables: { dispose(): any }[] = [];

    constructor(private readonly extensionContext: ExtensionContext) {
        const stalkerDebugAdapterDescriptorFactory = new StalkerDebugAdapterDescriptorFactory();
        this.disposables.push(stalkerDebugAdapterDescriptorFactory);

        this.disposables.push(debug.registerDebugConfigurationProvider("stalker", new StalkerDebugConfigurationProvider()));
        this.disposables.push(debug.registerDebugAdapterDescriptorFactory("stalker", stalkerDebugAdapterDescriptorFactory));
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
