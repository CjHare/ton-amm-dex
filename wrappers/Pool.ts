import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core'
import { beginMessage } from './lib/helpers'

export type PoolConfig = {
    routerAddress: Address
    lpFee: bigint
    protocolFee: bigint
    refFee: bigint
    protocolFeesAddress: Address
    collectedTokenAProtocolFees: bigint
    collectedTokenBProtocolFees: bigint
    reserve0: bigint
    reserve1: bigint
    wallet0: Address
    wallet1: Address
    supplyLP: bigint
    LPWalletCode: Cell
    LPAccountCode: Cell
}

export function poolConfigToCell(config: PoolConfig): Cell {
    return beginCell()
        .storeAddress(config.routerAddress)
        .storeUint(config.lpFee, 8)
        .storeUint(config.protocolFee, 8)
        .storeUint(config.refFee, 8)
        .storeAddress(config.wallet0)
        .storeAddress(config.wallet1)
        .storeCoins(config.supplyLP)
        .storeRef(
            beginCell()
                .storeCoins(config.collectedTokenAProtocolFees)
                .storeCoins(config.collectedTokenBProtocolFees)
                .storeAddress(config.protocolFeesAddress)
                .storeCoins(config.reserve0)
                .storeCoins(config.reserve1)
                .endCell(),
        )
        .storeRef(config.LPWalletCode)
        .storeRef(config.LPAccountCode)
        .endCell()
}

export class Pool implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new Pool(address)
    }

    static createFromConfig(config: PoolConfig, code: Cell, workchain = 0) {
        const data = poolConfigToCell(config)
        const init = { code, data }
        return new Pool(contractAddress(workchain, init), init)
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        })
    }

    setFees(params: {
        newLPFee: bigint
        newProtocolFees: bigint
        newRefFee: bigint
        newProtocolFeeAddress: Address
    }): Cell {
        return beginMessage({ op: BigInt(0x355423e5) })
            .storeUint(params.newLPFee, 8)
            .storeUint(params.newProtocolFees, 8)
            .storeUint(params.newRefFee, 8)
            .storeAddress(params.newProtocolFeeAddress)
            .endCell()
    }

    burnTokensNotification(params: {
        jettonAmount: bigint
        fromAddress: Address
        responseAddress: Address | null
    }): Cell {
        return beginMessage({ op: BigInt(0x7bdd97de) })
            .storeCoins(params.jettonAmount)
            .storeAddress(params.fromAddress)
            .storeAddress(params.responseAddress)
            .endCell()
    }

    collectFees(): Cell {
        return beginMessage({ op: BigInt(0x1fcb7d3d) }).endCell()
    }

    resetGas(): Cell {
        return beginMessage({ op: BigInt(0x42a0fb43) }).endCell()
    }

    swap(params: {
        fromAddress: Address
        tokenWallet: Address
        jettonAmount: bigint
        toAddress: Address
        minOutput: bigint
        hasRef?: boolean
        refAddress?: Address
    }): Cell {
        return beginMessage({ op: BigInt(0x25938561) })
            .storeAddress(params.fromAddress)
            .storeAddress(params.tokenWallet)
            .storeCoins(params.jettonAmount)
            .storeCoins(params.minOutput)
            .storeBit(!!params.hasRef)
            .storeBit(true)
            .storeRef(
                beginCell()
                    .storeAddress(params.fromAddress)
                    .storeAddress(params.refAddress || null)
                    .endCell(),
            )
            .endCell()
    }

    provideLiquidity(params: {
        fromAddress: Address
        jettonAmount0: bigint
        jettonAmount1: bigint
        minLPOut: bigint
    }): Cell {
        return beginMessage({ op: BigInt(0xfcf9e58f) })
            .storeAddress(params.fromAddress)
            .storeCoins(params.minLPOut)
            .storeCoins(params.jettonAmount0)
            .storeCoins(params.jettonAmount1)
            .endCell()
    }

    poolData(): Cell {
        return beginMessage({ op: BigInt(0x43c034e6) }).endCell()
    }

    expectedOutputs(params: { jettonAmount: bigint; tokenSent: Address }): Cell {
        return beginMessage({ op: BigInt(0xed4d8b67) })
            .storeCoins(params.jettonAmount)
            .storeAddress(params.tokenSent)
            .endCell()
    }

    cachedLPByAddress(params: { userAddress: Address }): Cell {
        return beginMessage({ op: BigInt(0x0c0671db) })
            .storeAddress(params.userAddress)
            .endCell()
    }
}
