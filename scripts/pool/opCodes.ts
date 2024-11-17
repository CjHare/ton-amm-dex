import { NetworkProvider } from '@ton/blueprint'
import { hashCommand } from '../../scripts-lib/op-code'

/**
 * Output of the OpCodes used by the Pool
 */
export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const writeCommand = (command: string, code: number) => {
        ui.write(command)
        ui.write(`\t0x${code.toString(16)}`)
        ui.write(`\t${code}`)
        ui.write('\n')
    }

    ui.write('---- Pool ----')

    // const transfer = 0xf8a7ea5;
    writeCommand('transfer', 0xf8a7ea5)

    // const transfer_notification = 0x7362d09c;
    writeCommand('transfer_notification', 0x7362d09c)

    // const internal_transfer = 0x178d4519;
    writeCommand('internal_transfer', 0x178d4519)

    // cconst excesses = 0xd53276db;
    writeCommand('excesses', 0xd53276db)

    // const burn = 0x595f07bc;
    writeCommand('burn', 0x595f07bc)

    // const burn_notification = 0x7bdd97de;
    writeCommand('burn_notification', 0x7bdd97de)

    // const provide_wallet_address = 0x2c76b973;
    writeCommand('provide_wallet_address', 0x2c76b973)

    // const take_wallet_address = 0xd1735400;
    writeCommand('take_wallet_address', 0xd1735400)

    // const swap = "swap"c;
    writeCommand('swap', hashCommand('swap'))

    // const provide_lp = "provide_lp"c;
    writeCommand('provide_lp', hashCommand('provide_lp'))

    // const pay_to = "pay_to"c;
    writeCommand('pay_to', hashCommand('pay_to'))

    // const swap_refund_no_liq = "swap_refund_no_liq"c;
    writeCommand('swap_refund_no_liq', hashCommand('swap_refund_no_liq'))

    // const swap_refund_reserve_err = "swap_refund_reserve_err"c;
    writeCommand('swap_refund_reserve_err', hashCommand('swap_refund_reserve_err'))

    // const swap_ok_ref = "swap_ok_ref"c;
    writeCommand('swap_ok_ref', hashCommand('swap_ok_ref'))

    // const swap_ok = "swap_ok"c;
    writeCommand('swap_ok', hashCommand('swap_ok'))

    // const burn_ok = "burn_ok"c;
    writeCommand('burn_ok', hashCommand('burn_ok'))

    // const refund_ok = "refund_ok"c;
    writeCommand('refund_ok', hashCommand('refund_ok'))

    // const collect_fees = "collect_fees"c;
    writeCommand('collect_fees', hashCommand('collect_fees'))

    // const set_fees = "set_fees"c;
    writeCommand('set_fees', hashCommand('set_fees'))

    // const reset_gas = "reset_gas"c;
    writeCommand('reset_gas', hashCommand('reset_gas'))

    // const add_liquidity = "add_liquidity"c;
    writeCommand('add_liquidity', hashCommand('add_liquidity'))

    // const cb_add_liquidity = "cb_add_liquidity"c;
    writeCommand('cb_add_liquidity', hashCommand('cb_add_liquidity'))

    // const cb_refund_me = "cb_refund_me"c;
    writeCommand('cb_refund_me', hashCommand('cb_refund_me'))

    // const getter_pool_data = "getter_pool_data"c;
    writeCommand('getter_pool_data', hashCommand('getter_pool_data'))

    // const getter_expected_outputs = "getter_expected_outputs"c;
    writeCommand('getter_expected_outputs', hashCommand('getter_expected_outputs'))

    // const getter_lp_account_address = "getter_lp_account_address"c;
    writeCommand('getter_lp_account_address', hashCommand('getter_lp_account_address'))

    // const getter_expected_tokens = "getter_expected_tokens"c;
    writeCommand('getter_expected_tokens', hashCommand('getter_expected_tokens'))

    // const getter_expected_liquidity = "getter_expected_liquidity"c;
    writeCommand('getter_expected_liquidity', hashCommand('getter_expected_liquidity'))
}
