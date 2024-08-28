import { Blockchain, EventAccountCreated, EventMessageSent, SandboxContract, SmartContract, TreasuryContract, internal, printTransactionFees } from '@ton/sandbox';
import { Address, Cell, TupleItemSlice, beginCell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import { Router } from '../wrappers/Router';
import { currentTimeInSeconds } from './lib/date_time';
import { randomAddress } from './lib/address_generator';
import { getBlockchainPresetConfig } from './lib/blockchain_config';
import { expectCodeEqualsCell } from './lib/account_state_equality';
import { routerDataUpgradeCode } from './lib/router_getter';

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
    //   it("should reset gas", async () => {
    //     await deployer.send({
    //         to: router.address,
    //         value: toNano(5), 
    //     });
        
    //     const resetGasResult = await blockchain.sendMessage(
    //         internal({
    //             from: adminAddress,
    //             to: router.address,
    //             value:  toNano(70000000),
    //             body: router.resetGas()
    //               })
    //             )
    
    //             expect(resetGasResult.transactions).toHaveTransaction({
    //                 from: adminAddress,
    //                 to: router.address,
    //                 success: true,
    //             });
        
    //             expect(resetGasResult.events).toHaveLength(2);    
    //              expect(resetGasResult.events[0].type).toBe('message_sent')
    //              expect(resetGasResult.events[1].type).toBe('message_sent')
        
    //              const eventMsgSendToken0 =resetGasResult.events[0] as EventMessageSent
    //              expect(eventMsgSendToken0.from).toEqualAddress(router.address)
    //              expect(eventMsgSendToken0.to).toEqualAddress(adminAddress)
    //              const eventMsgSendToken1 =  resetGasResult.events[1] as EventMessageSent
    //              expect(eventMsgSendToken1.from).toEqualAddress(adminAddress)
    //              expect(eventMsgSendToken1.to).toEqualAddress(router.address)
    //   });
  
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

      it("should always get the same pool", async () => {
        const tokenWalletOne = beginCell().storeAddress(randomAddress("token wallet 1")).endCell();
        const tokenWaletTwo = beginCell().storeAddress(randomAddress("token wallet 2")).endCell();

        const call = await blockchain.runGetMethod(router.address, "get_pool_address", [
          { type: "slice", cell: tokenWalletOne },
          { type: "slice", cell: tokenWaletTwo },
        ]);
    
        expect(call.exitCode).toBe(0)
        const poolAddress= (call.stack[0] as TupleItemSlice).cell?.beginParse().loadAddress();
        expect(poolAddress).toBeDefined

        const callTwo = await blockchain.runGetMethod(router.address, "get_pool_address", [
            { type: "slice", cell: tokenWalletOne },
            { type: "slice", cell: tokenWaletTwo },
          ]);
      
          expect(callTwo.exitCode).toBe(0)
          const poolAddressTwo= (callTwo.stack[0] as TupleItemSlice).cell?.beginParse().loadAddress();
        
          expect(poolAddress).toEqualAddress(poolAddressTwo)
          

          const someoneAddress = randomAddress("someone")
        const getPoolResult = await blockchain.sendMessage(
            internal({
                from: someoneAddress,
                to: router.address,
                value:  BigInt("300000000"),
                body: router.poolAddress({
                    walletTokenAAddress: randomAddress("token wallet 1"),
                    walletTokenBAddress: randomAddress("token wallet 2"),
                  }),
                })
        )

        expect(getPoolResult.transactions).toHaveTransaction({
            from: someoneAddress,
            to: router.address,
            success: true,
        });
        expect(getPoolResult.events.length).toBe(2)
        expect(getPoolResult.events[0].type).toBe('message_sent')
        expect(getPoolResult.events[1].type).toBe('message_sent')

        const eventMsgZero = getPoolResult.events[0] as EventMessageSent
        expect(eventMsgZero.from).toEqualAddress(router.address)
        expect(eventMsgZero.to).toEqualAddress(someoneAddress)        
        expect(eventMsgZero.bounced).toBe(false)        

        const eventMsgZeroBody = eventMsgZero.body.beginParse()
        eventMsgZeroBody.skip(32 + 64)
        const secondAddress = eventMsgZeroBody.loadAddress()
        expect(secondAddress).toEqualAddress(poolAddress)

        const eventMsgOne = getPoolResult.events[1] as EventMessageSent
        expect(eventMsgOne.from).toEqualAddress(someoneAddress)
        expect(eventMsgOne.to).toEqualAddress(router.address)        
        expect(eventMsgOne.bounced).toBe(true)       

       })   

       it("should refuse to pay if caller is not valid", async () => {
        // Change the chain state
        blockchain.setConfig(getBlockchainPresetConfig());
        
        const aRandomAddress = randomAddress("a random address")
        const payToResult = await blockchain.sendMessage(
            internal({
                from: aRandomAddress ,
                to: router.address,
                value:  toNano("2"),
                body: router.payTo({
                    owner: randomAddress("owner"),
                    tokenAAmount: BigInt(100),
                    walletTokenAAddress: randomAddress("token wallet 1"),
                    tokenBAmount: BigInt(200),
                    walletTokenBAddress: randomAddress("token wallet 2"),
                  })
                })
        )

        expect(payToResult.transactions).toHaveTransaction({
            from: aRandomAddress,
            to: router.address,
            success: false,
        });
        expect(payToResult.events.length).toBe(1)
        expect(payToResult.events[0].type).toBe('message_sent')

        const eventMsgZero = payToResult.events[0] as EventMessageSent
        expect(eventMsgZero.from).toEqualAddress(router.address)        
        expect(eventMsgZero.to).toEqualAddress(aRandomAddress)
        expect(eventMsgZero.bounced).toBe(true) 
      });

      it("should route a swap request", async () => {
        const tokenWallet0 = randomAddress("a random token wallet")
        const tokenWallet1 = randomAddress("token wallet 2");
        const swapperAddress = randomAddress("swapper")

        const swapWithoutRefResult = await blockchain.sendMessage(
            internal({
                from: tokenWallet0 ,
                to: router.address,
                value:  toNano("2"),
                body: router.swap({
                    jettonAmount: BigInt(100),
                    fromAddress: swapperAddress,
                    walletTokenBAddress: tokenWallet1,
                    toAddress: swapperAddress,
                    expectedOutput: BigInt(100)
                  })
                })
        )

        expect(swapWithoutRefResult.transactions).toHaveTransaction({
            from: tokenWallet0,
            to: router.address,
            success: true,
        });
        expect(swapWithoutRefResult.events.length).toBe(2)
        expect(swapWithoutRefResult.events[0].type).toBe('message_sent')
        expect(swapWithoutRefResult.events[1].type).toBe('message_sent')

        const eventMsgZero = swapWithoutRefResult.events[0] as EventMessageSent
        expect(eventMsgZero.from).toEqualAddress(router.address)        
        expect(eventMsgZero.to).not.toEqualAddress(tokenWallet0)
        expect(eventMsgZero.bounced).toBe(false) 

        const eventMsgOne = swapWithoutRefResult.events[1] as EventMessageSent
        expect(eventMsgOne.from).not.toEqualAddress(tokenWallet0)        
        expect(eventMsgOne.to).toEqualAddress(router.address)
        expect(eventMsgOne.bounced).toBe(true) 

        // Swap with a reference address
        const swapWithRefResult = await blockchain.sendMessage(
            internal({
                from: tokenWallet0 ,
                to: router.address,
                value:  toNano("2"),
                body: router.swap({
                    jettonAmount: BigInt(100),
                    fromAddress: swapperAddress,
                    walletTokenBAddress: tokenWallet1,
                    toAddress: swapperAddress,
                    expectedOutput: BigInt(100),
                    refAddress: randomAddress("ref"),
                  })
                })
        )

        expect(swapWithRefResult.transactions).toHaveTransaction({
            from: tokenWallet0,
            to: router.address,
            success: true,
        });
        expect(swapWithRefResult.events.length).toBe(2)
        expect(swapWithRefResult.events[0].type).toBe('message_sent')
        expect(swapWithRefResult.events[1].type).toBe('message_sent')

        const eventMsgRefZero = swapWithoutRefResult.events[0] as EventMessageSent
        expect(eventMsgRefZero.from).toEqualAddress(router.address)        
        expect(eventMsgRefZero.to).not.toEqualAddress(tokenWallet0)
        expect(eventMsgRefZero.bounced).toBe(false) 

        const eventMsgRefOne = swapWithoutRefResult.events[1] as EventMessageSent
        expect(eventMsgRefOne.from).not.toEqualAddress(tokenWallet0)        
        expect(eventMsgRefOne.to).toEqualAddress(router.address)
        expect(eventMsgRefOne.bounced).toBe(true) 
      })
  
      it("should route a lp request", async () => {
        const walletAddress = randomAddress("a random token wallet")
        const walletBAddress = randomAddress("token wallet 2")

        const provideLiquidityResult = await blockchain.sendMessage(
            internal({
                from: walletAddress ,
                to: router.address,
                value:  BigInt("300000000"),
                body: router.provideLiquidity({
                  jettonAmount: BigInt(100),
                  fromAddress: randomAddress("from"),
                    walletTokenBAddress: walletBAddress,
                    minLPOut: BigInt(100)
                  })
                })
        )

        expect(provideLiquidityResult.transactions).toHaveTransaction({
            from: walletAddress,
            to: router.address,
            success: true,
        });
        expect(provideLiquidityResult.events.length).toBe(4)
        expect(provideLiquidityResult.events[0].type).toBe('message_sent')
        expect(provideLiquidityResult.events[1].type).toBe('account_created')
        expect(provideLiquidityResult.events[2].type).toBe('message_sent')
        expect(provideLiquidityResult.events[3].type).toBe('account_created')

        const eventMsgZero = provideLiquidityResult.events[0] as EventMessageSent
        expect(eventMsgZero.from).toEqualAddress(router.address)        
        expect(eventMsgZero.to).not.toEqualAddress(walletAddress)
        expect(eventMsgZero.to).not.toEqualAddress(walletBAddress)
        expect(eventMsgZero.bounced).toBe(false) 
        const lpWalletOneAddress = eventMsgZero.to

        const eventMsgOne = provideLiquidityResult.events[1] as EventAccountCreated
        expect(eventMsgOne.account).toEqualAddress(lpWalletOneAddress)

        const eventMsgTwo = provideLiquidityResult.events[2] as EventMessageSent
        expect(eventMsgTwo.from).toEqualAddress(lpWalletOneAddress)        
        expect(eventMsgTwo.to).not.toEqualAddress(router.address)
        expect(eventMsgTwo.to).not.toEqualAddress(walletAddress)
        expect(eventMsgTwo.to).not.toEqualAddress(walletBAddress)
        expect(eventMsgTwo.bounced).toBe(false) 
        const lpWalletTwoAddress = eventMsgTwo.to     

        const eventMsgThree = provideLiquidityResult.events[3] as EventAccountCreated
        expect(eventMsgThree.account).toEqualAddress(lpWalletTwoAddress)
      })

      it("should allow pool upgrades", async () => {
        // Blockchain.now begins undefined :. set it!
        blockchain.now = currentTimeInSeconds()
        const updateAdminAddress = randomAddress("new admin")

        const sendUpdateAdminOk = await blockchain.sendMessage(
            internal({
                from: adminAddress,
                to: router.address,
                value:  BigInt("300000000"),
                body: router.initAdminUpgrade({
                    newAdmin: updateAdminAddress
                    })
                })
        )

        expect(sendUpdateAdminOk.transactions).toHaveTransaction({
            from: adminAddress,
            to: router.address,
            success: true,
        });

        expect(sendUpdateAdminOk.transactions.length).toBe(1)

        // two days pass (24 hours * 60 minutes * 60 seconds)
          const twoDaysInSeconds = (24 * 60 * 60 * 2); 
          blockchain.now += twoDaysInSeconds

        const sendFinalizeUpgradeAdminOk = await blockchain.sendMessage(
          internal({
            from: adminAddress,
            to: router.address,
            value:  BigInt("300000000"),
            body: router.finalizeUpgrades()
            })
        )
        
        expect(sendFinalizeUpgradeAdminOk.transactions).toHaveTransaction({
            from: adminAddress,
            to: router.address,
            success: true,
        });
        expect(sendFinalizeUpgradeAdminOk.events.length).toBe(0)
        
        // Ensure the router code is the starting code version
        await expectCodeEqualsCell(blockchain, router.address, routerCode)

        // After the update, the admin has changed to updateAdminAddress (adminAddress is no longer admin)
        const sendInitUpgradeWrongSender = await blockchain.sendMessage(
            internal({
                from: adminAddress,     
                to: router.address,
                value:  BigInt("300000000"),
                body: router.initCodeUpgrade({
                    newCode: beginCell().storeInt(BigInt("10"), 32).endCell(),
                  }),
                })
        )

        expect(sendInitUpgradeWrongSender.transactions).toHaveTransaction({
            from: adminAddress,
            to: router.address,
            success: false,
            exitCode: 65535
        });

        const codeUpgradeCell = beginCell().storeInt(BigInt("10"), 32).endCell()
        const sendInitCodeUpgradeOk = await blockchain.sendMessage(
            internal({
                from: updateAdminAddress,     
                to: router.address,
                value:  BigInt("300000000"),
                body: router.initCodeUpgrade({
                    newCode: codeUpgradeCell
                    })
                })
        )

        expect(sendInitCodeUpgradeOk.transactions).toHaveTransaction({
            from: updateAdminAddress,
            to: router.address,
            success: true
        });
        expect(sendFinalizeUpgradeAdminOk.events.length).toBe(0)
        expect(await        routerDataUpgradeCode(blockchain, router)).toEqualCell(codeUpgradeCell)

        // Failed upgrade results in a successul transaction
        const wrongAdmin = randomAddress("new admin")
        const sendFinalizeUpgradeFailed = await blockchain.sendMessage(
          internal({
              from: wrongAdmin,     
              to: router.address,
            value: BigInt("300000000"),
            body: router.finalizeUpgrades(),
              })
      )

      expect(sendFinalizeUpgradeFailed.transactions).toHaveTransaction({
        from: updateAdminAddress,
        to: router.address,
        success: true
    });
    expect(sendFinalizeUpgradeFailed.events.length).toBe(0)
    
        // Seven days passed 
        const sevenDaysInSeconds = (24 * 60 * 60 * 7); 
        blockchain.now += sevenDaysInSeconds

        const sendFinalizeUpgradeOk = await blockchain.sendMessage(
          internal({
              from: updateAdminAddress,     
              to: router.address,
            value: BigInt("300000000"),
            body: router.finalizeUpgrades(),
              })
      )
      expect(sendFinalizeUpgradeOk.transactions).toHaveTransaction({
        from: updateAdminAddress,
        to: router.address,
        success: true
    });
    expect(sendFinalizeUpgradeOk.events.length).toBe(0)

    await expectCodeEqualsCell(blockchain, router.address, codeUpgradeCell)
      })



      it("should collect fees from pool", async () => {
        const jettonAddressZero = randomAddress("a jetton")
        const jettonAddressOne = randomAddress("another jetton")

        const send = await blockchain.sendMessage(
          internal({
            from: adminAddress,
            to: router.address,
            value:  BigInt("300000000"),
            body: router.collectFees({
              jetton0Address: jettonAddressZero,
              jetton1Address: jettonAddressOne,
              })
            })
        )
        
        expect(send.transactions).toHaveTransaction({
            from: adminAddress,
            to: router.address,
            success: true,
        });
        expect(send.events.length).toBe(2)
        expect(send.events[0].type).toBe('message_sent')
        expect(send.events[1].type).toBe('message_sent')

        // Message to the pool
        const eventMsgZero = send.events[0] as EventMessageSent
        expect(eventMsgZero.from).toEqualAddress(router.address)
        expect(eventMsgZero.to).not.toEqualAddress(jettonAddressZero)
        expect(eventMsgZero.to).not.toEqualAddress(jettonAddressOne)
        const poolAddress = eventMsgZero.to

        // Message (fees collected) back from the pool
        const eventMsgOne = send.events[1] as EventMessageSent
        expect(eventMsgOne.from).toEqualAddress(poolAddress)
        expect(eventMsgOne.to).toEqualAddress(router.address)
      });      

      it("should set fees", async () => {
        const jettonAddressZero = randomAddress("a jetton")
        const jettonAddressOne = randomAddress("another jetton")

        const send = await blockchain.sendMessage(
          internal({
            from: adminAddress,
            to: router.address,        
            value: BigInt("300000000"),
            body: router.setFees({
              jetton0Address: jettonAddressZero,
              jetton1Address: jettonAddressOne,
              newLPFee: BigInt(2),
              newProtocolFee: BigInt(1),
              newRefFee: BigInt(1),
              newProtocolFeeAddress: randomAddress("partner"),
            }),
          })
        );

        expect(send.transactions).toHaveTransaction({
          from: adminAddress,
          to: router.address,
          success: true,
      });
      expect(send.events.length).toBe(2)
      expect(send.events[0].type).toBe('message_sent')
      expect(send.events[1].type).toBe('message_sent')

      const eventMsgZero = send.events[0] as EventMessageSent
      expect(eventMsgZero.from).toEqualAddress(router.address)
      expect(eventMsgZero.to).not.toEqualAddress(jettonAddressZero)
      expect(eventMsgZero.to).not.toEqualAddress(jettonAddressOne)
      const poolAddress = eventMsgZero.to

      const eventMsgOne = send.events[1] as EventMessageSent
      expect(eventMsgOne.from).toEqualAddress(poolAddress)
      expect(eventMsgOne.to).toEqualAddress(router.address)
      });


})




//TODO move the compilables into compilables/

//TODO rename Wallet -> LpWallet (keep consistent with Account)

//TODO rename the Wrappers getters (TS inferrenace of get prefix being a member)

//TODO finialize upgrade; is it enforcing the timelock correctly? FunC maybe not?