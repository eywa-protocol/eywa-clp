const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18, getReceipt } = require('../../../utils/common');
const abi = ethers.utils.defaultAbiCoder;
const AddressZero = ethers.constants.AddressZero;
const HashZero = ethers.constants.HashZero;

const {
  deployAddressBook,
  deployWhitelistV2,
  deployRouterV2,
  deployGateKeeperMock,
  deployBridgeMock,
  deployTestTokenPermit,
  deployPortalV2,
  deploySynthesisV2,
  deploySynthERC20,
  deployThirdPartySynthAdapter,
  deployWETH9,
  deployERC20Mock
} = require('../../setup/setup-contracts');


describe('RouterV2 unit tests', () => {

  async function deploy(){

    const TokenState = { 
      NotSet: 0, 
      InOut: 1
    };
    
    const CrossChainOpState  = { 
      Unknown: 0,
      Succeeded: 1,
      Reverted: 2 
  }

  const ExecutionResult = { 
    Failed: 0,
    Succeeded: 1,
    Interrupted: 2
  }

    const SynthType = {
      Unknown: 0,
      DefaultSynth: 1,
      CustomSynth: 2,
      ThirdPartySynth: 3,
      ThirdPartyToken: 4
    };

    let routerV2, addressBook, whitelist, portal, bridge, synthesis, thirdPartySynthAdapter,
        curveLPToken, syntheticToken, thirdPartySynthToken, WETH;
    let owner, accountantRole, operatorRole, alice, malory, bridgeContract, feesTreasuryContract, routerContract;

    const resumeSelector = (await ethers.getContractFactory("RouterV2")).interface.getSighash("resume"); // 0x6b750d63
    const chainIdFrom = 13;
    const chainIdCurrent = network.config.chainId;
    const chainIdTo = 101;
    const someAddress = '0x0000000000000000000000000000000000000088';
    const originalThirdPartyTokenAddress = '0x0000000000000000000000000000000123456789';

    const tokenAmount = parse18('100');
    const tokenAmountMin = parse18('10')
    const tokenAmountMax = parse18('10000')

    const executionPrice = parse18("0.1");
    const wrappingEther =  parse18("0.5");
    const sendingEther =  parse18("1");

    const wrappedTokenAmountMin = parse18('0.1')
    const wrappedTokenAmountMax = parse18('100')

    const bridgeFee = 1;

    const requestId = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const cPos = 0;
    const min10 = 60 * 10;

    const originalTokenName = 'SomeCurveLPToken';
    const originalTokenSymbol = 'LPT';
    const originalChainName = 'ETH';
    const syntheticTokenName = `s ${originalTokenSymbol} ${originalChainName}`;
    const syntheticTokenSymbol = `s${originalTokenSymbol}_${originalChainName}`;
    const thirdPartySynthTokenName = 'thirdPartySynthToken';
    const thirdPartySynthTokenSymbol = 'TPST';
    const decimals = 18;

    [owner, accountantRole, operatorRole, alice, malory, feesTreasuryContract, routerContract] = await ethers.getSigners();
    [owner, accountantRole, operatorRole, alice, malory, feesTreasuryContract, routerContract] = await ethers.getSigners();

    // deployment contracts
    addressBook = await deployAddressBook();
    whitelist = await deployWhitelistV2();
    WETH = await deployWETH9();
    let tx = await addressBook.setWETH(WETH.address);
    await tx.wait();
    routerV2 = await deployRouterV2([addressBook.address]);
    synthesis = await deploySynthesisV2([addressBook.address]);
    portal = await deployPortalV2([addressBook.address]);
    bridge = await deployBridgeMock();
    gateKeeper = await deployGateKeeperMock([bridge.address]);
    curveLPToken = await deployTestTokenPermit([originalTokenName, originalTokenSymbol, decimals]);
    syntheticToken = await deploySynthERC20([syntheticTokenName, syntheticTokenSymbol, decimals, curveLPToken.address, chainIdCurrent, originalChainName, SynthType.DefaultSynth]);
    thirdPartySynthToken = await deployTestTokenPermit([thirdPartySynthTokenName, thirdPartySynthTokenSymbol, decimals]);
    thirdPartySynthAdapter = await deployThirdPartySynthAdapter([originalThirdPartyTokenAddress, thirdPartySynthToken.address, chainIdCurrent, originalChainName, decimals]);


    // preparatory actions
    const ACCOUNTANT_ROLE = await routerV2.ACCOUNTANT_ROLE();
    const OPERATOR_ROLE = await synthesis.OPERATOR_ROLE();


    // setup roles
    tx = await routerV2.grantRole(ACCOUNTANT_ROLE, accountantRole.address);
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


    // setup curveLPToken
    tx = await whitelist.setTokens([[curveLPToken.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]);
    await tx.wait();
    tx = await curveLPToken.mint(portal.address, tokenAmount);
    await tx.wait();
    tx = await portal.connect(routerContract).lock(curveLPToken.address, tokenAmount, alice.address, alice.address);
    await tx.wait();
    tx = await curveLPToken.mint(alice.address, tokenAmount);
    await tx.wait();
    tx = await curveLPToken.connect(alice).approve(routerV2.address, tokenAmount);
    await tx.wait();


    // setup synthetic token
    tx = await whitelist.setTokens([[syntheticToken.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.NotSet]]);
    await tx.wait();
    tx = await synthesis.connect(operatorRole).setSynths([syntheticToken.address]);
    await tx.wait();
    tx = await syntheticToken.mint(alice.address, tokenAmount);
    await tx.wait();
    tx = await syntheticToken.transferOwnership(synthesis.address);
    await tx.wait();


    // setup third party synthetic token and adapter
    tx = await whitelist.setTokens([[thirdPartySynthAdapter.address, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.NotSet]]);
    await tx.wait();
    tx = await synthesis.connect(operatorRole).setSynths([thirdPartySynthAdapter.address]);
    await tx.wait();
    tx = await thirdPartySynthToken.mint(thirdPartySynthAdapter.address, tokenAmount.mul(2));
    await tx.wait();
    tx = await thirdPartySynthAdapter.mint(alice.address, tokenAmount);
    await tx.wait();
    tx = await thirdPartySynthToken.connect(alice).approve(routerV2.address, tokenAmount);
    await tx.wait();
    tx = await thirdPartySynthAdapter.transferOwnership(synthesis.address);
    await tx.wait();


    // setup WETH
    tx = await whitelist.setTokens([[WETH.address, wrappedTokenAmountMin, wrappedTokenAmountMax, bridgeFee, TokenState.InOut]]);
    await tx.wait();  
    tx = await WETH.connect(alice).deposit({value: wrappingEther});
    await tx.wait();
    tx = await WETH.connect(alice).approve(routerV2.address, wrappingEther);
    await tx.wait();

    // other setups
    tx = await opsRegistrar.registerComplexOp([
      ['P', true],
      ['LM', true],
      ['BU', true],
      ['BM', true],
      ['W', true],
      ['Uw', true],
      ['!M', true],
      ['!U', true],
    ]);
    await tx.wait();

    // impersonate contracts
    await impersonateAccount(bridge.address);
    await setBalance(bridge.address, MaxUint256);
    bridgeContract = await ethers.getSigner(bridge.address);


    // other setups
    tx = await addressBook.setRouter([[chainIdFrom, routerV2.address], [chainIdCurrent, routerV2.address], [chainIdTo, routerV2.address]]);
    await tx.wait();

    const deadline = await time.latest() + min10;
    const signature = await getPermitSignature(
      alice,
      curveLPToken,
      routerV2.address,
      tokenAmount,
      deadline
    );
    

    return {
      routerV2, addressBook, whitelist, portal, gateKeeper, bridge, synthesis, thirdPartySynthAdapter,
      curveLPToken, syntheticToken, thirdPartySynthToken, WETH,
      owner, accountantRole, alice, malory, bridgeContract, feesTreasuryContract,
      tokenAmount, executionPrice, wrappingEther, sendingEther, bridgeFee,
      someAddress, originalThirdPartyTokenAddress,
      resumeSelector, chainIdFrom, chainIdCurrent, chainIdTo,
      signature, requestId, cPos, deadline, CrossChainOpState, ExecutionResult
    }
  }

  describe("Should checking the correct operation of the constructor() function", () => {
    describe("Should checking the requires", () => {
      it('Should check require if WETH address is zero', async () => {

        const addressBook = await deployAddressBook();

        expect(await addressBook.WETH()).to.equal(AddressZero);

        await expect(deployRouterV2([addressBook.address]))
          .revertedWith("Router: WETH incorrect");
      });
      describe("Should checking the correct changes state variables", () => {
        it("Should check correct set WETH", async () => {
          const { routerV2, WETH } = await loadFixture(deploy);

          expect(await routerV2.WETH()).to.equal(WETH.address);
        });
      });
    });
  });

  describe("Should checking the correct operation of the receive()", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't WETH", async () => {
        const { routerV2, malory, sendingEther} = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await routerV2.WETH());
  
        await expect(malory.sendTransaction({ to: routerV2.address, value: sendingEther }))
          .revertedWith("Router: Invalid sender");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change Ether balances", async () => {
        const { routerV2, WETH, sendingEther } = await loadFixture(deploy);

        await impersonateAccount(WETH.address);
        await setBalance(WETH.address, MaxUint256);
        const WETHContract = await ethers.getSigner(WETH.address);
        const { routerV2, WETH, sendingEther } = await loadFixture(deploy);

        await impersonateAccount(WETH.address);
        await setBalance(WETH.address, MaxUint256);
        const WETHContract = await ethers.getSigner(WETH.address);

        await expect(WETHContract.sendTransaction({ to: routerV2.address, value: sendingEther }))
        await expect(WETHContract.sendTransaction({ to: routerV2.address, value: sendingEther }))
          .changeEtherBalances(
            [WETH, routerV2],
            [WETH, routerV2],
            [sendingEther.mul(-1), sendingEther]
          );
      });
    });
  });

  describe("Should checking the correct operation of the receiveValidatedData() function", () => {
    describe("Should checking the requires", () => {
      it('Should check require if validated data if caller is not a bridge', async () => {
        const { routerV2, addressBook, malory, resumeSelector, chainIdCurrent } = await loadFixture(deploy);

        const from = await addressBook.router(chainIdCurrent);

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).receiveValidatedData(resumeSelector, from, chainIdCurrent))
          .revertedWith("Router: bridge only");
      });
      it('Should check require if validated data if from is not a router', async () => {
        const { routerV2, addressBook, gateKeeper, bridgeContract, someAddress, resumeSelector, chainIdCurrent } = await loadFixture(deploy);

        const tx = await gateKeeper.setBridge(bridgeContract.address);
        await tx.wait();

        const from = await addressBook.router(chainIdCurrent);

        expect(someAddress).to.not.equal(from);

        await expect(routerV2.connect(bridgeContract).receiveValidatedData(resumeSelector, someAddress, chainIdCurrent))
          .revertedWith("Router: wrong sender");
      });
      it('Should check require if validated data if selector is not resume', async () => {
        const { routerV2, addressBook, gateKeeper, bridgeContract, resumeSelector, chainIdCurrent } = await loadFixture(deploy);

        const tx = await gateKeeper.setBridge(bridgeContract.address);
        await tx.wait();

        const from = await addressBook.router(chainIdCurrent);
        const wrongSelector = "0x00000000";

        expect(wrongSelector).to.not.equal(resumeSelector)

        await expect(routerV2.connect(bridgeContract).receiveValidatedData(wrongSelector, from, chainIdCurrent))
          .revertedWith("Router: wrong selector");
      });
    });
  });
  
  describe("Should checking the correct operation of the start() function for PERMIT_CODE with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, signature, deadline } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        const receipt = await getReceipt(chainIdCurrent, ['P'], [permitParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(routerV2.connect(alice).start(['P'], [permitParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, signature, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          AddressZero,          // to
          AddressZero,          // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        const receipt = await getReceipt(chainIdCurrent, ['LM', 'P'], [synthParams, permitParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM', 'P'], [synthParams, permitParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if token address incorrect", async () => {
        const { routerV2, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, signature, deadline } = await loadFixture(deploy);

        const noPermitToken = await deployERC20Mock(["No Permit Token", "NPT", 18]);

        const permitParams = getPermitParams(
          noPermitToken.address,    // token
          alice.address,            // owner
          tokenAmount,              // amount
          deadline,                 // deadline
          signature.v,              // v
          signature.r,              // r
          signature.s               // s
        )

        const receipt = await getReceipt(chainIdCurrent, ['P'], [permitParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['P'], [permitParams], receipt, {value: executionPrice}))
          .revertedWith("Router: permit failure");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change LP token approve", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, signature, deadline } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        let tx = await curveLPToken.connect(alice).approve(routerV2.address, 0);
        await tx.wait();
        expect(await curveLPToken.allowance(alice.address, routerV2.address)).to.equal(0);

        const receipt = await getReceipt(chainIdCurrent, ['P'], [permitParams], routerV2, alice, accountantRole, executionPrice, deadline);

        tx = await routerV2.connect(alice).start(['P'], [permitParams], receipt, {value: sendingEther})
        await tx.wait();
        expect(await curveLPToken.allowance(alice.address, routerV2.address)).to.equal(tokenAmount);
      });
      it("Should check correct change Ether balances", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, signature, deadline } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        const receipt = await getReceipt(chainIdCurrent, ['P'], [permitParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['P'], [permitParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, routerV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, signature, deadline } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        const receipt = await getReceipt(chainIdCurrent, ['P'], [permitParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['P'], [permitParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, signature, deadline } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        const receipt = await getReceipt(chainIdCurrent, ['P'], [permitParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['P'], [permitParams], receipt, {value: sendingEther}))
          .emit(routerV2, "FeePaid")
          .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, signature, deadline, ExecutionResult } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        const receipt = await getReceipt(chainIdCurrent, ['P'], [permitParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['P'], [permitParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for PERMIT_CODE with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, curveLPToken, malory, alice, tokenAmount, signature, requestId, cPos, deadline } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['P'], [permitParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if current currentOpsIdx isn't zero", async () => {
        const { routerV2, opsRegistrar, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, signature, deadline, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          AddressZero,          // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        await setBridge(gateKeeper, bridgeContract.address);

        const tx = await opsRegistrar.registerComplexOp([
          ['LMP', true]
        ]);
        await tx.wait();

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM', 'P'], [synthParams, permitParams]))
          .revertedWith("Router: permit not allowed");
      });
      it("Should check require if token address incorrect", async () => {
        const { routerV2, gateKeeper, alice, bridgeContract, tokenAmount, signature, requestId, cPos, deadline } = await loadFixture(deploy);

        const noPermitToken = await deployERC20Mock(["No Permit Token", "NPT", 18]);

        const permitParams = getPermitParams(
          noPermitToken.address,    // token
          alice.address,            // owner
          tokenAmount,              // amount
          deadline,                 // deadline
          signature.v,              // v
          signature.r,              // r
          signature.s               // s
        )

        await setBridge(gateKeeper, bridgeContract.address);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['P'], [permitParams]))
          .revertedWith("Router: permit failure");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change LP token approve", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, signature, deadline, requestId, cPos } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        await setBridge(gateKeeper, bridgeContract.address);

        let tx = await curveLPToken.connect(alice).approve(routerV2.address, 0);
        await tx.wait();
        expect(await curveLPToken.allowance(alice.address, routerV2.address)).to.equal(0);

        tx = await routerV2.connect(bridgeContract).resume(requestId, cPos, ['P'], [permitParams])
        await tx.wait();
        expect(await curveLPToken.allowance(alice.address, routerV2.address)).to.equal(tokenAmount);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, signature, deadline, requestId, cPos, ExecutionResult } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        await setBridge(gateKeeper, bridgeContract.address);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['P'], [permitParams]))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, requestId, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the start() function for LOCK_MINT_CODE with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if worng to", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM', 'LM'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM', 'LM'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if sender isn't current from", async () => {
        const { routerV2, curveLPToken, accountantRole, malory, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, malory, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(malory).start(['LM'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if emergencyTo isn't equal sender", async () => {
      it("Should check require if emergencyTo isn't equal sender", async () => {
        const { routerV2, curveLPToken, accountantRole, malory, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          malory.address        // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong emergencyTo");
      });
      it("Should check require if wrong to - nextOp zero and to zero address", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);
      it("Should check require if wrong to - nextOp zero and to zero address", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          AddressZero,          // to
          AddressZero,          // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);
        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: executionPrice}))
        await expect(routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if wrong to - nextOp not zero and to not zero address", async () => {
        const { routerV2, opsRegistrar, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);
      it("Should check require if wrong to - nextOp not zero and to not zero address", async () => {
        const { routerV2, opsRegistrar, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM', 'BU'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await opsRegistrar.registerComplexOp([
          ['LMBU', true],
        ]);
        await tx.wait();

        const receipt = await getReceipt(chainIdCurrent, ['LM', 'BU'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM', 'BU'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if to and emergencyTo is zero address", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          AddressZero,          // to
          chainIdCurrent,       // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          AddressZero           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: executionPrice}))
          .reverted;
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change LP token balances", async () => {
        const { routerV2, portal, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdCurrent,       // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            curveLPToken,
            [alice, portal],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
      it("Should check correct change Ether balances", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdCurrent,       // chainIdTo
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, routerV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chainIdTo
          chainIdTo,            // chainIdTo
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
      it("Should check correct change startedOps", async () => {
        const { routerV2, addressBook, gateKeeper, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chainIdTo
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);
        
        expect(await routerV2.startedOps(nextRequestId)).to.equal(ethers.utils.keccak256(synthParams));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chainIdTo
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "FeePaid")
          .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, addressBook, gateKeeper, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline, ExecutionResult } = await loadFixture(deploy);
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, deadline, ExecutionResult } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chainIdTo
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const requestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);

        await expect(routerV2.connect(alice).start(['LM'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, chainIdTo, requestId, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for LOCK_MINT_CODE for synthetic token", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, curveLPToken, malory, alice, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          AddressZero,          // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['LM'], [synthParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          AddressZero,          // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        await setBridge(gateKeeper, bridgeContract.address);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM', 'LM'], [synthParams, synthParams]))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if wrong current to", async () => {
      it("Should check require if wrong to - zero nextOp and to zero address", async () => {
        const { routerV2, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          AddressZero,          // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if operation already processed", async () => {
      it("Should check require if to and emergencyTo is zero address", async () => {
        const { routerV2, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          AddressZero,          // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .revertedWith("Router: wrong to");
      });
      it("Should check if operation already processed", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          AddressZero,          // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const tx = await routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]);
        await tx.wait();

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .revertedWith("Router: op processed");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change synthetic token balances", async () => {
        const { routerV2, gateKeeper, synthesis, curveLPToken, syntheticToken, alice, bridgeContract, feesTreasuryContract, tokenAmount, bridgeFee, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          0,                    // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const expectedFee = tokenAmount.mul(bridgeFee).div(await synthesis.FEE_DENOMINATOR());
        const expectedAmountOut = tokenAmount.sub(expectedFee);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .changeTokenBalances(
            syntheticToken,
            [alice, feesTreasuryContract],
            [expectedAmountOut, expectedFee]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, signature, deadline, requestId, cPos, ExecutionResult } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          0,                    // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, requestId, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for LOCK_MINT_CODE for adapter", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, malory, alice, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          0,                              // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['LM'], [synthParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, gateKeeper, alice, bridgeContract, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);
      it("Should check require if wrong to - zero nextOp and to zero address", async () => {
        const { routerV2, malory, alice, bridgeContract, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          AddressZero,                    // to
          chainIdTo,                      // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          malory.address                  // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .revertedWith("Router: wrong to");
          .revertedWith("Router: wrong receiver");
      });
      it("Should check if operation already processed", async () => {
        const { routerV2, alice, bridgeContract, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          AddressZero,                    // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        await setBridge(gateKeeper, bridgeContract.address);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .revertedWith("Router: wrong to");
      });
      it("Should check if operation already processed", async () => {
        const { routerV2, gateKeeper, alice, bridgeContract, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          AddressZero,                    // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        await setBridge(gateKeeper, bridgeContract.address);

        const tx = await routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]);
        await tx.wait();

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .revertedWith("Router: op processed");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change synthetic token balances", async () => {
        const { routerV2, gateKeeper, synthesis, thirdPartySynthToken, alice, bridgeContract, feesTreasuryContract, tokenAmount, bridgeFee, chainIdCurrent, originalThirdPartyTokenAddress, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          AddressZero,                    // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        const expectedFee = tokenAmount.mul(bridgeFee).div(await synthesis.FEE_DENOMINATOR());
        const expectedAmountOut = tokenAmount.sub(expectedFee);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .changeTokenBalances(
            thirdPartySynthToken,
            [alice, feesTreasuryContract],
            [expectedAmountOut, expectedFee]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, signature, deadline, requestId, cPos, ExecutionResult } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          AddressZero,          // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, requestId, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the start() function for BURN_UNLOCK_CODE for synthetic token with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU', 'BU'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU', 'BU'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if sender isn't current from", async () => {
        const { routerV2, syntheticToken, accountantRole, malory, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, malory, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(malory).start(['BU'], [synthParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if emergencyTo isn't equal sender", async () => {
        const { routerV2, syntheticToken, accountantRole, malory, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          malory.address          // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong emergencyTo");
      });
      it("Should check require if worng to", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU', 'LM'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU', 'LM'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if sender isn't current emergencyTo", async () => {
      it("Should check require if wrong to - nextOp zero and to zero address", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          AddressZero,            // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if wrong to - nextOp not zero and to not zero address", async () => {
        const { routerV2, opsRegistrar, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address,   // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          chainIdTo,                // chain id to
          chainIdCurrent,           // tokenInChainIdCurrent
          alice.address             // emergencyTo
        );

        const tx = await opsRegistrar.registerComplexOp([
          ['BULM', true],
        ]);
        await tx.wait();

        const receipt = await getReceipt(chainIdCurrent, ['BU', 'LM'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU', 'LM'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if emergencyTo is zero address", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address,   // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          chainIdCurrent,           // chain id to
          chainIdCurrent,           // tokenInChainIdCurrent
          AddressZero               // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: emergencyTo is not equal the sender");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change Synthetic token balances", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            syntheticToken,
            [alice],
            [tokenAmount.mul(-1)]
          );
      });
      it("Should check correct change change Ether balances", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, routerV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
      it("Should check correct change startedOps", async () => {
        const { routerV2, synthesis, addressBook, gateKeeper, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);;

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);

        const updateParams = getSynthParams(
          await syntheticToken.originalToken(),   // tokenIn
          tokenAmount,                            // amountIn
          alice.address,                          // from
          alice.address,                          // to
          chainIdTo,                              // chain id to
          chainIdCurrent,                         // tokenInChainIdCurrent
          alice.address                           // emergencyTo
        );

        expect(await routerV2.startedOps(nextRequestId)).to.equal(ethers.utils.keccak256(updateParams));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "FeePaid")
          .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, addressBook, gateKeeper, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline, ExecutionResult } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);
        
        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, chainIdTo, nextRequestId, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the start() function for BURN_UNLOCK_CODE for adapter token with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU', 'BU'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU', 'BU'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if sender isn't current from", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, malory, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, malory, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(malory).start(['BU'], [synthParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if emergencyTo isn't equal sender", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, malory, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          malory.address                // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong emergencyTo");
      });
      it("Should check require if worng to", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU', 'LM'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU', 'LM'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if sender isn't current emergencyTo", async () => {
      it("Should check require if wrong to - nextOp zero and to zero address", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address,   // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          AddressZero,                    // to
          chainIdTo,                      // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if wrong to - nextOp not zero and to not zero address", async () => {
        const { routerV2, opsRegistrar, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address,   // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          chainIdTo,                      // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        const tx = await opsRegistrar.registerComplexOp([
          ['BULM', true],
        ]);
        await tx.wait();

        const receipt = await getReceipt(chainIdCurrent, ['BU', 'LM'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU', 'LM'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if emergencyTo is zero address", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address,   // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          chainIdCurrent,                 // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          AddressZero                     // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: emergencyTo is not equal the sender");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change Synthetic token balances", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            thirdPartySynthToken,
            [alice],
            [tokenAmount.mul(-1)]
          );
      });
      it("Should check correct change change Ether balances", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther}))
        .changeEtherBalances(
          [alice, routerV2, accountantRole],
          [executionPrice.mul(-1), 0, executionPrice]
        );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
      it("Should check correct change startedOps", async () => {
        const { routerV2, addressBook, gateKeeper, synthesis, thirdPartySynthAdapter, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);

        const updateParams = getSynthParams(
          await thirdPartySynthAdapter.originalToken(), // tokenIn
          tokenAmount,                                  // amountIn
          synthesis.address,                            // from
          alice.address,                                // to
          chainIdTo,                                    // chain id to
          chainIdCurrent,                               // tokenInChainIdCurrent
          alice.address                                 // emergencyTo
        );

        expect(await routerV2.startedOps(nextRequestId)).to.equal(ethers.utils.keccak256(updateParams));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "FeePaid")
          .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, addressBook, gateKeeper, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline, ExecutionResult } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);
        
        const receipt = await getReceipt(chainIdCurrent, ['BU'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BU'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, chainIdTo, nextRequestId, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for BURN_UNLOCK_CODE", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, curveLPToken, alice, malory, tokenAmount, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address,   // tokenIn
          tokenAmount,            // amountIn
          AddressZero,            // from
          alice.address,          // to
          AddressZero,            // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['BU'], [synthParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address,   // tokenIn
          tokenAmount,            // amountIn
          AddressZero,            // from
          alice.address,          // to
          AddressZero,            // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        await setBridge(gateKeeper, bridgeContract.address);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BU', 'BU'], [synthParams, synthParams]))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if wrong current to", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, malory, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          AddressZero,          // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          malory.address        // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BU'], [synthParams]))
          .revertedWith("Router: wrong receiver");
      });
      it("Should check require if to and emergencyTo is zero address", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);
      it("Should check require if wrong to - zero nextOp and to zero address", async () => {
        const { routerV2, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          AddressZero,          // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BU'], [synthParams]))
          .revertedWith("Router: wrong to");
      });
      it("Should check if operation already processed", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);;

        const synthParams = getSynthParams(
          curveLPToken.address,   // tokenIn
          tokenAmount,            // amountIn
          AddressZero,            // from
          alice.address,          // to
          AddressZero,            // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );
        
        const tx = await routerV2.connect(bridgeContract).resume(requestId, cPos, ['BU'], [synthParams]);
        await tx.wait();

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BU'], [synthParams]))
          .revertedWith("Router: op processed");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change Synthetic token balances", async () => {
        const { routerV2, portal, gateKeeper, curveLPToken, alice, bridgeContract, feesTreasuryContract, tokenAmount, bridgeFee, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);;

        const synthParams = getSynthParams(
          curveLPToken.address,   // tokenIn
          tokenAmount,            // amountIn
          AddressZero,            // from
          alice.address,          // to
          AddressZero,            // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const expectedFee = tokenAmount.mul(bridgeFee).div(await portal.FEE_DENOMINATOR());
        const expectedAmountOut = tokenAmount.sub(expectedFee);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BU'], [synthParams]))
          .changeTokenBalances(
            curveLPToken,
            [alice, feesTreasuryContract, portal],
            [expectedAmountOut, expectedFee, tokenAmount.mul(-1)]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, portal, gateKeeper, curveLPToken, alice, bridgeContract, feesTreasuryContract, tokenAmount, bridgeFee, chainIdCurrent, requestId, cPos, ExecutionResult } = await loadFixture(deploy);;

        const synthParams = getSynthParams(
          curveLPToken.address,   // tokenIn
          tokenAmount,            // amountIn
          AddressZero,            // from
          alice.address,          // to
          AddressZero,            // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BU'], [synthParams]))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, requestId, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the start() function for BURN_MINT_CODE for synthetic token with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);;

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM', 'BM'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM', 'BM'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if sender isn't current from", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, malory, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, malory, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(malory).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if emergencyTo isn't equal sender", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, malory, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address,   // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          alice.address,            // to
          chainIdTo,                // chain id to
          chainIdCurrent,           // tokenInChainIdCurrent
          malory.address            // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong emergencyTo");
      });
      it("Should check require if wrong to - nextOp zero and to zero address", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address,   // tokenIn
          tokenAmount,              // amountIn
          alice.address,            // from
          AddressZero,              // to
          chainIdTo,                // chain id to
          chainIdCurrent,           // tokenInChainIdCurrent
          alice.address             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if worng to - nextOp not zero and to not zero address", async () => {
        const { routerV2, opsRegistrar, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM', 'BU'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM', 'BU'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if emergencyTo is zero address", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          AddressZero             // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: emergencyTo is not equal the sender");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change Synthetic token balances", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            syntheticToken,
            [alice],
            [tokenAmount.mul(-1)]
          );
      });
      it("Should check correct change Synthetic token balances", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            syntheticToken,
            [alice],
            [tokenAmount.mul(-1)]
          );
      });
      it("Should check correct change change Ether balances", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, routerV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
      it("Should check correct change startedOps", async () => {
        const { routerV2, addressBook, gateKeeper, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);

        const updateParams = getSynthParams(
          await syntheticToken.originalToken(),   // tokenIn
          tokenAmount,                            // amountIn
          alice.address,                          // from
          alice.address,                          // to
          chainIdTo,                              // chain id to
          chainIdCurrent,                         // tokenInChainIdCurrent
          alice.address                           // emergencyTo
        );

        expect(await routerV2.startedOps(nextRequestId)).to.equal(ethers.utils.keccak256(updateParams));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
        const { routerV2, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "FeePaid")
          .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, addressBook, gateKeeper, syntheticToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline, ExecutionResult } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          syntheticToken.address, // tokenIn
          tokenAmount,            // amountIn
          alice.address,          // from
          alice.address,          // to
          chainIdTo,              // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);
        
        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, chainIdTo, nextRequestId, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the start() function for BURN_MINT_CODE for adapter token with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const wrongSendingEther = executionPrice.sub(1);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM', 'BM'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM', 'BM'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if sender isn't current from", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, malory, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, malory, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(malory).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if emergencyTo isn't equal sender ", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, malory, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          malory.address                // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong emergencyTo");
      });
      it("Should check require if wrong to - nextOp zero and to zero address", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address,   // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          AddressZero,                    // to
          chainIdTo,                      // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if worng to - nextOp not zero and to not zero address", async () => {
        const { routerV2, opsRegistrar, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM', 'BU'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM', 'BU'], [synthParams, synthParams], receipt, {value: executionPrice}))
        const tx = await opsRegistrar.registerComplexOp([
          ['BMLM', true],
        ]);
        await tx.wait();

        const receipt = await getReceipt(chainIdCurrent, ['BM', 'LM'], [synthParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM', 'LM'], [synthParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if emergencyTo is zero address", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          AddressZero                   // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: emergencyTo is not equal the sender");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change Synthetic token balances", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            thirdPartySynthToken,
            [alice],
            [tokenAmount.mul(-1)]
          );
      });
      it("Should check correct change change Ether balances", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, routerV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
      it("Should check correct change startedOps", async () => {
        const { routerV2, addressBook, gateKeeper, synthesis, thirdPartySynthAdapter, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther});
        await tx.wait();

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);

        const updateParams = getSynthParams(
          await thirdPartySynthAdapter.originalToken(), // tokenIn
          tokenAmount,                                  // amountIn
          synthesis.address,                            // from
          alice.address,                                // to
          chainIdTo,                                    // chain id to
          chainIdCurrent,                               // tokenInChainIdCurrent
          alice.address                                 // emergencyTo
        );

        expect(await routerV2.startedOps(nextRequestId)).to.equal(ethers.utils.keccak256(updateParams));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
        const { routerV2, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "FeePaid")
          .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, addressBook, gateKeeper, thirdPartySynthToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, deadline, ExecutionResult } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          thirdPartySynthToken.address, // tokenIn
          tokenAmount,                  // amountIn
          alice.address,                // from
          alice.address,                // to
          chainIdTo,                    // chain id to
          chainIdCurrent,               // tokenInChainIdCurrent
          alice.address                 // emergencyTo
        );

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);
        
        const receipt = await getReceipt(chainIdCurrent, ['BM'], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['BM'], [synthParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, chainIdTo, nextRequestId, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for BURN_MINT_CODE for synthetic token", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, curveLPToken, alice, malory, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['BM'], [synthParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          AddressZero,          // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        await setBridge(gateKeeper, bridgeContract.address);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM', 'BM'], [synthParams, synthParams]))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if wrong current to", async () => {
        const { routerV2, curveLPToken, alice, malory, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          AddressZero,          // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          malory.address        // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .revertedWith("Router: wrong receiver");
      });
      it("Should check require if to and emergencyTo is zero address", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);
      it("Should check require if wrong to - zero nextOp and to zero address", async () => {
        const { routerV2, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          AddressZero,          // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .revertedWith("Router: wrong to");
      });
      it("Should check if operation already processed", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          AddressZero,          // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const tx = await routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]);
        await tx.wait();

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .revertedWith("Router: op processed");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change synthetic token balances", async () => {
        const { routerV2, gateKeeper, synthesis, curveLPToken, syntheticToken, alice, bridgeContract, feesTreasuryContract, tokenAmount, bridgeFee, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          AddressZero,          // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const expectedFee = tokenAmount.mul(bridgeFee).div(await synthesis.FEE_DENOMINATOR());
        const expectedAmountOut = tokenAmount.sub(expectedFee);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .changeTokenBalances(
            syntheticToken,
            [alice, feesTreasuryContract],
            [expectedAmountOut, expectedFee]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, portal, gateKeeper, curveLPToken, alice, bridgeContract, feesTreasuryContract, tokenAmount, bridgeFee, chainIdCurrent, requestId, cPos, ExecutionResult } = await loadFixture(deploy);;

        const synthParams = getSynthParams(
          curveLPToken.address,   // tokenIn
          tokenAmount,            // amountIn
          AddressZero,            // from
          alice.address,          // to
          AddressZero,            // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, requestId, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for BURN_MINT_CODE for adapter", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, alice, malory, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          AddressZero,                    // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['BM'], [synthParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, gateKeeper, alice, bridgeContract, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);
      it("Should check require if wrong to - zero nextOp and to zero address", async () => {
        const { routerV2, alice, bridgeContract, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);
      it("Should check require if wrong current to", async () => {
        const { routerV2, alice, malory, bridgeContract, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          AddressZero,                    // to
          AddressZero,                    // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .revertedWith("Router: wrong to");
          .revertedWith("Router: wrong receiver");
      });
      it("Should check require if to and emergencyTo is zero address", async () => {
        const { routerV2, gateKeeper, curveLPToken, alice, bridgeContract, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress,   // tokenIn
          tokenAmount,                      // amountIn
          alice.address,                    // from
          AddressZero,                      // to
          chainIdTo,                        // chain id to
          chainIdCurrent,                   // tokenInChainIdCurrent
          alice.address                     // emergencyTo
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .revertedWith("Router: wrong to");
      });
      it("Should check if operation already processed", async () => {
        const { routerV2, alice, bridgeContract, tokenAmount, originalThirdPartyTokenAddress, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          AddressZero,                    // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        await setBridge(gateKeeper, bridgeContract.address);

        const tx = await routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]);
        await tx.wait();

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .revertedWith("Router: op processed");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change synthetic token balances", async () => {
        const { routerV2, gateKeeper, synthesis, thirdPartySynthToken, alice, bridgeContract, feesTreasuryContract, tokenAmount, bridgeFee, chainIdCurrent, originalThirdPartyTokenAddress, requestId, cPos } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          AddressZero,                    // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );

        const expectedFee = tokenAmount.mul(bridgeFee).div(await synthesis.FEE_DENOMINATOR());
        const expectedAmountOut = tokenAmount.sub(expectedFee);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .changeTokenBalances(
            thirdPartySynthToken,
            [alice, feesTreasuryContract],
            [expectedAmountOut, expectedFee]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, gateKeeper, synthesis, thirdPartySynthToken, alice, bridgeContract, feesTreasuryContract, tokenAmount, bridgeFee, chainIdCurrent, originalThirdPartyTokenAddress, requestId, cPos, ExecutionResult } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          originalThirdPartyTokenAddress, // tokenIn
          tokenAmount,                    // amountIn
          alice.address,                  // from
          alice.address,                  // to
          AddressZero,                    // chain id to
          chainIdCurrent,                 // tokenInChainIdCurrent
          alice.address                   // emergencyTo
        );
  
        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BM'], [synthParams]))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, requestId, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the start() function for 'WRAP_CODE' with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const wrongSendingEther = executionPrice.sub(1);

        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['W'], [wrapParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, WETH, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, wrappingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
      });
      it("Should check require if sender isn't current from", async () => {
        const { routerV2, WETH, accountantRole, alice, malory, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, malory, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(malory).start(['W'], [wrapParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if worng to - nextOp not zero and to not zero", async () => {
        const { routerV2, opsRegistrar, curveLPToken, WETH, accountantRole, alice, tokenAmount, executionPrice, wrappingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const tx = await opsRegistrar.registerComplexOp([
          ['WLM', true],
        ]);
        await tx.wait();

        const receipt = await getReceipt(chainIdCurrent, ['W', 'LM'], [wrapParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['W', 'LM'], [wrapParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if worng to - nextOp zero and to zero", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          AddressZero,      // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['W'], [wrapParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if currentOpsIdx isn't zero", async () => {
        const { routerV2, opsRegistrar, curveLPToken, WETH, accountantRole, alice, tokenAmount, executionPrice, wrappingEther, sendingEther, chainIdCurrent, signature, deadline } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['LM', 'W'], [synthParams, wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['LM', 'W'], [synthParams, wrapParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if sender isn't current from", async () => {
        const { routerV2, WETH, accountantRole, alice, malory, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, malory, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(malory).start(['W'], [wrapParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if worng to", async () => {
        const { routerV2, WETH, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, wrappingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
      it("Should check require if worng to - nextOp not zero and to not zero", async () => {
        const { routerV2, opsRegistrar, curveLPToken, WETH, accountantRole, alice, tokenAmount, executionPrice, wrappingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['W', 'LM'], [wrapParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['W', 'LM'], [wrapParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
        const tx = await opsRegistrar.registerComplexOp([
          ['WLM', true],
        ]);
        await tx.wait();

        const receipt = await getReceipt(chainIdCurrent, ['W', 'LM'], [wrapParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['W', 'LM'], [wrapParams, synthParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if worng to - nextOp zero and to zero", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          AddressZero,      // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['W'], [wrapParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if currentOpsIdx isn't zero", async () => {
        const { routerV2, opsRegistrar, curveLPToken, WETH, accountantRole, alice, tokenAmount, executionPrice, wrappingEther, sendingEther, chainIdCurrent, signature, deadline } = await loadFixture(deploy);

        const permitParams = getPermitParams(
          curveLPToken.address,   // token
          alice.address,          // owner
          tokenAmount,            // amount
          deadline,               // deadline
          signature.v,            // v
          signature.r,            // r
          signature.s             // s
        )

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const tx = await opsRegistrar.registerComplexOp([
          ['PW', true],
        ]);
        await tx.wait();

        const receipt = await getReceipt(chainIdCurrent, ['P', 'W'], [permitParams, wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

          await expect(routerV2.connect(alice).start(['P', 'W'], [permitParams, wrapParams], receipt, {value: sendingEther}))
            .revertedWith("Router: wrap not allowed");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change WrappedETH token balances", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['W'], [wrapParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            WETH,
            [alice],
            [wrappingEther]
          );
      });
      it("Should check change Ether balances", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['W'], [wrapParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, WETH, routerV2, accountantRole],
            [executionPrice.add(wrappingEther).mul(-1), wrappingEther, 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['W'], [wrapParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
      const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

      const wrapParams = getWrapParams(
        WETH.address,     // tokenIn
        wrappingEther,    // amountIn
        alice.address,    // from
        alice.address,    // to
      );
  
        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);
  
        await expect(routerV2.connect(alice).start(['W'], [wrapParams], receipt, {value: sendingEther}))
          .emit(routerV2, "FeePaid")
          .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, addressBook, gateKeeper, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, chainIdTo, deadline, ExecutionResult } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );
        
        const receipt = await getReceipt(chainIdCurrent, ['W'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);
  
        await expect(routerV2.connect(alice).start(['W'], [wrapParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for 'WRAP_CODE' with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, WETH, alice, malory, bridgeContract, wrappingEther, requestId, cPos } = await loadFixture(deploy);
        
        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['W'], [wrapParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, gateKeeper, WETH, alice, bridgeContract, wrappingEther, requestId, cPos } = await loadFixture(deploy);
        
        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        await setBridge(gateKeeper, bridgeContract.address);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['W'], [wrapParams]))
          .revertedWith("Router: wrong sequence of operations");
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for 'WRAP_CODE' with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, WETH, alice, malory, bridgeContract, wrappingEther, requestId, cPos } = await loadFixture(deploy);
        
        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const wrongSendingEther = executionPrice.sub(1);

        const receipt = await getReceipt(chainIdCurrent, ['Uw'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['Uw'], [wrapParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, curveLPToken, WETH, accountantRole, alice, tokenAmount, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
      });
      it("Should check require if sender isn't current from", async () => {
        const { routerV2, WETH, accountantRole, alice, malory, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['Uw'], [wrapParams], routerV2, malory, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(malory).start(['Uw'], [wrapParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if worng to", async () => {
        const { routerV2, opsRegistrar, WETH, accountantRole, alice, executionPrice, wrappingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const tx = await opsRegistrar.registerComplexOp([
          ['UwUw', true],
        ]);
        await tx.wait();

        const receipt = await getReceipt(chainIdCurrent, ['Uw', 'Uw'], [wrapParams, wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['Uw', 'Uw'], [wrapParams, wrapParams], receipt, {value: executionPrice}))
          .revertedWith("Router: wrong to");
      });
      it("Should check require if currentOpsIdx isn't zero ", async () => {
        const { routerV2, opsRegistrar, curveLPToken, WETH, accountantRole, alice, tokenAmount, executionPrice, wrappingEther, sendingEther, chainIdCurrent, chainIdTo, deadline } = await loadFixture(deploy);

        const unWrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          AddressZero       // to
        );

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['Uw', 'LM'], [wrapParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

          await expect(routerV2.connect(alice).start(['Uw', 'LM'], [wrapParams, synthParams], receipt, {value: sendingEther}))
            .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if sender isn't current from", async () => {
        const { routerV2, WETH, accountantRole, alice, malory, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['Uw'], [wrapParams], routerV2, malory, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(malory).start(['Uw'], [wrapParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sender");
        const tx = await opsRegistrar.registerComplexOp([
          ['UwLM', true],
        ]);
        await tx.wait();

        const receipt = await getReceipt(chainIdCurrent, ['Uw', 'LM'], [unWrapParams, synthParams], routerV2, alice, accountantRole, executionPrice, deadline);

          await expect(routerV2.connect(alice).start(['Uw', 'LM'], [unWrapParams, synthParams], receipt, {value: sendingEther}))
            .revertedWith("Router: unwrap not allowed");
      });
      it("Should check require if sender wrong WETH", async () => {
        const { routerV2, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);
        
        const wrongWETH = await deployWETH9();
        let tx = await wrongWETH.connect(alice).deposit({value: wrappingEther});
        await tx.wait();
        tx = await wrongWETH.connect(alice).approve(routerV2.address, wrappingEther);
        await tx.wait();

        const wrapParams = getWrapParams(
          wrongWETH.address,    // tokenIn
          wrappingEther,        // amountIn
          alice.address,        // from
          alice.address,        // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['Uw'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['Uw'], [wrapParams], receipt, {value: sendingEther}))
          .reverted;
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change WrappedETH token balances", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['Uw'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['Uw'], [wrapParams], receipt, {value: sendingEther}))
          .changeTokenBalances(
            WETH,
            [alice],
            [wrappingEther.mul(-1)]
          );
      });
      it("Should check change Ether balances", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['Uw'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['Uw'], [wrapParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, WETH, routerV2, accountantRole],
            [executionPrice.mul(-1).add(wrappingEther), wrappingEther.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );

        const receipt = await getReceipt(chainIdCurrent, ['Uw'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['Uw'], [wrapParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
        const { routerV2, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, deadline } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );
    
          const receipt = await getReceipt(chainIdCurrent, ['Uw'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);
    
          await expect(routerV2.connect(alice).start(['Uw'], [wrapParams], receipt, {value: sendingEther}))
            .emit(routerV2, "FeePaid")
            .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, addressBook, gateKeeper, WETH, accountantRole, alice, executionPrice, wrappingEther, sendingEther, chainIdCurrent, chainIdTo, deadline, ExecutionResult } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          alice.address,    // from
          alice.address,    // to
        );
        
        const receipt = await getReceipt(chainIdCurrent, ['Uw'], [wrapParams], routerV2, alice, accountantRole, executionPrice, deadline);
    
        await expect(routerV2.connect(alice).start(['Uw'], [wrapParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for 'UNWRAP_CODE' with executionPrice", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, WETH, alice, malory, bridgeContract, wrappingEther, requestId, cPos } = await loadFixture(deploy);
        
        const wrapParams = getWrapParams(
          WETH.address,             // tokenIn
          wrappingEther,            // amountIn
          bridgeContract.address,   // from
          alice.address,            // to
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['Uw'], [wrapParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, gateKeeper, WETH, alice, bridgeContract, wrappingEther, requestId, cPos } = await loadFixture(deploy);
      it("Should check require if wrong sender", async () => {
        const { routerV2, WETH, alice, malory, bridgeContract, wrappingEther, requestId, cPos } = await loadFixture(deploy);
        
        const wrapParams = getWrapParams(
          WETH.address,     // tokenIn
          wrappingEther,    // amountIn
          malory.address,   // from
          alice.address     // to
        );

        await setupForResumeUw(WETH, routerV2, bridgeContract, alice, wrappingEther);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['Uw'], [wrapParams]))
          .revertedWith("Router: wrong sender");
      });
      it("Should check require if wrong to", async () => {
        const { routerV2, opsRegistrar, WETH, alice, bridgeContract, wrappingEther, requestId, cPos } = await loadFixture(deploy);
        
        const wrapParams = getWrapParams(
          WETH.address,               // tokenIn
          wrappingEther,              // amountIn
          bridgeContract.address,     // from
          alice.address,              // to
        );

        const tx = await opsRegistrar.registerComplexOp([
          ['UwUw', true],
        ]);
        await tx.wait();
        
        await setupForResumeUw(WETH, routerV2, bridgeContract, alice, wrappingEther);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['Uw', 'Uw'], [wrapParams, wrapParams]))
        .revertedWith("Router: wrong to");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change WrappedETH token balances", async () => {
        const { routerV2, WETH, alice, bridgeContract, wrappingEther, requestId, cPos } = await loadFixture(deploy);
        
        const wrapParams = getWrapParams(
          WETH.address,             // tokenIn
          wrappingEther,            // amountIn
          bridgeContract.address,   // from
          alice.address,            // to
        );

        await setupForResumeUw(WETH, routerV2, gateKeeper, bridgeContract, alice, wrappingEther);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['Uw'], [wrapParams]))
          .changeTokenBalances(
            WETH,
            [bridgeContract],
            [wrappingEther.mul(-1)]
          );
      });
      it("Should check change Ether balances", async () => {
        const { routerV2, WETH, alice, bridgeContract, wrappingEther,  requestId, cPos } = await loadFixture(deploy);

        const wrapParams = getWrapParams(
          WETH.address,             // tokenIn
          wrappingEther,            // amountIn
          bridgeContract.address,   // from
          alice.address,            // to
        );

        await setupForResumeUw(WETH, routerV2, bridgeContract, alice, wrappingEther);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['Uw'], [wrapParams]))
          .changeEtherBalances(
            [alice],
            [wrappingEther]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, WETH, alice, bridgeContract, wrappingEther, chainIdCurrent, requestId, cPos, ExecutionResult } = await loadFixture(deploy);
          
        const wrapParams = getWrapParams(
          WETH.address,             // tokenIn
          wrappingEther,            // amountIn
          bridgeContract.address,   // from
          alice.address,            // to
        );
  
        await setBridge(gateKeeper, bridgeContract.address);
  
        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['Uw'], [wrapParams]))
          .revertedWith("Router: wrong sequence of operations");
      });
    });
  });

  describe("Should checking the correct operation of the start() function for EMERGENCY_UNLOCK_CODE", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            AddressZero,          // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyTo
          ]
        );

        const wrongSendingEther = executionPrice.sub(1);

        const receipt = await getReceipt(chainIdCurrent, ['!M'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['!M'], [cancelParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, accountantRole, alice, executionPrice, sendingEther, chainIdCurrent, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent    // chainIdTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['!M', '!M'], [cancelParams, cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['!M', '!M'], [cancelParams, cancelParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if operation with requestId succeeded", async () => {
        const { routerV2, gateKeeper, curveLPToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, requestId, cPos, deadline, CrossChainOpState } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          AddressZero,          // from
          alice.address,        // to
          0,                    // chain id tos
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            AddressZero,          // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyParams
          ]   
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['LM'], [synthParams]))
          .not.reverted;

        expect(await routerV2.processedOps(requestId)).to.equal(CrossChainOpState.Succeeded);

        const receipt = await getReceipt(chainIdCurrent, ['!M'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['!M'], [cancelParams], receipt, {value: sendingEther}))
          .revertedWith("Router: op processed");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Check correct change processedOps if operation with requestId failed", async () => {
        const { routerV2, curveLPToken, addressBook, accountantRole, alice, malory, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, requestId, cPos, deadline, CrossChainOpState } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address, // tokenIn
          tokenAmount,          // amountIn
          alice.address,        // from
          alice.address,        // to
          chainIdTo,            // chain id to
          chainIdCurrent,       // tokenInChainIdCurrent
          alice.address         // emergencyTo
        );

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            AddressZero,          // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyTo
          ]
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['LM'], [synthParams]))
          .revertedWith("Router: bridge only");

        expect(await routerV2.processedOps(requestId)).to.not.equal(CrossChainOpState.Succeeded);

        const receipt = await getReceipt(chainIdCurrent, ['!M'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['!M'], [cancelParams], receipt, {value: sendingEther});
        await tx.wait();

        expect(await routerV2.processedOps(requestId)).to.equal(CrossChainOpState.Reverted);
      });
      it("Check correct change processedOps if operation with requestId not processd", async () => {
        const { routerV2, accountantRole, curveLPToken, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, requestId, deadline, CrossChainOpState } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            AddressZero,          // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyTo
          ]
        );

        expect(await routerV2.processedOps(requestId)).to.not.equal(CrossChainOpState.Succeeded);

        const receipt = await getReceipt(chainIdCurrent, ['!M'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['!M'], [cancelParams], receipt, {value: sendingEther});
        await tx.wait();

        expect(await routerV2.processedOps(requestId)).to.equal(CrossChainOpState.Reverted);
      });
      it("Should check correct change ether balances", async () => {
        const { routerV2, addressBook, whitelist, portal, opsRegistrar, gateKeeper, bridge, synthesis, thirdPartySynthAdapter, curveLPToken, syntheticToken, thirdPartySynthToken, WETH, owner, accountantRole, alice, malory, bridgeContract, feesTreasuryContract, tokenAmount, executionPrice, wrappingEther, sendingEther, bridgeFee, someAddress, originalThirdPartyTokenAddress, resumeSelector, chainIdFrom, chainIdCurrent, chainIdTo, signature, requestId, cPos, deadline, CrossChainOpState } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            AddressZero,          // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyTo
          ]
        );

        const receipt = await getReceipt(chainIdCurrent, ['!M'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['!M'], [cancelParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, routerV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, accountantRole, curveLPToken, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            AddressZero,          // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyTo
          ]
        );

        const receipt = await getReceipt(chainIdCurrent, ['!M'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['!M'], [cancelParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
      it("Should check correct change startedOps", async () => {
        const { routerV2, addressBook, gateKeeper, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            AddressZero,          // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyTo
          ]
        );

        const receipt = await getReceipt(chainIdCurrent, ['!M'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['!M'], [cancelParams], receipt, {value: sendingEther});
        await tx.wait();

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdCurrent, chainIdCurrent);

        expect(await routerV2.startedOps(nextRequestId)).to.equal(ethers.utils.keccak256(cancelParams));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
        const { routerV2, addressBook, curveLPToken, accountantRole, alice, malory, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, requestId, cPos, deadline, CrossChainOpState } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            AddressZero,          // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyTo
          ]
        );
  
        const receipt = await getReceipt(chainIdCurrent, ['!M'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);
  
        await expect(routerV2.connect(alice).start(['!M'], [cancelParams], receipt, {value: sendingEther}))
          .emit(routerV2, "FeePaid")
          .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, addressBook, curveLPToken, accountantRole, alice, malory, tokenAmount, executionPrice, sendingEther, chainIdCurrent, chainIdTo, requestId, cPos, deadline, CrossChainOpState, ExecutionResult } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent    // chainIdTo
        );

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdCurrent, chainIdCurrent);

        const receipt = await getReceipt(chainIdCurrent, ['!M'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        console.log("requestId", requestId);
        console.log("nextRequestId", nextRequestId);
        // 0x8345123ff9c94a18dc6ef3d00f3030de5cc8ce5a2e25df13dc0ff5f971d1b45b;
  
        await expect(routerV2.connect(alice).start(['!M'], [cancelParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, chainIdTo, nextRequestId, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for EMERGENCY_UNLOCK_CODE", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, curveLPToken, alice, malory, tokenAmount, chainIdCurrent, chainIdTo, requestId, cPos } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,    // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            alice.address,        // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyTo
          ]
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['!M'], [cancelParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, gateKeeper, curveLPToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, resumeSelector, chainIdCurrent, chainIdTo, requestId, cPos, deadline } = await loadFixture(deploy);
      it("Should check require if wrong started operation requestId", async () => {
        const { routerV2, gateKeeper, bridgeContract, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,    // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            alice.address,        // from
            alice.address,        // to
            chainIdTo,            // chain id to
            chainIdCurrent,       // tokenInChainIdCurrent
            alice.address         // emergencyTo
          ]
        );

        expect(await routerV2.startedOps(requestId)).to.equal("0x");

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['!M'], [cancelParams]))
          .revertedWith("Router: op not started");
      });
      it("Should check require if not set currentChainIdFrom", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, requestId, cPos, deadline } = await loadFixture(deploy);

        const txReceipt = await startCrossChainTransfer('LM', routerV2, curveLPToken, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline);
        const decodeEvent = await getDecodeLogComplexOpProcessed(txReceipt);

        const cancelParams = getCancelParams(
          decodeEvent.nextRequestId,    // requestId
          chainIdCurrent,               // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            alice.address,        // from
            alice.address,        // to
            chainIdTo,            // chainIdTo
            chainIdCurrent,       // tokenInChainIdFrom
            alice.address         // emergencyTo
          ]
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['!M'], [cancelParams]))
          .revertedWith("Router: wrong emergency init");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Check correct change token balances", async () => {
        const { routerV2, portal, gateKeeper, curveLPToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, resumeSelector, chainIdCurrent, chainIdTo, requestId, cPos, deadline } = await loadFixture(deploy);

        const txReceipt = await startCrossChainTransfer('LM', routerV2, curveLPToken, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline);
        const decodeEvent = await getDecodeLogComplexOpProcessed(txReceipt);

        const cancelParams = getCancelParams(
          decodeEvent.nextRequestId,    // requestId
          AddressZero,                  // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            alice.address,        // from
            alice.address,        // to
            chainIdTo,            // chainIdTo
            chainIdCurrent,       // tokenInChainIdFrom
            alice.address         // emergencyTo
          ]
        );

        await setupForResumeEmergancy(routerV2, gateKeeper, bridgeContract, resumeSelector, chainIdTo);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['!M'], [cancelParams]))
          .changeTokenBalances(
            curveLPToken,
            [portal, alice],
            [tokenAmount.mul(-1), tokenAmount]
          )
      });
      it("Check correct change startedOps", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, resumeSelector, chainIdCurrent, chainIdTo, requestId, cPos, deadline } = await loadFixture(deploy);

        const txReceipt = await startCrossChainTransfer('LM', routerV2, curveLPToken, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline);
        const decodeEvent = await getDecodeLogComplexOpProcessed(txReceipt);

        const cancelParams = getCancelParams(
          decodeEvent.nextRequestId,    // requestId
          AddressZero,                  // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            alice.address,        // from
            alice.address,        // to
            chainIdTo,            // chainIdTo
            chainIdCurrent,       // tokenInChainIdFrom
            alice.address         // emergencyTo
          ]
        );

        await setupForResumeEmergancy(routerV2, gateKeeper, bridgeContract, resumeSelector, chainIdTo);

        const tx = await routerV2.connect(bridgeContract).resume(requestId, cPos, ['!M'], [cancelParams]);
        await tx.wait();

        expect(await routerV2.startedOps(decodeEvent.nextRequestId)).to.equal(HashZero);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, resumeSelector, chainIdCurrent, chainIdTo, requestId, cPos, deadline, ExecutionResult } = await loadFixture(deploy);

        const txReceipt = await startCrossChainTransfer('LM', routerV2, curveLPToken, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline);
        const decodeEvent = await getDecodeLogComplexOpProcessed(txReceipt);

        const cancelParams = getCancelParams(
          decodeEvent.nextRequestId,    // requestId
          AddressZero,                  // chainIdTo
          [
            curveLPToken.address, // tokenIn
            tokenAmount,          // amountIn
            alice.address,        // from
            alice.address,        // to
            chainIdTo,            // chainIdTo
            chainIdCurrent,       // tokenInChainIdFrom
            alice.address         // emergencyTo
          ]
        );

        await setupForResumeEmergancy(routerV2, gateKeeper, bridgeContract, resumeSelector, chainIdTo);
  
        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['!M'], [cancelParams]))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, requestId, 0, HashZero, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the start() function for EMERGENCY_MINT_CODE", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sendingEther less than executionPrice", async () => {
        const { routerV2, accountantRole, alice, curveLPToken, tokenAmount, executionPrice, chainIdCurrent, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        const wrongSendingEther = executionPrice.sub(1);

        const receipt = await getReceipt(chainIdCurrent, ['!U'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['!U'], [cancelParams], receipt, {value: wrongSendingEther}))
          .revertedWith("Router: invalid amount");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, accountantRole, alice, executionPrice, sendingEther, chainIdCurrent, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent    // chainIdTo
        );

        const receipt = await getReceipt(chainIdCurrent, ['!U', '!U'], [cancelParams, cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['!U', '!U'], [cancelParams, cancelParams], receipt, {value: sendingEther}))
          .revertedWith("Router: wrong sequence of operations");
      });
      it("Should check require if operation with requestId succeeded", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, sendingEther, chainIdCurrent, requestId, cPos, deadline, CrossChainOpState } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address,   // tokenIn
          tokenAmount,            // amountIn
          AddressZero,            // from
          alice.address,          // to
          0,                      // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,     // tokenIn
            tokenAmount,              // amountIn
            AddressZero,              // from
            alice.address,            // to
            0,                        // chain id to
            chainIdCurrent,           // tokenInChainIdCurrent
            alice.address             // emergencyTo
          ]
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['BU'], [synthParams]))
          .not.reverted;

        expect(await routerV2.processedOps(requestId)).to.equal(CrossChainOpState.Succeeded);

        const receipt = await getReceipt(chainIdCurrent, ['!U'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['!U'], [cancelParams], receipt, {value: sendingEther}))
          .revertedWith("Router: op processed");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Check correct change processedOps if operation with requestId failed", async () => {
        const { routerV2, addressBook, curveLPToken, accountantRole, alice, malory, tokenAmount, executionPrice, sendingEther, chainIdCurrent, requestId, cPos, deadline, CrossChainOpState } = await loadFixture(deploy);

        const synthParams = getSynthParams(
          curveLPToken.address,   // tokenIn
          tokenAmount,            // amountIn
          AddressZero,            // from
          alice.address,          // to
          AddressZero,            // chain id to
          chainIdCurrent,         // tokenInChainIdCurrent
          alice.address           // emergencyTo
        );

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['BU'], [synthParams]))
          .revertedWith("Router: bridge only");

        expect(await routerV2.processedOps(requestId)).to.not.equal(CrossChainOpState.Succeeded);

        const receipt = await getReceipt(chainIdCurrent, ['!U'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['!U'], [cancelParams], receipt, {value: sendingEther});
        await tx.wait();

        expect(await routerV2.processedOps(requestId)).to.equal(CrossChainOpState.Reverted);
      });
      it("Check correct change processedOps if operation with requestId not processd", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, requestId, deadline, CrossChainOpState } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        expect(await routerV2.processedOps(requestId)).to.not.equal(CrossChainOpState.Succeeded);

        const receipt = await getReceipt(chainIdCurrent, ['!U'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['!U'], [cancelParams], receipt, {value: sendingEther});
        await tx.wait();

        expect(await routerV2.processedOps(requestId)).to.equal(CrossChainOpState.Reverted);
      });
      it("Should check correct change ether balances", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        const receipt = await getReceipt(chainIdCurrent, ['!U'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['!U'], [cancelParams], receipt, {value: sendingEther}))
          .changeEtherBalances(
            [alice, routerV2, accountantRole],
            [executionPrice.mul(-1), 0, executionPrice]
          );
      });
      it("Should check correct change nonces", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        const receipt = await getReceipt(chainIdCurrent, ['!U'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const noncesBefore = await routerV2.nonces(alice.address);

        const tx = await routerV2.connect(alice).start(['!U'], [cancelParams], receipt, {value: sendingEther});
        await tx.wait();

        const noncesAfter = await routerV2.nonces(alice.address);
        
        expect(noncesAfter).to.equal(noncesBefore.add(1));
      });
      it("Should check correct change startedOps", async () => {
        const { routerV2, addressBook, gateKeeper, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        const receipt = await getReceipt(chainIdCurrent, ['!U'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const tx = await routerV2.connect(alice).start(['!U'], [cancelParams], receipt, {value: sendingEther});
        await tx.wait();

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdCurrent, chainIdCurrent);

        expect(await routerV2.startedOps(nextRequestId)).to.equal(ethers.utils.keccak256(cancelParams));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event FeePaid", async () => {
        const { routerV2, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, requestId, deadline } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        const receipt = await getReceipt(chainIdCurrent, ['!U'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        await expect(routerV2.connect(alice).start(['!U'], [cancelParams], receipt, {value: sendingEther}))
          .emit(routerV2, "FeePaid")
          .withArgs(alice.address, accountantRole.address, executionPrice);
      });
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, addressBook, gateKeeper, curveLPToken, accountantRole, alice, tokenAmount, executionPrice, sendingEther, chainIdCurrent, requestId, deadline, ExecutionResult } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,    // requestId
          chainIdTo     // chainIdTo
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        const receipt = await getReceipt(chainIdCurrent, ['!U'], [cancelParams], routerV2, alice, accountantRole, executionPrice, deadline);

        const nextRequestId = await getRequestId(addressBook, gateKeeper, chainIdTo, chainIdCurrent);
          
        console.log("requestId", requestId);
        console.log("nextRequestId", nextRequestId);
        // 0x8345123ff9c94a18dc6ef3d00f3030de5cc8ce5a2e25df13dc0ff5f971d1b45b

        await expect(routerV2.connect(alice).start(['!U'], [cancelParams], receipt, {value: sendingEther}))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, HashZero, chainIdTo, nextRequestId, ExecutionResult.Succeeded, 0);
      });
    });
  });

  describe("Should checking the correct operation of the resume() function for EMERGENCY_MINT_CODE", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't bridge", async () => {
        const { routerV2, addressBook, curveLPToken, tokenAmount, alice, malory, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        expect(malory.address).to.not.equal(await addressBook.bridge());

        await expect(routerV2.connect(malory).resume(requestId, cPos, ['!U'], [cancelParams]))
          .revertedWith("Router: bridge only");
      });
      it("Should check require if wrong sequence of operations", async () => {
        const { routerV2, gateKeeper, syntheticToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, resumeSelector, chainIdCurrent, chainIdTo, requestId, cPos, deadline } = await loadFixture(deploy);
      it("Should check require if wrong started operation requestId", async () => {
        const { routerV2, gateKeeper, bridgeContract, chainIdCurrent, requestId, cPos } = await loadFixture(deploy);

        const cancelParams = getCancelParams(
          requestId,        // requestId
          chainIdCurrent,   // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            AddressZero,            // from
            alice.address,          // to
            0,                      // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        expect(await routerV2.startedOps(requestId)).to.equal("0x");

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['!U'], [cancelParams]))
          .revertedWith("Router: op not started");
      });
      it("Should check require if not set currentChainIdFrom", async () => {
        const { routerV2, gateKeeper, syntheticToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, chainIdCurrent, chainIdTo, requestId, cPos, deadline } = await loadFixture(deploy);

        const txReceipt = await startCrossChainTransfer('BU', routerV2, syntheticToken, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline);
        const decodeEvent = await getDecodeLogComplexOpProcessed(txReceipt);

        const cancelParams = getCancelParams(
          decodeEvent.nextRequestId,    // requestId
          chainIdCurrent,               // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            alice.address,          // from
            alice.address,          // to
            chainIdTo,              // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['!U'], [cancelParams]))
          .revertedWith("Router: wrong emergency init");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Check correct change token balances for synthetic token", async () => {
        const { routerV2, gateKeeper, syntheticToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, resumeSelector, chainIdCurrent, chainIdTo, requestId, cPos, deadline } = await loadFixture(deploy);

        const txReceipt = await startCrossChainTransfer('BU', routerV2, syntheticToken, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline);
        const decodeEvent = await getDecodeLogComplexOpProcessed(txReceipt);


        const cancelParams = getCancelParams(
          decodeEvent.nextRequestId,    // requestId
          chainIdCurrent,                // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            alice.address,          // from
            alice.address,          // to
            chainIdTo,              // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        await setupForResumeEmergancy(routerV2, gateKeeper, bridgeContract, resumeSelector, chainIdTo);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['!U'], [cancelParams]))
          .changeTokenBalance(
            syntheticToken,
            alice,
            tokenAmount
          );
      });
      it("Check correct change token balances for adapter", async () => {
        const { routerV2, gateKeeper, thirdPartySynthToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, resumeSelector, chainIdCurrent, chainIdTo, requestId, cPos, deadline } = await loadFixture(deploy);

        const txReceipt = await startCrossChainTransfer('BM', routerV2, syntheticToken, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline);
        const decodeEvent = await getDecodeLogComplexOpProcessed(txReceipt);

        const cancelParams = getCancelParams(
          decodeEvent.nextRequestId,    // requestId
          chainIdCurrent,               // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            alice.address,          // from
            alice.address,          // to
            chainIdTo,              // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        await setupForResumeEmergancy(routerV2, gateKeeper, bridgeContract, resumeSelector, chainIdTo);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['!U'], [cancelParams]))
          .changeTokenBalance(
            syntheticToken,
            alice,
            tokenAmount
          );
      });
      it("Check correct change startedOps", async () => {
        const { routerV2, gateKeeper, syntheticToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, resumeSelector, chainIdCurrent, chainIdTo, requestId, cPos, deadline } = await loadFixture(deploy);

        const txReceipt = await startCrossChainTransfer('BU', routerV2, syntheticToken, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline);
        const decodeEvent = await getDecodeLogComplexOpProcessed(txReceipt);

        const cancelParams = getCancelParams(
          decodeEvent.nextRequestId,    // requestId
          chainIdCurrent,               // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            alice.address,          // from
            alice.address,          // to
            chainIdTo,              // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        await setupForResumeEmergancy(routerV2, gateKeeper, bridgeContract, resumeSelector, chainIdTo);

        const tx = await routerV2.connect(bridgeContract).resume(requestId, cPos, ['!U'], [cancelParams])
        await tx.wait();

        console.log(decodeEvent.nextRequestId);
        console.log(HashZero);

        expect(await routerV2.startedOps(decodeEvent.nextRequestId)).to.equal(HashZero);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event ComplexOpProcessed", async () => {
        const { routerV2, gateKeeper, thirdPartySynthToken, accountantRole, alice, bridgeContract, tokenAmount, executionPrice, resumeSelector, chainIdCurrent, chainIdTo, requestId, cPos, deadline, ExecutionResult } = await loadFixture(deploy);

        const txReceipt = await startCrossChainTransfer('BU', routerV2, syntheticToken, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline);
        const decodeEvent = await getDecodeLogComplexOpProcessed(txReceipt);

        const cancelParams = getCancelParams(
          decodeEvent.nextRequestId,    // requestId
          chainIdCurrent,               // chainIdTo
          [
            curveLPToken.address,   // tokenIn
            tokenAmount,            // amountIn
            alice.address,          // from
            alice.address,          // to
            chainIdTo,              // chain id to
            chainIdCurrent,         // tokenInChainIdCurrent
            alice.address           // emergencyTo
          ]
        );

        await setupForResumeEmergancy(routerV2, gateKeeper, bridgeContract, resumeSelector, chainIdTo);

        await expect(routerV2.connect(bridgeContract).resume(requestId, cPos, ['!U'], [cancelParams]))
          .emit(routerV2, "ComplexOpProcessed")
          .withArgs(chainIdCurrent, requestId, 0, HashZero, ExecutionResult.Succeeded, 0);
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

  function getCancelParams(requestId, chainIdTo, emergencyParams) {
    return abi.encode(
      ['bytes32', 'uint64', "tuple(address, uint256, address, address, uint64, uint64, address)"],
      [
        requestId,
        chainIdTo,
        [...emergencyParams]
    ]);
  }

  async function setBridge(gateKeeper, bridgeAddress) {
    const tx = await gateKeeper.setBridge(bridgeAddress);
    await tx.wait();
  }

  async function setupForResumeUw(WETH, routerV2, gateKeeper, bridgeContract, alice, wrappingEther) {
    let tx = await WETH.connect(alice).transfer(bridgeContract.address, wrappingEther);
    await tx.wait();
    tx = await WETH.connect(bridgeContract).approve(routerV2.address, wrappingEther);
    await tx.wait();
  }

  async function setupForResumeEmergancy(routerV2, bridgeContract, resumeSelector, chainIdTo) {
    const tx = await routerV2.connect(bridgeContract).receiveValidatedData(resumeSelector, routerV2.address, chainIdTo);
    await tx.wait();
  }

  async function startCrossChainTransfer(command, routerV2, token, alice, accountantRole, chainIdTo, chainIdCurrent, tokenAmount, executionPrice, deadline) {
    const synthParams = getSynthParams(
      token.address,    // tokenIn
      tokenAmount,      // amountIn
      alice.address,    // from
      alice.address,    // to
      chainIdTo,        // chain id to
      chainIdCurrent,   // tokenInChainIdCurrent
      alice.address     // emergencyTo
    );

    const receipt = await getReceipt(chainIdCurrent, [command], [synthParams], routerV2, alice, accountantRole, executionPrice, deadline);
    const tx = await routerV2.connect(alice).start([command], [synthParams], receipt, {value: executionPrice});
    return await tx.wait();
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

  async function getDecodeLogComplexOpProcessed(txReceipt) {
    const log = txReceipt.events[txReceipt.events.length - 1];
    const interfaceRouterV2 = (await ethers.getContractFactory("RouterV2")).interface;
    const decodeEvent = interfaceRouterV2.decodeEventLog("ComplexOpProcessed", log.data, log.topics)
    return decodeEvent;
  }

  async function getRequestId(addressBook, gateKeeper, chainIdTo, chainIdFrom) {
    let routerToAddress = await addressBook.router(chainIdTo)
    routerToAddress = ethers.utils.hexZeroPad(routerToAddress , 32)
    let routerFromAddress = await addressBook.router(chainIdFrom)
    routerFromAddress = ethers.utils.hexZeroPad(routerFromAddress , 32)
    const nonce = await gateKeeper.getNonce()
    return ethers.utils.keccak256(abi.encode(
      ['bytes32', 'uint256', 'uint256', 'uint256',  'bytes32'],
      [
        routerFromAddress,
        nonce,
        chainIdTo,
        chainIdFrom,
        routerToAddress,
    ]));
  }
});
