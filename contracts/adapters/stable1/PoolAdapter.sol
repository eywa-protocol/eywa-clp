// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IStablePool.sol";


/**
 * @dev Specified only for old implementations, which doesn't have getter for LP.
 * Like Ethereum 3pool (0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7).
 * Should be deployed for each pool (cause lp differs).
 */
contract PoolAdapter {

    address public immutable lp;
    uint8 public immutable n;

    /**
     * @param lp_ LP pool address. 
     */
    constructor(address lp_, uint8 n_) {
        require(lp_ != address(0), "PoolAdapter: zero address");
        require(n_ != 0, "PoolAdapter: wrong params");
        lp = lp_;
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
        IStablePool poolImpl = IStablePool(pool);

        require(tokenIn == poolImpl.coins(i), "PoolAdapter: wrong params");

        IERC20 erc20Impl = IERC20(tokenIn);

        uint256 minAmount;

        if (n == 2) {
            uint256[2] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0);
        } else if (n == 3) {
            uint256[3] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0);
        } else if (n == 4) {
            uint256[4] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0);
        } else if (n == 5) {
            uint256[5] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0);
        } else if (n == 6) {
            uint256[6] memory amounts;
            amounts[i] = amountIn;
            minAmount = poolImpl.calc_token_amount(amounts, true);
            if (minAmountOut > minAmount) {
                SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
                return 0;
            }
            SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
            poolImpl.add_liquidity(amounts, 0);
        } else {
            revert("PoolAdapter: wrong n");
        }

        amountOut = IERC20(lp).balanceOf(address(this));

        if (amountOut == 0) {
            return 0;
        }

        require(amountOut >= minAmountOut, "PoolAdapter: min amount");
        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(lp), to, amountOut);
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
        IStablePool poolImpl = IStablePool(pool);

        require(tokenIn == poolImpl.coins(i), "PoolAdapter: wrong params");

        IERC20 erc20Impl = IERC20(tokenIn);

        uint256 minDy = poolImpl.get_dy(int128(uint128(i)), int128(uint128(j)), amountIn);
        if (minAmountOut > minDy) {
            SafeERC20.safeTransfer(erc20Impl, emergencyTo, amountIn);
            return 0;
        }
        SafeERC20.safeIncreaseAllowance(erc20Impl, pool, amountIn);
        poolImpl.exchange(int128(uint128(i)), int128(uint128(j)), amountIn, minAmountOut);

        address tokenOut = poolImpl.coins(j);
        
        amountOut = IERC20(tokenOut).balanceOf(address(this));
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
        IStablePool poolImpl = IStablePool(pool);

        require(tokenIn == lp, "PoolAdapter: wrong params");

        uint256 minAmount = poolImpl.calc_withdraw_one_coin(amountIn, int128(uint128(j)));
        if (minAmountOut > minAmount) {
            SafeERC20.safeTransfer(IERC20(lp), emergencyTo, amountIn);
            return 0;
        }
        // burnFrom used for this lp, increase allowance not needed
        poolImpl.remove_liquidity_one_coin(amountIn, int128(uint128(j)), minAmountOut);

        address tokenOut = poolImpl.coins(j);

        amountOut = IERC20(tokenOut).balanceOf(address(this));

        if (to != address(this)) {
            SafeERC20.safeTransfer(IERC20(tokenOut), to, amountOut);
        }
    }
}
