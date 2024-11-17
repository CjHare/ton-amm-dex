import { toNano } from '@ton/core'
import { compile, NetworkProvider } from '@ton/blueprint'
import { Router } from '../../wrappers/Router'
import { promptAddress } from '../../scripts-lib/cli-prompt'

export async function run(provider: NetworkProvider) {
    const ui = provider.ui()

    ui.write('\n------ Deploy TonSwap ------')
    const adminAddress = await promptAddress('Router admin address', ui, provider.sender().address)

    const router = provider.open(
        Router.createFromConfig(
            {
                isLocked: false,
                adminAddress: adminAddress,
                LpWalletCode: await compile('LpWallet'),
                poolCode: await compile('Pool'),
                LpAccountCode: await compile('LpAccount'),
            },
            await compile('Router'),
        ),
    )

    await router.sendDeploy(provider.sender(), toNano('0.05'))

    await provider.waitForDeploy(router.address)
}
