
import { extname, resolve, dirname, join, relative, sep, posix } from 'node:path'

import { getIcon } from '../../utils/index.js'
import { isDesktop, isMobile } from '../../globals.js'

import { getAssetLinkPath } from '../../utils/assets.js'
import { ResolvedConfig } from '../../types.js'

import { sanitize } from "../../assets/services/index.js"
import { mergeConfig } from 'vite'

const virtualModuleId = 'commoners:env'

const ENV_VAR_NAMES = [ 
    'NAME', 
    'VERSION', 
    'ICON', 
    'SERVICES', 

    'READY', 
    'PLUGINS', 

    'DESKTOP',
    'MOBILE',
    'WEB', 

    'DEV',
    'PROD',
]


const TAGS = {
    head: {
        start: '<head>',
        end: '</head>'
    }
}

type CommonersPluginOptions = {
    config: ResolvedConfig
    build: boolean,
    dev: boolean,
    env: Record<string, string>
}

export default ({ 
    config, 
    build, 
    dev,
    env
}: CommonersPluginOptions) => {

    const { outDir, target } = config

    // Variables only resolved once for the main configuration
    const actualOutDir = outDir
    const desktop = isDesktop(target)
    const mobile = isMobile(target)
    
    const resolvedVirtualModuleId = '\0' + virtualModuleId

    const { plugins } = config
    const pluginAssetInfo = Object.values(plugins).reduce((acc, plugin) => {

        const { assets = {} } = plugin

        Object.values(assets).map((value) => {
            const config = typeof value === 'string' ? { src: value } : value
            const { src, ...overrides } = config
            if (Object.keys(overrides).length) acc[`/${src}`] = overrides
        })

        return acc
    }, {})

    return {
        name: 'commoners',
        resolveId(id) {
            if (id === virtualModuleId)  return resolvedVirtualModuleId
        },
        load(id) {
            if (id === resolvedVirtualModuleId) {
                const lines = [
                    "const ENV = globalThis.commoners",
                    ...ENV_VAR_NAMES.map(name => `export const ${name} = ENV.${name}`),
                    "export default ENV"
                ]
                return lines.join("\n")
            }
        },
        transformIndexHtml(html, ctx) {

            const { path: htmlPath } = ctx
            const parent = dirname(htmlPath)

            const overrides = pluginAssetInfo[htmlPath] ?? {}

            const resolvedConfig = mergeConfig(config, overrides)
            // resolvedConfig.root = parent

            // Only use custom outDir if not in development
            const _assetOutDir = dev ? undefined : resolvedConfig?.outDir
            const assetOutDir = _assetOutDir ?? actualOutDir

            
            // Resolve paths per HTML file built
            const configRoot = resolvedConfig.root

            const root = _assetOutDir ? actualOutDir : configRoot
            const relTo = join(build ? assetOutDir : root, parent) // Resolve actual path in the assets
            
            const updatedConfigURL = getAssetLinkPath('commoners.config.mjs', assetOutDir, relTo)
        
            const services = sanitize(resolvedConfig.services)
        
            const rawIconSrc = getIcon(resolvedConfig.icon)
            const resolvedIcon = rawIconSrc ? resolve(configRoot, rawIconSrc) : null
            const iconPath = resolvedIcon ? getAssetLinkPath(resolvedIcon, assetOutDir, relTo) : null
        
            const globalObject = {
        
                NAME: resolvedConfig.name,
                VERSION: resolvedConfig.version,
                ICON: iconPath,
                SERVICES: services,
        
                // Target Shortcuts
                DESKTOP: desktop,
                MOBILE: mobile,
                WEB: !desktop && !mobile,
        
                // Production vs Development
                DEV: dev,
                PROD: !dev,
        
                // Environment Variables
                ENV: env,

                ROOT: relative(relTo, root).replaceAll(sep, posix.sep)
            }
            
            const faviconLink = rawIconSrc ? `<link rel="shortcut icon" href="${iconPath}" type="image/${extname(iconPath).slice(1)}" >` : ''
            
            // Inject required items into the HTML head
            const headStart = html.indexOf(TAGS.head.start)
            const headEnd = html.indexOf(TAGS.head.end)
            const headContent = headStart && headEnd ? html.slice(headStart + TAGS.head.start.length, headEnd) : ''
            const beforeHead = headStart ? html.slice(0, headStart) : ''
            const afterHead = headEnd ? html.slice(headEnd + TAGS.head.end.length) : ''

            const lowPriority = `
                <title>${resolvedConfig.name}</title>
                ${faviconLink}
            `

            const highPriority = `
                <script type="module">

                const { send, services, quit, args } = globalThis.__commoners ?? {} 

                const { __id } = args ?? {}

                const GLOBAL = globalThis.commoners = JSON.parse(\`${JSON.stringify(globalObject)}\`)
                if (services) GLOBAL.SERVICES = services // Replace with sanitized services from Electron if available
                if (GLOBAL.DESKTOP === true) GLOBAL.DESKTOP = { quit, ...args } // Ensure desktop is configured properly at the start

                GLOBAL.READY = new Promise(res => {
                
                    const resolve = (...args) => {
                        res(...args) // Resolve the promise
                        delete GLOBAL.__READY
                        if (send) {
                            send("commoners:ready:" + __id) // Notify the main process that everything is ready
                        }
                    }
                    
                    GLOBAL.__READY = resolve
                })    

                // Directly import the plugins from the transpiled configuration object
                import("${updatedConfigURL}").then(o => {
                    const { plugins } = o.default
                    if (plugins) GLOBAL.__PLUGINS = plugins
                    import("${getAssetLinkPath('onload.mjs', assetOutDir, relTo)}")
                 })


            </script>\n
            `

            return `${beforeHead}${TAGS.head.start}${highPriority}${headContent}${lowPriority}${TAGS.head.end}${afterHead}`
            
        }
    }
}