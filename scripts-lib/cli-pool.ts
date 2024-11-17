import { UIProvider } from '@ton/blueprint'
import { isAccountActive } from './account'
import { Address, TonClient4 } from '@ton/ton'

/**
 * Checks whether the account the given address is active, display and terminating when it is not.
 *
 * Contracts must pay rent, even if it did exist, it may no longer.
 */
export async function enforceActivePool(client: TonClient4, ui: UIProvider, pool: Address) {
    const isPoolActive = await isAccountActive(client, pool)
    if (isPoolActive) {
        ui.write(`Acitve Pool found at: ${pool}`)
    } else {
        ui.write(`No Pool found at address: ${pool}`)
        ui.write('\nPool must be active to be interacted with!')
        ui.write('Stopped.')
        process.exit()
    }
}
