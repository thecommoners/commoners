export const validMobilePlatforms =  tuple('ios', 'android')

export const valid = {

    // Derived
    target: tuple('desktop', 'mobile', 'web'),
    mode:  tuple('development', 'local', 'remote'),
    platform: tuple('mac', 'windows', 'linux', ...validMobilePlatforms),

    // Internal
    command: tuple('start', 'dev', 'build', 'launch', 'commit', 'publish'),

    // Configuration
    icon: tuple('light', 'dark'),

}

type LocalServiceMetadata = { src: string }
type RemoteServiceMetadata = { url: string }

type BaseServiceMetadata = (LocalServiceMetadata | RemoteServiceMetadata)
type ExtraServiceMetadata = { 
    port?: number,
    build?: string | {[x in typeof valid.platform[number]]?: string},
    extraResources?: {to: string, from: string}[] // NOTE: Replace with electron-builder type
    publish?: Partial<UserService> & {
        local?: Partial<UserService>,
        remote?: Partial<UserService>,
    }
}

export type UserService = string | (BaseServiceMetadata & ExtraServiceMetadata) // Can nest build by platform type

export type PluginType = any

import { ManifestOptions } from 'vite-plugin-pwa'


export function tuple<T extends string[]>(...o: T) {
    return o;
}

type ValidNestedProperty = typeof valid.target[number] | typeof valid.platform[number] | typeof valid.mode[number]

// Icon Configuration
type BaseIconType = string //| {[x in typeof valid.platform[number]]?: string}
type ValidNestedIconKey = typeof valid.icon[number] // | ValidNestedProperty // NOTE: Not yet drilling for the icon

// Complete Recursive Configurations
type IconConfiguration = {[x in ValidNestedIconKey]?: BaseIconType }

export type UserConfig = {
    icon?: BaseIconType | IconConfiguration
    plugins?: PluginType[],
    services?: {
        [x: string]: UserService
    }
}

export type ResolvedConfig = {
    icon?: BaseIconType | IconConfiguration
    plugins: PluginType[],
    services: {
        [x: string]: UserService // FIX
    },

    // Programmatically Added
    electron?: any, // TODO
    pwa?: {
        includeAssets: string[],
        manifest: Partial<ManifestOptions>
    }
}

export type CommonersGlobalObject = {
    TARGET: typeof valid.target[number],
    PLATFORM: typeof valid.platform[number],
    MODE: typeof valid.mode[number],
}

export type BaseOptions = {
    target: typeof valid.target[number],
    platform: typeof valid.platform[number]
}

declare global {
    const COMMONERS: CommonersGlobalObject
  }