// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IMetaPool.sol";


/**
 * @dev Specified for meta pool with zap
 * Like Avalanche atricrypto (0xb755b949c126c04e0348dd881a5cf55d424742b2).
 */
contract PoolAdapterMeta {

    uint8 public immutable n;

    /**
     * @param n_ coins count. 
     */
    constructor(uint8 n_) {
        require(n_ != 0, "PoolAdapterMeta: wrong params");
        n = n_;
    }

    /**
     * @dev Adds liquidity to the pool.
     *
     * @param tokenIn The address of the input token to add liquidity;
     * @param amountIn The amount of input token to add as liquidity;
     * @param to Address where the LP tokens will be transferred;
     * @param pool Address of the pool contract;
     * @param minAmountOut The minimum amount of pool tokens expected to be received;
     * @param i Index of the input token (underlying);
     * @param emergencyTo Emergency to address in case of inconsistency.
     */
    function addLiquidity(
        address tokenIn,
        uint256 amountIn,
        address to,
        address pool,
        uint256 minAmountOut,
        uint8 i,
        address emergencyTo
    ) external returns (uint256 amountOut) {
        IMetaPool poolImpl = IMetaPool(pool);

        require(tokenIn == poolImpl.underlying_coins(i), "PoolAdapterMeta: wrong params");

        IERC20 erc20Impl = IERC20(tokenIn);

        uint256 minAmount;
        uint256 balanceBefore =  IERC20(poolImpl.token()).balanceOf(to);

        if (n == 2) {
            uint256[2] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0, to);
        } else if (n == 3) {
            uint256[3] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0, to);
        } else if (n == 4) {
            uint256[4] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0, to);
        } else if (n == 5) {
            uint256[5] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0, to);
        } else if (n == 6) {
            uint256[6] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0, to);
        }
        uint256 balanceAfter =  IERC20(poolImpl.token()).balanceOf(to);
        amountOut = balanceAfter - balanceBefore;

        if (amountOut == 0) {
            return 0;
        }

        require(amountOut >= minAmountOut, "PoolAdapterMeta: min amount");
    }

    /**
     * @dev Swaps tokens in the pool.
     *
     * @param tokenIn Address of the token to swap;
     * @param amountIn The amount of input token to be exchanged;
     * @param to Address where the output tokens will be transferred;
     * @param pool Address of the pool contract;
     * @param minAmountOut Minimum amount of coin to receive;
     * @param i Index of the input token (underlying);
     * @param j Index of the output token (underlying);
     * @param emergencyTo Emergency to address in case of inconsistency.
     */
    function swap(
        address tokenIn,
        uint256 amountIn,
        address to,
        address pool,
        uint256 minAmountOut,
        uint8 i,
        uint8 j,
        address emergencyTo
    ) external returns (uint256 amountOut) {
        IMetaPool poolImpl = IMetaPool(pool);
        require(tokenIn == poolImpl.underlying_coins(i), "PoolAdapterMeta: wrong params");

        uint256 minDy = poolImpl.get_dy_underlying(uint256(i), uint256(j), amountIn);
        if (minAmountOut > minDy) {
            SafeERC20.safeTransfer(IERC20(tokenIn), emergencyTo, amountIn);
            return 0;
        }
        
        SafeERC20.safeIncreaseAllowance(IERC20(tokenIn), pool, amountIn);

        uint256 balanceBefore =  IERC20(poolImpl.underlying_coins(j)).balanceOf(to);
        poolImpl.exchange_underlying(uint256(i), uint256(j), amountIn, 0, to);
        uint256 balanceAfter =  IERC20(poolImpl.underlying_coins(j)).balanceOf(to);
        amountOut = balanceAfter - balanceBefore;

        require(amountOut >= minAmountOut, "PoolAdapterMeta: min amount");
    }

    /**
     * @dev Removes liquidity from the pool.
     *
     * @param tokenIn Address of the lp;
     * @param amountIn The amount of the lp to be removed;
     * @param to Address where the output token will be transferred;
     * @param pool Address of the pool contract;
     * @param minAmountOut Minimum amount of coin to receive;
     * @param i Index value of the coin to withdraw (underlying);
     * @param emergencyTo Emergency to address in case of inconsistency.
     */
    function removeLiquidity(
        address tokenIn,
        uint256 amountIn,
        address to,
        address pool,
        uint256 minAmountOut,
        uint8 i,
        address emergencyTo
    ) external returns (uint256 amountOut) {
        IMetaPool poolImpl = IMetaPool(pool);

        require(tokenIn == poolImpl.token(), "PoolAdapterMeta: wrong params");
        IERC20 erc20Impl = IERC20(tokenIn);

        uint256 minAmount = poolImpl.calc_withdraw_one_coin(amountIn, uint256(i));
        if (minAmountOut > minAmount) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }

        SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
        
        uint256 balanceBefore =  IERC20(poolImpl.underlying_coins(i)).balanceOf(to);
        poolImpl.remove_liquidity_one_coin(amountIn, i, 0, to);
        uint256 balanceAfter =  IERC20(poolImpl.underlying_coins(i)).balanceOf(to);
        amountOut = balanceAfter - balanceBefore;
        
        require(amountOut >= minAmountOut, "PoolAdapterMeta: min amount");
    }
}
