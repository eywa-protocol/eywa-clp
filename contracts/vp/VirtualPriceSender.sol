// SPDX-License-Identifier: UNLICENSED
// Copyright (c) Eywa.Fi, 2021-2024 - all rights reserved
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "../interfaces/IGateKeeper.sol";
import "../interfaces/IAddressBook.sol";
import "../interfaces/IVirtualPriceReceiver.sol";
import "../interfaces/I3Pool.sol";


contract VirtualPriceSender is AccessControlEnumerable {

    struct Receiver {
        address receiver;
        uint64 chainId;
    }

    /// @dev operator role id
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    /// @dev operator role id
    bytes32 public constant SENDER_ROLE = keccak256("SENDER_ROLE");
    /// @dev addressBook contract
    address public addressBook;
    /// @dev receivers (pool => chainId => receiver)
    mapping(address => mapping(uint64 => address)) public receivers;

    event PriceSent(uint256 price, address pool, uint64 chainId);
    
    constructor(address addressBook_) {
        require(addressBook_ != address(0), "VirtualPriceSender: zero address");
        addressBook = addressBook_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Sets address book.
     *
     * Controlled by DAO and\or multisig (3 out of 5, Gnosis Safe).
     *
     * @param addressBook_ address book contract address.
     */
    function setAddressBook(address addressBook_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        addressBook = addressBook_;
    }

    /**
     * @dev Sets pool, receiver and its chainId.
     *
     * @param pool The pool, which has to be oraclized;
     * @param receiver The virtual price receiver for given pool;
     * @param receiverChainId The receiver's chainId.
     */
    function setReceiver(address pool, uint64 receiverChainId, address receiver) external onlyRole(OPERATOR_ROLE) {
        receivers[pool][receiverChainId] = receiver;
    }

    /**
     * @dev Sends lp virtual price.
     *
     * @param pool The pool which lp price have to be send;
     * @param receiverChainId Destination chainId.
     */
    function sendVirtualPrice(address pool, uint64 receiverChainId) public onlyRole(SENDER_ROLE) {
        _sendVirtualPrice(pool, receiverChainId);
    }

    /**
     * @dev Sends lp virtual price for few pools at same time.
     *
     * @param pools The array of pool addresses which lp prices have to be send;
     * @param receiverChainIds Destinations chainIds.
     */
    function sendVirtualPrice(address[] calldata pools, uint64[] calldata receiverChainIds) public onlyRole(SENDER_ROLE) {
        require(pools.length == receiverChainIds.length, "VirtualPriceSender: wrong params");
        uint256 length = pools.length;
        for (uint256 i; i < length; ++i) {
            _sendVirtualPrice(pools[i], receiverChainIds[i]);
        }
    }

    function _sendVirtualPrice(address pool, uint64 receiverChainId) private {
        address receiver = receivers[pool][receiverChainId];
        require(receiver != address(0), "VirtualPriceSender: wrong receiver");
        I3Pool poolImpl = I3Pool(pool);

        uint256 virtualPrice = poolImpl.get_virtual_price();

        bytes memory out = abi.encodeWithSelector(
            IVirtualPriceReceiver.receiveVirtualPrice.selector,
            virtualPrice,
            block.chainid
        );

        address gateKeeper = IAddressBook(addressBook).gateKeeper();
        IGateKeeper gateKeeperImpl = IGateKeeper(gateKeeper);
        gateKeeperImpl.sendData(out, receiver, receiverChainId, address(0));

        emit PriceSent(virtualPrice, pool, receiverChainId);
    }
}
