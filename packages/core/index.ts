import { dirname, join, relative, normalize, resolve } from 'node:path'
import { existsSync, lstatSync, unlink, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { globalWorkspacePath, getDefaultMainLocation, templateDir, onExit, ensureTargetConsistent, isMobile } from './globals.js'
import { ResolvedConfig, ResolvedService, ServiceCreationOptions, TargetType, UserConfig } from './types.js'
import { resolveAll, createAll } from './templates/services/index.js'
import { resolveFile, getJSON } from './utils/files.js'
import merge from './utils/merge.js'
import { bundleConfig } from './utils/assets.js'

// Exports
export * from './types.js'
export * from './globals.js'
export { default as launch } from './launch.js'
export { default as build } from './build.js'
export { default as share } from './share.js'
export { default as start } from './start.js'


export const defineConfig = (o: UserConfig): UserConfig => o

export const resolveConfigPath = (base = '') => resolveFile(join(base, 'commoners.config'), ['.ts', '.js'])

const isDirectory = (root: string) => lstatSync(root).isDirectory()

export async function loadConfigFromFile(
    root: string = resolveConfigPath()
) {

    const rootExists = existsSync(root)

    if (rootExists) {
        root = resolve(root) // Resolve to absolute path
        if (!isDirectory(root)) root = dirname(root) // Get the parent directory
    }
    
    else {
        console.log(`${root} is an invalid root. Please specify an existing Commoners project path.`)
        process.exit(1)
    }
    

    const configPath = resolveConfigPath(
        rootExists ? 
            root : // New root config
            '' // Base config
        )

    let config = {} as UserConfig // No user-defined configuration found


    if (configPath) {


        const randomId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
        const configOutputPath = join(dirname(configPath), globalWorkspacePath, `commoners.config-${randomId}.mjs`)
            
        const outputFiles = await bundleConfig(configPath, configOutputPath)
        const fileUrl = `${pathToFileURL(configOutputPath)}`

        try {
            config = (await import(fileUrl)).default as UserConfig
        } finally {
            outputFiles.forEach((file) => unlink(file, () => { })) // Ignore errors
        }

    }

    // Set the root of the project
    config.root = relative(process.cwd(), root) || root

    return config
}

type ResolveOptions = {
    services?: string | string[],
    customPort?: number,
    target?: TargetType,
    build?: boolean
}

export async function resolveConfig(
    o: UserConfig = {}, 
    { 
        // Service Auto-Configuration
        target,
        build = false,

        // Advanced Service Configuration
        services, 
        customPort,

    } : ResolveOptions = {}
) {

    const initialTarget = target ?? await ensureTargetConsistent(o.target, ['services'])

    // Mobile commands must always run from the root of the specified project
    if (isMobile(initialTarget) && o.root) {
        process.chdir(o.root)
        delete o.root
    }

    const root = o.root ?? (o.root = process.cwd()) // Always carry the root of the project

    const temp = { ...o }
    const { services: ogServices, plugins } = temp
    delete temp.plugins
    delete temp.services

    const userPkg = getJSON(join(root, 'package.json'))

    // Merge Config and package.json (transformed name)
    const copy = merge(structuredClone(temp) , {
        ...userPkg,
        name: userPkg.name ? userPkg.name.split('-').map(str => str[0].toUpperCase() + str.slice(1)).join(' ') : 'Commoners App'
    }) as Partial<ResolvedConfig>
    
    copy.plugins = plugins ?? {} // Transfer the original plugins
    copy.services = ogServices as any ?? {} // Transfer original functions on publish

    copy.target = await ensureTargetConsistent(copy.target, ['services'])
    
    if (!copy.electron) copy.electron = {}

    // Set default values for certain properties shared across config and package.json
    if (!copy.icon) copy.icon = join(templateDir, 'icon.png')
    if (!copy.version) copy.version = '0.0.0'

    if (!copy.appId) copy.appId = `com.${copy.name.replace(/\s/g, '').toLowerCase()}.app`
    
    // Always have a build options object
    if (!copy.build) copy.build = {}

    copy.services = await resolveAll(copy.services, { target, build, services: !!services, root: copy.root }) // Always resolve all backend services before going forward

    // Build a subset of services if specified
    if (build && services) {
        const selected = typeof services === 'string' ? [ services ] : services
        const isSingleService = selected.length === 1

        for (let name in copy.services) {
            if (!selected.includes(name)) delete copy.services[name]
            else if (isSingleService && customPort) copy.services[name].port = customPort
        }
    }


    return copy as ResolvedConfig
}

const writePackageJSON = (o, root = '') => {
    writeFileSync(join(root, 'package.json'), JSON.stringify(o, null, 2)) // Will not update userPkg—but this variable isn't used for the Electron process
}

// Ensure project can handle --desktop command
export const configureForDesktop = async (outDir, root = '', defaults = {}) => {

    const userPkg = getJSON(join(root, 'package.json'))
    const pkg = { ...defaults, ...userPkg }

    const resolvedOutDir = root ? relative(root, outDir) : outDir
    const defaultMainLocation = getDefaultMainLocation(resolvedOutDir)
    if (!pkg.main || normalize(pkg.main) !== normalize(defaultMainLocation)) {
        onExit(() =>  writePackageJSON(pkg, root)) // Write back the original package.json on exit
        writePackageJSON({...pkg, main: defaultMainLocation}, root)
    }

}

export const createServices = async (services: ResolvedConfig['services'], opts: ServiceCreationOptions = {}) => await createAll(services, opts) as {
    active: {
        [name:string]: ResolvedService
    }
    close: (id?:string) => void
}