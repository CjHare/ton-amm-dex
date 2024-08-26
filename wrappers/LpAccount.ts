import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { beginMessage } from "./lib/helpers";

export type LpAccountConfig = { 
    user: Address;
    pool: Address;
    stored0: bigint;
    stored1: bigint;
};

export function accountConfigToCell(config: LpAccountConfig): Cell {
    return beginCell()
        .storeAddress(config.user)
        .storeAddress(config.pool)
        .storeCoins(config.stored0)
        .storeCoins(config.stored1)
        .endCell();
}

export class LpAccount implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new LpAccount(address);
    }

    static createFromConfig(config:  LpAccountConfig, code: Cell, workchain = 0) {
        const data = accountConfigToCell(config);
        const init = { code, data };
        return new LpAccount(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }



 resetGas(): Cell {
    return beginMessage({ op: BigInt(0x42a0fb43) })
        .endCell();
}

 addLiquidity(params: {
    newAmount0: bigint;
    newAmount1: bigint;
    minLPOut: bigint;
}): Cell {
    return beginMessage({ op: BigInt(0x3ebe5431) })
        .storeCoins(params.newAmount0)
        .storeCoins(params.newAmount1)
        .storeCoins(params.minLPOut)
        .endCell();
}

directAddLiquidity(params: {
    amount0: bigint;
    amount1: bigint;
    minLPOut: bigint;
}): Cell {
    return beginMessage({ op: BigInt(0x4cf82803) })
        .storeCoins(params.amount0)
        .storeCoins(params.amount1)
        .storeCoins(params.minLPOut)
        .endCell();
}

 refundMe(): Cell {
    return beginMessage({ op: BigInt(0x0bf3f447) })
        .endCell();
}

 getLPAccountData(): Cell {
    return beginMessage({ op: BigInt(0xea97bbef) })
        .endCell();
}

}