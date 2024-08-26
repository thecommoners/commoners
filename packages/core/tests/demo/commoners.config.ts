import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from "node:url";

// const root/ = resolve(dirname(fileURLToPath(import.meta.url)))
const root = './'

import * as echo from './src/plugins/echo'

export const name = 'Test App'

const httpSrc = join(root, 'src/services/http/index.ts')
const expressSrc = join(root, 'src/services/express/index.js')

const config = {

    name,

    electron: {
        splash: join(root, 'splash.html'),
    },

    plugins: { echo },

    services: {
        http: { 
            src: httpSrc, 
            port: 2345 // Hardcoded port
        },
        express: { src: expressSrc },

        manual: {
            src: expressSrc,
            
            build: async function (info) { 
                const fs = await import('node:fs')
                const path = await import('node:path')
                const filename = await this.package(info) 
                const outDir = path.dirname(info.out)
                fs.appendFileSync(path.join(outDir, 'test.txt'), 'Hello world!')
                return filename
            },

            // NOTE: Must be hardcoded
            publish: {
                src: 'manual',
                base: './.commoners/custom_services_dir/manual'
            }
        }


        // python: {
        //     description: 'A simple Python server',
        //     src: './src/services/python/main.py',
        //     build: 'python -m PyInstaller --name flask --onedir --clean ./src/services/python/main.py --distpath ./build/python',
        //     publish: {
        //         src: 'flask',
        //         base: './build/python/flask', // Will be copied
        //     }
        // },
    }
}

export default config