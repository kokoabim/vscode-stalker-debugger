## β Beta

#### 2025-03-13 — 0.4.1

-   Fixed missing updated README.md in the last release.

#### 2025-03-13 — 0.4.0

-   Added support for Microsoft Edge debugging.
    -   To use, set `attachOptions.action` to `debugWithEdge`.

#### 2025-02-14 — 0.3.0

-   Added support for Mozilla Firefox debugging.
    -   Requires [Debugger for Firefox](https://marketplace.visualstudio.com/items?itemName=firefox-devtools.vscode-firefox-debug) extension.
        -   Note: The extension's `reloadOnChange.watch` debug configuration property is set to `${webRoot}/**/*` to auto-reload on website file/content changes.
    -   To use, set `attachOptions.action` to `debugWithFirefox`.
-   Added `attachOptions.browserTaskProperties` launch configuration object property. This object is provided as debug configuration properties when debugging with an external browser. For example, to specify specific options for the Debugger for Firefox extension.
-   Improved README.md.

#### 2025-02-13 — 0.2.0

-   Added changes to ensure support on Linux and Windows. (Tested on Ubuntu 24.04 and Windows 11.)

#### 2025-02-11 — 0.1.4

-   Updated README.md with _TL;DR_ section to reference example C# project.

#### 2025-02-11 — 0.1.3

-   Improved Webpack Watch pre-build task.

#### 2025-02-06 — 0.1.2

-   Improved README.md (again).

#### 2025-02-06 — 0.1.1

-   Added `launchSettingsProfile` launch configuration to root. If set, this will override `processOptions.launchSettingsProfile` and `url` launch configurations.
-   Improved handling of `launchSettingsProfile` and `url` launch configurations.
-   Added clearer use cases to README.md to help users understand who this extension applies to and how to use it.

#### 2025-02-05 — 0.1.0

-   Moved to beta since the extension is stable.
-   Added `attachOptions:urlPath` launch configuration to open a specific URL path when attaching to process, instead of a default root path.
-   Added support for `console` and `logging` launch configurations.
-   Added use of `net9.0` for launch configuration snippets.
-   Updated package dependencies.
-   Updated miscellaneous development settings.

## ⍺ Alpha

#### 2024-09-09 — 0.0.3

-   Fixed configuration snippets.
-   Added configuration snippet that includes debugging with Google Chrome.

#### 2024-07-23 — 0.0.2

-   Minor grammar correction.
-   Minor updates to README.md.

#### 2024-07-23 — 0.0.1

-   First public release. Probably buggy. No pun intended.
