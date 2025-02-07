import { execSync } from "child_process";
import { existsSync } from "fs";
import { CancellationToken, DebugConfiguration, DebugConfigurationProvider, ProviderResult, WorkspaceFolder, window } from "vscode";

import { StalkerDebugConfiguration } from "./StalkerDebugConfiguration";
import { VariableUtil } from "./VariableUtil";

export class StalkerDebugConfigurationProvider implements DebugConfigurationProvider {
    // eslint-disable-next-line no-unused-vars
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): ProviderResult<StalkerDebugConfiguration> {
        const configuration: StalkerDebugConfiguration = debugConfiguration as StalkerDebugConfiguration;
        VariableUtil.prepareLaunchConfigVars(configuration);
        VariableUtil.expandVSCodeVarsForObject(configuration);

        if (!configuration) return window.showInformationMessage("Failed to get debug configuration").then(_ => undefined);
        else if (!configuration.project) return window.showInformationMessage("No project to build, run and watch").then(_ => undefined);
        else if (!configuration.process) return window.showInformationMessage("No process to attach to").then(_ => undefined);

        configuration.console ??= 'integratedTerminal';

        configuration.attachOptions ??= {};
        configuration.buildOptions ??= {};
        configuration.env ??= {};
        configuration.logging ??= {
            moduleLoad: false
        };
        configuration.processOptions ??= {};
        configuration.watchOptions ??= {};

        configuration.watchOptions.dotnet = StalkerDebugConfigurationProvider.locateDotNetExecutable(configuration.watchOptions.dotnet ?? 'dotnet');
        if (!configuration.watchOptions.dotnet) return window.showInformationMessage("Failed to locate dotnet executable").then(_ => undefined);

        if (configuration.watchOptions.disableOptimizations) configuration.env.DOTNET_WATCH_SUPPRESS_MSBUILD_INCREMENTALISM = '1';
        if (configuration.watchOptions.doNotLaunchBrowser || (configuration.processOptions.launchSettingsProfile && configuration.attachOptions.action && configuration.attachOptions.action !== 'nothing')) configuration.env.DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER = '1';
        if (configuration.watchOptions.doNotRefreshBrowser) configuration.env.DOTNET_WATCH_SUPPRESS_BROWSER_REFRESH = '1';
        if (configuration.watchOptions.noEmojis) configuration.env.DOTNET_WATCH_SUPPRESS_EMOJIS = '1';
        if (configuration.watchOptions.usePollingFileWatcher) configuration.env.DOTNET_USE_POLLING_FILE_WATCHER = '1';

        return VariableUtil.expandLaunchConfigVarsForObject(configuration) as StalkerDebugConfiguration;
    }

    private static locateDotNetExecutable(executable: string): string | undefined {
        executable = executable.trim();
        if (executable === '') return undefined;

        if (existsSync(executable)) return executable;

        executable = execSync(`which ${executable}`).toString().trim();
        if (existsSync(executable)) return executable;

        return undefined;
    }
}
