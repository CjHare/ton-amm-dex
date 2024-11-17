import { AmountType, DEX, QueryIdType } from '@ston-fi/sdk'
import { NetworkProvider } from '@ton/blueprint'
import { Address, toNano } from '@ton/core'
import { cliPrettify, confirmAndProceedOrExit, promptAddress, promptAmount } from '../../scripts-lib/cli-prompt'
import { isAccountActive, lastTransactionTime } from '../../scripts-lib/account'
import { getPoolData } from '../pool/getPoolData'
import { asTonClient4 } from '../../scripts-lib/ton-client'
import { getExpectedTokens } from '../pool/getExpectedTokens'
import { cliRouterAddress } from '../../scripts-lib/cli'
import { hashKeccak } from '../../scripts-lib/hash'
import { enforceActivePool } from '../../scripts-lib/cli-pool'
import { transactionIncrementWriteConfiration } from '../../scripts-lib/clo'

// Idenitifer for the message used in command line output
const MESSAGE_NAME = 'Provide Liquidity'

/**
 * Jetton to Jetton pool liquidity
 */
export async function run(provider: NetworkProvider) {
    const ui = provider.ui()
    const client = asTonClient4(provider.api())
    const input = await getProvideLiquidityInput(provider)
    const router = provider.open(DEX.v1.Router.create(input.routerAddress))

    /*
     * Active contract check
     */
    ui.write('Checking contracts...')

    ui.write(`Send Jetton Minter Address: ${input.params.sendTokenAddress}`)
    const isSendAddressActive = await isAccountActive(client, input.params.sendTokenAddress)
    if (!isSendAddressActive) {
        ui.write('Send Jetton Minter contract is not active!')
    }

    ui.write(`Other Jetton Minter Address: ${input.params.otherTokenAddress}`)
    const isOtherAddressActive = await isAccountActive(client, input.params.otherTokenAddress)
    if (!isOtherAddressActive) {
        ui.write('Other Jetton Minter contract is not active!')
    }

    // Confirm the user really wants to proceed with non-active Jetton Minter contract
    if (!isSendAddressActive || !isOtherAddressActive) {
        ui.write('WARNING: Both the token address must be active for a successful providing of liquidity')
        await confirmAndProceedOrExit(ui)
    }

    // As token ordering is performed by the router, either way around works the same
    const poolAddress = await router.getPoolAddressByJettonMinters({
        token0: input.params.sendTokenAddress,
        token1: input.params.otherTokenAddress,
    })

    await enforceActivePool(client, ui, poolAddress)

    const poolData = await getPoolData(provider, poolAddress)

    // When there's no reserve, the inital LP mint still need to occur
    if (poolData.reserve0 == 0n && poolData.reserve1 == 0n) {
        ui.write('Pool is missing the initial liquidity provisioning')
        ui.write('\n')
        ui.write(`WANRING: Starting liquidity for a Pool is not minted to you, but to null`)
        await confirmAndProceedOrExit(ui)
    }

    /*
     * minLpOut of zero flow prevents the callback (cb_add_liquidity) and any LP jetton minting
     */
    if (input.params.minLpOut == 0n) {
        ui.write('minLpOut is zero!')
        ui.write('\n')
        ui.write(
            `WANRING: Expecting a minimum of zero LP jettons is a special case; add liquidity does not attempt to mint any LPs, rather the liquidity is added to the pool in the users LP Account`,
        )
        await confirmAndProceedOrExit(ui)
    } else {
        const pool = provider.open(DEX.v1.Pool.create(poolAddress))
        const lpAccountAddress = await pool.getLpAccountAddress({ ownerAddress: input.params.userWalletAddress })
        const LpAccount = provider.open(DEX.v1.LpAccount.create(lpAccountAddress))

        /*
         * Add the send amount to the appropriate LP Account token balance
         */
        const lpData = await LpAccount.getLpAccountData()

        let totalAmount0 = lpData.amount0
        let totalAmount1 = lpData.amount1

        if (
            hashKeccak(input.params.sendTokenAddress.toString()) > hashKeccak(input.params.otherTokenAddress.toString())
        ) {
            totalAmount0 += input.params.sendAmount
        } else {
            totalAmount1 += input.params.sendAmount
        }

        ui.write('\n')
        ui.write('Before add liquidity LP Account')
        ui.write(`\tjetton0: ${lpData.amount0}`)
        ui.write(`\tjetton1: ${lpData.amount1}`)
        ui.write('\n')
        ui.write('After add liquidity LP Account balance')
        ui.write(`\tjetton0: ${totalAmount0}`)
        ui.write(`\tjetton1: ${totalAmount1}`)

        /*
         * Is minLp within 10% of the expected (allows 10% slippage under)
         */
        const estimatedLpTokes = await getExpectedTokens(provider, poolAddress, {
            amount0: totalAmount0,
            amount1: totalAmount1,
        })

        ui.write('\n')
        ui.write('LP jettons mint')
        ui.write(`\tUser minimum: ${input.params.minLpOut}`)
        ui.write(`\tPool estimated: ${estimatedLpTokes}`)

        if (isTenPercentLarger(input.params.minLpOut, estimatedLpTokes)) {
            ui.write('\n')
            ui.write('minLpOut is more than 10% larger than the estimated LP jettons!')
            ui.write('\n')
            ui.write(
                'WANRING: when the number of LP jettons that would be mint does not meet the required minLpOut, the jettons are stored in the users LP Account, with no minting performed',
            )
            await confirmAndProceedOrExit(ui)
        }

        /*
         * Unless the ratio of liquidity exactly matches the pool, any excess (on either side) is donted to all LP holders of the pool
         */
        const poolData = await pool.getPoolData()
        const ratioPoolReserveZeroAsOne = Number(poolData.reserve0) / Number(poolData.reserve1)
        const ratioLpAccountReserveZeroAsOne = Number(totalAmount0) / Number(totalAmount1)

        ui.write('\n')
        ui.write('Pool')
        ui.write(`\tjetton0: ${poolData.reserve0}`)
        ui.write(`\tjetton1: ${poolData.reserve1}`)
        ui.write(`\tRatio: (${ratioPoolReserveZeroAsOne}) jetton0 == (1) jetton1`)

        ui.write('\n')
        ui.write('LP Account (post add liquidity)')
        ui.write(`\tjetton0: ${totalAmount0}`)
        ui.write(`\tjetton1: ${totalAmount1}`)
        ui.write(`\tRatio: (${ratioLpAccountReserveZeroAsOne}) jetton0 == (1) jetton1`)

        if (!isWithinTwoPercent(ratioPoolReserveZeroAsOne, ratioLpAccountReserveZeroAsOne)) {
            ui.write('\n')
            ui.write(
                'WANRING: LP ratio is more than a non-trival (2%) amount off from the Pool ratio, only the minimum is awarded to the user, but the entirity is still given to the Pool (a bonus for the other LPs)',
            )
            await confirmAndProceedOrExit(ui)
        }
    }

    /*
     * Add Liquidity
     */
    const userLastTransaction = await lastTransactionTime(client, input.params.userWalletAddress)

    await router.sendProvideLiquidityJetton(provider.sender(), input.params)

    await transactionIncrementWriteConfiration(
        client,
        ui,
        input.params.userWalletAddress,
        userLastTransaction,
        MESSAGE_NAME,
    )
}

