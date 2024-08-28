/**
 * Current system time in seconds.
 */
export function currentTimeInSeconds(): number {
    return Math.floor(Date.now() / 1000)
}
