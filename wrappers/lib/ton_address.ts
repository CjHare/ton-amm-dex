import { Address } from '@ton/core'

/**
 * Validates and converts the given the string to an Address, displaying appropriate error messages.
 * @param address might be a TON address in friendly format
 * @param name variable name to display in error messages
 * @returns address as a valid TON Address
 */
export function tonAddress(address: string | undefined, name: string): Address {
    if (address === undefined) {
        throw new Error(`${name} is not defined`)
    }

    if (!Address.isFriendly(address)) {
        throw new Error(`${name} is not a friendly TON address: ${address}`)
    }

    return Address.parse(address)
}
