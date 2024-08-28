import { Blockchain, EventAccountCreated, EventMessageSent, SandboxContract, TreasuryContract, internal, printTransactionFees } from '@ton/sandbox';
import { Address, Cell, TupleItemInt, TupleItemSlice, beginCell, toNano } from '@ton/core';
import { Pool } from '../wrappers/Pool';
import { compile } from '@ton/blueprint';
import { randomAddress, zeroAddress } from './lib/address_generator';
import { getBlockchainPresetConfig } from './lib/blockchain_config';

/** Import the TON matchers */
import "@ton/test-utils";
import { parseUri } from './lib/hex_parser';

describe('Pool', () => {
    let poolCode: Cell;
    let walletCode: Cell;
    let accountCode: Cell;
    let routerAddress: Address;
    let walletOneAddress: Address;
    let walletZeroAddress: Address;

    beforeAll(async () => {
        poolCode = await compile('Pool');
        walletCode = await compile('LpWallet');
        accountCode = await compile('LpAccount');
        walletZeroAddress = randomAddress("wallet0")
        walletOneAddress = randomAddress("wallet1")
        routerAddress = randomAddress("a valid pool");
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let pool: SandboxContract<Pool>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        pool = blockchain.openContract(Pool.createFromConfig({        
            routerAddress: routerAddress,
            lpFee: BigInt(20),
            protocolFee: BigInt(0),
            refFee: BigInt(10),
            protocolFeesAddress: randomAddress("a valid protocol fee address"),
            collectedTokenAProtocolFees: BigInt(0),
            collectedTokenBProtocolFees: BigInt(0),
            wallet0: walletZeroAddress,
            wallet1: walletOneAddress,
            reserve0: BigInt(0),
            reserve1: BigInt(0),
            supplyLP: BigInt(0),
            LPWalletCode: walletCode,
            LPAccountCode: accountCode
        }, poolCode));

        deployer = await blockchain.treasury('deployer');

        await deployPool();
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

        const deployEventMsg = deployResult.events[0] as EventMessageSent
        expect(deployEventMsg.from).toEqualAddress(deployer.address)
        expect(deployEventMsg.to).toEqualAddress(pool.address)        
        const createEventMsg = deployResult.events[1] as EventAccountCreated
        expect(createEventMsg.account).toEqualAddress(pool.address)
    }

    it('should deploy', async () => {
        expect(blockchain).toBeDefined;
        expect(pool).toBeDefined;
        expect(pool.address).toBeDefined;
    });

    it("should mint lp tokens", async () => {
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
            success: true,
        });

        // Assignment of LP tokens to user wallet, then creation of user wallet
        expect(sendToken0.events).toHaveLength(2);    
        expect(sendToken0.events[0].type).toBe('message_sent')
        expect(sendToken0.events[1].type).toBe('account_created')
        const eventMsgSendToken0 = sendToken0.events[0] as EventMessageSent
        const eventCreateSendToken0 = sendToken0.events[1] as EventAccountCreated
        expect(eventMsgSendToken0.from).toEqualAddress(pool.address)
        expect(eventMsgSendToken0.to).toEqualAddress(eventCreateSendToken0.account)

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
            success: true,
        });

        //TODO investigate behaviour, 4 events when same "user" used, only 2 for any other user, unknown why!
        //TODO is this expected behiavour?
        expect(sendToken1.events).toHaveLength(4);
//        expect(sendToken1.events[0].type).toBe('message_sent')
//        expect(sendToken1.events[1].type).toBe('account_created')

      });

  it("should reset gas", async () => {
    await deployer.send({
            to: pool.address,
            value: toNano(5), 
        });  

        // Reset the gas
        const resetGasResult = await blockchain.sendMessage(
            internal({
                from: routerAddress,
                to: pool.address,
                value: toNano(70000000),
                body: pool.resetGas()
            })
        );

        expect(resetGasResult.transactions).toHaveTransaction({
            from: routerAddress,
            to: pool.address,
            success: true,
        });

        expect(resetGasResult.events).toHaveLength(2);    
         expect(resetGasResult.events[0].type).toBe('message_sent')
         expect(resetGasResult.events[1].type).toBe('message_sent')

         const eventMsgSendToken0 =resetGasResult.events[0] as EventMessageSent
         expect(eventMsgSendToken0.from).toEqualAddress(pool.address)
         expect(eventMsgSendToken0.to).toEqualAddress(routerAddress)
         const eventMsgSendToken1 =  resetGasResult.events[1] as EventMessageSent
         expect(eventMsgSendToken1.from).toEqualAddress(routerAddress)
         expect(eventMsgSendToken1.to).toEqualAddress(pool.address)
  });

  
  it("should allow burning", async () => {
        await deployer.send({
            to: pool.address,
            value: toNano(5), 
        });  

// TODO setup the Jettison contracts and state in the sandbox, loading and setting the Blockchain config takes a serious amount of time!

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
        wallet0: walletZeroAddress,
        wallet1: walletOneAddress,
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


  it("should allow collecting fees", async () => {
        await deployer.send({
            to: pool.address,
            value: toNano(5), 
        });  

        // Change the chain state
    blockchain.setConfig(getBlockchainPresetConfig());

        // Deploy a pool with different parameters, fees and an invalid address
        pool = blockchain.openContract(Pool.createFromConfig({        
            routerAddress: routerAddress,
            lpFee: BigInt(20),
            protocolFee: BigInt(0),
            refFee: BigInt(10),
            protocolFeesAddress: zeroAddress,
            collectedTokenAProtocolFees: BigInt(110),
            collectedTokenBProtocolFees: BigInt(440),
            wallet0: walletZeroAddress,
            wallet1: walletOneAddress,
            reserve0: BigInt(1310),
            reserve1: BigInt(203333),
            supplyLP: BigInt(10000000),
            LPWalletCode: walletCode,
            LPAccountCode: accountCode
        }, poolCode));
    
        await deployPool();


    // Internal message to collect fees that fails to collect fee
    const sendCollectFeesNoFeeAddress = await blockchain.sendMessage(
        internal({
            from: routerAddress,
            to: pool.address,
            value: toNano(0.5),
            body: pool.collectFees()
            })
    );

    expect(sendCollectFeesNoFeeAddress.transactions).toHaveTransaction({
        from: routerAddress,
        to: pool.address,
        success: false
    });


        // Deploy a pool with different parameters, fees with valid addres
        pool = blockchain.openContract(Pool.createFromConfig({        
            routerAddress: routerAddress,
            lpFee: BigInt(20),
            protocolFee: BigInt(0),
            refFee: BigInt(10),
            protocolFeesAddress: randomAddress("a valid protocol fee address"),
            collectedTokenAProtocolFees: BigInt(110),
            collectedTokenBProtocolFees: BigInt(440),
            wallet0: walletZeroAddress,
            wallet1: walletOneAddress,
            reserve0: BigInt(1310),
            reserve1: BigInt(203333),
            supplyLP: BigInt(10000000),
            LPWalletCode: walletCode,
            LPAccountCode: accountCode
        }, poolCode));
    
        await deployPool();

            // Internal message to collect fees that collects the fee
            const sendCollectFees = await blockchain.sendMessage(
                internal({
                    from: routerAddress,
                    to: pool.address,
                    value: toNano(0.5),
                    body: pool.collectFees()
                    })
            );
        
            expect(sendCollectFees.transactions).toHaveTransaction({
                from: routerAddress,
                to: pool.address,
                deploy: false,
                success: true
            });

            expect(sendCollectFees.events.length).toBe(1)
            expect(sendCollectFees.events[0].type).toBe('message_sent')
            const initiationMsg = sendCollectFees.events[0] as EventMessageSent
            expect(initiationMsg.from).toEqualAddress(pool.address)
            expect(initiationMsg.to).toEqualAddress(routerAddress)

            // Should be collecting fees of 440 TokenB 
            let sendSwapRefs = initiationMsg.body.refs[0].beginParse()
            sendSwapRefs.skip(4 + 4 + 4);
            sendSwapRefs.loadAddress();
            expect(sendSwapRefs.loadCoins()).toBe(BigInt(440));

            // Zero Fees should now remain
            const callPoolData = await blockchain.runGetMethod(pool.address,"get_pool_data", []);
            expect(        (callPoolData.stack[8] as TupleItemInt).value).toBe(BigInt(0))
            expect(        (callPoolData.stack[9] as TupleItemInt).value).toBe(BigInt(0))

        // Deploy a pool with different parameters, big fees with valid addres
    pool = blockchain.openContract(Pool.createFromConfig({        
        routerAddress: routerAddress,
        lpFee: BigInt(20),
        protocolFee: BigInt(0),
        refFee: BigInt(10),
        protocolFeesAddress: randomAddress("a valid protocol fee address"),
        collectedTokenAProtocolFees: BigInt(11000000000000),
        collectedTokenBProtocolFees: BigInt(4400000000000000),
        wallet0: walletZeroAddress,
        wallet1: walletOneAddress,
        reserve0: BigInt(1310),
        reserve1: BigInt(203333),
        supplyLP: BigInt(10000000),
        LPWalletCode: walletCode,
        LPAccountCode: accountCode
    }, poolCode));

    await deployPool();

    // Too low Gas should fail
    const userAddress = randomAddress("user")
    const sendCollectFeesLowGas = await blockchain.sendMessage(
        internal({
            from: userAddress,
            to: pool.address,
            value: toNano(0.5),
            body: pool.collectFees()
            })
    );

    expect(sendCollectFeesLowGas.transactions).toHaveTransaction({
        from: userAddress,
        to: pool.address,
        success: false
    });

        // Adequate Gas should pass
        const sendCollectFeesWithRewards = await blockchain.sendMessage(
            internal({
                from: userAddress,
                to: pool.address,
                value: toNano(1.2),
                body: pool.collectFees()
                })
        );
    
        expect(sendCollectFeesWithRewards.transactions).toHaveTransaction({
            from: userAddress,
            to: pool.address,
            success: true
        });


        expect(sendCollectFeesWithRewards.events.length).toBe(2)

        //TODO check the balances for available fees
        //TODO check "a valid protocol fee address" received the fees
  });


  it("should allow swapping", async () => {
    let protocolFeesAddress = randomAddress("another valid protocol address");
    
        await deployer.send({
            to: pool.address,
            value: toNano(5), 
        });  

        // Deploy a pool with different parameters: big zero fees, valid addres, 1:1 asset balance
        pool = blockchain.openContract(Pool.createFromConfig({        
            routerAddress: routerAddress,
            lpFee: BigInt(20),
            protocolFee: BigInt(0),
            refFee: BigInt(10),
            protocolFeesAddress: randomAddress("a valid protocol fee address"),
            collectedTokenAProtocolFees: BigInt(0),
            collectedTokenBProtocolFees: BigInt(0),
            wallet0: walletZeroAddress,
            wallet1: walletOneAddress,
            reserve0: BigInt(1000000000000000),
            reserve1: BigInt(1000000000000000),
            supplyLP: BigInt(10000000),
            LPWalletCode: walletCode,
            LPAccountCode: accountCode
        }, poolCode));

        await deployPool();

        const sendChangeFees = await blockchain.sendMessage(
            internal({
                from: routerAddress,
                to: pool.address,
                value: toNano(0.1),
                body: pool.setFees({
                    newLPFee: BigInt(100),
                    newProtocolFees: BigInt(0),
                    newRefFee: BigInt(10),
                    newProtocolFeeAddress: protocolFeesAddress,
                  }),
                })
        )

        expect(sendChangeFees.transactions).toHaveTransaction({
            from: routerAddress,
            to: pool.address,
            success: true
        });

        const callPoolData = await blockchain.runGetMethod(pool.address,"get_pool_data", []);
        expect(        (callPoolData.stack[4] as TupleItemInt).value).toBe(BigInt(100))
        expect(        (callPoolData.stack[5] as TupleItemInt).value).toBe(BigInt(0))
        expect(        (callPoolData.stack[6] as TupleItemInt).value).toBe(BigInt(10))
        
const callGetOutputs = await blockchain.runGetMethod( pool.address,"get_expected_outputs", [
      { type: "int", value: BigInt(20000000000) },
      { type: "slice", cell: beginCell().storeAddress(walletZeroAddress).endCell()}
    ]);

    const expectedSwapWallet0  = (callGetOutputs.stack[0] as TupleItemInt).value;
    expect(expectedSwapWallet0).toBe(BigInt(19799607967));

    // Invalid sender (unpermisioned) should fail
    const sendSwapWrongSender = await blockchain.sendMessage(
        internal({
            from: randomAddress(""),
            to: pool.address,
            value: toNano(0.1),
            body: pool.swap({
                fromAddress: randomAddress("user1"),
                jettonAmount: BigInt(20000000000),
                tokenWallet: walletOneAddress,
                toAddress: randomAddress("user1"),
                minOutput: BigInt(200),
              }),
            })
    );

    expect(sendSwapWrongSender.transactions).toHaveTransaction({
        from: randomAddress(""),
        to: pool.address,
        success: false
    });


    // Permissioned sender should be able to swap
    const sendSwap = await blockchain.sendMessage(
        internal({
            from: routerAddress,
            to: pool.address,
            value: toNano(0.1),
            body: pool.swap({
                fromAddress: randomAddress("user1"),
                jettonAmount: BigInt(20000000000),
                tokenWallet: walletZeroAddress,
                toAddress: randomAddress("user1"),
                minOutput: BigInt(200),
              }),
            })
    );

    expect(sendSwap.transactions).toHaveTransaction({
        from: routerAddress,
        to: pool.address,
        success: true
    });

    expect(sendSwap.events.length).toBe(1)
    expect(sendSwap.events[0].type).toBe('message_sent')
    const sensSwaptMsg = sendSwap.events[0] as EventMessageSent
    expect(sensSwaptMsg.from.equals(pool.address))
    expect(sensSwaptMsg.to.equals(routerAddress))

    let sendSwapRefs = sensSwaptMsg.body.refs[0].beginParse()
    sendSwapRefs.loadCoins();
    sendSwapRefs.loadAddress();
    let receivedToken = sendSwapRefs.loadCoins();
    expect(receivedToken).toBe(expectedSwapWallet0);


    // After performing a swap, the expected output for the same swap should be lower
    const expectedOutputsAfterSwap = await blockchain.runGetMethod(pool.address,"get_expected_outputs", [
        { type: "int", value: BigInt(20000000000) },
        { type: "slice", cell: beginCell().storeAddress(walletZeroAddress).endCell()},
      ]);

      const expectedWallet0AfterSwap  = (expectedOutputsAfterSwap.stack[0] as TupleItemInt).value;
      expect(expectedWallet0AfterSwap).toBeLessThan(receivedToken);
  });

  it("should send back token when reject swap", async () => {
    await deployer.send({
        to: pool.address,
        value: toNano(5), 
    });  

        // Deploy a pool with different parameters: big zero fees, valid addres, 1:1 asset balance
        pool = blockchain.openContract(Pool.createFromConfig({        
            routerAddress: routerAddress,
            lpFee: BigInt(20),
            protocolFee: BigInt(0),
            refFee: BigInt(10),
            protocolFeesAddress: randomAddress("a valid protocol fee address"),
            collectedTokenAProtocolFees: BigInt(0),
            collectedTokenBProtocolFees: BigInt(0),
            wallet0: walletZeroAddress,
            wallet1: walletOneAddress,
            reserve0: BigInt(1000),
            reserve1: BigInt(10000),
            supplyLP: BigInt(0),
            LPWalletCode: walletCode,
            LPAccountCode: accountCode
        }, poolCode));

        await deployPool();

        // Swap message with unacceptable output expected (should be rejected)
        const sendSwap = await blockchain.sendMessage(
            internal({
                from: routerAddress,
                to: pool.address,
                value: toNano(0.1),
                body: pool.swap({
                    fromAddress: randomAddress("user1"),
                    jettonAmount: BigInt(20),
                    tokenWallet: walletOneAddress,
                    toAddress: randomAddress("user1"),
                    minOutput: BigInt(20000000),
                  }),
                })
        );

        
        expect(sendSwap.transactions).toHaveTransaction({
            from: routerAddress,
            to: pool.address,
            success: true
        });

        expect(sendSwap.events.length).toBe(1)
        expect(sendSwap.events[0].type).toBe('message_sent')
        const swapMsg = sendSwap.events[0] as EventMessageSent
        expect(swapMsg.from).toEqualAddress(pool.address)
        expect(swapMsg.to).toEqualAddress(routerAddress)

        let sendSwapRefs = swapMsg.body.refs[0].beginParse()
    expect(sendSwapRefs.loadCoins()).toBe(0n);
    expect(sendSwapRefs.loadAddress()).toEqualAddress(walletZeroAddress)
    expect(sendSwapRefs.loadCoins()).toBe(20n);
    expect(sendSwapRefs.loadAddress()).toEqualAddress(walletOneAddress)

  });

  it("should swap with referall", async () => {
    await deployer.send({
        to: pool.address,
        value: toNano(5), 
    });  

        // Change the chain state
        blockchain.setConfig(getBlockchainPresetConfig());


        // Deploy a pool with different parameters: big zero fees, valid addres, 1:1 asset balance
        pool = blockchain.openContract(Pool.createFromConfig({        
            routerAddress: routerAddress,
            lpFee: BigInt(20),
            protocolFee: BigInt(0),
            refFee: BigInt(10),
            protocolFeesAddress: randomAddress("a valid protocol fee address"),
            collectedTokenAProtocolFees: BigInt(0),
            collectedTokenBProtocolFees: BigInt(0),
            wallet0: walletZeroAddress,
            wallet1: walletOneAddress,
            reserve0: BigInt("1000000000000000000000000000000000"),
            reserve1: BigInt("1000000000000000000000000000000000"),
            supplyLP: BigInt(100000),
            LPWalletCode: walletCode,
            LPAccountCode: accountCode
        }, poolCode));

        await deployPool();

        // Swap internal message, with any output acceptable and ref address
        const sendSwap = await blockchain.sendMessage(
            internal({
                from: routerAddress,
                to: pool.address,
                value: toNano(1),
                body: pool.swap({
                    fromAddress: randomAddress("user1"),
                    jettonAmount: BigInt(20000),
                    tokenWallet: walletOneAddress,
                    toAddress: randomAddress("user1"),
                    minOutput: BigInt(0),
                    hasRef: true,
                    refAddress: randomAddress("ref")
                  }),
                })
        );

        
        expect(sendSwap.transactions).toHaveTransaction({
            from: routerAddress,
            to: pool.address,
            success: true
        });

        expect(sendSwap.events.length).toBe(2)
        expect(sendSwap.events[0].type).toBe('message_sent')
        expect(sendSwap.events[1].type).toBe('message_sent')

        const msgOutUser = sendSwap.events[1] as EventMessageSent
        expect(msgOutUser.from).toEqualAddress(pool.address)
        expect(msgOutUser.to).toEqualAddress(routerAddress)

        const msgOutRef = sendSwap.events[0] as EventMessageSent
        expect(msgOutRef.from).toEqualAddress(pool.address)
        expect(msgOutRef.to).toEqualAddress(routerAddress)

        let tokenOutUserRefs = msgOutUser.body.refs[0].beginParse()
    expect(tokenOutUserRefs.loadCoins()).toBe(BigInt(19939));
    expect(tokenOutUserRefs.loadAddress()).toEqualAddress(walletZeroAddress)


    let tokenRefOutRefs = msgOutRef.body.refs[0].beginParse()
    expect(tokenRefOutRefs.loadCoins()).toBe(BigInt(20));
    expect(tokenRefOutRefs.loadAddress()).toEqualAddress(walletZeroAddress);
  });

  
  it("should generate a valid jetton URI", async () => {
    const expectedAddress = pool.address.toRawString().toUpperCase()

    const callPoolData = await blockchain.runGetMethod(pool.address,"get_jetton_data", []);
    expect(callPoolData.exitCode).toBe(0);

      const expectedUri  = parseUri((callPoolData.stack[3] as TupleItemSlice).cell);
    expect(expectedUri).toBe("https://lp.ston.fi/" + expectedAddress + ".json");
  });

});
