import { DEX } from '@ston-fi/sdk'
import { NetworkProvider } from '@ton/blueprint'
import { isAccountActive, lastTransactionTime } from '../../scripts-lib/account'
import { cliPrettify, confirmAndProceedOrExit, promptAddress, promptAmount } from '../../scripts-lib/cli-prompt'
import { Address, toNano } from '@ton/core'
import { asTonClient4 } from '../../scripts-lib/ton-client'
import { cliRouterAddress } from '../../scripts-lib/cli'
import { enforceActivePool } from '../../scripts-lib/cli-pool'
import { getExpectedOutputs } from '../pool/getExpectedOutputs'
import { JettonMinter } from '../../wrappers/JettonMinter'
import { transactionIncrementWriteConfiration } from '../../scripts-lib/clo'

// Idenitifer for the message used in command line output
const MESSAGE_NAME = 'Swap'

/**
 * Jetton to Jetton swap.
 */
export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const client = asTonClient4(provider.api())
    const input = await getSwapInput(provider)
    const router = provider.open(DEX.v1.Router.create(input.routerAddress))

    /*
     * Active contract check
     */
    ui.write('Checking contracts...')

    ui.write(`Offer Jetton Minter Address: ${input.swapParams.offerJettonAddress}`)
    const isOfferAddressActive = await isAccountActive(client, input.swapParams.offerJettonAddress)
    if (!isOfferAddressActive) {
        ui.write('Offer Jetton Minter contract is not active!')
    }

    ui.write(`Ask Jetton Minter Address: ${input.swapParams.askJettonAddress}`)
    const isAskAddressActive = await isAccountActive(client, input.swapParams.askJettonAddress)
    if (!isAskAddressActive) {
        ui.write('Ask Jetton Minter contract is not active!')
    }

    // Confirm the user really wants to proceed with non-active Jetton Minter contract
    if (!isOfferAddressActive || !isAskAddressActive) {
        ui.write('WARNING: Both the token address must be active for a successful swap')
        await confirmAndProceedOrExit(ui)
    }

    // As token ordering is performed by the router, either way around works the same
    const poolAddress = await router.getPoolAddressByJettonMinters({
        token0: input.swapParams.offerJettonAddress,
        token1: input.swapParams.askJettonAddress,
    })

    await enforceActivePool(client, ui, poolAddress)

    /*
     * Router jetton wallet address for the jettons to swap (the 'from' jetton)
     */
    const walletAddress = await provider
        .open(JettonMinter.createFromAddress(input.swapParams.offerJettonAddress))
        .getWalletAddress(input.routerAddress)

    const expectedOut = await getExpectedOutputs(provider, poolAddress, {
        amount: input.swapParams.offerAmount,
        jettonWallet: walletAddress,
    })

    ui.write('\n')
    ui.write(`Expected swap out: ${expectedOut}`)
    if (isFivePercentLarger(input.swapParams.minAskAmount, expectedOut)) {
        ui.write('WARNING: Difference between the your ask and the expected swap output is greater than 5%')
    }
    await confirmAndProceedOrExit(ui)

    /*
     * Perform Swap
     */
    const userLastTransaction = await lastTransactionTime(client, input.swapParams.userWalletAddress)

    await router.sendSwapJettonToJetton(provider.sender(), input.swapParams)

    await transactionIncrementWriteConfiration(
        client,
        ui,
        input.swapParams.userWalletAddress,
        userLastTransaction,
        MESSAGE_NAME,
    )
}

type SwapParameters = {
    userWalletAddress: Address
    offerJettonAddress: Address
    askJettonAddress: Address
    offerAmount: bigint
    minAskAmount: bigint
}

type SwapInput = {
    routerAddress: Address
    swapParams: SwapParameters
}

async function getSwapInput(provider: NetworkProvider): Promise<SwapInput> {
    const ui = provider.ui()
    const routerAddress = await cliRouterAddress(ui)
    const userWalletAddress = await promptAddress('User (performing the swap) Address', ui, provider.sender().address)
    const offerJettonMinterAddress = await promptAddress('Offer Jetton Minter Address', ui)
    const askJettonMinterAddress = await promptAddress('Ask Jetton Minter Address', ui)
    const offerAmount = await promptAmount('How many jettons are you offering?', ui)
    const minAskAmount = await promptAmount('What is the least number of jettons you will accept?', ui)

    const swapParams = {
        userWalletAddress: userWalletAddress,
        offerJettonAddress: offerJettonMinterAddress,
        askJettonAddress: askJettonMinterAddress,
        offerAmount: toNano(offerAmount),
        minAskAmount: toNano(minAskAmount),
    } as SwapParameters

    ui.write('\n')
    ui.write('------ Swap summary ------')
    ui.write(`Router Address: ${routerAddress}`)
    ui.write(`swap:\n${JSON.stringify(swapParams, cliPrettify, 2)}`)
    ui.write('--------------------------')

    await confirmAndProceedOrExit(ui)

    return { routerAddress, swapParams }
}

/**
 * Is a 20% or more larger than b
 */
function isFivePercentLarger(a: bigint, b: bigint): boolean {
    const tenPercent: bigint = b / 20n
    const threshold: bigint = b + tenPercent

    return a >= threshold
}