type ProvideLiquidityParameters = {
    userWalletAddress: Address
    sendTokenAddress: Address
    otherTokenAddress: Address
    sendAmount: bigint
    minLpOut: bigint
    gasAmount?: AmountType
    forwardGasAmount?: AmountType
    queryId?: QueryIdType
}

type ProvideLiquidityInput = {
    routerAddress: Address
    params: ProvideLiquidityParameters
}

async function getProvideLiquidityInput(provider: NetworkProvider): Promise<ProvideLiquidityInput> {
    const ui = provider.ui()
    const routerAddress = await cliRouterAddress(ui)
    const userWalletAddress = await promptAddress('Liquidity Provider Address', ui, provider.sender().address)
    const sendJettonMinterAddress = await promptAddress('Send Jetton Minter Address', ui)
    const otherJettonMinterAddress = await promptAddress('Other Jetton Minter Address', ui)
    const sendAmount = await promptAmount('How many send tokens are you providing?', ui)
    const minLpOut = await promptAmount('What is the least number of LP jettons you will accept?', ui)

    const params = {
        userWalletAddress: userWalletAddress,
        sendTokenAddress: sendJettonMinterAddress,
        otherTokenAddress: otherJettonMinterAddress,
        sendAmount: toNano(sendAmount),
        minLpOut: toNano(minLpOut),
    } as ProvideLiquidityParameters

    ui.write('\n')
    ui.write('------ Provide Liquidity summary ------')
    ui.write(`Router Address: ${routerAddress}`)
    ui.write(`Liquidity:\n${JSON.stringify(params, cliPrettify, 2)}`)
    ui.write('--------------------------')

    await confirmAndProceedOrExit(ui)

    return { routerAddress, params }
}

/**
 * Is a 10% or more larger than b
 */
function isTenPercentLarger(a: bigint, b: bigint): boolean {
    const tenPercent: bigint = b / 10n
    const threshold: bigint = b + tenPercent

    return a >= threshold
}

/**
 * Are two numbers within 2% of each other?
 */
function isWithinTwoPercent(a: number, b: number): boolean {
    const twoPercent: number = b * 0.02
    const lowerBound: number = b - twoPercent
    const upperBound: number = b + twoPercent

    return a >= lowerBound && a <= upperBound
}
