// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IStablePool.sol";


contract PoolAdapterStableNg {

    /**
     * @dev Adds liquidity to the pool.
     *
     * @param tokenIn The address of the input token to add liquidity;
     * @param amountIn The amount of input token to add as liquidity;
     * @param to Address where the LP tokens will be transferred;
     * @param pool Address of the pool contract;
     * @param minAmountOut The minimum amount of pool tokens expected to be received;
     * @param i Index of the input token;
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
        IStablePoolNg poolImpl = IStablePoolNg(pool);
        require(tokenIn == poolImpl.coins(i), "PoolAdapterStableNg: wrong params");
        IERC20 erc20Impl = IERC20(tokenIn);
        uint256[] memory amounts = new uint256[](poolImpl.N_COINS());
        amounts[i] = amountIn;
        uint256 minAmount = poolImpl.calc_token_amount(amounts, true);
        if (minAmountOut > minAmount) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
        amountOut = poolImpl.add_liquidity(amounts, 0, to);
        if (amountOut == 0) {
            return 0;
        }
        require(amountOut >= minAmountOut, "PoolAdapterStableNg: min amount");
    }

    /**
     * @dev Swaps tokens in the pool.
     *
     * @param tokenIn The address of the input token to swap liquidity;
     * @param amountIn The amount of input token to be exchanged;
     * @param to Address where the output tokens will be transferred;
     * @param pool Address of the pool contract;
     * @param minAmountOut Minimum amount of coin to receive;
     * @param i Index of the input token;
     * @param j Index of the output token;
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
        IStablePoolNg poolImpl = IStablePoolNg(pool);
        require(tokenIn == poolImpl.coins(i), "PoolAdapterStableNg: wrong params");
        IERC20 erc20Impl = IERC20(tokenIn);
        uint256 minDy = poolImpl.get_dy(int128(uint128(i)), int128(uint128(j)), amountIn);
        if (minAmountOut > minDy) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
        amountOut = poolImpl.exchange(int128(uint128(i)), int128(uint128(j)), amountIn, minAmountOut, to);
    }

    /**
     * @dev Removes liquidity from the pool.
     *
     * @param tokenIn The address of the input token to remove liquidity;
     * @param amountIn The amount of the lp to be removed;
     * @param to Address where the output token will be transferred;
     * @param pool Address of the pool contract;
     * @param minAmountOut Minimum amount of coin to receive;
     * @param j Index value of the coin to withdraw;
     * @param emergencyTo Emergency to address in case of inconsistency.
     */
    function removeLiquidity(
        address tokenIn,
        uint256 amountIn,
        address to,
        address pool,
        uint256 minAmountOut,
        uint8 j,
        address emergencyTo
    ) external returns (uint256 amountOut) {
        IStablePoolNg poolImpl = IStablePoolNg(pool);
        require(tokenIn == pool, "PoolAdapterStableNg: wrong params");
        uint256 minAmount = poolImpl.calc_withdraw_one_coin(amountIn, int128(uint128(j)));
        if (minAmountOut > minAmount) {
            SafeERC20.safeTransfer(IERC20(pool), emergencyTo, amountIn);
            return 0;
        }
        amountOut = poolImpl.remove_liquidity_one_coin(amountIn, int128(uint128(j)), minAmount, to);
    }
}
