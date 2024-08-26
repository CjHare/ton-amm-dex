import { Blockchain, EventAccountCreated, EventMessageSent, SandboxContract, TreasuryContract, internal, printTransactionFees } from '@ton/sandbox';
import { Address, Cell, TupleItemInt, TupleItemSlice, beginCell, toNano } from '@ton/core';
import { Pool } from '../wrappers/Pool';
import { compile } from '@ton/blueprint';
import { getBlockchainPresetConfig, parseUri, randomAddress, zeroAddress } from './lib/helpers';

/** Import the TON matchers */
import "@ton/test-utils";
import { Account } from '../wrappers/Account';

describe('Account', () => {
    let walletCode: Cell;
    let accountCode: Cell;
    let routerAddress: Address;
    let walletOneAddress: Address;
    let walletZeroAddress: Address;
    let poolAddress : Address;
    let userAddress: Address;

    beforeAll(async () => {
        walletCode = await compile('Wallet');
        accountCode = await compile('Account');
        walletZeroAddress = randomAddress("wallet0")
        walletOneAddress = randomAddress("wallet1")

        poolAddress = randomAddress("pool");
        userAddress = randomAddress("user");

    
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let account: SandboxContract<Account>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        routerAddress = randomAddress("a valid pool");

        account = blockchain.openContract(Account.createFromConfig({ 
            user: userAddress,
            pool: poolAddress,
            stored0: toNano(0),
            stored1: toNano(0),
        }, accountCode));

        deployer = await blockchain.treasury('deployer');

        await deployAccount();
    });

    async function deployAccount():Promise<void>{
        const deployResult = await account.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: account.address,
            deploy: true,
            success: true,
        });

        // Events for deploy message and account creation
        expect(deployResult.events.length).toBe(2)
        expect(deployResult.events[0].type).toBe('message_sent')
        expect(deployResult.events[1].type).toBe('account_created')
        const eventMsgSendToken0 = deployResult.events[0] as EventMessageSent
        const eventCreateSendToken0 = deployResult.events[1] as EventAccountCreated
        expect(eventMsgSendToken0.from.equals(deployer.address)).toBeTruthy
        expect(eventMsgSendToken0.to.equals(account.address)).toBeTruthy        
    }

    it("should reset gas", async () => {
        await deployer.send({
            to: account.address,
            value: toNano(5), 
        });  

        // Message from the wrong address should fail
        const sendCollectFeesWithRewards = await blockchain.sendMessage(
            internal({
                from: randomAddress("someone"),
                to: account.address,
                value: toNano(7000000000),
                body: account.resetGas()
                })
        );

    
        expect(sendCollectFeesWithRewards.transactions).toHaveTransaction({
            from: randomAddress("someone"),
            to: account.address,
            success: false
        });

        // Message from the userAddress should succeed
        const sendResetGas = await blockchain.sendMessage(
            internal({
                from: userAddress,
                to: account.address,
                value: toNano(7000000000),
                body: account.resetGas()
                })
        );

    
        expect(sendResetGas.transactions).toHaveTransaction({
            from: userAddress,
            to: account.address,
            success: true
        });

        expect(sendResetGas.events.length).toBe(2)
        expect(sendResetGas.events[0].type).toBe('message_sent')
        expect(sendResetGas.events[1].type).toBe('message_sent')

        const resetGasMsgZero = sendResetGas.events[0] as EventMessageSent
        expect(resetGasMsgZero.from).toEqualAddress(account.address)
        expect(resetGasMsgZero.to).toEqualAddress(userAddress)
        expect(resetGasMsgZero.bounced).toBe(false)

        const resetGasMsgOne = sendResetGas.events[1] as EventMessageSent
        expect(resetGasMsgOne.from).toEqualAddress(userAddress)
        expect(resetGasMsgOne.to).toEqualAddress(account.address)
        expect(resetGasMsgZero.bounced).toBe(false)
    });
})
