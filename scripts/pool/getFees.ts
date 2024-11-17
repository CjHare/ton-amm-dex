import { NetworkProvider } from '@ton/blueprint'
import { cliJettonMinterAddresses, cliRouterAddress } from '../../scripts-lib/cli'
import { DEX } from '@ston-fi/sdk'
import { enforceActivePool } from '../../scripts-lib/cli-pool'
import { asTonClient4 } from '../../scripts-lib/ton-client'
import { getPoolData } from './getPoolData'

export async function run(provider: NetworkProvider) {
    const client = asTonClient4(provider.api())
    const ui = provider.ui()
    const routerAddress = await cliRouterAddress(ui)
    const jettonMinterInput = await cliJettonMinterAddresses(ui)
    const router = provider.open(DEX.v1.Router.create(routerAddress))
    const poolAddress = await router.getPoolAddressByJettonMinters(jettonMinterInput)

    await enforceActivePool(client, ui, poolAddress)

    const data = await getPoolData(provider, poolAddress)

    ui.write('\n')
    ui.write('------ Pool Fees ------')
    ui.write(`LP Fee (BIPS): ${data.lpFee}`)
    ui.write(`Protocol Fee (BIPS): ${data.protocolFee}`)
    ui.write(`Referral Fee (BIPS) ${data.refFee}`)
    ui.write(`Protocol fee address: ${data.protocolFeeAddress}`)
    ui.write('-----------------------')
}
