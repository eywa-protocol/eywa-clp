// let deployInfo = require(process.env.HHC_PASS ? process.env.HHC_PASS : '../../output_config.json');
const { checkoutProvider, timeout } = require("../../utils/helper");
const { ethers } = require("hardhat");
const { assert } = require("chai");

contract('StableSwap', () => {

    describe("StableSwap local test", () => {
        let localToken = []
        let localTokenAddress = []
        let stableList = ["USDT", "USDC", "BUSD", "DAI"]
        let crosschainPool

        const A = 100                 // amplification coefficient for the pool.
        const fee = 5000000;           // pool swap fee
        const admin_fee = 10000000000;

        async function getSlippagePercent(actualAmount, calculatedAmount) {
            slippage = 100 - calculatedAmount / actualAmount * 100
            console.log("Slippage: ", slippage)
            return slippage
        }

        async function swap(i, j, dx, min_dy) {
            j_amount = await crosschainPool.get_dy(i, j, dx);
            console.log("swap amount " + ethers.utils.formatEther(dx));
            console.log("swap " + i + " vs " + j);
            console.log("get_dy " + ethers.utils.formatEther(j_amount));
            // getSlippagePercent(dx, j_amount)

            // let min_dy = 0;
            await localToken[i].mint(owner.address, dx)
            await localToken[i].approve(crosschainPool.address, dx)
            tx = await crosschainPool.exchange(i, j, dx, min_dy);

            for (let i = 0; i < amounts.length; i++) {
                console.log(stableList[0] + (i + 1) + " " + await crosschainPool.balances(i))
            }
        }

        async function removeLiquidityOneCoin(tokenAmount, i, minAmount) {
            amount = await crosschainPool.calc_withdraw_one_coin(tokenAmount, i,);
            console.log("remove liquidity one coin #" + i + " " + ethers.utils.formatEther(tokenAmount)+ " LP");
            console.log("calc_withdraw_one_coin " + ethers.utils.formatEther(amount)+ " LP");
            getSlippagePercent(tokenAmount, amount);

            await crosschainPoolLp.approve(crosschainPool.address, tokenAmount)
            tx = await crosschainPool.remove_liquidity_one_coin(amount, i, minAmount);

            for (let i = 0; i < amounts.length; i++) {
                console.log(stableList[0] + (i + 1) + " " + ethers.utils.formatEther(await crosschainPool.balances(i)))
            }
        }

        async function removeLiquidity(amountLp, minAmounts) {
            amount = await crosschainPool.calc_token_amount(minAmounts, false);
            console.log("remove liquidity " + ethers.utils.formatEther(amountLp) + " LP");
            console.log("calc_token_amount for withdraw " + ethers.utils.formatEther(amount) + " LP");
            getSlippagePercent(amountLp, amount);

            await crosschainPoolLp.approve(crosschainPool.address, amountLp);
            tx = await crosschainPool.remove_liquidity(amount, minAmounts);

            for (let i = 0; i < amounts.length; i++) {
                console.log(stableList[0] + (i + 1) + " " + ethers.utils.formatEther(await crosschainPool.balances(i)))
            }
        }

        async function removeLiquidityImbalance(amounts, maxBurnLpAmount) {
            amount = await crosschainPool.calc_token_amount(amounts, false);
            console.log("remove liquidity " + ethers.utils.formatEther(maxBurnLpAmount) + " LP");
            console.log("calc_token_amount for withdraw imbalance " + ethers.utils.formatEther(amount) + " LP" );
            getSlippagePercent(maxBurnLpAmount, amount);

            await crosschainPoolLp.approve(crosschainPool.address, maxBurnLpAmount);
            tx = await crosschainPool.remove_liquidity_imbalance(amounts, maxBurnLpAmount);

            for (let i = 0; i < amounts.length; i++) {
                console.log(stableList[0] + (i + 1) + " " + ethers.utils.formatEther(await crosschainPool.balances(i)))
            }
        }

        async function addLiquidity(amounts, min_mint_amount){
            amount = await crosschainPool.calc_token_amount(amounts, true);
            getSlippagePercent(min_mint_amount, amount);

            //add liq to stable pool
            for (let i = 0; i < amounts.length; i++) {
                await localToken[i].mint(owner.address, amounts[i])
                await localToken[i].approve(crosschainPool.address, amounts[i])
            }

            // min_mint_amount = 0;
            try {
                tx = await crosschainPool.add_liquidity(
                    amounts,
                    min_mint_amount,
                    {
                        gasLimit: '5000000'
                    }
                );
                await tx.wait();
                console.log("add liquidity crosschainPool pool:", tx.hash);
            } catch (e) {
                console.log(e);
            }

            for (let i = 0; i < amounts.length; i++) {
                console.log(stableList[0] + (i + 1) + " " + ethers.utils.formatEther(await crosschainPool.balances(i)))
            }

        }

        async function createStablePool(owner, amounts) {
            ERC20 = await ethers.getContractFactory('ERC20Mock')
            LpToken = await ethers.getContractFactory('CurveTokenV5')
            StableSwap2Pool = await ethers.getContractFactory('StableSwap2Pool')
            StableSwap3Pool = await ethers.getContractFactory('StableSwap3Pool')
            StableSwap4Pool = await ethers.getContractFactory('StableSwap4Pool')
            StableSwap5Pool = await ethers.getContractFactory('StableSwap5Pool')
            StableSwap6Pool = await ethers.getContractFactory('StableSwap6PoolUSDT')
            StableSwap7Pool = await ethers.getContractFactory('StableSwap7Pool')
            StableSwap8Pool = await ethers.getContractFactory('StableSwap8Pool')

            for (let i = 0; i < amounts.length; i++) {
                localToken[i] = await ERC20.deploy(stableList[0], stableList[0])
                localTokenAddress[i] = localToken[i].address
            }

            crosschainPoolLp = await LpToken.deploy("LpToken", "LPC", { gasLimit: 10000000 });
            await crosschainPoolLp.deployed();

            switch (amounts.length) {
                case 2:
                    crosschainPool = await StableSwap2Pool.deploy(owner.address, localTokenAddress, crosschainPoolLp.address, A, fee, admin_fee);
                    break;
                case 3:
                    crosschainPool = await StableSwap3Pool.deploy(owner.address, localTokenAddress, crosschainPoolLp.address, A, fee, admin_fee);
                    break;
                case 4:
                    crosschainPool = await StableSwap4Pool.deploy(owner.address, localTokenAddress, crosschainPoolLp.address, A, fee, admin_fee);
                    break;
                case 5:
                    crosschainPool = await StableSwap5Pool.deploy(owner.address, localTokenAddress, crosschainPoolLp.address, A, fee, admin_fee);
                    break;
                case 6:
                    crosschainPool = await StableSwap6Pool.deploy(owner.address, localTokenAddress, crosschainPoolLp.address, A, fee, admin_fee);
                    break;
                case 7:
                    crosschainPool = await StableSwap7Pool.deploy(owner.address, localTokenAddress, crosschainPoolLp.address, A, fee, admin_fee);
                    break;
                case 8:
                    crosschainPool = await StableSwap8Pool.deploy(owner.address, localTokenAddress, crosschainPoolLp.address, A, fee, admin_fee);
                    break;
            }

            await crosschainPool.deployed();
            console.log("CrosschainPool deployed to:", crosschainPool.address);
            let txSM = await crosschainPoolLp.set_minter(crosschainPool.address);
            await txSM.wait();

            // await addLiquidity(amounts, 0);

            //add liq to stable pool
            for (let i = 0; i < amounts.length; i++) {
                await localToken[i].mint(owner.address, amounts[i])
                await localToken[i].approve(crosschainPool.address, amounts[i])

            }

            min_mint_amount = 0;
            try {
                tx = await crosschainPool.add_liquidity(
                    amounts,
                    min_mint_amount,
                    {
                        gasLimit: '5000000'
                    }
                );
                await tx.wait();
                console.log("add liquidity crosschainPool pool:", tx.hash);
            } catch (e) {
                console.log(e);
            }

            for (let i = 0; i < amounts.length; i++) {
                console.log(stableList[0] + (i + 1) + " " + await crosschainPool.balances(i))
            }

            return crosschainPool, crosschainPoolLp, localToken, localTokenAddress
        }

        before(async () => {
            [owner, lpProvider, user] = await ethers.getSigners();

        })



        it("Test Swap 1", async function () {
            amounts = [
                BigInt(10*10**6),
                ethers.utils.parseEther("10.0"),
                BigInt(10*10**6),
                BigInt(10*10**6),
                BigInt(10*10**6),
                BigInt(10*10**6)
            ]
            await createStablePool(owner, amounts);

            let i = 1;
            let j = 3;
            let dx = ethers.utils.parseEther("1.0"); //amount to swap
            // let dx = BigInt(10*10**6) //amount to swap

            minDy = await crosschainPool.get_dy(i, j, dx)
            await swap(i, j, dx, minDy);

            console.log(await localToken[3].balanceOf(owner.address))
            // await swap(j, i, dx);

        })


    })
})