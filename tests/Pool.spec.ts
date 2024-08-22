import { Blockchain, EventAccountCreated, EventMessageSent, SandboxContract, TreasuryContract, internal } from '@ton/sandbox';
import { Address, Cell, TupleItemSlice, beginCell, toNano } from '@ton/core';
import { Pool } from '../wrappers/Pool';
import { compile } from '@ton/blueprint';
import { getBlockchainPresetConfig, randomAddress } from './lib/helpers';

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

        deployPool();
    });

    async function deployPool():Promise<void>{
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
    }

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

        //TODO call the actual reset gas function!!!!

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
         expect(userAccountToken0.equals(userAccountToken0)).toBeTruthy
         const eventMsgSendToken0 =  resetGasResult.events[0] as EventMessageSent
         expect(eventMsgSendToken0.from.equals(userAddres)).toBeTruthy
         expect(eventMsgSendToken0.to.equals(pool.address)).toBeTruthy
  });

  
  it("should allow burning", async () => {
        // Set balance of pool contract to 5 TON
        await deployer.send({
            to: pool.address,
            value: toNano(5), 
        });  

        // Change the chain state
    blockchain.setConfig(getBlockchainPresetConfig());

    // Deploy a pool with different parameters
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
        reserve0: BigInt(10000),
        reserve1: BigInt(204030300),
        supplyLP: BigInt(1000),
        LPWalletCode: walletCode,
        LPAccountCode: accountCode
    }, poolCode));

    await deployPool();

    const userAddress = beginCell().storeAddress(randomAddress("user1")).endCell();
    const callWalletAddress = await blockchain.runGetMethod(pool.address,"get_wallet_address", [{ type: "slice", cell: Cell.fromBase64(userAddress.toBoc({ idx: false }).toString("base64")) }]);
    expect(callWalletAddress.exitCode).toBe(0);
    const userWalletAddress = (callWalletAddress.stack[0] as TupleItemSlice).cell?.beginParse().loadAddress();
    expect(userWalletAddress).toBeDefined

    // Internal message with incorrect parameter to burn tokens (expected to fail)
    const sendWrongAmount = await blockchain.sendMessage(
        internal({
            from: userWalletAddress,
            to: pool.address,
            value: toNano(70000000),
            body: pool.burnTokensNotification({
                fromAddress: randomAddress("user1"),
                jettonAmount: BigInt(0),
                responseAddress: null,
            })
        })
    );

    // The tx should failed and the only event should be the failed tx
    expect(sendWrongAmount.transactions).toHaveTransaction({
        from: userWalletAddress,
        to: pool.address,
        deploy: false,
        success: false,
    });
    expect(sendWrongAmount.events).toHaveLength(1);    
    expect(sendWrongAmount.events[0].type).toBe('message_sent')

    // Internal message to burn tokens
    const burnTokensResult = await blockchain.sendMessage(
        internal({
            from: userWalletAddress,
            to: pool.address,
            value: toNano(1),
            body: pool.burnTokensNotification({
                fromAddress: randomAddress("user1"),
                jettonAmount: BigInt(100),
                responseAddress: userWalletAddress,
            })
        })
    );

    expect(burnTokensResult.transactions).toHaveTransaction({
        from: userWalletAddress,
        to: pool.address,
        deploy: false,
        success: true
    });

    expect(burnTokensResult.events.length).toBe(2)
    
    expect(burnTokensResult.events[0].type).toBe('message_sent')
    const initiationMsg = burnTokensResult.events[0] as EventMessageSent
    expect(initiationMsg.from.equals(pool.address))
    expect(initiationMsg.to.equals(userWalletAddress))

    expect(burnTokensResult.events[1].type).toBe('message_sent')
    const burnMsg = burnTokensResult.events[1] as EventMessageSent
    expect(burnMsg.from.equals(pool.address))
    expect(burnMsg.to.equals(routerAddress))


    // Check the balances after the burning
    const callPoolData = await blockchain.runGetMethod(pool.address,"get_pool_data", []);
    const reserve0  = callPoolData.stackReader.readBigNumber()
    expect( reserve0 < BigInt(10000)).toBe(true);
    const reserve1  = callPoolData.stackReader.readBigNumber()
    expect( reserve1 < BigInt(204030300)).toBe(true);
  });


});
