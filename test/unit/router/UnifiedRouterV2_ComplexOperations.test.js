const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18, getReceipt } = require('../../../utils/common');
const abi = ethers.utils.defaultAbiCoder;
const AddressZero = ethers.constants.AddressZero;

const {
  deployAddressBook,
  deployWhitelistV2,
  deployUnifiedRouterV2,
  deployGateKeeperMock,
  deployBridgeMock,
  deployTestTokenPermit,
  deployPortalV2,
  deployWETH9,
  deployPoolAdapter,
  deployCurvePoolMock
} = require('../../setup/setup-contracts');


describe('UnifiedunifiedRouterV2 complex operations tests', () => {

  async function deploy(){

    const TokenState = { NotSet: 0, InOut: 1 };

    let unifiedRouterV2, addressBook, whitelist, portal, bridge, curvePoolMock, poolAdapter, curveLPToken, WETH, USDT; 
    let owner, accountantRole, operatorRole, alice, malory;

    const chainIdFrom = network.config.chainId;
    const someAddress = '0x0000000000000000000000000000000000000088';

    const tokenAmount = parse18('100');
    const tokenAmountMin = parse18('10')
    const tokenAmountMax = parse18('10000')

    const executionPrice = parse18("0.2");
    const wrappingEther =  parse18("0.5");
    const sendingEther =  parse18("1");

    const wrappedTokenAmountMin = parse18('0.1')
    const wrappedTokenAmountMax = parse18('100')

    const bridgeFee = 1;

    const min10 = 60 * 10;

    [owner, accountantRole, operatorRole, alice, malory] = await ethers.getSigners();

    // deployment contracts
    addressBook = await deployAddressBook();
    whitelist = await deployWhitelistV2();
    WETH = await deployWETH9();
    let tx = await addressBook.setWETH(WETH.address);
    await tx.wait();
    unifiedRouterV2 = await deployUnifiedRouterV2([addressBook.address]);
    bridge = await deployBridgeMock();
    gateKeeper = await deployGateKeeperMock([bridge.address]);
    portal = await deployPortalV2([addressBook.address]);
    curveLPToken = await deployTestTokenPermit(['CurveLPToken', 'LPT', 18]);
    USDT = await deployTestTokenPermit(['USDT', 'USDT', 18]);
    curvePoolMock = await deployCurvePoolMock([[USDT.address, WETH.address]]);
    poolAdapter = await deployPoolAdapter([curvePoolMock.address]);


    // preparatory actions
    const DEFAULT_ADMIN_ROLE = await unifiedRouterV2.DEFAULT_ADMIN_ROLE();
    const ACCOUNTANT_ROLE = await unifiedRouterV2.ACCOUNTANT_ROLE();
    const OPERATOR_ROLE = await unifiedRouterV2.OPERATOR_ROLE();

    tx = await unifiedRouterV2.grantRole(ACCOUNTANT_ROLE, accountantRole.address);
    await tx.wait();
    tx = await unifiedRouterV2.grantRole(OPERATOR_ROLE, operatorRole.address);
    await tx.wait();
    tx = await unifiedRouterV2.connect(operatorRole).setPoolAdapter(curvePoolMock.address, poolAdapter.address);
    await tx.wait();

    tx = await addressBook.setRouter([[network.config.chainId, unifiedRouterV2.address], [chainIdFrom, unifiedRouterV2.address]]);
    await tx.wait();
    tx = await addressBook.setPortal([[network.config.chainId, portal.address], [chainIdFrom, portal.address]]);
    await tx.wait();
    tx = await addressBook.setWhitelist(whitelist.address);
    await tx.wait();
    tx = await addressBook.setGateKeeper(gateKeeper.address);
    await tx.wait();

    tx = await bridge.grantRole(await bridge.GATEKEEPER_ROLE(), gateKeeper.address);
    await tx.wait();

    tx = await whitelist.setTokens([[curveLPToken.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]);
    await tx.wait();
    tx = await whitelist.setTokens([[WETH.address, wrappedTokenAmountMin, wrappedTokenAmountMax, bridgeFee, TokenState.InOut]]);
    await tx.wait();  


    tx = await USDT.mint(curvePoolMock.address, tokenAmount);
    await tx.wait();
    tx = await USDT.mint(alice.address, tokenAmount);
    await tx.wait();
    tx = await WETH.deposit({value: tokenAmount});
    await tx.wait();
    tx = await WETH.transfer(curvePoolMock.address, tokenAmount);
    await tx.wait();


    return {
      unifiedRouterV2, addressBook, portal, whitelist, gateKeeper, bridge, curveLPToken, WETH, curvePoolMock, USDT, WETH,
      owner, accountantRole, operatorRole, alice, malory, 
      tokenAmount, executionPrice, wrappingEther, sendingEther,
      someAddress,
      chainIdFrom,
      min10,
      DEFAULT_ADMIN_ROLE, ACCOUNTANT_ROLE, OPERATOR_ROLE
    }
  }

  describe("Should checking the correct operation of the start() function for LM with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { unifiedRouterV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdFrom, min10 } = await loadFixture(deploy);

        await mintApproveCurveLPToken(unifiedRouterV2, curveLPToken, alice, tokenAmount);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,         // from
          alice.address,         // to
          chainIdFrom,          // chain id to
          chainIdFrom,          // tokenInChainIdFrom
          alice.address          // emergencyTo
        );

        const receipt = await getReceipt(chainIdFrom, ['LM'], [synthParams], unifiedRouterV2, alice, accountantRole, executionPrice, await getDeadline(min10));

        const wrongSendingEther = executionPrice.sub(1);

        await expect(unifiedRouterV2.connect(alice).start(['LM'], [synthParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change LP token balances", async () => {
        const { unifiedRouterV2, portal, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdFrom, min10 } = await loadFixture(deploy);

        await mintApproveCurveLPToken(unifiedRouterV2, curveLPToken, alice, tokenAmount);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,         // from
          alice.address,         // to
          chainIdFrom,          // chain id to
          chainIdFrom,          // tokenInChainIdFrom
          alice.address          // emergencyTo
        );

        const receipt = await getReceipt(chainIdFrom, ['LM'], [synthParams], unifiedRouterV2, alice, accountantRole, executionPrice, await getDeadline(min10));

        await expect(unifiedRouterV2.connect(alice).start(['LM'], [synthParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            curveLPToken,
            [alice, portal],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
      it("Should check correct change Ether balances", async () => {
        const { unifiedRouterV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdFrom, min10 } = await loadFixture(deploy);

        await mintApproveCurveLPToken(unifiedRouterV2, curveLPToken, alice, tokenAmount);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,         // from
          alice.address,         // to
          chainIdFrom,          // chainIdTo
          chainIdFrom,          // tokenInChainIdFrom
          alice.address          // emergencyTo
        );

        const receipt = await getReceipt(chainIdFrom, ['LM'], [synthParams], unifiedRouterV2, alice, accountantRole, executionPrice, await getDeadline(min10));

        await expect(unifiedRouterV2.connect(alice).start(['LM'], [synthParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, unifiedRouterV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
    });
  });

  describe("Should checking the correct operation of the start() function for WLM with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { unifiedRouterV2, WETH, accountantRole, alice, executionPrice, wrappingEther, chainIdFrom, min10 } = await loadFixture(deploy);

        const wrongSendingEther = executionPrice.sub(1);

        const wrapParams = getWrapParams(
          WETH.address, // tokenIn
          wrappingEther,        // amountIn
          alice.address,         // from
          AddressZero,          // to
        );

        const synthParams = getSynthParams(
          WETH.address, // tokenIn
          wrappingEther,        // amountIn
          AddressZero,          // from
          alice.address,         // to
          chainIdFrom,          // chainIdTo
          chainIdFrom,          // tokenInChainIdFrom
          alice.address          // emergencyTo
        );

        const receipt = await getReceipt(chainIdFrom, ['W', 'LM'], [wrapParams, synthParams], unifiedRouterV2, alice, accountantRole, executionPrice, await getDeadline(min10));

        await expect(unifiedRouterV2.connect(alice).start(['W', 'LM'], [wrapParams, synthParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change WrappedETH token balances", async () => {
        const { unifiedRouterV2, portal, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdFrom, min10 } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,    // tokenIn
          wrappingEther,   // amountIn
          alice.address,    // from
          AddressZero,     // to
        );

        const synthParams = getSynthParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          AddressZero,      // from
          alice.address,     // to
          chainIdFrom,      // chainIdTo
          chainIdFrom,      // tokenInChainIdFrom
          alice.address      // emergencyTo
        );

        const receipt = await getReceipt(chainIdFrom, ['W', 'LM'], [wrapParams, synthParams], unifiedRouterV2, alice, accountantRole, executionPrice, await getDeadline(min10));

        await expect(unifiedRouterV2.connect(alice).start(['W', 'LM'], [wrapParams, synthParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            WETH,
            [portal],
            [wrappingEther]
          );
      });
      it("Should check change Ether balances", async () => {
        const { unifiedRouterV2, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdFrom, min10 } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,    // tokenIn
          wrappingEther,   // amountIn
          alice.address,    // from
          AddressZero,     // to
        );

        const synthParams = getSynthParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          AddressZero,      // from
          alice.address,     // to
          chainIdFrom,      // chainIdTo
          chainIdFrom,      // tokenInChainIdFrom
          alice.address      // emergencyTo
        );

        const receipt = await getReceipt(chainIdFrom, ['W', 'LM'], [wrapParams, synthParams], unifiedRouterV2, alice, accountantRole, executionPrice, await getDeadline(min10));

        await expect(unifiedRouterV2.connect(alice).start(['W', 'LM'], [wrapParams, synthParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, WETH, unifiedRouterV2, accountantRole],
            [executionPrice.add(wrappingEther).mul(-1), wrappingEther,0, executionPrice]
          );
      });
    });
  });

  describe("Should checking the correct operation of the start() function for SUw with executionPrice", () => {
    describe("Should checking the correct changes state variables", () => {
      it("Should correct change USDT balance", async() => {
        const { unifiedRouterV2, curvePoolMock, USDT, WETH, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdFrom, min10 } = await loadFixture(deploy);
      
        const swapParams = getSwapParams(
          USDT.address,             // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          AddressZero,              // to
          curvePoolMock.address,    // pool
          0,                        // minAmountOut
          0,                        // i
          1,                        // j
          alice.address             // emergencyTo
        );

      const wrapParams = getWrapParams(
          WETH.address,   // tokenIn
          tokenAmount,    // amountIn
          AddressZero,    // from
          alice.address,   // to
        );

        const receipt = await getReceipt(chainIdFrom, ['S', 'Uw'], [swapParams, wrapParams], unifiedRouterV2, alice, accountantRole, executionPrice, await getDeadline(min10));

        await USDT.connect(alice).approve(unifiedRouterV2.address, tokenAmount);

        await expect(unifiedRouterV2.connect(alice).start(['S', 'Uw'], [swapParams, wrapParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            USDT,
            [alice],
            [tokenAmount.mul(-1)]
          );
      });
      it("Should correct change Ether balance", async() => {
        const { unifiedRouterV2, curvePoolMock, USDT, WETH, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdFrom, min10 } = await loadFixture(deploy);

        const swapParams = getSwapParams(
          USDT.address,           // tokenIn
          tokenAmount,            // amountIn
          alice.address,           // from
          AddressZero,            // to
          curvePoolMock.address,  // pool
          0,                      // minAmountOut
          0,                      // i
          1,                      // j
          alice.address            // emergencyTo
        );

      const wrapParams = getWrapParams(
          WETH.address,   // tokenIn
          tokenAmount,    // amountIn
          AddressZero,    // from
          alice.address,   // to
        );

        const receipt = await getReceipt(chainIdFrom, ['S', 'Uw'], [swapParams, wrapParams], unifiedRouterV2, alice, accountantRole, executionPrice, await getDeadline(min10));

        await USDT.connect(alice).approve(unifiedRouterV2.address, tokenAmount);

        await expect(unifiedRouterV2.connect(alice).start(['S', 'Uw'], [swapParams, wrapParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, WETH, unifiedRouterV2, accountantRole],
            [executionPrice.mul(-1).add(tokenAmount), tokenAmount.mul(-1), 0, executionPrice]
          );
      });
    });
  });

  async function mintApproveCurveLPToken(unifiedRouterV2, curveLPToken, alice, tokenAmount){
    let tx = await curveLPToken.mint(alice.address, tokenAmount);
    await tx.wait();
    tx = await curveLPToken.connect(alice).approve(unifiedRouterV2.address, tokenAmount);
    await tx.wait();
  }

  function getSynthParams(tokenIn, amountIn, from, to, chainIdTo, tokenInChainIdFrom, emergencyTo) {
    return abi.encode(
      ['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'],
      [
        tokenIn,
        amountIn,
        from,
        to,
        chainIdTo,
        tokenInChainIdFrom,
        emergencyTo
    ]);
  }

  function getWrapParams(tokenIn, amountIn, from, to) {
    return abi.encode(
      ['address', 'uint256', 'address', 'address'],
      [
        tokenIn,
        amountIn,
        from,
        to
    ]);
  }

  function getSwapParams(tokenIn, amountIn, from, to, pool, minAmountOut, i, j, emergencyTo) {
    return abi.encode(
      ['address', 'uint256', 'address', 'address', 'address', 'uint256', 'uint8', 'uint8', 'address'],
      [
        tokenIn,
        amountIn,
        from,
        to,
        pool,
        minAmountOut,
        i,
        j,
        emergencyTo
    ]);
  }

  async function getDeadline(deadline) {
    return await time.latest() + deadline;
  }
});

