import { keccak256, toUtf8Bytes } from 'ethers'

export function hashKeccak(input: string): bigint {
    const inputBytes = toUtf8Bytes(input)
    const hashHex = keccak256(inputBytes)
    return BigInt(hashHex)
}
