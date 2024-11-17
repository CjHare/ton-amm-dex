import { UIProvider } from '@ton/blueprint'
import { Address } from '@ton/core'
import { optionalTonAddress } from '../wrappers/lib/config-parsing'
import { promptAddress } from './cli-prompt'

/** Get dotEnv working */
import dotenv from 'dotenv'
dotenv.config()

export type CliJettonMinterAddresses = {
    token0: Address
    token1: Address
}

/**
 * Router address from CLI input, with a default if present in config.
 */
export async function cliRouterAddress(ui: UIProvider): Promise<Address> {
    const defaultRouterAddress = optionalTonAddress(process.env.ROUTER_ADDRESS, 'ROUTER_ADDRESS')
    return await promptAddress('Router Address', ui, defaultRouterAddress)
}

/**
 * Two Jetton Minters from CLI input.
 */
export async function cliJettonMinterAddresses(ui: UIProvider): Promise<CliJettonMinterAddresses> {
    ui.write('The minter addresses can be in either order')
    const jettonMinterZeroAddress = await promptAddress('Jetton Minter 0 Address', ui)
    const jettonMinterOneAddress = await promptAddress('Jetton Minter 1 Address', ui)

    return { token0: jettonMinterZeroAddress, token1: jettonMinterOneAddress }
}
