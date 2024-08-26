import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { beginMessage } from "./lib/helpers";

export type RouterConfig = { isLocked: boolean; adminAddress: Address; LPWalletCode: Cell; poolCode: Cell; LPAccountCode: Cell; }

export function routerConfigToCell(config: RouterConfig): Cell {
    return beginCell()
      .storeUint(config.isLocked ? 1 : 0, 1)
      .storeAddress(config.adminAddress)
      .storeRef(config.LPWalletCode)
      .storeRef(config.poolCode)
      .storeRef(config.LPAccountCode)
      .storeRef(beginCell()
        .storeUint(0, 64)
        .storeUint(0, 64)
        .storeAddress(null)
        .storeRef(beginCell().endCell())
        .endCell())
      .endCell();
}

export class Router implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Router(address);
    }

    static createFromConfig(config: RouterConfig, code: Cell, workchain = 0) {
        const data = routerConfigToCell(config);
        const init = { code, data };
        return new Router(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    setFees(params: {
        jetton0Address: Address;
        jetton1Address: Address;
        newLPFee: bigint;
        newProtocolFee: bigint;
        newRefFee: bigint;
        newProtocolFeeAddress: Address;
      }): Cell {
        return beginMessage({ op: BigInt(0x355423e5) })
          .storeUint(params.newLPFee, 8)
          .storeUint(params.newProtocolFee, 8)
          .storeUint(params.newRefFee, 8)
          .storeAddress(params.newProtocolFeeAddress)
          .storeRef(beginCell()
            .storeAddress(params.jetton0Address)
            .storeAddress(params.jetton1Address)
            .endCell())
          .endCell();
      }
      
      initCodeUpgrade(params: { newCode: Cell; }): Cell {
        return beginMessage({ op: BigInt(0xdf1e233d) })
          .storeRef(params.newCode)
          .endCell();
      }
      
       initAdminUpgrade(params: { newAdmin: Address; }): Cell {
        return beginMessage({ op: BigInt(0x2fb94384) })
          .storeAddress(params.newAdmin)
          .endCell();
      }
      
      cancelCodeUpgrade(): Cell {
        return beginMessage({ op: BigInt(0x357ccc67) })
          .endCell();
      }
      
      cancelAdminUpgrade(): Cell {
        return beginMessage({ op: BigInt(0xa4ed9981) })
          .endCell();
      }
      
      
      finalizeUpgrades(): Cell {
        return beginMessage({ op: BigInt(0x6378509f) })
          .endCell();
      }
      
      resetGas(): Cell {
        return beginMessage({ op: BigInt(0x42a0fb43) }).endCell();
      }
      
    lock(): Cell {
        return beginMessage({ op: BigInt(0x878f9b0e) })
          .endCell();
      }
      
      unlock(): Cell {
        return beginMessage({ op: BigInt(0x6ae4b0ef) })
          .endCell();
      }
      
     collectFees(params: {
        jetton0Address: Address;
        jetton1Address: Address;
      }): Cell {
        return beginMessage({ op: BigInt(0x1fcb7d3d) })
          .storeAddress(params.jetton0Address)
          .storeAddress(params.jetton1Address)
          .endCell();
      }
      
      payTo(params: { owner: Address; tokenAAmount: bigint; walletTokenAAddress: Address; tokenBAmount: bigint; walletTokenBAddress: Address }): Cell {
        return beginMessage({ op: BigInt(0xf93bb43f) })
          .storeAddress(params.owner)
          .storeUint(BigInt(0), 32)
          .storeRef(
            beginCell()
              .storeCoins(params.tokenAAmount)
              .storeAddress(params.walletTokenAAddress)
              .storeCoins(params.tokenBAmount)
              .storeAddress(params.walletTokenBAddress)
              .endCell()
          )
          .endCell();
      }
      
      swap(params: { jettonAmount: bigint; fromAddress: Address; walletTokenBAddress: Address; toAddress: Address; expectedOutput: bigint; refAddress?: Address; }): Cell {
        let swapPayload = beginCell()
          .storeUint(BigInt(0x25938561), 32)
          .storeAddress(params.walletTokenBAddress)
          .storeCoins(params.expectedOutput)
          .storeAddress(params.toAddress)
          .storeBit(!!params.refAddress);
      
        if (!!params.refAddress)
          swapPayload.storeAddress(params.refAddress || null);
      
        return beginMessage({ op: BigInt(0x7362d09c) })
          .storeCoins(params.jettonAmount)
          .storeAddress(params.fromAddress)
          .storeBit(true)
          .storeRef(swapPayload.endCell())
          .endCell();
      }
      
      provideLiquidity(params: { jettonAmount: bigint; fromAddress: Address; walletTokenBAddress: Address; minLPOut: bigint }): Cell {
        return beginMessage({ op: BigInt(0x7362d09c) })
          .storeCoins(params.jettonAmount)
          .storeAddress(params.fromAddress)
          .storeBit(true)
          .storeRef(beginCell()
            .storeUint(BigInt(0xfcf9e58f), 32)
            .storeAddress(params.walletTokenBAddress)
            .storeCoins(params.minLPOut)
            .endCell())
          .endCell();
      }
      
      getPoolAddress(params: { walletTokenAAddress: Address; walletTokenBAddress: Address }): Cell {
        return beginMessage({ op: BigInt(0xd1db969b) })
          .storeAddress(params.walletTokenAAddress)
          .storeAddress(params.walletTokenBAddress)
          .endCell();
      }
}