import { NetworkProvider } from '@ton/blueprint'

/**
 * Output of the OpCodes used by the LP Wallet
 */
export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const writeCommand = (command: string, code: number) => {
        ui.write(command)
        ui.write(`\t0x${code.toString(16)}`)
        ui.write(`\t${code}`)
        ui.write('\n')
    }

    ui.write('---- LP Wallet ----')

    // const transfer = 0xf8a7ea5;
    writeCommand('transfer', 0xf8a7ea5)

    // const transfer_notification = 0x7362d09c;
    writeCommand('transfer_notification', 0x7362d09c)

    // const internal_transfer = 0x178d4519;
    writeCommand('internal_transfer', 0x178d4519)

    // const excesses = 0xd53276db;
    writeCommand('excesses', 0xd53276db)

    // const burn = 0x595f07bc;
    writeCommand('burn', 0x595f07bc)

    // const burn_notification = 0x7bdd97de;
    writeCommand('burn_notification', 0x7bdd97de)
}
