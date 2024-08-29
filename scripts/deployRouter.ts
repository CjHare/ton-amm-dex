import { Address, toNano } from '@ton/core'
import { compile, NetworkProvider } from '@ton/blueprint'
import dotenv from "dotenv";
import { Router } from '../wrappers/Router';

/** Get dotEnv working */
dotenv.config();

export async function run(provider: NetworkProvider) {
    const adminAddress = tonAddress(process.env.ADMIN_ADDRESS)

    const router = provider.open(Router.createFromConfig({
        isLocked: false,
        adminAddress: adminAddress,
        LpWalletCode: await compile('LpWallet'),
        poolCode: await compile('Pool'),
        LpAccountCode: await compile('LpAccount')
    }, await compile('Router')))

    await router.sendDeploy(provider.sender(), toNano('0.05'))

    await provider.waitForDeploy(router.address)
}

function tonAddress(address:string | undefined) : Address{
    if (address === undefined)
    {
        throw new Error("ADMIN_ADDRESS is not defined");
    }

    if(!Address.isFriendly(address)){
        throw new Error(`ADMIN_ADDRESS is not a friendly TON address: ${address}`);
    }

    return Address.parse(address)
}