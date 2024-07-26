// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IAavePool.sol";


contract PoolAdapterAave {

    uint8 public immutable n;

    /**
     * @param n_ coins count. 
     */
    constructor(uint8 n_) {
        require(n_ != 0, "PoolAdapterAave: wrong params");
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
     * @param k Index of the input token;
     * @param emergencyTo Emergency to address in case of inconsistency.
     */
    function addLiquidity(
        address tokenIn,
        uint256 amountIn,
        address to,
        address pool,
        uint256 minAmountOut,
        uint8 k,
        address emergencyTo
    ) external returns (uint256 amountOut) {
        IAavePool poolImpl = IAavePool(pool);

        bool isUnderlying = k >= n;

        require(tokenIn == (isUnderlying ? poolImpl.underlying_coins(k - n) : poolImpl.coins(k)), "PoolAdapterAave: wrong params");

        if (n == 2) {
            uint256[2] memory amounts;
            amounts[isUnderlying ? k - n : k] = amountIn;
            uint256 minAmount = poolImpl.calc_token_amount(amounts, true);
            IERC20 erc20Impl = IERC20(tokenIn);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            amountOut = poolImpl.add_liquidity(amounts, 0, isUnderlying);
        } else if (n == 3) {
            uint256[3] memory amounts;
            amounts[isUnderlying ? k - n : k] = amountIn;
            uint256 minAmount = poolImpl.calc_token_amount(amounts, true);
            IERC20 erc20Impl = IERC20(tokenIn);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            amountOut = poolImpl.add_liquidity(amounts, 0, isUnderlying);
        } else {
            revert("PoolAdapterAave: wrong params");
        }

        require(amountOut >= minAmountOut, "PoolAdapterAave: min amount");

        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(poolImpl.lp_token()), to, amountOut);
        }
    }

    /**
     * @dev Swaps tokens in the pool.
     *
     * @param tokenIn The address of the input token to swap liquidity;
     * @param amountIn The amount of input token to be exchanged;
     * @param to Address where the output tokens will be transferred;
     * @param pool Address of the pool contract;
     * @param minAmountOut Minimum amount of coin to receive;
     * @param i Index of the input token (if > n, it's underlying);
     * @param j Index of the output token (if > n, it's underlying);
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
        bool isUnderlying = i >= n;

        i = isUnderlying ? i - n : i;
        j = isUnderlying ? j - n : j;

        IERC20 erc20Impl = IERC20(isUnderlying ? IAavePool(pool).underlying_coins(i) : IAavePool(pool).coins(i));

        require(tokenIn == address(erc20Impl), "PoolAdapterAave: wrong params");

        address tokenOut;
        uint256 minDy;
        if (isUnderlying) {
            minDy = IAavePool(pool).get_dy_underlying(int128(uint128(i)), int128(uint128(j)), amountIn);
        } else {
            minDy = IAavePool(pool).get_dy(int128(uint128(i)), int128(uint128(j)), amountIn);
        }

        if (minAmountOut > minDy) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        
        SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);

        if (isUnderlying) {
            amountOut = IAavePool(pool).exchange_underlying(int128(uint128(i)), int128(uint128(j)), amountIn, 0);
            tokenOut = IAavePool(pool).underlying_coins(j);
        } else {
            amountOut = IAavePool(pool).exchange(int128(uint128(i)), int128(uint128(j)), amountIn, 0);
            tokenOut = IAavePool(pool).coins(j);
        }

        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(tokenOut), to, amountOut);
        }
    }

    /**
     * @dev Removes liquidity from the pool.
     *
     * @param tokenIn The address of the input token to remove liquidity;
     * @param amountIn The amount of the lp to be removed;
     * @param to Address where the output token will be transferred;
     * @param pool Address of the pool contract;
     * @param minAmountOut Minimum amount of coin to receive;
     * @param k Index value of the coin to withdraw;
     * @param emergencyTo Emergency to address in case of inconsistency.
     */
    function removeLiquidity(
        address tokenIn,
        uint256 amountIn,
        address to,
        address pool,
        uint256 minAmountOut,
        uint8 k,
        address emergencyTo
    ) external returns (uint256 amountOut) {
        IAavePool poolImpl = IAavePool(pool);

        require(tokenIn == poolImpl.lp_token(), "PoolAdapterAave: wrong params");

        IERC20 erc20Impl = IERC20(tokenIn);

        bool isUnderlying = k >= n;

        uint8 i = isUnderlying ? k - n : k;

        uint256 minAmount = poolImpl.calc_withdraw_one_coin(amountIn, int128(uint128(i)));
        if (minAmountOut > minAmount) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        poolImpl.remove_liquidity_one_coin(amountIn, int128(uint128(i)), minAmount, isUnderlying);

        address tokenOut = isUnderlying ? poolImpl.underlying_coins(i) : poolImpl.coins(i);
        amountOut = IERC20(tokenOut).balanceOf(address(this));
        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(tokenOut), to, amountOut);
        }
    }
}
