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

        const deployEventMsg = deployResult.events[0] as EventMessageSent
        expect(deployEventMsg.from).toEqualAddress(deployer.address)
        expect(deployEventMsg.to).toEqualAddress(account.address)        
        const createEventMsg = deployResult.events[1] as EventAccountCreated
        expect(createEventMsg.account).toEqualAddress(account.address)
        }

    it("should reset gas", async () => {
        await deployer.send({
            to: account.address,
            value: toNano(5), 
        });  

        // Message from the wrong address should fail
        const sendResetGasWrongSender = await blockchain.sendMessage(
            internal({
                from: randomAddress("someone"),
                to: account.address,
                value: toNano(7000000000),
                body: account.resetGas()
                })
        );

    
        expect(sendResetGasWrongSender.transactions).toHaveTransaction({
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

        const resetGasEventZero = sendResetGas.events[0] as EventMessageSent
        expect(resetGasEventZero.from).toEqualAddress(account.address)
        expect(resetGasEventZero.to).toEqualAddress(userAddress)
        expect(resetGasEventZero.bounced).toBe(false)

        const resetGasEventOne = sendResetGas.events[1] as EventMessageSent
        expect(resetGasEventOne.from).toEqualAddress(userAddress)
        expect(resetGasEventOne.to).toEqualAddress(account.address)
        expect(resetGasEventOne.bounced).toBe(true)
    });

    it("should store new liquidity and ask for minting", async () => {

        // User is not allowed to add liquidity
        const sendResetGasWrongSender = await blockchain.sendMessage(
            internal({
                from: userAddress,
                to: account.address,
                value: toNano(7000000000),
                body: account.addLiquidity({
                    newAmount0: toNano(1),
                    newAmount1: toNano(0),
                    minLPOut: toNano(1),
                }),
                })
        );
        expect(sendResetGasWrongSender.transactions).toHaveTransaction({
            from: userAddress,
            to: account.address,
            success: false
        });

        // Add liquidty must come from the Pool
        const sendAddLiquidity = await blockchain.sendMessage(
            internal({
                from: poolAddress,
                to: account.address,
                value: toNano(7000000000),
                body: account.addLiquidity({
                    newAmount0: toNano(1),
                    newAmount1: toNano(0),
                    minLPOut: toNano(1),
                }),
                })
        );

        expect(sendAddLiquidity.transactions).toHaveTransaction({
            from: poolAddress,
            to: account.address,
            success: true
        });
        expect(sendAddLiquidity.events.length).toBe(0)



const sendCB = await blockchain.sendMessage(
    internal({
        from: poolAddress,
        to: account.address,
        value: toNano(7000000000),
        body: account.addLiquidity({
            newAmount0: toNano(0),
            newAmount1: toNano(10),
            minLPOut: toNano(1),
        }),
        })
);

expect(sendCB.transactions).toHaveTransaction({
    from: poolAddress,
    to: account.address,
    success: true
});
expect(sendCB.events.length).toBe(2)
expect(sendCB.events[0].type).toBe('message_sent')
expect(sendCB.events[1].type).toBe('message_sent')

const cbEventZero = sendCB.events[0] as EventMessageSent
expect(cbEventZero.from).toEqualAddress(account.address)
expect(cbEventZero.to).toEqualAddress(poolAddress)
expect(cbEventZero.bounced).toBe(false)

const cbEventOne = sendCB.events[1] as EventMessageSent
expect(cbEventOne.from).toEqualAddress(poolAddress)
expect(cbEventOne.to).toEqualAddress(account.address)
expect(cbEventOne.bounced).toBe(true)


const sendRefund = await blockchain.sendMessage(
    internal({
        from: poolAddress,
        to: account.address,
        value: toNano(7000000000),
        body: account.addLiquidity({
            newAmount0: toNano(0),
            newAmount1: toNano(10),
            minLPOut: toNano(0),
        }),
        })
);
expect(sendRefund.transactions).toHaveTransaction({
    from: poolAddress,
    to: account.address,
    success: true
});
expect(sendRefund.events.length).toBe(0)
    });

})
