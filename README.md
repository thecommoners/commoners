# commoners
 The `commoners` CLI **allows anyone to build their application for web, desktop, and mobile distribution**. Only JavaScript is required; no additional languages or libraries (e.g. Dart, React, etc.) are necessary.

A complete example of a COMMONERS application that connects to Bluetooth and Serial devices across multiple platforms is available at our [commoners-starter-kit](https://github.com/garrettmflynn/commoners-starter-kit) repository.

## How To Use
- `commoners start` - Start your project in an Electron application.

- `commoners dev` - Start your project in your default browser

- `commoners build` - Build the project assets
    - `--desktop` - For your current desktop platform
    - `--pwa` - As a Progressive Web App (PWA)
    - `--ios` - For iOS
    - `--android` - For Android

- `commoners launch` - Launch your built application (default: `commoners dev`)
    - `--desktop` - Start your desktop build
    - `--ios` - Open the project with XCode (coming soon)
    - `--android` - Open the project with Android Studio (coming soon)

- `commoners commit` - Commit your latest build to Github (coming soon)
- `commoners publish` - Publish your latest commit to Github Pages (coming soon)
    - `--message` - Add a commit message and trigger a new commit


## Core Concepts
### Services
Services are independent processes that the main application depends on. These may be `local` or `remote` based on the distributed application files.

> **Note:** `commoners` currently supports `.js`, `.ts`, `.py`, `.exe`, and `.pkg` services.

To declare a service, you simply add the source file path to the `commoners.config.js` file:
```js
export default {
    services: {
        test: './services/test/index.ts'
    },
}
```

To use a service, you should (1) check for the existence of the service, then (2) instantiate the appropriate URL from the `COMMONERS` global object:

```js
    if ('test' in COMMMONERS.services) {
        const url = new URL(COMMONERS.services.test.url)
        // ....
    }
```




#### Using Services in Production
Service configurations may be different between development and production. For instance, `.py` services are commonly packaged using `pyinstaller`, which will output an `.exe` / `.pkg` file that includes all dependencies.

The following service structure would be used to handle this case:
```json
{
    "src": "src/main.py",
    "publish": {
        "build": {
            "mac": "python -m PyInstaller --name test --onedir --clean ./src/main.py --distpath ./dist/pyinstaller",
        },
        "desktop": {
            "src": "./pyinstaller/test", 
            "extraResources": [ 
                {
                    "from": "./dist/pyinstaller/test",
                    "to": "pyinstaller"
                }
            ]
        }
    }
}
```

### Plugins
Plugins are collections of JavaScript functions that run at different points during app initialization. These points include:
1. `main` - Immediately on Electron main process instantiation (`desktop` builds only)
2. `preload` - Before the DOM is loaded 
3. `render` - After the DOM is loaded 

To declare a plugin, you simply add the relevant configuration object in the `plugins` array of the `commoners.config.js` file:
```js
export default {
    plugins: [
        {
            name: 'selective-builds',
            isSupported: {
                desktop: {
                    render: false,
                    preload: false
                },
                mobile: {
                    render: false
                },
                web: {
                    preload: false
                }
            },
            main: () => console.log('desktop build (main)'),
            preload: () => console.log(COMMONERS.TARGET + ' build (preload)'),
            render: () => console.log(COMMONERS.TARGET + ' build (render)'),
        }
    ]
}
```

To use a plugin, you should check for the existence of the plugin, which *may* have a return value separately stored in the `plugins.loaded` and `plugins.rendered` propreties:

```js
    if ('test' in COMMMONERS.plugins.loaded) {
        const loadedPlugin = COMMMONERS.plugins.loaded.test
        const renderedPlugin = COMMMONERS.plugins.loaded.rendered
        // ....
    }
```

## Build Notes
### iOS
#### Fix Pods Issue
Run the following commands on the terminal and try again:
```
cd ios/App
pod install
```

If you add any Capacitor plugins to your dependencies, you'll need to run this again.
