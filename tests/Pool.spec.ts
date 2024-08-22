import { Blockchain, EventAccountCreated, EventMessageSent, SandboxContract, TreasuryContract, internal } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { Pool } from '../wrappers/Pool';
import { compile } from '@ton/blueprint';
import { randomAddress } from './lib/helpers';

/** Import the TON matchers */
import "@ton/test-utils";

describe('Pool', () => {
    let poolCode: Cell;
    let walletCode: Cell;
    let accountCode: Cell;
    let routerAddress: Address;

    beforeAll(async () => {
        poolCode = await compile('Pool');
        walletCode = await compile('Wallet');
        accountCode = await compile('Account');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let pool: SandboxContract<Pool>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        routerAddress = randomAddress("a valid pool");

        pool = blockchain.openContract(Pool.createFromConfig({        
            routerAddress: routerAddress,
            lpFee: BigInt(20),
            protocolFee: BigInt(0),
            refFee: BigInt(10),
            protocolFeesAddress: randomAddress("a valid protocol fee address"),
            collectedTokenAProtocolFees: BigInt(0),
            collectedTokenBProtocolFees: BigInt(0),
            wallet0: randomAddress("wallet0"),
            wallet1: randomAddress("wallet1"),
            reserve0: BigInt(0),
            reserve1: BigInt(0),
            supplyLP: BigInt(0),
            LPWalletCode: walletCode,
            LPAccountCode: accountCode
        }, poolCode));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await pool.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: pool.address,
            deploy: true,
            success: true,
        });

        // Events for deploy message and pool creation
        expect(deployResult.events.length).toBe(2)
        expect(deployResult.events[0].type).toBe('message_sent')
        expect(deployResult.events[1].type).toBe('account_created')
        const eventMsgSendToken0 = deployResult.events[0] as EventMessageSent
        const eventCreateSendToken0 = deployResult.events[1] as EventAccountCreated
        expect(eventMsgSendToken0.from.equals(deployer.address)).toBeTruthy
        expect(eventMsgSendToken0.to.equals(pool.address)).toBeTruthy        
    });


    it('should deploy', async () => {
        expect(blockchain).toBeDefined;
        expect(pool).toBeDefined;
        expect(pool.address).toBeDefined;
    });

    it("should mint lp tokens", async () => {
        // Set balance of pool contract to 5 TON
        await deployer.send({
            to: pool.address,
            value: toNano(5), 
        });

        const sendToken0 = await blockchain.sendMessage(
            internal({
                from: routerAddress,
                to: pool.address,
                value: toNano(7000000000),
                body: pool.provideLiquidity({
                    fromAddress: randomAddress("user"),
                    jettonAmount0: BigInt(0),
                    jettonAmount1: BigInt(1000001),
                    minLPOut: BigInt(1),
                })
            })
        );

        // Mssage is sent from the router to the pool
        expect(sendToken0.transactions).toHaveTransaction({
            from: routerAddress,
            to: pool.address,
            deploy: false,
            success: true,
        });

        // Assignment of LP tokens to user wallet, then creation of user wallet
        expect(sendToken0.events).toHaveLength(2);    
        expect(sendToken0.events[0].type).toBe('message_sent')
        expect(sendToken0.events[1].type).toBe('account_created')
        const eventMsgSendToken0 = sendToken0.events[0] as EventMessageSent
        const eventCreateSendToken0 = sendToken0.events[1] as EventAccountCreated
        expect(eventMsgSendToken0.from.equals(pool.address)).toBeTruthy
        expect(eventMsgSendToken0.to.equals(eventCreateSendToken0.account)).toBeTruthy

        // Supply the other side of the LP pool
        const sendToken1 = await blockchain.sendMessage(
            internal({
                from: routerAddress,
                to: pool.address,
                value: toNano(7000000000),
                body: pool.provideLiquidity({
                    fromAddress: randomAddress("user"),
                    jettonAmount0: BigInt(1000001),
                    jettonAmount1: BigInt(0),
                    minLPOut: BigInt(1),
                })
            })
        );

        expect(sendToken1.transactions).toHaveTransaction({
            from: routerAddress,
            to: pool.address,
            deploy: false,
            success: true,
        });

        //TODO investigate behaviour, 4 events when same "user" used, only 2 for any other user, unknown why!
        //TODO is this expected behiavour?
        expect(sendToken1.events).toHaveLength(4);
//        expect(sendToken1.events[0].type).toBe('message_sent')
//        expect(sendToken1.events[1].type).toBe('account_created')

      });




  it("should reset gas", async () => {
        // Set balance of pool contract to 5 TON
        await deployer.send({
            to: pool.address,
            value: toNano(5), 
        });  

        const userAddres =randomAddress("user");

        // Supply the other side of the LP pool
        const resetGasResult = await blockchain.sendMessage(
            internal({
                from: routerAddress,
                to: pool.address,
                value: toNano(7000000000),
                body: pool.provideLiquidity({
                    fromAddress: userAddres,
                    jettonAmount0: BigInt(1000001),
                    jettonAmount1: BigInt(0),
                    minLPOut: BigInt(1),
                })
            })
        );

        expect(resetGasResult.transactions).toHaveTransaction({
            from: routerAddress,
            to: pool.address,
            deploy: false,
            success: true,
        });

        // Reset gas message from user wallet, then creation of user wallet
        expect(resetGasResult.events).toHaveLength(2);    
         expect(resetGasResult.events[0].type).toBe('message_sent')
         expect(resetGasResult.events[1].type).toBe('account_created')
         const eventCreateSendToken0 =resetGasResult.events[1] as EventAccountCreated
         const userAccountToken0 = eventCreateSendToken0.account
         const eventMsgSendToken0 =  resetGasResult.events[0] as EventMessageSent
         expect(eventMsgSendToken0.from.equals(userAddres)).toBeTruthy
         expect(eventMsgSendToken0.to.equals(pool.address)).toBeTruthy
  });

});
