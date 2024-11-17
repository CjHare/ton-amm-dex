import { DEX } from '@ston-fi/sdk'
import { NetworkProvider } from '@ton/blueprint'
import { Address, toNano } from '@ton/core'
import { cliPrettify, confirmAndProceedOrExit, promptAddress, promptAmount } from '../../scripts-lib/cli-prompt'
import { asTonClient4 } from '../../scripts-lib/ton-client'
import { enforceActivePool } from '../../scripts-lib/cli-pool'
import { CliJettonMinterAddresses, cliRouterAddress } from '../../scripts-lib/cli'
import { JettonMinter } from '../../wrappers/JettonMinter'

export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const cliInput = await getPoolParametersInput(provider)
    const client = asTonClient4(provider.api())
    const router = provider.open(DEX.v1.Router.create(cliInput.routerAddress))
    const poolAddress = await router.getPoolAddressByJettonMinters(cliInput.jettonMinters)

    await enforceActivePool(client, ui, poolAddress)

    /*
     * Router jetton wallet address for the jettons to swap (the 'from' jetton)
     */
    const walletAddress = await provider
        .open(JettonMinter.createFromAddress(cliInput.swap.jettonMinter))
        .getWalletAddress(cliInput.routerAddress)

    const data = await getExpectedOutputs(provider, poolAddress, {
        amount: cliInput.swap.amount,
        jettonWallet: walletAddress,
    })

    ui.write('\n')
    ui.write('------ Expected Output ------')
    ui.write(`Pool Address: ${poolAddress}`)
    ui.write(`Wallet Address: ${walletAddress}`)
    ui.write(`Output Jettons: ${data}`)
    ui.write('--------------------------------')
}

/**
 * Expected outcome for a swap on the pool.
 *
 * Each pool has their own jetton wallet address for a jetton minter.
 */
export async function getExpectedOutputs(
    provider: NetworkProvider,
    pool: Address,
    params: { amount: bigint; jettonWallet: Address },
): Promise<bigint> {
    return (await provider.open(DEX.v1.Pool.create(pool)).getExpectedOutputs(params)).jettonToReceive
}

/**
 * jettonWallet address != JettonMinter address
 */
export type CliExpectedOutputs = {
    amount: bigint
    jettonMinter: Address
}

type Inputarameters = {
    routerAddress: Address
    jettonMinters: CliJettonMinterAddresses
    swap: CliExpectedOutputs
}

async function getPoolParametersInput(provider: NetworkProvider): Promise<Inputarameters> {
    const ui = provider.ui()
    const routerAddress = await cliRouterAddress(ui)
    const sendJettonMinterAddress = await promptAddress('Send Jetton Minter Address', ui)
    const otherJettonMinterAddress = await promptAddress('Other Jetton Minter Address', ui)
    const swapAmount = await promptAmount('Swap amount', ui)

    const swap = {
        amount: toNano(swapAmount),
        jettonMinter: sendJettonMinterAddress,
    } as CliExpectedOutputs

    const jettonMinters = {
        token0: sendJettonMinterAddress,
        token1: otherJettonMinterAddress,
    } as CliJettonMinterAddresses

    ui.write('\n')
    ui.write('------ Input summary ------')
    ui.write(`Router Address: ${routerAddress}`)
    ui.write(`Minter Addresses: ${jettonMinters}`)
    ui.write(`Swap Request:\n${JSON.stringify(swap, cliPrettify, 2)}`)
    ui.write('-----------------------------------')

    await confirmAndProceedOrExit(ui)

    return { routerAddress, jettonMinters, swap }
}
