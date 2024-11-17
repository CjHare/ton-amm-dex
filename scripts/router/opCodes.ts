import { NetworkProvider } from '@ton/blueprint'
import { hashCommand } from '../../scripts-lib/op-code'

/**
 * Output of the OpCodes used by the Router
 */
export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const writeCommand = (command: string, code: number) => {
        ui.write(command)
        ui.write(`\t0x${code.toString(16)}`)
        ui.write(`\t${code}`)
        ui.write('\n')
    }

    ui.write('---- Router ----')

    // const transfer = 0xf8a7ea5;
    writeCommand('transfer', 0xf8a7ea5)

    // const transfer_notification = 0x7362d09c;
    writeCommand('transfer_notification', 0x7362d09c)

    // const swap = "swap"c;
    writeCommand('swap', hashCommand('swap'))

    // const provide_lp = "provide_lp"c;
    writeCommand('provide_lp', hashCommand('provide_lp'))

    // const pay_to = "pay_to"c;
    writeCommand('pay_to', hashCommand('pay_to'))

    // const collect_fees = "collect_fees"c;
    writeCommand('collect_fees', hashCommand('collect_fees'))

    // const set_fees = "set_fees"c;
    writeCommand('set_fees', hashCommand('set_fees'))

    // const reset_gas = "reset_gas"c;
    writeCommand('reset_gas', hashCommand('reset_gas'))

    // const reset_pool_gas = "reset_pool_gas"c;
    writeCommand('reset_pool_gas', hashCommand('reset_pool_gas'))

    // const lock = "lock"c;
    writeCommand('lock', hashCommand('lock'))

    // const unlock = "unlock"c;
    writeCommand('unlock', hashCommand('unlock'))

    // const init_code_upgrade = "init_code_upgrade"c;
    writeCommand('init_code_upgrade', hashCommand('init_code_upgrade'))

    // const init_admin_upgrade = "init_admin_upgrade"c;
    writeCommand('init_admin_upgrade', hashCommand('init_admin_upgrade'))

    // const cancel_code_upgrade = "cancel_code_upgrade"c;
    writeCommand('cancel_code_upgrade', hashCommand('cancel_code_upgrade'))

    // const cancel_admin_upgrade = "cancel_admin_upgrade"c;
    writeCommand('cancel_admin_upgrade', hashCommand('cancel_admin_upgrade'))

    // const finalize_upgrades = "finalize_upgrades"c;
    writeCommand('finalize_upgrades', hashCommand('finalize_upgrades'))

    // const getter_pool_address = "getter_pool_address"c;
    writeCommand('getter_pool_address', hashCommand('getter_pool_address'))

    // const transfer_bounce_locked = "transfer_bounce_locked"c;
    writeCommand('transfer_bounce_locked', hashCommand('transfer_bounce_locked'))

    // const transfer_bounce_invalid_request = "transfer_bounce_invalid_request"c;
    writeCommand('transfer_bounce_invalid_request', hashCommand('transfer_bounce_invalid_request'))
}
