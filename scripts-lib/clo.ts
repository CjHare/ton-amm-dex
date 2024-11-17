import { sleep, UIProvider } from '@ton/blueprint'
import { Address } from '@ton/core'
import { getLastBlock } from './account'
import { TonClient4 } from '@ton/ton'

/**
 * Await the incrmenting of the last recorded transaction for an account and write
 * an appropriate message to the UI.
 */
export async function transactionIncrementWriteConfiration(
    client: TonClient4,
    ui: UIProvider,
    userWalletAddress: Address,
    userLastTransaction: string | null,
    messageName: string,
): Promise<void> {
    const txConfirmation = await waitForTransaction(client, ui, userWalletAddress, userLastTransaction, 10)
    if (txConfirmation) {
        ui.write(`${messageName} message has made it onto The Open Network!`)
    } else {
        ui.write('Transaction took too long, check your wallet for the tx!')
    }
}

const waitForTransaction = async (
    client: TonClient4,
    ui: UIProvider,
    address: Address,
    curTx: string | null,
    maxRetry: number,
    interval: number = 1000,
) => {
    let done = false
    let count = 0

    do {
        const lastBlock = await getLastBlock(client)
        ui.write(`Awaiting transaction completion (${++count}/${maxRetry})`)
        await sleep(interval)
        const curState = await client.getAccountLite(lastBlock, address)
        if (curState.account.last !== null) {
            done = curState.account.last.lt !== curTx
        }
    } while (!done && count < maxRetry)
    return done
}
