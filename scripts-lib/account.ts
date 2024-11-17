import { Address, TonClient4 } from '@ton/ton'

export type LastAccountState = {
    state:
        | {
              type: 'uninit'
          }
        | {
              data: string | null
              code: string | null
              type: 'active'
          }
        | {
              type: 'frozen'
              stateHash: string
          }
    last: {
        lt: string
        hash: string
    } | null
}

export async function getLastAccountState(client: TonClient4, account: Address): Promise<LastAccountState> {
    const lastBlock = await client.getLastBlock()
    const entry = await client.getAccount(lastBlock.last.seqno, account)

    if (entry.account == null) {
        throw new Error(`Account for ${account} is null`)
    } else return entry.account
}

export const getAccountLastTx = async (client: TonClient4, address: Address) => {
    const res = await client.getAccountLite(await getLastBlock(client), address)
    if (res.account.last == null) throw Error('Contract is not active')
    return res.account.last.lt
}

export const getLastBlock = async (client: TonClient4) => {
    return (await client.getLastBlock()).last.seqno
}

/**
 * An account can have the states of 'uninit', 'active' or 'frozen',
 *
 * We only want to deal with active account, those who have been initialized and are up to date
 * on rent payment.
 */
export async function isAccountActive(client: TonClient4, checkActive: Address): Promise<boolean> {
    const account = await getLastAccountState(client, checkActive)

    return account.state.type === 'active'
}

/**
 * Retrieves the logical time for the last transaction an account sent, or null when there has yet to be ant transaction.
 */
export async function lastTransactionTime(client: TonClient4, userWalletAddress: Address): Promise<string | null> {
    let userWalletAccount = await getLastAccountState(client, userWalletAddress)
    return userWalletAccount.last !== null ? userWalletAccount.last.lt : null
}
