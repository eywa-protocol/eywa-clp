// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ICryptoPool.sol";


/**
 * @dev Specified for old implementations, which have another calc_token_amount interface
 * Like Ethereum 2crypto.
 * 
 * Should be deployed for each pool (cause lp differs).
 */
contract PoolAdapterCrypto {

    address public immutable lp;

    /**
     * @param lp_ LP pool address;
     */
    constructor(address lp_) {
        require(lp_ != address(0), "PoolAdapterCrypto: zero address");
        lp = lp_;
    }


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
        ICryptoPool poolImpl = ICryptoPool(pool);

        require(tokenIn == poolImpl.coins(i), "PoolAdapterCrypto: wrong params");

        IERC20 erc20Impl = IERC20(tokenIn);

        uint256[2] memory amounts;
        amounts[i] = amountIn;
        if (minAmountOut > poolImpl.calc_token_amount(amounts)) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
        poolImpl.add_liquidity(amounts, 0);

        amountOut = IERC20(lp).balanceOf(address(this));

        require(amountOut >= minAmountOut, "PoolAdapter: min amount");
    
        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(lp), to, amountOut);
        }
    }

    /**
     * @dev Swaps tokens in the pool.
     *
     * @param tokenIn Address of the token to swap;
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
        ICryptoPool poolImpl = ICryptoPool(pool);

        require(tokenIn == poolImpl.coins(i), "PoolAdapterCrypto: wrong params");

        IERC20 erc20Impl = IERC20(tokenIn);

        uint256 minDy = poolImpl.get_dy(uint256(i), uint256(j), amountIn);
        if (minAmountOut > minDy) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
        poolImpl.exchange(uint256(i), uint256(j), amountIn, minDy);

        address tokenOut = poolImpl.coins(j);
        amountOut = IERC20(tokenOut).balanceOf(address(this));
        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(tokenOut), to, amountOut);
        }
    }

    /**
     * @dev Removes liquidity from the pool.
     *
     * @param tokenIn Address of the lp;
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
        ICryptoPool poolImpl = ICryptoPool(pool);
        
        require(tokenIn == lp, "PoolAdapterCrypto: wrong params");

        IERC20 erc20Impl = IERC20(tokenIn);

        uint256 minAmount = poolImpl.calc_withdraw_one_coin(amountIn, uint256(j));
        if (minAmountOut > minAmount) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        poolImpl.remove_liquidity_one_coin(amountIn, j, 0);

        address tokenOut = poolImpl.coins(j);
        amountOut = IERC20(tokenOut).balanceOf(address(this));
        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(tokenOut), to, amountOut);
        }
    }
}
