// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2023 - all rights reserved
pragma solidity 0.8.17;


interface IMetaPool {
    function add_liquidity(uint256[2] memory amounts, uint256 min_mint_amount, address receiver) external;

    function add_liquidity(uint256[3] memory amounts, uint256 min_mint_amount, address receiver) external;

    function add_liquidity(uint256[4] memory amounts, uint256 min_mint_amount, address receiver) external;

    function add_liquidity(uint256[5] memory amounts, uint256 min_mint_amount, address receiver) external;

    function add_liquidity(uint256[6] memory amounts, uint256 min_mint_amount, address receiver) external;

    function add_liquidity(uint256[7] memory amounts, uint256 min_mint_amount, address receiver) external;

    function add_liquidity(uint256[8] memory amounts, uint256 min_mint_amount, address receiver) external;

    function remove_liquidity(uint256 amounts, uint256[2] memory min_amounts, address receiver) external;

    function remove_liquidity(uint256 amounts, uint256[3] memory min_amounts, address receiver) external;

    function remove_liquidity(uint256 amounts, uint256[4] memory min_amounts, address receiver) external;

    function remove_liquidity(uint256 amounts, uint256[5] memory min_amounts, address receiver) external;

    function remove_liquidity(uint256 amounts, uint256[6] memory min_amounts, address receiver) external;

    function remove_liquidity(uint256 amounts, uint256[7] memory min_amounts, address receiver) external;

    function remove_liquidity(uint256 amounts, uint256[8] memory min_amounts, address receiver) external;
    
    function remove_liquidity_one_coin(uint256 token_amount, uint256 i, uint256 min_amount, address receiver) external;

    function exchange_underlying(uint256 i, uint256 j, uint256 dx, uint256 min_dy, address receiver) external;

    function get_dy_underlying(uint256 i, uint256 j, uint256 dx) external view returns (uint256);

    function calc_withdraw_one_coin(uint256 token_amount, uint256 i) external view returns (uint256);

    function calc_token_amount(uint256[2] memory amounts, bool is_deposit) external view returns (uint256);

    function calc_token_amount(uint256[3] memory amounts, bool is_deposit) external view returns (uint256);

    function calc_token_amount(uint256[4] memory amounts, bool is_deposit) external view returns (uint256);

    function calc_token_amount(uint256[5] memory amounts, bool is_deposit) external view returns (uint256);

    function calc_token_amount(uint256[6] memory amounts, bool is_deposit) external view returns (uint256);

    function calc_token_amount(uint256[7] memory amounts, bool is_deposit) external view returns (uint256);

    function calc_token_amount(uint256[8] memory amounts, bool is_deposit) external view returns (uint256);

    function coins(uint256 i) external view returns (address);

    function underlying_coins(uint256 i) external view returns (address);

    function token() external view returns (address);
}
