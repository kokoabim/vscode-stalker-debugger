import { workspace } from 'vscode';
import { StalkerDebugConfiguration } from './StalkerDebugConfiguration';

export class VariableUtil {
    static expandLaunchConfigVars(value: string, launchConfig: StalkerDebugConfiguration): string {
        if (!value) return value;

        value = value
            .replace(/\${cwd}/g, launchConfig.cwd)
            .replace(/\${process}/g, launchConfig.process)
            .replace(/\${project}/g, launchConfig.project);

        if (launchConfig.webRoot) value = value.replace(/\${webRoot}/g, launchConfig.webRoot);

        for (const key in launchConfig.env) value = value.replace(new RegExp(`\\$\\{env:${key}\\}`, "g"), launchConfig.env[key]);

        for (const key in launchConfig.vars) value = value.replace(new RegExp(`\\$\\{var:${key}\\}`, "g"), launchConfig.vars[key]);

        return value;
    }

    static expandLaunchConfigVarsForObject(values: { [key: string]: any }, launchConfig?: StalkerDebugConfiguration): { [key: string]: any } {
        launchConfig ??= values as StalkerDebugConfiguration;

        for (const key in values) {
            if (typeof values[key] === "string") values[key] = VariableUtil.expandLaunchConfigVars(values[key], launchConfig);
            else if (Array.isArray(values[key])) {
                for (let i = 0; i < values[key].length; i++) {
                    if (typeof values[key][i] === "string") values[key][i] = VariableUtil.expandLaunchConfigVars(values[key][i], launchConfig);
                    else if (typeof values[key][i] === "object") values[key][i] = VariableUtil.expandLaunchConfigVarsForObject(values[key][i], launchConfig);
                }
            }
            else if (typeof values[key] === "object") values[key] = VariableUtil.expandLaunchConfigVarsForObject(values[key], launchConfig);
        }
        return values;
    }

    static expandVSCodeVars(value: string): string {
        if (!value) return value;

        if (workspace.workspaceFolders?.[0]) value = value.replace(/\${workspaceFolder}/g, workspace.workspaceFolders[0].uri.fsPath);

        return value;
    }

    static expandVSCodeVarsForObject(values: { [key: string]: any }): { [key: string]: any } {
        for (const key in values) {
            if (typeof values[key] === "string") values[key] = VariableUtil.expandVSCodeVars(values[key]);
            else if (Array.isArray(values[key])) {
                for (let i = 0; i < values[key].length; i++) {
                    if (typeof values[key][i] === "string") values[key][i] = VariableUtil.expandVSCodeVars(values[key][i]);
                    else if (typeof values[key][i] === "object") values[key][i] = VariableUtil.expandVSCodeVarsForObject(values[key][i]);
                }
            }
            else if (typeof values[key] === "object") values[key] = VariableUtil.expandVSCodeVarsForObject(values[key]);
        }
        return values;
    }

    static prepareLaunchConfigVars(launchConfig: StalkerDebugConfiguration): void {
        if (!launchConfig.vars || !Object.keys(launchConfig.vars).length) return;

        for (const key1 in launchConfig.vars) {
            for (const key2 in launchConfig.vars) {
                if (key1 !== key2) launchConfig.vars[key1] = launchConfig.vars[key1].replace(new RegExp(`\\$\\{var:${key2}\\}`, "g"), launchConfig.vars[key2]);
            }

            launchConfig.vars[key1] = VariableUtil.expandVSCodeVars(launchConfig.vars[key1]);
        }
    }
}