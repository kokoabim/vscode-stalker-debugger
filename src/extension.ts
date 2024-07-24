import * as vscode from "vscode";
import { StalkerDebuggerVSCodeExtension } from "./StalkerDebuggerVSCodeExtension";

export function activate(context: vscode.ExtensionContext) {
    extension = new StalkerDebuggerVSCodeExtension(context);
}

export function deactivate() {
    extension?.dispose();
    extension = undefined;
}

let extension: StalkerDebuggerVSCodeExtension | undefined;
