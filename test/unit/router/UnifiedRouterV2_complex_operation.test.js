const { loadFixture, time, impersonateAccount, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18, getReceipt } = require('../../../utils/common');
const abi = ethers.utils.defaultAbiCoder;
const AddressZero = ethers.constants.AddressZero;
const MaxUint256 = ethers.constants.MaxUint256;

const {
  deployAddressBook,
  deployWhitelistV2,
  deployUnifiedRouterV2,
  deployGateKeeperMock,
  deployBridgeMock,
  deployCurvePoolMock,
  deployTestTokenPermit,
  deployOpsRegistrar,
  deployPortalV2,
  deploySynthesisV2,
  deploySynthERC20,
  deployWETH9,
  deployERC20Mock,
  deployPoolAdapter
} = require('../../setup/setup-contracts');


describe('UnifiedRouterV2 complex operations tests', () => {

  async function deploy(){

    const TokenState = { 
      NotSet: 0, 
      InOut: 1
    };

    const SynthType = {
      Unknown: 0,
      DefaultSynth: 1,
      CustomSynth: 2,
      ThirdPartySynth: 3,
      ThirdPartyToken: 4
    };

    let urouterV2, addressBook, whitelist, portal, opsRegistrar, bridge, synthesis,
        curveLPTokenETH, syntheticTokenETH, curveLPTokenBSC, syntheticTokenBSC, WETH, USDT,
        curvePoolMockFTM, poolAdapterFTM,
        pool_WETH_USDT_ETH, poolAdapter_WETH_USDT_ETH, pool_WETH_USDT_BSC, poolAdapter_WETH_USDT_BSC,
        syntheticToken_WETH_USDT_ETH, syntheticToken_WETH_USDT_BSC, pool_WETH_USDT_FTM, poolAdapter_WETH_USDT_FTM;
    let owner, accountantRole, operatorRole, alice, bob, bridgeContract, feesTreasuryContract, routerContract;

    const chainIdCurrent = network.config.chainId;

    const tokenAmount = parse18('100');
    const tokenAmountMin = parse18('10')
    const tokenAmountMax = parse18('10000')

    const executionPrice = parse18("0.1");

    const bridgeFee = 1;

    const min10 = 60 * 10;

    const originalTokenNameETH = 'CurveLPToken_ETH';
    const originalTokenSymbolETH = 'LPT_ETH';
    const originalChainNameETH = 'ETH';
    const syntheticTokenNameETH = `s ${originalTokenSymbolETH} ${originalChainNameETH}`;
    const syntheticTokenSymbolETH = `s${originalTokenSymbolETH}_${originalChainNameETH}`;

    const originalTokenNameBSC = 'CurveLPToken_BSC';
    const originalTokenSymbolBSC = 'LPT_BSC';
    const originalChainNameBSC = 'BSC';
    const syntheticTokenNameBSC = `s ${originalTokenSymbolBSC} ${originalChainNameBSC}`;
    const syntheticTokenSymbolBSC = `s${originalTokenSymbolBSC}_${originalChainNameBSC}`;

    const decimals = 18;

    [owner, accountantRole, operatorRole, alice, bob, feesTreasuryContract, routerContract] = await ethers.getSigners();

    // deployment contracts
    addressBook = await deployAddressBook();
    whitelist = await deployWhitelistV2();
    WETH = await deployWETH9();
    let tx = await addressBook.setWETH(WETH.address);
    await tx.wait();
    urouterV2 = await deployUnifiedRouterV2([addressBook.address]);
    synthesis = await deploySynthesisV2([addressBook.address]);
    portal = await deployPortalV2([addressBook.address]);
    bridge = await deployBridgeMock();
    gateKeeper = await deployGateKeeperMock([bridge.address]);
    opsRegistrar = await deployOpsRegistrar();

    // deploy some LP token, synthetic token for them and pool for synthetic token
    curveLPTokenETH = await deployTestTokenPermit([originalTokenNameETH, originalTokenSymbolETH, decimals]);
    syntheticTokenETH = await deploySynthERC20([syntheticTokenNameETH, syntheticTokenSymbolETH, decimals, curveLPTokenETH.address, chainIdCurrent, originalChainNameETH, SynthType.DefaultSynth]);
    curveLPTokenBSC = await deployTestTokenPermit([originalTokenNameBSC, originalTokenSymbolBSC, decimals]);
    syntheticTokenBSC = await deploySynthERC20([syntheticTokenNameBSC, syntheticTokenSymbolBSC, decimals, curveLPTokenBSC.address, chainIdCurrent, originalChainNameBSC, SynthType.DefaultSynth]);
    curvePoolMockFTM = await deployCurvePoolMock([[syntheticTokenETH.address, syntheticTokenBSC.address]]);
    poolAdapterFTM = await deployPoolAdapter([curvePoolMockFTM.address]);

    // deploy some USDT, tow pool USDT-WETH, synthetic token for them and pool for synthetic token
    USDT = await deployTestTokenPermit(['USDT', 'USDT', 18]);
    pool_WETH_USDT_ETH = await deployCurvePoolMock([[WETH.address, USDT.address]]);
    poolAdapter_WETH_USDT_ETH = await deployPoolAdapter([pool_WETH_USDT_ETH.address]);
    pool_WETH_USDT_BSC = await deployCurvePoolMock([[WETH.address, USDT.address]]);
    poolAdapter_WETH_USDT_BSC = await deployPoolAdapter([pool_WETH_USDT_BSC.address]);
    
    syntheticToken_WETH_USDT_ETH = await deploySynthERC20([syntheticTokenNameETH, syntheticTokenSymbolETH, decimals, pool_WETH_USDT_ETH.address, chainIdCurrent, originalChainNameETH, SynthType.DefaultSynth]);
    syntheticToken_WETH_USDT_BSC = await deploySynthERC20([syntheticTokenNameBSC, syntheticTokenSymbolBSC, decimals, pool_WETH_USDT_BSC.address, chainIdCurrent, originalChainNameBSC, SynthType.DefaultSynth]);
    
    pool_WETH_USDT_FTM = await deployCurvePoolMock([[syntheticToken_WETH_USDT_ETH.address, syntheticToken_WETH_USDT_BSC.address]]);
    poolAdapter_WETH_USDT_FTM = await deployPoolAdapter([pool_WETH_USDT_FTM.address]);


    // preparatory actions
    const ACCOUNTANT_ROLE = await urouterV2.ACCOUNTANT_ROLE();
    const OPERATOR_ROLE = await synthesis.OPERATOR_ROLE();


    // setup roles
    tx = await urouterV2.grantRole(ACCOUNTANT_ROLE, accountantRole.address);
    await tx.wait();
    tx = await urouterV2.grantRole(OPERATOR_ROLE, operatorRole.address);
    await tx.wait();
    tx = await synthesis.grantRole(OPERATOR_ROLE, operatorRole.address);
    await tx.wait();
    tx = await bridge.grantRole(await bridge.GATEKEEPER_ROLE(), gateKeeper.address);
    await tx.wait();


    // setup contracts to AddressBook
    tx = await addressBook.setWhitelist(whitelist.address);
    await tx.wait();
    tx = await addressBook.setRouter([[chainIdCurrent, routerContract.address]]);
    await tx.wait();
    tx = await addressBook.setSynthesis([[chainIdCurrent, synthesis.address]]);
    await tx.wait();
    tx = await addressBook.setPortal([[chainIdCurrent, portal.address]]);
    await tx.wait();
    tx = await addressBook.setGateKeeper(gateKeeper.address);
    await tx.wait();
    tx = await addressBook.setTreasury(feesTreasuryContract.address);
    await tx.wait();
    tx = await addressBook.setOpsRegistrar(opsRegistrar.address);
    await tx.wait();


    // setup pool adapters
    tx = await urouterV2.connect(operatorRole).setPoolAdapter(curvePoolMockFTM.address, poolAdapterFTM.address);
    await tx.wait();
    tx = await urouterV2.connect(operatorRole).setPoolAdapter(pool_WETH_USDT_ETH.address, poolAdapter_WETH_USDT_ETH.address);
    await tx.wait();
    tx = await urouterV2.connect(operatorRole).setPoolAdapter(pool_WETH_USDT_BSC.address, poolAdapter_WETH_USDT_BSC.address);
    await tx.wait();
    tx = await urouterV2.connect(operatorRole).setPoolAdapter(pool_WETH_USDT_FTM.address, poolAdapter_WETH_USDT_FTM.address);
    await tx.wait();


    // setup curveLPTokenETH
    tx = await whitelist.setTokens([[curveLPTokenETH.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]);
    await tx.wait();
    tx = await curveLPTokenETH.mint(portal.address, tokenAmount);
    await tx.wait();
    tx = await portal.connect(routerContract).lock(curveLPTokenETH.address, tokenAmount, alice.address, alice.address);
    await tx.wait();
    tx = await curveLPTokenETH.mint(alice.address, tokenAmount);
    await tx.wait();


    // setup syntheticTokenETH
    tx = await whitelist.setTokens([[syntheticTokenETH.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.NotSet]]);
    await tx.wait();
    tx = await synthesis.connect(operatorRole).setSynths([syntheticTokenETH.address]);
    await tx.wait();
    tx = await syntheticTokenETH.mint(curvePoolMockFTM.address, tokenAmount);
    await tx.wait();
    tx = await syntheticTokenETH.transferOwnership(synthesis.address);
    await tx.wait();


    // setup curveLPTokenBSC
    tx = await whitelist.setTokens([[curveLPTokenBSC.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]);
    await tx.wait();
    tx = await curveLPTokenBSC.mint(portal.address, tokenAmount);
    await tx.wait();
    tx = await portal.connect(routerContract).lock(curveLPTokenBSC.address, tokenAmount, alice.address, alice.address);
    await tx.wait();
    tx = await curveLPTokenBSC.mint(alice.address, tokenAmount);
    await tx.wait();


    // setup syntheticTokenBSC
    tx = await whitelist.setTokens([[syntheticTokenBSC.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.NotSet]]);
    await tx.wait();
    tx = await synthesis.connect(operatorRole).setSynths([syntheticTokenBSC.address]);
    await tx.wait();
    tx = await syntheticTokenBSC.mint(curvePoolMockFTM.address, tokenAmount);
    await tx.wait();
    tx = await syntheticTokenBSC.transferOwnership(synthesis.address);
    await tx.wait();


    // setup WETH
    tx = await whitelist.setTokens([[WETH.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]);
    await tx.wait();  
    tx = await WETH.deposit({value: tokenAmount.mul(2)});
    await tx.wait();
    tx = await WETH.transfer(pool_WETH_USDT_ETH.address, tokenAmount);
    await tx.wait();
    tx = await WETH.transfer(pool_WETH_USDT_BSC.address, tokenAmount);
    await tx.wait();


    // setup USDT
    tx = await USDT.mint(pool_WETH_USDT_ETH.address, tokenAmount);
    await tx.wait();
    tx = await USDT.mint(pool_WETH_USDT_BSC.address, tokenAmount);
    await tx.wait();
    tx = await USDT.mint(alice.address, tokenAmount);
    await tx.wait();


    // setup pool_WETH_USDT_ETH
    tx = await whitelist.setTokens([[pool_WETH_USDT_ETH.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]);
    await tx.wait();


    // setup pool_WETH_USDT_BSC
    tx = await whitelist.setTokens([[pool_WETH_USDT_BSC.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]);
    await tx.wait();
    tx = await pool_WETH_USDT_BSC.mint(portal.address, tokenAmount);
    await tx.wait();


    // setup syntheticToken_WETH_USDT_ETH
    tx = await whitelist.setTokens([[syntheticToken_WETH_USDT_ETH.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.NotSet]]);
    await tx.wait();
    tx = await synthesis.connect(operatorRole).setSynths([syntheticToken_WETH_USDT_ETH.address]);
    await tx.wait();
    tx = await syntheticToken_WETH_USDT_ETH.mint(pool_WETH_USDT_FTM.address, tokenAmount);
    await tx.wait();
    tx = await syntheticToken_WETH_USDT_ETH.transferOwnership(synthesis.address);
    await tx.wait();


    // setup syntheticToken_WETH_USDT_BSC
    tx = await whitelist.setTokens([[syntheticToken_WETH_USDT_BSC.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.NotSet]]);
    await tx.wait();
    tx = await synthesis.connect(operatorRole).setSynths([syntheticToken_WETH_USDT_BSC.address]);
    await tx.wait();
    tx = await syntheticToken_WETH_USDT_BSC.mint(pool_WETH_USDT_FTM.address, tokenAmount);
    await tx.wait();
    tx = await syntheticToken_WETH_USDT_BSC.transferOwnership(synthesis.address);
    await tx.wait();


    // impersonate contracts
    await impersonateAccount(bridge.address);
    await setBalance(bridge.address, MaxUint256);
    bridgeContract = await ethers.getSigner(bridge.address);

    await impersonateAccount(urouterV2.address);
    await setBalance(urouterV2.address, MaxUint256.div(2));
    routerContract = await ethers.getSigner(urouterV2.address);


    // other setups
    tx = await opsRegistrar.registerComplexOp([
      ['PLMSBU', true],
      ['WALM', true],
      ['WALMSBURUw', true]
    ]);
    await tx.wait();

    tx = await addressBook.setRouter([[chainIdCurrent, urouterV2.address]]);
    await tx.wait();

    const deadline = await time.latest() + min10;
    const signature = await getPermitSignature(
      alice,
      curveLPTokenETH,
      urouterV2.address,
      tokenAmount,
      deadline
    );


    return {
      urouterV2, addressBook, portal, gateKeeper, synthesis,
      curveLPTokenETH, syntheticTokenETH, curveLPTokenBSC, syntheticTokenBSC, curvePoolMockFTM,
      WETH, pool_WETH_USDT_ETH, pool_WETH_USDT_BSC, pool_WETH_USDT_FTM, syntheticToken_WETH_USDT_ETH, syntheticToken_WETH_USDT_BSC, 
      accountantRole, alice, bob, routerContract, bridgeContract, feesTreasuryContract,
      tokenAmount, executionPrice, bridgeFee,
      chainIdCurrent,
      signature, deadline
    }
  }

  describe("Should checking the correct operation PLMSBU", () => {
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change token balances", async () => {
        const {
          urouterV2, addressBook, portal, gateKeeper, synthesis,
          curveLPTokenETH, syntheticTokenETH, curveLPTokenBSC, syntheticTokenBSC, curvePoolMockFTM,
          accountantRole, alice, bob, routerContract, bridgeContract, feesTreasuryContract,
          tokenAmount, executionPrice, bridgeFee,
          chainIdCurrent,
          signature, deadline
        } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPTokenETH.address,    // token
          alice.address,              // owner
          tokenAmount,                // amount
          deadline,                   // deadline
          signature.v,                // v
          signature.r,                // r
          signature.s                 // s
        )

        const synthParamsLM = getSynthParams(
          curveLPTokenETH.address,    // tokenIn
          tokenAmount,                // amountIn
          alice.address,              // from
          AddressZero,                // to
          chainIdCurrent,             // chain id to
          chainIdCurrent,             // tokenInChainIdCurrent
          alice.address               // emergencyTo
        );

        const swapParams = getSwapParams(
          syntheticTokenETH.address,    // tokenIn
          MaxUint256,                   // amountIn
          AddressZero,                  // from
          AddressZero,                  // to
          curvePoolMockFTM.address,     // pool
          0,                            // minAmountOut
          0,                            // i
          1,                            // j
          alice.address                 // emergencyTo
        );

        let synthParamsBU = getSynthParams(
          syntheticTokenBSC.address,    // tokenIn
          MaxUint256,                   // amountIn
          AddressZero,                  // from
          alice.address,                // to
          chainIdCurrent,               // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['P', 'LM', 'S', 'BU'], [permitParams, synthParamsLM, swapParams, synthParamsBU], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['P', 'LM', 'S', 'BU'], [permitParams, synthParamsLM, swapParams, synthParamsBU], receipt, {value: executionPrice}))
          .changeTokenBalances(
            curveLPTokenETH,
            [alice, portal],
            [tokenAmount.mul(-1), tokenAmount]
          )
          .changeEtherBalances(
            [alice, accountantRole],
            [executionPrice.mul(-1), executionPrice]
          );

        let requestId = await getRequestId(routerContract, addressBook, gateKeeper, chainIdCurrent, chainIdCurrent)
        let cPos = 1;

        let expectedFee = tokenAmount.mul(bridgeFee).div(await synthesis.FEE_DENOMINATOR());
        const expectedAmountOut = tokenAmount.sub(expectedFee);

        await expect(urouterV2.connect(bridgeContract).resume(requestId, cPos, ['P', 'LM', 'S', 'BU'], [permitParams, synthParamsLM, swapParams, synthParamsBU]))
          .changeTokenBalances(
            syntheticTokenETH,
            [curvePoolMockFTM, feesTreasuryContract],
            [expectedAmountOut, expectedFee]
          )
          .changeTokenBalances(
            syntheticTokenBSC,
            [curvePoolMockFTM],
            [expectedAmountOut.mul(-1)]
          );


        synthParamsBU = getSynthParams(
          curveLPTokenBSC.address,      // tokenIn
          expectedAmountOut,            // amountIn
          AddressZero,                  // from
          bob.address,                  // to
          chainIdCurrent,               // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        requestId = await getRequestId(routerContract, addressBook, gateKeeper, chainIdCurrent, chainIdCurrent)
        cPos = 3;

        expectedFee = expectedAmountOut.mul(bridgeFee).div(await synthesis.FEE_DENOMINATOR());
        const expectedAmountOut2 = expectedAmountOut.sub(expectedFee);

        await expect(urouterV2.connect(bridgeContract).resume(requestId, cPos, ['P', 'LM', 'S', 'BU'], [permitParams, synthParamsLM, swapParams, synthParamsBU]))
          .changeTokenBalances(
            curveLPTokenBSC,
            [portal, bob, feesTreasuryContract],
            [expectedAmountOut.mul(-1), expectedAmountOut2, expectedFee]
          );
      });
    });
  });

  describe("Should checking the correct operation WALMSBURUw", () => {
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change token balances", async () => {
        const {
          urouterV2, addressBook, portal, gateKeeper, synthesis,
          WETH, pool_WETH_USDT_ETH, pool_WETH_USDT_BSC, pool_WETH_USDT_FTM, syntheticToken_WETH_USDT_ETH, syntheticToken_WETH_USDT_BSC, 
          accountantRole, alice, bob, routerContract, bridgeContract, feesTreasuryContract,
          tokenAmount, executionPrice, bridgeFee,
          chainIdCurrent, deadline
        } = await loadFixture(deploy);

        let wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          tokenAmount,      // amountIn
          alice.address,    // from
          AddressZero,      // to
        );

        let addParams = getAddParams(
          WETH.address,                 // tokenIn
          tokenAmount,                  // amountIn
          AddressZero,                  // from
          AddressZero,                  // to
          pool_WETH_USDT_BSC.address,   // pool
          0,                            // minAmountOut
          0,                            // i
          alice.address                 // emergencyTo
        );

        let synthParamsLM = getSynthParams(
          pool_WETH_USDT_BSC.address,   // tokenIn
          tokenAmount,                  // amountIn
          AddressZero,                  // from
          alice.address,                // to
          chainIdCurrent,               // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        let receipt = await getReceipt(chainIdCurrent, ['W', 'A', 'LM'], [wrapParams, addParams, synthParamsLM], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['W', 'A', 'LM'], [wrapParams, addParams, synthParamsLM], receipt, {value: executionPrice.add(tokenAmount)}))
          .changeTokenBalances(
            pool_WETH_USDT_BSC,
            [portal],
            [tokenAmount]
          )
          .changeEtherBalances(
            [alice, WETH, urouterV2, accountantRole],
            [executionPrice.add(tokenAmount).mul(-1), tokenAmount, 0, executionPrice]
          );


        wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          tokenAmount,      // amountIn
          alice.address,    // from
          AddressZero,      // to
        );

        addParams = getAddParams(
          WETH.address,                 // tokenIn
          tokenAmount,                  // amountIn
          AddressZero,                  // from
          AddressZero,                  // to
          pool_WETH_USDT_ETH.address,   // pool
          0,                            // minAmountOut
          0,                            // i
          alice.address                 // emergencyTo
        );

        synthParamsLM = getSynthParams(
          pool_WETH_USDT_ETH.address,   // tokenIn
          tokenAmount,                  // amountIn
          AddressZero,                  // from
          AddressZero,                  // to
          chainIdCurrent,               // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const swapParams = getSwapParams(
          syntheticToken_WETH_USDT_ETH.address,   // tokenIn
          MaxUint256,                             // amountIn
          AddressZero,                            // from
          AddressZero,                            // to
          pool_WETH_USDT_FTM.address,             // pool
          0,                                      // minAmountOut
          0,                                      // i
          1,                                      // j
          alice.address                           // emergencyTo
        );

        let synthParamsBU = getSynthParams(
          syntheticToken_WETH_USDT_BSC.address,   // tokenIn
          MaxUint256,                             // amountIn
          AddressZero,                            // from
          AddressZero,                            // to
          chainIdCurrent,                         // chain id to
          chainIdCurrent,                         // tokenInChainIdCurrent
          alice.address                           // emergencyTo
        );

        const removeParams = getRemoveParams(
          pool_WETH_USDT_BSC.address,    // tokenIn
          MaxUint256,                   // amountIn
          AddressZero,                  // from
          AddressZero,                  // to
          pool_WETH_USDT_BSC.address,   // pool
          0,                            // minAmountOut
          0,                            // i
          alice.address                 // emergencyTo
        );

        let unWrapParams = getWrapParams(
          WETH.address,     // tokenIn
          MaxUint256,       // amountIn
          AddressZero,      // from
          bob.address,      // to
        );

        receipt = await getReceipt(chainIdCurrent, ['W', 'A', 'LM', 'S', 'BU', 'R', 'Uw'], [wrapParams, addParams, synthParamsLM, swapParams, synthParamsBU, removeParams, unWrapParams], urouterV2, alice, accountantRole, executionPrice, deadline);

        await expect(urouterV2.connect(alice).start(['W', 'A', 'LM', 'S', 'BU', 'R', 'Uw'], [wrapParams, addParams, synthParamsLM, swapParams, synthParamsBU, removeParams, unWrapParams], receipt, {value: executionPrice.add(tokenAmount)}))
          .changeTokenBalances(
            pool_WETH_USDT_ETH,
            [portal],
            [tokenAmount]
          )
          .changeEtherBalances(
            [alice, WETH, urouterV2, accountantRole],
            [executionPrice.add(tokenAmount).mul(-1), tokenAmount, 0, executionPrice]
          );


        let requestId = await getRequestId(routerContract, addressBook, gateKeeper, chainIdCurrent, chainIdCurrent)
        let cPos = 2;

        let expectedFee = tokenAmount.mul(bridgeFee).div(await synthesis.FEE_DENOMINATOR());
        const expectedAmountOut = tokenAmount.sub(expectedFee);

        await expect(urouterV2.connect(bridgeContract).resume(requestId, cPos, ['W', 'A', 'LM', 'S', 'BU', 'R', 'Uw'], [wrapParams, addParams, synthParamsLM, swapParams, synthParamsBU, removeParams, unWrapParams]))
          .changeTokenBalances(
            syntheticToken_WETH_USDT_ETH,
            [pool_WETH_USDT_FTM, feesTreasuryContract],
            [expectedAmountOut, expectedFee]
          )
          .changeTokenBalances(
            syntheticToken_WETH_USDT_BSC,
            [pool_WETH_USDT_FTM],
            [expectedAmountOut.mul(-1)]
          );

        synthParamsBU = getSynthParams(
          pool_WETH_USDT_BSC.address,    // tokenIn
          expectedAmountOut,            // amountIn
          portal.address,                // from
          AddressZero,                  // to
          chainIdCurrent,               // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        requestId = await getRequestId(routerContract, addressBook, gateKeeper, chainIdCurrent, chainIdCurrent)
        cPos = 4;

        expectedFee = expectedAmountOut.mul(bridgeFee).div(await synthesis.FEE_DENOMINATOR());
        const expectedAmountOut2 = expectedAmountOut.sub(expectedFee);

        await expect(urouterV2.connect(bridgeContract).resume(requestId, cPos, ['W', 'A', 'LM', 'S', 'BU', 'R', 'Uw'], [wrapParams, addParams, synthParamsLM, swapParams, synthParamsBU, removeParams, unWrapParams]))
          .changeTokenBalances(
              pool_WETH_USDT_BSC,
              [portal, feesTreasuryContract],
              [expectedAmountOut.mul(-1), expectedFee]
            )
          .changeEtherBalances(
            [bob, WETH],
            [expectedAmountOut2, expectedAmountOut2.mul(-1)]
          );
      });
    });
  });

  function getPermitParams(token, owner, amount, deadline, v, r, s) {
    return abi.encode(
      ['address', 'address', 'uint256', 'uint256', 'uint8', 'bytes32', 'bytes32'],
      [
        token,
        owner,
        amount,
        deadline,
        v,
        r,
        s
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

  function getSynthParams(tokenIn, amountIn, from, to, chainIdTo, tokenInChainIdCurrent, emergencyTo) {
    return abi.encode(
      ['address', 'uint256', 'address', 'address', 'uint64', 'uint64', 'address'],
      [
        tokenIn,
        amountIn,
        from,
        to,
        chainIdTo,
        tokenInChainIdCurrent,
        emergencyTo
    ]);
  }

  function getAddParams(tokenIn, amountIn, from, to, pool, minAmountOut, i, emergencyTo) {
    return abi.encode(
      ['address', 'uint256', 'address', 'address', 'address', 'uint256', 'uint8', 'address'],
      [
        tokenIn,
        amountIn,
        from,
        to,
        pool,
        minAmountOut,
        i,
        emergencyTo
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

  function getRemoveParams(tokenIn, amountIn, from, to, pool, minAmountOut, i, emergencyTo) {
    return abi.encode(
      ['address', 'uint256', 'address', 'address', 'address', 'uint256', 'uint8', 'address'],
      [
        tokenIn,
        amountIn,
        from,
        to,
        pool,
        minAmountOut,
        i,
        emergencyTo
    ]);
  }

  async function getPermitSignature(signer, token, spender, value, deadline) {
    const [nonce, name, version, chainId] = await Promise.all([
      token.nonces(signer.address),
      'EYWA',
      '1',
      signer.getChainId(),
    ]);

    return ethers.utils.splitSignature(
      await signer._signTypedData(
        {name, version, chainId, verifyingContract: token.address },
        {
          Permit: [
            {name: 'owner', type: 'address'},
            {name: 'spender', type: 'address'},
            {name: 'value', type: 'uint256'},
            {name: 'nonce', type: 'uint256'},
            {name: 'deadline', type: 'uint256'},
          ],
        },
        {
          owner: signer.address,
          spender,
          value,
          nonce,
          deadline,
        }
      )
    );
  };

  async function getRequestId(routerContract, addressBook, gateKeeper, chainIdTo, chainIdFrom) {
    let routerToAddress = await addressBook.router(chainIdTo)
    routerToAddress = ethers.utils.hexZeroPad(routerToAddress , 32)
    let routerFromAddress = await addressBook.router(chainIdFrom)
    routerFromAddress = ethers.utils.hexZeroPad(routerFromAddress , 32)
    const nonce = await gateKeeper.connect(routerContract).getNonce()
    return ethers.utils.keccak256(abi.encode(
      ['bytes32', 'uint256', 'uint256', 'uint256',  'bytes32'],
      [
        routerFromAddress,
        nonce,
        chainIdTo,
        chainIdFrom,
        routerToAddress,
      ]
    ));
  }
});
