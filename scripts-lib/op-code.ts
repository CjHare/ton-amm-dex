import CRC32 from 'crc-32'

/**
 * In FunC a const can be defined with a 'c' suffix, deonting to compile into a cell,
 * which can be used for uint comparision during the execution phase.
 *
 * e.g.
 * const swap = "swap"c;
 */
export function hashCommand(command: string): number {
    // Apply CRC32 hash to the command
    const crc32Hash = CRC32.str(command)

    // Convert it to unsigned 32-bit integer
    const unsignedCrc32Hash = crc32Hash >>> 0

    return unsignedCrc32Hash
}
