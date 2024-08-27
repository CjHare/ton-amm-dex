import { Blockchain, EventAccountCreated, EventMessageSent, SandboxContract, TreasuryContract, internal, printTransactionFees } from '@ton/sandbox';
import { Address, Cell, TupleItemSlice, beginCell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import { randomAddress } from './lib/helpers';
import { Router } from '../wrappers/Router';

/** Import the TON matchers */
import "@ton/test-utils";

describe('Router', () => {
    let routerCode: Cell;
    let  poolCode: Cell;
    let walletCode: Cell;
    let accountCode: Cell;
    let adminAddress: Address;

    beforeAll(async () => {
        poolCode = await compile('Pool');
        routerCode = await compile('Router');
        walletCode = await compile('Wallet');
        accountCode = await compile('LpAccount');
        adminAddress = randomAddress("admin")    
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let router: SandboxContract<Router>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        router = blockchain.openContract(Router.createFromConfig({        
            isLocked: false,
            adminAddress: adminAddress,
            poolCode: poolCode,
            LPWalletCode: walletCode,
            LPAccountCode: accountCode,
        }, routerCode));

        deployer = await blockchain.treasury('deployer');

        await deployPool();
    });

    async function deployPool():Promise<void>{
        const deployResult = await router.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: router.address,
            deploy: true,
            success: true,
        });

        // Events for deploy message and router creation
        expect(deployResult.events.length).toBe(2)
        expect(deployResult.events[0].type).toBe('message_sent')
        expect(deployResult.events[1].type).toBe('account_created')

        const deployEventMsg = deployResult.events[0] as EventMessageSent
        expect(deployEventMsg.from).toEqualAddress(deployer.address)
        expect(deployEventMsg.to).toEqualAddress(router.address)        
        const createEventMsg = deployResult.events[1] as EventAccountCreated
        expect(createEventMsg.account).toEqualAddress(router.address)
    }

    it("should get a valid pool address", async () => {
        const poolAddr1 = beginCell().storeAddress(randomAddress("token wallet 1")).endCell();
        const poolAddr2 = beginCell().storeAddress(randomAddress("token wallet 2")).endCell();

        const call = await blockchain.runGetMethod(router.address, "get_pool_address", [
          { type: "slice", cell: poolAddr1 },
          { type: "slice", cell: poolAddr2 },
        ]);
    
        expect(call.exitCode).toBe(0)

        const userWalletAddress = (call.stack[0] as TupleItemSlice).cell?.beginParse().loadAddress();
        expect(userWalletAddress).toBeDefined
      });

      it("should reset gas", async () => {
        await deployer.send({
            to: router.address,
            value: toNano(5), 
        });
        
        const resetGasResult = await blockchain.sendMessage(
            internal({
                from: adminAddress,
                to: router.address,
                value:  toNano(70000000),
                body: router.resetGas()
                  })
                )
    
                expect(resetGasResult.transactions).toHaveTransaction({
                    from: adminAddress,
                    to: router.address,
                    success: true,
                });
        
                expect(resetGasResult.events).toHaveLength(2);    
                 expect(resetGasResult.events[0].type).toBe('message_sent')
                 expect(resetGasResult.events[1].type).toBe('message_sent')
        
                 const eventMsgSendToken0 =resetGasResult.events[0] as EventMessageSent
                 expect(eventMsgSendToken0.from).toEqualAddress(router.address)
                 expect(eventMsgSendToken0.to).toEqualAddress(adminAddress)
                 const eventMsgSendToken1 =  resetGasResult.events[1] as EventMessageSent
                 expect(eventMsgSendToken1.from).toEqualAddress(adminAddress)
                 expect(eventMsgSendToken1.to).toEqualAddress(router.address)
      });
    
})




//TODO rename Wallet -> LpWallet (keep consistent with Account)