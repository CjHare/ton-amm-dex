import { DEX } from '@ston-fi/sdk'
import { NetworkProvider } from '@ton/blueprint'
import { Address, toNano } from '@ton/core'
import { cliPrettify, confirmAndProceedOrExit, promptAmount } from '../../scripts-lib/cli-prompt'
import { asTonClient4 } from '../../scripts-lib/ton-client'
import { enforceActivePool } from '../../scripts-lib/cli-pool'
import { CliJettonMinterAddresses, cliJettonMinterAddresses, cliRouterAddress } from '../../scripts-lib/cli'

export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const input = await getPoolParametersInput(provider)
    const client = asTonClient4(provider.api())
    const router = provider.open(DEX.v1.Router.create(input.routerAddress))
    const poolAddress = await router.getPoolAddressByJettonMinters(input.jettons)

    await enforceActivePool(client, ui, poolAddress)

    const data = await getExpectedTokens(provider, poolAddress, input.params)

    ui.write('\n')
    ui.write('------ Expected LP Tokens ------')
    ui.write(`Pool Address: ${poolAddress}`)
    ui.write(`LP Tokens: ${data}`)
    ui.write('--------------------------------')
}

export async function getExpectedTokens(
    provider: NetworkProvider,
    pool: Address,
    params: GetExpectedTokensInput,
): Promise<bigint> {
    return await provider.open(DEX.v1.Pool.create(pool)).getExpectedTokens(params)
}

export type GetExpectedTokensInput = {
    amount0: bigint
    amount1: bigint
}

type Inputarameters = {
    routerAddress: Address
    jettons: CliJettonMinterAddresses
    params: GetExpectedTokensInput
}

async function getPoolParametersInput(provider: NetworkProvider): Promise<Inputarameters> {
    const ui = provider.ui()

    const routerAddress = await cliRouterAddress(ui)
    const jettons = await cliJettonMinterAddresses(ui)

    ui.write('Token amounts map to the natural Jetton minter ordering (on-chain Pool contract), not that given above')
    const amount0 = await promptAmount('Token0 amount', ui)
    const amount1 = await promptAmount('Token1 amount', ui)
    const params = {
        amount0: toNano(amount0),
        amount1: toNano(amount1),
    } as GetExpectedTokensInput

    ui.write('\n')
    ui.write('------ Input summary ------')
    ui.write(`Router Address: ${routerAddress}`)
    ui.write(`Pool Address Request:\n${JSON.stringify(jettons, cliPrettify, 2)}`)
    ui.write(`Expected LP Tokens Request:\n${JSON.stringify(params, cliPrettify, 2)}`)
    ui.write('-----------------------------------')

    await confirmAndProceedOrExit(ui)

    return { routerAddress, jettons, params }
}
