import { DEX } from '@ston-fi/sdk'
import { NetworkProvider } from '@ton/blueprint'
import { Address } from '@ton/core'
import { cliPrettify, confirmAndProceedOrExit } from '../../scripts-lib/cli-prompt'
import { asTonClient4 } from '../../scripts-lib/ton-client'
import { enforceActivePool } from '../../scripts-lib/cli-pool'
import { CliJettonMinterAddresses, cliJettonMinterAddresses, cliRouterAddress } from '../../scripts-lib/cli'

export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const client = asTonClient4(provider.api())
    const input = await getPoolParametersInput(provider)
    const router = provider.open(DEX.v1.Router.create(input.routerAddress))
    const poolAddress = await router.getPoolAddressByJettonMinters(input.params)

    await enforceActivePool(client, ui, poolAddress)

    const data = await getPoolData(provider, poolAddress)

    ui.write('------ Pool Data ------')
    ui.write(`Pool Address: ${poolAddress}`)
    ui.write(`Pool Data:\n${JSON.stringify(data, cliPrettify, 2)}`)
    ui.write('--------------------------')
}

/**
 * Assumes an active pool is given, queries for the Pool data.
 */
export async function getPoolData(provider: NetworkProvider, pool: Address): Promise<PoolData> {
    return await provider.open(DEX.v1.Pool.create(pool)).getPoolData()
}

export type PoolData = {
    reserve0: bigint
    reserve1: bigint
    token0WalletAddress: Address
    token1WalletAddress: Address
    lpFee: bigint
    protocolFee: bigint
    refFee: bigint
    protocolFeeAddress: Address
    collectedToken0ProtocolFee: bigint
    collectedToken1ProtocolFee: bigint
}

type GetPoolDataParameters = {
    routerAddress: Address
    params: CliJettonMinterAddresses
}

async function getPoolParametersInput(provider: NetworkProvider): Promise<GetPoolDataParameters> {
    const ui = provider.ui()
    const routerAddress = await cliRouterAddress(ui)
    const params = await cliJettonMinterAddresses(ui)

    ui.write('\n')
    ui.write('------ Get Pool Data summary ------')
    ui.write(`Router Address: ${routerAddress}`)
    ui.write(`Request:\n${JSON.stringify(params, cliPrettify, 2)}`)
    ui.write('-----------------------------------')

    await confirmAndProceedOrExit(ui)

    return { routerAddress, params }
}
