import { TonClient, TonClient4 } from '@ton/ton'

export function asTonClient4(api: TonClient4 | TonClient) {
    if (api instanceof TonClient4) {
        return api as TonClient4
    }

    throw new Error(`API is not of type TonClient4`)
}
