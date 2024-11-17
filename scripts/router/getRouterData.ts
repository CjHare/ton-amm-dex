import { NetworkProvider } from '@ton/blueprint'
import { DEX } from '@ston-fi/sdk'
import { Address, Cell } from '@ton/core'
import { tonAddress } from '../../wrappers/lib/config-parsing'

/** Get dotEnv working */
import dotenv from 'dotenv'
dotenv.config()

export async function run(provider: NetworkProvider) {
    const routerAddress = tonAddress(process.env.ROUTER_ADDRESS, 'ROUTER_ADDRESS')

    const router = provider.open(DEX.v1.Router.create(routerAddress))

    const data: GetRouterDataResponse = await router.getRouterData()

    provider.ui().write(`${data}`)
}

type GetRouterDataResponse = {
    isLocked: boolean
    adminAddress: Address
    tempUpgrade: Cell
    poolCode: Cell
    jettonLpWalletCode: Cell
    lpAccountCode: Cell
}
