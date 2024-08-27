import { Blockchain, EventAccountCreated, EventMessageSent, SandboxContract, TreasuryContract, internal, printTransactionFees } from '@ton/sandbox';
import { Address, Cell, TupleItemSlice, beginCell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import { getBlockchainPresetConfig, randomAddress } from './lib/helpers';
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
        const tokenWalletOne = beginCell().storeAddress(randomAddress("token wallet 1")).endCell();
        const tokenWaletTwo = beginCell().storeAddress(randomAddress("token wallet 2")).endCell();

        const call = await blockchain.runGetMethod(router.address, "get_pool_address", [
          { type: "slice", cell: tokenWalletOne },
          { type: "slice", cell: tokenWaletTwo },
        ]);
    
        expect(call.exitCode).toBe(0)
        const poolAddress = (call.stack[0] as TupleItemSlice).cell?.beginParse().loadAddress();
        expect(poolAddress).toBeDefined
      });

      // TODO this test is failing due to an `out of ton` action error, no idea why ...yet
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
  
      it("should pay if caller is valid", async () => {
        // Change the chain state
        blockchain.setConfig(getBlockchainPresetConfig());

        const tokenWalletOneAddress = randomAddress("token wallet 1")
        const tokenWalletTwoAddress = randomAddress("token wallet 2");

        const call = await blockchain.runGetMethod(router.address, "get_pool_address", [
          { type: "slice", cell: beginCell().storeAddress(tokenWalletOneAddress).endCell() },
          { type: "slice", cell: beginCell().storeAddress(tokenWalletTwoAddress).endCell() },
        ]);
        const poolAddress = (call.stack[0] as TupleItemSlice).cell?.beginParse().loadAddress();

        const payToResult = await blockchain.sendMessage(
            internal({
                from: poolAddress,
                to: router.address,
                value:  toNano(20),
                body: router.payTo({
                    owner: randomAddress("owner"),
                    tokenAAmount: BigInt(100),
                    walletTokenAAddress: tokenWalletOneAddress,
                    tokenBAmount: BigInt(200),
                    walletTokenBAddress: tokenWalletTwoAddress,
                  })
                })
        )
    
                expect(payToResult.transactions).toHaveTransaction({
                    from: poolAddress,
                    to: router.address,
                    success: true,
                });


                expect(payToResult.events.length).toBe(4)
                expect(payToResult.events[0].type).toBe('message_sent')
                expect(payToResult.events[1].type).toBe('message_sent')
                expect(payToResult.events[2].type).toBe('message_sent')
                expect(payToResult.events[3].type).toBe('message_sent')
        
                const eventMsgZero = payToResult.events[0] as EventMessageSent
                expect(eventMsgZero.from).toEqualAddress(router.address)
                expect(eventMsgZero.to).toEqualAddress(tokenWalletOneAddress)        
                expect(eventMsgZero.bounced).toBe(false)        

                const eventMsgOne = payToResult.events[1] as EventMessageSent
                expect(eventMsgOne.from).toEqualAddress(router.address)
                expect(eventMsgOne.to).toEqualAddress(tokenWalletTwoAddress)        
                expect(eventMsgOne.bounced).toBe(false)        

                const eventMsgTwo = payToResult.events[2] as EventMessageSent
                expect(eventMsgTwo.from).toEqualAddress(tokenWalletOneAddress)
                expect(eventMsgTwo.to).toEqualAddress(router.address)        
                expect(eventMsgTwo.bounced).toBe(true)       

                const eventMsgThree = payToResult.events[3] as EventMessageSent
                expect(eventMsgThree.from).toEqualAddress(tokenWalletTwoAddress)
                expect(eventMsgThree.to).toEqualAddress(router.address)        
                expect(eventMsgThree.bounced).toBe(true)       
      });      

})




//TODO rename Wallet -> LpWallet (keep consistent with Account)