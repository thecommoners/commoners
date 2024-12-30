import { desktop, isSupported } from "@commoners/bluetooth"

type TestOptions = {
    remoteDebuggingPort?: number
    remoteAllowOrigins?: string 
}

export default (options: TestOptions) => {

    const { 
        remoteDebuggingPort = 8315, 
        remoteAllowOrigins = '*'   // Allow all remote origins
    } = options


    return {

        isSupported: ({ DESKTOP }) => DESKTOP,

        // Store options for future reference
        options,

        start: function() {
            const { process } = globalThis
            const { COMMONERS_TESTING } = process.env
            if (!COMMONERS_TESTING) return
            if (remoteDebuggingPort) this.electron.app.commandLine.appendSwitch("remote-debugging-port", `${remoteDebuggingPort}`)
            if (remoteAllowOrigins) this.electron.app.commandLine.appendSwitch("remote-allow-origins", `${remoteAllowOrigins}`)
        },

        desktop: {
            load: function (win) {
                const { process } = globalThis
                const { COMMONERS_TESTING } = process.env
                if (!COMMONERS_TESTING) return
                win.__show = null // Do not show windows while testing
            }
        }
    }
}