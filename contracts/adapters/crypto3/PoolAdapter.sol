// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ICryptoPool.sol";
import "./ICryptoPool.sol";


/**
 * @dev Specified for a three-level pool with two zaps
 * Like Polygon WMATIC/TRICRYPTO (0x7bbc0e92505b485aeb3e82e828cb505daf1e50c6).
 * 
 * Should be deployed for each pool (cause lp and zap differs).
 * coins array starts with the wrapped native token, and then ERC20 tokens follow in order, as in the constructor of zap
 */
contract PoolAdapterCrypto {

    address public immutable lp;
    address public immutable zap;
    address[6] public coins;

    /**
     * @param lp_ LP pool address;
     * @param zap_ zap for pool address;
     * @param coins_ order of token addresses in the zap;
     */
    constructor(address lp_, address zap_, address[6] memory coins_) {
        require(lp_ != address(0), "PoolAdapterCrypto: zero address");
        require(zap_ != address(0), "PoolAdapterCrypto: zero address");
        for (uint256 i; i < 6; i++) {
            require(coins_[i] != address(0), "PoolAdapterCrypto: zero address");
        }
        lp = lp_;
        zap = zap_;
        coins = coins_;
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
        IZap zapImpl = IZap(zap);
        IERC20 erc20Impl = IERC20(tokenIn);
        require(tokenIn == coins[i], "PoolAdapterCrypto: wrong params");

        uint256[6] memory amounts;
        amounts[i] = amountIn;
        if (minAmountOut > zapImpl.calc_token_amount(pool, amounts)) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        SafeERC20.safeIncreaseAllowance(erc20Impl, zap, amountIn);
        zapImpl.add_liquidity(pool, amounts, 0);

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
        IZap zapImpl = IZap(zap);
        IERC20 erc20Impl = IERC20(tokenIn);
        require(tokenIn == coins[i], "PoolAdapterCrypto: wrong params");

        uint256 minDy = zapImpl.get_dy(pool, uint256(i), uint256(j), amountIn);
        if (minAmountOut > minDy) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        SafeERC20.safeIncreaseAllowance(erc20Impl, zap, amountIn);
        amountOut = zapImpl.exchange(pool, uint256(i), uint256(j), amountIn, 0);

        address tokenOut = coins[j];
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
        IZap zapImpl = IZap(zap);
        IERC20 erc20Impl = IERC20(tokenIn);
        require(tokenIn == lp, "PoolAdapterCrypto: wrong params");

        uint256 minAmount = zapImpl.calc_withdraw_one_coin(pool, amountIn, uint256(j));
        if (minAmountOut > minAmount) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        SafeERC20.safeIncreaseAllowance(erc20Impl, zap, amountIn);
        amountOut = zapImpl.remove_liquidity_one_coin(pool, amountIn, j, 0);

        address tokenOut = coins[j];
        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(tokenOut), to, amountOut);
        }
    }
}
