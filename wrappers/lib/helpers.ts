import { Builder, beginCell } from '@ton/core'

export function beginMessage(params: { op: bigint }): Builder {
    return beginCell()
        .storeUint(params.op, 32)
        .storeUint(BigInt(Math.floor(Math.random() * 2 ** 31)), 64)
}
