import { NetworkProvider } from '@ton/blueprint'
import { hashCommand } from '../../scripts-lib/op-code'

/**
 * Output of the OpCodes used by the LP Account
 */
export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const writeCommand = (command: string, code: number) => {
        ui.write(command)
        ui.write(`\t0x${code.toString(16)}`)
        ui.write(`\t${code}`)
        ui.write('\n')
    }

    ui.write('---- LP Account ----')

    // const reset_gas = "reset_gas"c;
    writeCommand('reset_gas', hashCommand('reset_gas'))

    // const add_liquidity = "add_liquidity"c;
    writeCommand('add_liquidity', hashCommand('add_liquidity'))

    // const cb_add_liquidity = "cb_add_liquidity"c;
    writeCommand('cb_add_liquidity', hashCommand('cb_add_liquidity'))

    // const getter_lp_account_data = "getter_lp_account_data"c;
    writeCommand('getter_lp_account_data', hashCommand('getter_lp_account_data'))

    // const direct_add_liquidity = "direct_add_liquidity"c;
    writeCommand('direct_add_liquidity', hashCommand('direct_add_liquidity'))

    // const refund_me = "refund_me"c;
    writeCommand('refund_me', hashCommand('refund_me'))

    // const cb_refund_me = "cb_refund_me"c;
    writeCommand('cb_refund_me', hashCommand('cb_refund_me'))
}
