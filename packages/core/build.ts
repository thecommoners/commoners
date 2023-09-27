import path from "node:path"
import { NAME, assetOutDir, cliArgs, commonersPkg, getBuildConfig, templateDir } from "./globals.js"
import { BaseOptions, ResolvedConfig } from "./types.js"
import { getIcon } from "./utils/index.js"

import * as mobile from './mobile/index.js'
import { build as ElectronBuilder } from 'electron-builder'
import { loadConfigFromFile, resolveConfig } from "./index.js"
import { clearOutputDirectory, populateOutputDirectory } from "./common.js"

import { resolveViteConfig } from './vite.js'
import { spawnProcess } from './utils/processes.js'

import { build as ViteBuild } from 'vite'
import chalk from "chalk"

// Types
export type BuildOptions = BaseOptions & {}

export default async function build ({ target, platform }: BuildOptions, config?: ResolvedConfig) {

    const resolvedConfig = await resolveConfig(config ||  await loadConfigFromFile())

    await clearOutputDirectory()

    const { icon , services } = resolvedConfig

    const toBuild = {
        frontend: cliArgs['frontend'] || !cliArgs['backend'],
        backend: cliArgs['backend'] || !cliArgs['frontend']
    }

    if (toBuild.frontend) {
        if (target === 'mobile') await mobile.prebuild(resolvedConfig) // Run mobile prebuild command
        await ViteBuild(resolveViteConfig(config, { build: true }))  // Build the standard output files using Vite. Force recognition as build
    }

    // Build services if not specifically the frontend
    if (toBuild.backend) {
        for (let name in services) {
            const service = services[name]
            let build = (service && typeof service === 'object') ? service.build : null 
            if (build && typeof build === 'object') build = build[platform] // Run based on the platform if an object
            if (build) {
                console.log(chalk.yellow(`Running build command for commoners-${name}-service`))
                await spawnProcess(build)
            }
        }
    }

    // Create the standard output files
    await populateOutputDirectory(resolvedConfig)
    
    // ------------------------- Target-Specific Build Steps -------------------------
    if (target === 'desktop') {

        const buildConfig = getBuildConfig()

        buildConfig.productName = NAME

        // NOTE: These variables don't get replaced on Windows
        buildConfig.appId = buildConfig.appId.replace('${name}', NAME)
        buildConfig.win.executableName = buildConfig.win.executableName.replace('${name}', NAME)

        // Register extra resources
        buildConfig.mac.extraResources = buildConfig.linux.extraResources = Object.values(services).reduce((acc: string[], { extraResources }: any) => {
            if (extraResources) acc.push(...extraResources)
            return acc
        }, [])

        // Derive Electron version
        if (!('electronVersion' in buildConfig)) {
            const electronVersion = commonersPkg.dependencies.electron
            if (electronVersion[0] === '^') buildConfig.electronVersion = electronVersion.slice(1)
            else buildConfig.electronVersion = electronVersion
        }

        const defaultIcon = getIcon(icon)

        // TODO: Get platform-specific icon
        const macIcon = defaultIcon // icon && typeof icon === 'object' && 'mac' in icon ? icon.mac : defaultIcon
        const winIcon = macIcon // icon && typeof icon === 'object' && 'win' in icon ? icon.win : defaultIcon

        // Ensure proper absolute paths are provided for Electron build
        buildConfig.directories.buildResources = path.join(templateDir, buildConfig.directories.buildResources)
        buildConfig.afterSign = typeof buildConfig.afterSign === 'string' ? path.join(templateDir, buildConfig.afterSign) : buildConfig.afterSign
        buildConfig.mac.entitlementsInherit = path.join(templateDir, buildConfig.mac.entitlementsInherit)
        buildConfig.mac.icon = macIcon ? path.join(assetOutDir, macIcon) : path.join(templateDir, buildConfig.mac.icon)
        buildConfig.win.icon = winIcon ? path.join(assetOutDir, winIcon) : path.join(templateDir, buildConfig.win.icon)
        buildConfig.includeSubNodeModules = true // Allow for grabbing workspace dependencies

        await ElectronBuilder({ config: buildConfig as any })
    }

    else if (target === 'mobile') {
        await mobile.init(platform, resolvedConfig)
        await mobile.open(platform, resolvedConfig)
    }
}