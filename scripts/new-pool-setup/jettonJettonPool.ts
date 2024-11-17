import { NetworkProvider } from '@ton/blueprint'
import { DEX } from '@ston-fi/sdk'
import { Address, toNano } from '@ton/core'
import { cliPrettify, confirmAndProceedOrExit, promptAddress, promptAmount } from '../../scripts-lib/cli-prompt'
import { isAccountActive, lastTransactionTime } from '../../scripts-lib/account'
import { asTonClient4 } from '../../scripts-lib/ton-client'
import { cliRouterAddress } from '../../scripts-lib/cli'
import { getPoolData } from '../pool/getPoolData'
import { transactionIncrementWriteConfiration } from '../../scripts-lib/clo'

// Minimum liquidity for a new Pool liquidity
const MINIMUM_LIQUIDITY = BigInt(1001)

// Number of initial LP jettons to mint to null
const MINIMUM_LP_OUT = BigInt(1)

// Idenitifer for the message used in command line output
const MESSAGE_NAME = 'Provide Liquidity'

/**
 * The initial supply of liquidity to a new (possibilty undeployed) Jeeton-Jetton Pool.
 *
 * Any amount is supported, by as the initial mint is lost to null, the script
 * performs any mint over the minimim with a warning, then submits two transactions
 * to provide both sides of the liquidity, deploying the Pool, if necessary.
 */
export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const client = asTonClient4(provider.api())
    const input = await getProvideLiquidityInput(provider)

    /*
     * Jetton Minters must exist
     */
    ui.write(`Jetton Minter Zero Address: ${input.jettonMinterZeroAddress}`)
    const isJettonZeroAddressActive = await isAccountActive(client, input.jettonMinterZeroAddress)
    if (isJettonZeroAddressActive) {
        ui.write('Jetton Minter Zero is active')
    } else {
        ui.write('\nJetton Minter Zero is not active!')
        ui.write('\n')
        ui.write('Jetton Minter Zero must be active to provide liquidity')
        ui.write('Stopped')
        process.exit()
    }

    ui.write(`Jetton Minter One Address: ${input.jettonMinterOneAddress}`)
    const isJettonOneAddressActive = await isAccountActive(client, input.jettonMinterOneAddress)
    if (isJettonOneAddressActive) {
        ui.write('Jetton Minter One is active')
    } else {
        ui.write('\nJetton Minter One is not active!')
        ui.write('\n')
        ui.write('Jetton Minter One must be active to provide liquidity')
        ui.write('Stopped')
        process.exit()
    }

    /*
     * Check the values exceed the minimum for initial Pool liquidity
     */
    if (input.jettonZeroAmount < MINIMUM_LIQUIDITY || input.jettonOneAmount < MINIMUM_LIQUIDITY) {
        ui.write('\nInsufficient liquidity!')
        ui.write('Both must be larger than 1001 units (standard nine decimal place jetton == 0.000001001)')
        ui.write(`Jetton 0: ${input.jettonZeroAmount}`)
        ui.write(`Jetton 1: ${input.jettonOneAmount}`)
        ui.write('Stopped.')
        process.exit()
    }

    /*
     * Check that the Pool either is non-active or zero liquidity
     */
    const router = provider.open(DEX.v1.Router.create(input.routerAddress))
    const poolAddress = await router.getPoolAddressByJettonMinters({
        token0: input.jettonMinterZeroAddress,
        token1: input.jettonMinterOneAddress,
    })
    const isPoolActive = await isAccountActive(client, poolAddress)
    if (isPoolActive) {
        ui.write(`Acitve Pool found at address: ${poolAddress}`)
        const poolData = await getPoolData(provider, poolAddress)
        const hasLiquidity = poolData.reserve0 > 0n && poolData.reserve1 > 0n

        if (hasLiquidity) {
            ui.write('\nPool already has liquidity')
            ui.write(`reserve0: ${poolData.reserve0}`)
            ui.write(`reserve1: ${poolData.reserve1}`)
            ui.write('\nCannot provide initial liquidity when liquidity is already present')
            ui.write('Stopped.')
            process.exit()
        }
    } else {
        ui.write(`No Pool found at address: ${poolAddress}`)
        ui.write('Pool will be deployed as part providing initial liquidity')
    }

    /*
     * Provide the Jetton0 side of the liquisity
     */
    let userLastTransaction = await lastTransactionTime(client, input.userWalletAddress)

    await router.sendProvideLiquidityJetton(provider.sender(), {
        userWalletAddress: input.userWalletAddress,
        sendTokenAddress: input.jettonMinterZeroAddress,
        otherTokenAddress: input.jettonMinterOneAddress,
        sendAmount: input.jettonZeroAmount,
        minLpOut: MINIMUM_LP_OUT,
    })

    await transactionIncrementWriteConfiration(client, ui, input.userWalletAddress, userLastTransaction, MESSAGE_NAME)

    /*
     * Provide the other Jetton1 side of the liquidity
     */
    userLastTransaction = await lastTransactionTime(client, input.userWalletAddress)

    await router.sendProvideLiquidityJetton(provider.sender(), {
        userWalletAddress: input.userWalletAddress,
        sendTokenAddress: input.jettonMinterOneAddress,
        otherTokenAddress: input.jettonMinterZeroAddress,
        sendAmount: input.jettonOneAmount,
        minLpOut: MINIMUM_LP_OUT,
    })

    await transactionIncrementWriteConfiration(client, ui, input.userWalletAddress, userLastTransaction, MESSAGE_NAME)
}

type ProvideLiquidityCLI = {
    routerAddress: Address
    userWalletAddress: Address
    jettonMinterZeroAddress: Address
    jettonZeroAmount: bigint
    jettonMinterOneAddress: Address
    jettonOneAmount: bigint
}

async function getProvideLiquidityInput(provider: NetworkProvider): Promise<ProvideLiquidityCLI> {
    const ui = provider.ui()

    ui.write('\n------ Create a Jetton-Jetton Liquidity Pool ------')
    ui.write('The Pool may already exist but must contain zero liquidity')
    ui.write('The first mint of LP tokens do not go to you, but to the null address')
    ui.write('There must be at leat 1001 jettons provided for each (standard nine decimal place jetton == 0.000001001)')

    const routerAddress = await cliRouterAddress(ui)
    const userWalletAddress = await promptAddress('Liquidity Provider Address', ui, provider.sender().address)

    const jettonMinterZeroAddress = await promptAddress('First Jetton Minter Address', ui)
    const jettonZeroAmount = toNano(await promptAmount('How many of these jettons are you providing?', ui))

    const jettonMinterOneAddress = await promptAddress('Second Jetton Minter Address', ui)
    const jettonOneAmount = toNano(await promptAmount('How many of these jettons are you providing?', ui))

    const params = {
        routerAddress,
        userWalletAddress,
        jettonMinterZeroAddress,
        jettonZeroAmount,
        jettonMinterOneAddress,
        jettonOneAmount,
    } as ProvideLiquidityCLI

    ui.write('\n')
    ui.write('------ Provide Liquidity summary ------')
    ui.write(`Liquidity:\n${JSON.stringify(params, cliPrettify, 2)}`)
    ui.write('--------------------------')

    await confirmAndProceedOrExit(ui)

    return params
}
