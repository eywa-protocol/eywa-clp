// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;


interface IStablePoolNg {
    function add_liquidity(uint256[] memory amounts, uint256 min_mint_amount, address receiver) external returns (uint256);
    
    function remove_liquidity(uint256 burn_amount, uint256[] memory min_amounts, address receiver, bool claim_admin_fees) external returns (uint256[] memory);

    function remove_liquidity_one_coin(uint256 burn_amount, int128 i, uint256 min_received, address receiver) external returns (uint256);

    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy, address receiver) external returns (uint256);

    function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256);

    function calc_withdraw_one_coin(uint256 token_amount, int128 i) external view returns (uint256);

    function calc_token_amount(uint256[] memory amounts, bool is_deposit) external view returns (uint256);

    function coins(uint256 i) external view returns (address);

    function N_COINS() external view returns (uint256);
}
