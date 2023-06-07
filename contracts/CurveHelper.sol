// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStableSwapPool.sol";
import "./interfaces/ITreasury.sol";


interface IERC20Extended {
    function decimals() external view returns (uint8);
}

contract CurveHelper is Ownable {
    address treasuryAddress;
    uint256 minOutPercent = 99700; //99,7%

    event TreasuryReplenish(string reason, address token, uint256 amount);

    struct BalanceMetaExchange {
        //pool address
        address addPool;
        address swapPool;
        address removePool;
        //pool slots
        uint256 slotsAddPool;
        uint256 slotsSwapPool;
        uint256 slotsRemovePool;
        //exchange params
        uint256 i; //index value for the coin to send
        uint256 j; //index value of the coin to receive
        //withdraw params
        uint256 minOutcome;
    }

    constructor(address _treasuryAddress) {
        treasuryAddress = _treasuryAddress;
    }

    mapping(address => bool) public whiteList;

    modifier onlyTrusted() {
        require(whiteList[msg.sender], "CurveHelper: only trusted");
        _;
    }

    function setMinOutPercent(uint256 minPercent) public onlyOwner {
        minOutPercent = minPercent;
    }
    
    function addTrustedAddress(address trusted) public onlyOwner {
        whiteList[trusted] = true;
    }

    function removeTrustedAddress(address trusted) public onlyOwner {
        whiteList[trusted] = false;
    }

    function withdrawToken(
        address token,
        uint256 amount,
        address to
    ) public onlyOwner {
        SafeERC20.safeTransfer(IERC20(token), to, amount);
    }

    function getCoins(address pool, uint256 slots) public view returns (address[] memory) {
        address[] memory coins = new address[](slots);
        for (uint256 i = 0; i < slots; i++) {
            coins[i] = IStableSwapPool(pool).coins(i);
        }
        return coins;
    }

    function getTreasuryBalances(address[] memory coins) public view returns (uint256[] memory) {
        uint256[] memory treasuryBalances = new uint256[](coins.length);
        for (uint256 i = 0; i < coins.length; i++) {
            treasuryBalances[i] = IERC20(coins[i]).balanceOf(treasuryAddress);
        }
        return treasuryBalances;
    }

    function swapDesired(
        address pool,
        uint256 slotsCount,
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 min_dy
    ) public onlyTrusted {
        address[] memory coins = new address[](slotsCount);
        coins = getCoins(pool, slotsCount);
        ITreasury(treasuryAddress).withdraw("swapDesired", coins[i], dx, address(this));
        IERC20(coins[i]).approve(pool, dx);
        IStableSwapPool(pool).exchange(int128(int256(i)), int128(int256(j)), dx, min_dy);
        uint256 replenishAmount = IERC20(coins[j]).balanceOf(address(this));
        SafeERC20.safeTransfer(IERC20(coins[j]), treasuryAddress, replenishAmount);
        emit TreasuryReplenish("swapDesired", coins[j], replenishAmount);
    }

    function balanceDesiredRoute(BalanceMetaExchange calldata params, uint256[] calldata addAmount) public onlyTrusted {
        address[] memory coinsAddPool = new address[](params.slotsAddPool);
        address[] memory coinsSwapPool = new address[](params.slotsSwapPool);
        address[] memory coinsRemovePool = new address[](params.slotsRemovePool);
        coinsAddPool = getCoins(params.addPool, params.slotsAddPool);
        coinsSwapPool = getCoins(params.swapPool, params.slotsSwapPool);
        coinsRemovePool = getCoins(params.removePool, params.slotsRemovePool);
        uint256 amountOutMin;

        //add
        for (uint256 i = 0; i < params.slotsAddPool; i++) {
            if (addAmount[i] > 0) {
                ITreasury(treasuryAddress).withdraw("balanceDesiredRoute", coinsAddPool[i], addAmount[i], address(this));
                IERC20(coinsAddPool[i]).approve(params.addPool, addAmount[i]);
                uint256 thisDecimals = IERC20Extended(coinsAddPool[i]).decimals();
                if (thisDecimals < 18) {
                    amountOutMin += addAmount[i] * 10**(18 - thisDecimals);
                }
                if (thisDecimals > 18) {
                    amountOutMin += addAmount[i] / 10**(thisDecimals - 18);
                }
                if (thisDecimals == 18) {
                    amountOutMin += addAmount[i];
                }
            }
        }
        addLiquidityBalanced(params.addPool, params.slotsAddPool, addAmount);

        //swap
        uint256 swapAmount = IERC20(coinsSwapPool[params.i]).balanceOf(address(this));
        IERC20(coinsSwapPool[params.i]).approve(params.swapPool, swapAmount);
        IStableSwapPool(params.swapPool).exchange(int128(int256(params.i)), int128(int256(params.j)), swapAmount, 0);

        //remove
        uint256 removeAmount = IERC20(coinsSwapPool[params.j]).balanceOf(address(this));
        IERC20(IStableSwapPool(params.removePool).lp_token()).approve(params.removePool, removeAmount);
        removeLiquidityBalanced(params.removePool, params.slotsRemovePool, removeAmount);
        uint256 totalOutcome;
        for (uint256 i = 0; i < params.slotsRemovePool; i++) {
            uint256 thisBalance = IERC20(coinsRemovePool[i]).balanceOf(address(this));
            uint256 thisDecimals = IERC20Extended(coinsRemovePool[i]).decimals();
            if (thisBalance > 0) {
                if (thisDecimals < 18) {
                    totalOutcome += thisBalance * 10**(18 - thisDecimals);
                }
                if (thisDecimals > 18) {
                    totalOutcome += thisBalance / 10**(thisDecimals - 18);
                }
                if (thisDecimals == 18) {
                    totalOutcome += thisBalance;
                }
                SafeERC20.safeTransfer(IERC20(coinsRemovePool[i]), treasuryAddress, thisBalance);
                emit TreasuryReplenish("balanceDesiredRoute", coinsRemovePool[i], thisBalance);
            }
        }
        amountOutMin = amountOutMin * minOutPercent / 100000;
        require(totalOutcome >= params.minOutcome, "CurveHelper: outcome inconsistency");
        require(totalOutcome >= amountOutMin, "CurveHelper: minimum out assertion");
    }

    function removeLiquidityBalanced(
        address pool,
        uint256 slotsCount,
        uint256 amountLp
    ) internal {
        if (slotsCount == 2) {
            uint256[2] memory min_amounts2;
            IStableSwapPool(pool).remove_liquidity(amountLp, min_amounts2);
        }
        if (slotsCount == 3) {
            uint256[3] memory min_amounts3;
            IStableSwapPool(pool).remove_liquidity(amountLp, min_amounts3);
        }
        if (slotsCount == 4) {
            uint256[4] memory min_amounts4;
            IStableSwapPool(pool).remove_liquidity(amountLp, min_amounts4);
        }
        if (slotsCount == 5) {
            uint256[5] memory min_amounts5;
            IStableSwapPool(pool).remove_liquidity(amountLp, min_amounts5);
        }
        if (slotsCount == 6) {
            uint256[6] memory min_amounts6;
            IStableSwapPool(pool).remove_liquidity(amountLp, min_amounts6);
        }
        if (slotsCount == 7) {
            uint256[7] memory min_amounts7;
            IStableSwapPool(pool).remove_liquidity(amountLp, min_amounts7);
        }
        if (slotsCount == 8) {
            uint256[8] memory min_amounts8;
            IStableSwapPool(pool).remove_liquidity(amountLp, min_amounts8);
        }
    }

    function addLiquidityBalanced(
        address pool,
        uint256 slotsCount,
        uint256[] calldata amountToAdd
    ) internal {
        if (slotsCount == 2) {
            uint256[2] memory amounts2;
            for (uint256 i = 0; i < slotsCount; i++) {
                if (amountToAdd[i] > 0) amounts2[i] = amountToAdd[i];
            }
            IStableSwapPool(pool).add_liquidity(amounts2, 0);
        }
        if (slotsCount == 3) {
            uint256[3] memory amounts3;
            for (uint256 i = 0; i < slotsCount; i++) {
                if (amountToAdd[i] > 0) amounts3[i] = amountToAdd[i];
            }
            IStableSwapPool(pool).add_liquidity(amounts3, 0);
        }
        if (slotsCount == 4) {
            uint256[4] memory amounts4;
            for (uint256 i = 0; i < slotsCount; i++) {
                if (amountToAdd[i] > 0) amounts4[i] = amountToAdd[i];
            }
            IStableSwapPool(pool).add_liquidity(amounts4, 0);
        }
        if (slotsCount == 5) {
            uint256[5] memory amounts5;
            for (uint256 i = 0; i < slotsCount; i++) {
                if (amountToAdd[i] > 0) amounts5[i] = amountToAdd[i];
            }
            IStableSwapPool(pool).add_liquidity(amounts5, 0);
        }
        if (slotsCount == 6) {
            uint256[6] memory amounts6;
            for (uint256 i = 0; i < slotsCount; i++) {
                if (amountToAdd[i] > 0) amounts6[i] = amountToAdd[i];
            }
            IStableSwapPool(pool).add_liquidity(amounts6, 0);
        }
        if (slotsCount == 7) {
            uint256[7] memory amounts7;
            for (uint256 i = 0; i < slotsCount; i++) {
                if (amountToAdd[i] > 0) amounts7[i] = amountToAdd[i];
            }
            IStableSwapPool(pool).add_liquidity(amounts7, 0);
        }
        if (slotsCount == 8) {
            uint256[8] memory amounts8;
            for (uint256 i = 0; i < slotsCount; i++) {
                if (amountToAdd[i] > 0) amounts8[i] = amountToAdd[i];
            }
            IStableSwapPool(pool).add_liquidity(amounts8, 0);
        }
    }
}
