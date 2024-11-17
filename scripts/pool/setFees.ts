import { NetworkProvider, UIProvider } from '@ton/blueprint'
import { Address, Builder, Cell, SenderArguments, beginCell, toNano } from '@ton/core'
import { cliPrettify, confirmAndProceedOrExit, promptAddress, promptAmountUint } from '../../scripts-lib/cli-prompt'
import { cliJettonMinterAddresses, cliRouterAddress } from '../../scripts-lib/cli'
import { DEX } from '@ston-fi/sdk'
import { asTonClient4 } from '../../scripts-lib/ton-client'
import { enforceActivePool } from '../../scripts-lib/cli-pool'
import { JettonMinter } from '../../wrappers/JettonMinter'

export async function run(provider: NetworkProvider) {
    const client = asTonClient4(provider.api())
    const ui = provider.ui()

    ui.write('Only the Router owner has permission to set fees')
    const routerAddress = await cliRouterAddress(ui)
    const cliParams = await cliSetFees(ui)

    const router = provider.open(DEX.v1.Router.create(routerAddress))
    const poolAddress = await router.getPoolAddressByJettonMinters({
        token0: cliParams.jettonMinter0Address,
        token1: cliParams.jettonMinter1Address,
    })

    await enforceActivePool(client, ui, poolAddress)

    /*
     * The Router getter uses the Router Jetton Wallet, not the Jetton Minter addresses
     */
    const [jetton0WalletAddress, jetton1WalletAddress] = await Promise.all([
        provider.open(JettonMinter.createFromAddress(cliParams.jettonMinter0Address)).getWalletAddress(routerAddress),
        provider.open(JettonMinter.createFromAddress(cliParams.jettonMinter1Address)).getWalletAddress(routerAddress),
    ])

    const setFeesParams = {
        jettonWallet0: jetton0WalletAddress,
        jettonWallet1: jetton1WalletAddress,
        newLPFee: cliParams.newLPFee,
        newProtocolFee: cliParams.newProtocolFee,
        newRefFee: cliParams.newRefFee,
        newProtocolFeeAddress: cliParams.newProtocolFeeAddress,
    }

    /*
     * StonFi SDK lacks setFees(), instead hand rolling it
     */
    const txParams = await getSetFeeTxParams(routerAddress, setFeesParams)

    await provider.sender().send(txParams)
}

type SetFeesInput = {
    jettonWallet0: Address
    jettonWallet1: Address
    newLPFee: bigint
    newProtocolFee: bigint
    newRefFee: bigint
    newProtocolFeeAddress: Address
}

type CliSetFees = {
    jettonMinter0Address: Address
    jettonMinter1Address: Address
    newLPFee: bigint
    newProtocolFee: bigint
    newRefFee: bigint
    newProtocolFeeAddress: Address
}

async function cliSetFees(ui: UIProvider): Promise<CliSetFees> {
    const jettonMinterInput = await cliJettonMinterAddresses(ui)
    const lpFee = await promptAmountUint('LP Fee (BIPS)', ui)
    const protocolFee = await promptAmountUint('Protocol Fee (BIPS)', ui)
    const refFee = await promptAmountUint('Referral Fee (BIPS)', ui)
    const protocolFeeAddress = await promptAddress('Protocol fee address', ui)

    const params: CliSetFees = {
        jettonMinter0Address: jettonMinterInput.token0,
        jettonMinter1Address: jettonMinterInput.token1,
        newLPFee: lpFee,
        newProtocolFee: protocolFee,
        newRefFee: refFee,
        newProtocolFeeAddress: protocolFeeAddress,
    }

    ui.write('\n')
    ui.write('------ Set Fees summary ------')
    ui.write(`Request:\n${JSON.stringify(params, cliPrettify, 2)}`)
    ui.write('--------------------------')

    await confirmAndProceedOrExit(ui)

    return params
}

async function getSetFeeTxParams(to: Address, params: SetFeesInput): Promise<SenderArguments> {
    const value = toNano('0.5')
    const body = setFees(params)
    return { to, value, body }
}

function setFees(params: SetFeesInput): Cell {
    return beginMessage({ op: BigInt(0x355423e5) })
        .storeUint(params.newLPFee, 8)
        .storeUint(params.newProtocolFee, 8)
        .storeUint(params.newRefFee, 8)
        .storeAddress(params.newProtocolFeeAddress)
        .storeRef(beginCell().storeAddress(params.jettonWallet0).storeAddress(params.jettonWallet1).endCell())
        .endCell()
}

export function beginMessage(params: { op: bigint }): Builder {
    return beginCell()
        .storeUint(params.op, 32)
        .storeUint(BigInt(Math.floor(Math.random() * 2 ** 31)), 64)
}
