// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStableSwapPool.sol";
import "./interfaces/ICurveBalancer.sol";


contract StablePoolAdapter is Ownable {

    /**
     * @dev Adds liquidity to the pool.
     *
     * @param pool Address of the pool contract;
     * @param tokenIn The address of the input token to add liquidity;
     * @param amountIn The amount of input token to add as liquidity;
     * @param minAmountOut The minimum amount of pool tokens expected to be received;
     * @param coinIndex Index of the input token;
     * @param to Address where the LP tokens will be transferred;
     * @param minAmountOut Minimum amount of coin to receive;
     * @param emergencyTo Emergency to address in case of inconsistency.
     */
    function addLiquidity(
        address pool,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 coinIndex,
        address to,
        uint256 coinsCount,
        address emergencyTo
    ) external returns (uint256 amountOut) {
        IERC20 erc20Impl = IERC20(tokenIn);
        uint256 minAmount;
        if (coinsCount == 2) {
            uint256[2] memory amounts;
            amounts[coinIndex] = amountIn;
            minAmount = IStableSwapPool(pool).calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            IStableSwapPool(pool).add_liquidity(amounts, 0);
        } else if (coinsCount == 4) {
            uint256[4] memory amounts;
            amounts[coinIndex] = amountIn;
            minAmount = IStableSwapPool(pool).calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            IStableSwapPool(pool).add_liquidity(amounts, 0);
        } else if (coinsCount == 6) {
            uint256[6] memory amounts;
            amounts[coinIndex] = amountIn;
            minAmount = IStableSwapPool(pool).calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            IStableSwapPool(pool).add_liquidity(amounts, 0);
        }

        amountOut = IERC20(pool).balanceOf(address(this));
        require(amountOut >= minAmountOut, "StablePoolAdapter: min amount");
        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(pool), to, amountOut);
        }
    }

    /**
     * @dev Swaps tokens in the pool.
     *
     * @param tokenIn Address of the token to swap;
     * @param pool Address of the pool contract;
     * @param i Index of the input token;
     * @param j Index of the output token;
     * @param tokenOut Address of the token to receive;
     * @param to Address where the output tokens will be transferred;
     * @param minAmountOut Minimum amount of coin to receive;
     * @param emergencyTo Emergency to address in case of inconsistency.
     */
    function swap(
        address tokenIn,
        address pool,
        int128 i,
        int128 j,
        address tokenOut,
        address to,
        uint256 minAmountOut,
        address emergencyTo
    ) external returns (uint256 amountOut) {
        // TODO change for amount variable from input params?
        uint256 amountIn = IERC20(tokenIn).balanceOf(address(this));

        IERC20 erc20Impl = IERC20(tokenIn);
        SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);

        uint256 minDy = IStableSwapPool(pool).get_dy(i, j, amountIn);
        if (minAmountOut > minDy) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        IStableSwapPool(pool).exchange(i, j, amountIn, minDy);

        amountOut = IERC20(tokenOut).balanceOf(address(this));
        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(tokenOut), to, amountOut);
        }
    }

    /**
     * @dev Removes liquidity from the pool.
     *
     * @param pool Address of the pool contract;
     * @param i Index value of the coin to withdraw;
     * @param to Address where the output token will be transferred;
     * @param tokenOut Address of the output token to receive;
     * @param minAmountOut Minimum amount of coin to receive;
     * @param emergencyTo Emergency to address in case of inconsistency.
     */
    function removeLiquidity(
        address pool,
        int128 i,
        address to,
        address tokenOut,
        uint256 minAmountOut,
        address emergencyTo
    ) external returns (uint256 amountOut) {
        IStableSwapPool poolImpl = IStableSwapPool(pool);
        uint256 amountIn = IERC20(pool).balanceOf(address(this));
        uint256 minAmount = poolImpl.calc_withdraw_one_coin(amountIn, i);
        if (minAmountOut > minAmount) {
            SafeERC20.safeTransfer(IERC20(pool), emergencyTo, amountIn);
            return 0;
        }
        poolImpl.remove_liquidity_one_coin(amountIn, i, minAmount);
        amountOut = IERC20(tokenOut).balanceOf(address(this));
        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(tokenOut), to, amountOut);
        }
    }
}
