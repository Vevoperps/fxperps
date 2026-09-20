// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IOracle} from "../interfaces/IOracle.sol";

/**
 * @title MockOracle
 * @notice A settable price, for tests and for the testnet deployment.
 *
 * On testnet this is what the keeper writes into until the chain's real Pyth
 * deployment is confirmed. It is not, and must never be, what mainnet reads:
 * the deploy script refuses to wire it outside a test chain.
 */
contract MockOracle is IOracle {
    address public owner;
    mapping(bytes32 => uint256) private prices;
    mapping(bytes32 => bool) private known;

    event PriceSet(bytes32 indexed market, uint256 price);

    error NotOwner();
    error UnknownFeed();

    constructor(address owner_) {
        owner = owner_;
    }

    function price(bytes32 market) external view returns (uint256) {
        if (!known[market]) revert UnknownFeed();
        return prices[market];
    }

    function hasFeed(bytes32 market) external view returns (bool) {
        return known[market];
    }

    function setPrice(bytes32 market, uint256 value) public {
        if (msg.sender != owner) revert NotOwner();
        prices[market] = value;
        known[market] = true;
        emit PriceSet(market, value);
    }

    function setPrices(bytes32[] calldata marketList, uint256[] calldata values) external {
        for (uint256 i = 0; i < marketList.length; i++) {
            setPrice(marketList[i], values[i]);
        }
    }
}
