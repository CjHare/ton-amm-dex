import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
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
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and pool are ready to use
    });
});
