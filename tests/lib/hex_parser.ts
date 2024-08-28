import { Cell } from '@ton/core'

export function parseUri(cell: Cell): string {
    const prefix = 8
    const payloadLength = cell.bits.length - prefix
    const parsing = cell.beginParse().skip(prefix)

    return hexToUtf8(parsing.loadBits(payloadLength).toString())
}

function hexToUtf8(hexString: string): string {
    // NodeJS Buffer library for the conversion
    return Buffer.from(hexString, 'hex').toString('utf-8')
}
