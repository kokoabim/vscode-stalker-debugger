import { PreBuildTask } from "./StalkerDebugAdapter";

// ! Not extending DebugConfiguration to avoid `[key: string]: any` in the interface
export interface StalkerDebugConfiguration {
    attachOptions: {
        action?: string;
        interval?: number;
        taskProperties?: { [key: string]: any };
    },
    buildOptions: {
        preBuildTasks?: PreBuildTask[];
    },
    cwd: string;
    env: { [key: string]: any };
    name: string;
    process: string;
    processOptions: {
        args?: string[];
        launchProfile?: string;
    },
    project: string;
    request: string;
    type: string;
    url?: string;
    vars: { [key: string]: any };
    watchOptions: {
        args?: string[];
        disableOptimizations?: boolean;
        dotnet?: string;
        doNotLaunchBrowser?: boolean;
        doNotRefreshBrowser?: boolean;
        interval?: number;
        noEmojis?: boolean;
        verbose?: boolean;
        usePollingFileWatcher?: boolean;
    },
    webRoot?: string;
}