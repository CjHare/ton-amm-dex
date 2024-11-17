import { NetworkProvider } from '@ton/blueprint'
import { DEX, pTON } from '@ston-fi/sdk'
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
 * The initial supply of liquidity to a new (possibilty undeployed) TON-Jetton Pool.
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
     * Jetton Minter must exist
     */
    ui.write(`Jetton Minter Address: ${input.jettonMinterAddress}`)
    const isSendAddressActive = await isAccountActive(client, input.jettonMinterAddress)
    if (isSendAddressActive) {
        ui.write('Jetton Minter is active')
    } else {
        ui.write('\nJetton Minter is not active!')
        ui.write('\n')
        ui.write('Jetton Minter must be active to provide liquidity')
        ui.write('Stopped')
        process.exit()
    }

    /*
     * Check the values exceed the minimum for initial Pool liquidity
     */
    if (input.sendJettonAmount < MINIMUM_LIQUIDITY || input.sendTonAmount < MINIMUM_LIQUIDITY) {
        ui.write('\nInsufficient liquidity!')
        ui.write('Both must be larger than 1001 units (standard nine decimal place jetton == 0.000001001)')
        ui.write(`Jettons: ${input.sendJettonAmount}`)
        ui.write(`TON: ${input.sendTonAmount}`)
        ui.write('Stopped.')
        process.exit()
    }

    /*
     * Check that the Pool either is non-active or zero liquidity
     */
    const router = provider.open(DEX.v1.Router.create(input.routerAddress))
    const proxyTon = client.open(pTON.v1.create(pTON.v1.address))

    ui.write(`Proxy TON address: ${proxyTon.address}`)
    const poolAddress = await router.getPoolAddressByJettonMinters({
        token0: input.jettonMinterAddress,
        token1: proxyTon.address,
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
     * The Router must have a pTon wallet deployed to accept pTon jettons
     */
    const pTonRouterWalletAddress = await proxyTon.getWalletAddress(router.address)
    const isRouterWalletWrapperTonActive = await isAccountActive(client, pTonRouterWalletAddress)
    if (!isRouterWalletWrapperTonActive) {
        ui.write(`No pTon wallet found for Router at: ${pTonRouterWalletAddress}`)
        ui.write('Deploying')
        await proxyTon.sendDeployWallet(provider.sender(), { ownerAddress: router.address })
    }

    /*
     * Provide the Jetton side of the liquisity
     */
    let userLastTransaction = await lastTransactionTime(client, input.userWalletAddress)

    await router.sendProvideLiquidityJetton(provider.sender(), {
        userWalletAddress: input.userWalletAddress,
        sendTokenAddress: input.jettonMinterAddress,
        otherTokenAddress: proxyTon.address,
        sendAmount: input.sendJettonAmount,
        minLpOut: MINIMUM_LP_OUT,
    })

    await transactionIncrementWriteConfiration(client, ui, input.userWalletAddress, userLastTransaction, MESSAGE_NAME)

    /*
     * Provide the TON side of the liquidity
     */
    userLastTransaction = await lastTransactionTime(client, input.userWalletAddress)

    await router.sendProvideLiquidityTon(provider.sender(), {
        userWalletAddress: input.userWalletAddress,
        proxyTon: new pTON.v1(),
        otherTokenAddress: input.jettonMinterAddress,
        sendAmount: input.sendTonAmount,
        minLpOut: MINIMUM_LP_OUT,
    })

    await transactionIncrementWriteConfiration(client, ui, input.userWalletAddress, userLastTransaction, MESSAGE_NAME)
}

type ProvideLiquidityCLI = {
    routerAddress: Address
    userWalletAddress: Address
    jettonMinterAddress: Address
    sendJettonAmount: bigint
    sendTonAmount: bigint
}

async function getProvideLiquidityInput(provider: NetworkProvider): Promise<ProvideLiquidityCLI> {
    const ui = provider.ui()

    ui.write('\n------ Create a TON-Jetton Liquidity Pool ------')
    ui.write('The Pool may already exist but must contain zero liquidity')
    ui.write('The first mint of LP tokens do not go to you, but to the null address')
    ui.write('There must be at leat 1001 jettons and TON provided (standard nine decimal place jetton == 0.000001001)')

    const routerAddress = await cliRouterAddress(ui)
    const userWalletAddress = await promptAddress('Liquidity Provider Address', ui, provider.sender().address)
    const jettonMinterAddress = await promptAddress('Jetton Minter Address', ui)
    const sendJettonAmount = await promptAmount('How many jettons are you providing?', ui)
    const sendTonAmount = await promptAmount('How much TON are you providing?', ui)

    const params = {
        routerAddress: routerAddress,
        userWalletAddress: userWalletAddress,
        jettonMinterAddress: jettonMinterAddress,
        sendJettonAmount: toNano(sendJettonAmount),
        sendTonAmount: toNano(sendTonAmount),
    } as ProvideLiquidityCLI

    ui.write('\n')
    ui.write('------ Provide Liquidity summary ------')
    ui.write(`Liquidity:\n${JSON.stringify(params, cliPrettify, 2)}`)
    ui.write('--------------------------')

    await confirmAndProceedOrExit(ui)

    return params
}
