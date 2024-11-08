const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse6 } = require('../../utils/common');
const AddressZero = ethers.constants.AddressZero;


const {
  deployAddressBook,
  deployWhitelistV2,
  deploySynthesisV2,
  deploySynthERC20,
  deployTestTokenPermit,
  deployThirdPartySynthAdapter
} = require('../setup/setup-contracts');


describe('Synthesis unit tests', () => {
  async function deploy(){
    // eslint-disable-next-line no-undef

    const SynthType = {
      Unknown: 0,
      DefaultSynth: 1,
      CustomSynth: 2,
      ThirdPartySynth: 3,
      ThirdPartyToken: 4
    };

    const TokenState = {
      NotSet: 0,
      InOut: 1
    }

    let synthesis, addressBook, whitelist, syntheticToken, syntheticTokenCustom, thirdPartySynthToken, thirdPartySynthAdapter;
    let owner, operator, alice, malory, routerContract, feesTreasuryContract;
  
    const tokenAmountMin = parse6('1');
    const tokenAmountMax = parse6('10000');
    const tokenAmount = parse6('100');

    const originalTokenAddress = '0x55d398326f99059ff775485246999027b3197955';
    const originalTokenAddressCustom = '0x55d398326f99059ff775485246999027b3197966';
    const originalThirdPartyTokenAddress = '0x0000000000000000000000000000000000000056';
    const someAddress = '0x0000000000000000000000000000000000000088';

    const chainIdCurrent = network.config.chainId;
    const chainIdFrom = 56;

    const originalChainName = 'BSC';
    const defaultTokenName = 's USDT BSC';
    const defaultTokenSymbol = 'sUSDT_BSC';
    const customTokenName = 'TokenX_TokenY';
    const customTokenSymbol = 'TX_TY';
    const decimals = 6

    const fee = 1;

    [owner, operator, alice, malory, routerContract, feesTreasuryContract] = await ethers.getSigners();


    // deployment contracts
    addressBook = await deployAddressBook();
    whitelist = await deployWhitelistV2();
    synthesis = await deploySynthesisV2([addressBook.address]);
    syntheticToken = await deploySynthERC20([defaultTokenName, defaultTokenSymbol, decimals, originalTokenAddress, chainIdFrom, originalChainName, SynthType.DefaultSynth]);
    syntheticTokenCustom = await deploySynthERC20([customTokenName, customTokenSymbol, decimals, originalTokenAddressCustom, chainIdFrom, originalChainName, SynthType.CustomSynth]);
    thirdPartySynthToken = await deployTestTokenPermit(['thirdPartySynthToken', 'TOX', 18]);
    thirdPartySynthAdapter = await deployThirdPartySynthAdapter([originalThirdPartyTokenAddress, thirdPartySynthToken.address, chainIdFrom, originalChainName, 18]);


    // preparatory actions
    const DEFAULT_ADMIN_ROLE = await synthesis.DEFAULT_ADMIN_ROLE();
    const OPERATOR_ROLE = await synthesis.OPERATOR_ROLE();

    let tx = await synthesis.grantRole(OPERATOR_ROLE, operator.address);
    await tx.wait();
    tx = await addressBook.setWhitelist(whitelist.address);
    await tx.wait();
    tx = await addressBook.setSynthesis([[chainIdCurrent, synthesis.address]]);
    await tx.wait();


    // contrats emulation
    tx = await addressBook.setRouter([[chainIdCurrent, routerContract.address]]);
    await tx.wait();
    tx = await addressBook.setTreasury(feesTreasuryContract.address);
    await tx.wait();


    return {
      synthesis, addressBook, whitelist, syntheticToken, syntheticTokenCustom, thirdPartySynthToken, thirdPartySynthAdapter,
      owner, operator, alice, malory, routerContract, feesTreasuryContract,
      tokenAmountMin, tokenAmountMax, tokenAmount, TokenState,
      originalTokenAddress, originalTokenAddressCustom, originalThirdPartyTokenAddress, someAddress, 
      chainIdFrom, defaultTokenName, defaultTokenSymbol, customTokenName, customTokenSymbol, decimals, originalChainName, 
      fee, SynthType, DEFAULT_ADMIN_ROLE, OPERATOR_ROLE
    }
  }
  
  describe("Should checking the values initialized on deploy", () => {
    it("Should check correct set addressBook", async () => {
      const { synthesis, addressBook } = await loadFixture(deploy);

      expect(await synthesis.addressBook()).to.equal(addressBook.address);
    });
  });

  describe("Should checking the correct operation of the setAddressBook() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't DEFAULT_ADMIN_ROLE", async () => {
        const { synthesis, malory, someAddress, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await synthesis.hasRole(DEFAULT_ADMIN_ROLE, malory.address)).to.equal(false);

        const reason = `AccessControl: account ${malory.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`;

        await expect(synthesis.connect(malory).setAddressBook(someAddress))
          .revertedWith(reason);
      });
      it("Should check require if new address is zero", async () => {
        const { synthesis, owner, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);
          
        expect(await synthesis.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);

        await expect(synthesis.setAddressBook(AddressZero))
          .revertedWith("EndPoint: zero address");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change addressBook", async () => {
        const { synthesis, owner, someAddress, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

        expect(await synthesis.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);

        const tx = await synthesis.setAddressBook(someAddress);
        await tx.wait();

        expect(await synthesis.addressBook()).to.equal(someAddress);
      });
    });
  });

  describe("Should checking the correct operation of the setCap() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't OPERATOR_ROLE", async () => {
        const { synthesis, syntheticToken, malory, tokenAmount, OPERATOR_ROLE } = await loadFixture(deploy);

        expect(await synthesis.hasRole(OPERATOR_ROLE, malory.address)).to.equal(false);

        const reason =`AccessControl: account ${malory.address.toLowerCase()} is missing role ${OPERATOR_ROLE}`;
            
        await expect(synthesis.connect(malory).setCap(syntheticToken.address, tokenAmount))
          .revertedWith(reason);
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change cap", async () => {
        const { synthesis, syntheticToken, operator, tokenAmount, OPERATOR_ROLE } = await loadFixture(deploy);

        expect(await synthesis.hasRole(OPERATOR_ROLE, operator.address)).to.equal(true);

        let tx = await syntheticToken.transferOwnership(synthesis.address);
        await tx.wait();

        tx = await synthesis.connect(operator).setCap(syntheticToken.address, tokenAmount);
        await tx.wait();

        expect(await syntheticToken.cap()).to.equal(tokenAmount);
      });
    });
  });

  describe("Should checking the correct operation of the setSynths() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't OPERATOR_ROLE", async () => {
        const { synthesis, syntheticToken, malory, OPERATOR_ROLE } = await loadFixture(deploy);

        expect(await synthesis.hasRole(OPERATOR_ROLE, malory.address)).to.equal(false);

        const reason = `AccessControl: account ${malory.address.toLowerCase()} is missing role ${OPERATOR_ROLE}`;
        
        await expect(synthesis.connect(malory).setSynths([syntheticToken.address]))
          .revertedWith(reason);
      });
      it("Should check require if original token address is zero", async () => {
        const { synthesis, operator, chainIdFrom, defaultTokenName, defaultTokenSymbol, originalChainName, customTokenName, customTokenSymbol, decimals, SynthType } = await loadFixture(deploy);

        const synthDefault = await deploySynthERC20([defaultTokenName, defaultTokenSymbol, decimals, AddressZero, chainIdFrom, originalChainName, SynthType.DefaultSynth]);

        await expect(synthesis.connect(operator).setSynths([synthDefault.address]))
          .revertedWith('Synthesis: synth incorrect');

        const synthCustom = await deploySynthERC20([customTokenName, customTokenSymbol, decimals, AddressZero, chainIdFrom, originalChainName, SynthType.CustomSynth]);

        await expect(synthesis.connect(operator).setSynths([synthCustom.address]))
          .revertedWith('Synthesis: synth incorrect');
      });
      it("Should check require if syntheticToken is already set", async () => {
        const { synthesis, syntheticToken, operator } = await loadFixture(deploy);

        const tx = await synthesis.connect(operator).setSynths([syntheticToken.address]);
        await tx.wait();

        await expect(synthesis.connect(operator).setSynths([syntheticToken.address]))
          .revertedWith('Synthesis: synth already set');
      });
      it("Should check require if syntheticToken total supply > 0", async () => {
        const { synthesis, syntheticToken, syntheticTokenCustom, operator, alice, tokenAmountMin } = await loadFixture(deploy);

        let tx = await syntheticToken.mint(alice.address, tokenAmountMin);
        await tx.wait();

        await expect(synthesis.connect(operator).setSynths([syntheticToken.address]))
          .revertedWith('Synthesis: totalSupply incorrect');

        tx = await syntheticTokenCustom.mint(alice.address, tokenAmountMin);
        await tx.wait();

        await expect(synthesis.connect(operator).setSynths([syntheticTokenCustom.address]))
          .revertedWith('Synthesis: totalSupply incorrect');
      });
      it("Should check require if synth with synth address assigned", async () => {
        const { synthesis, thirdPartySynthToken, thirdPartySynthAdapter, operator, someAddress } = await loadFixture(deploy);

        const tx = await synthesis.connect(operator).setSynths([thirdPartySynthAdapter.address]);
        await tx.wait();

        const thirdPartySynthAdapter2 = await deployThirdPartySynthAdapter([someAddress, thirdPartySynthToken.address, 1, 'ETH', 18]);

        await expect(synthesis.connect(operator).setSynths([thirdPartySynthAdapter2.address]))
          .revertedWith('Synthesis: adapter already set')
      });
      it("Should check require if syntheticToken has incorrect synth type", async () => {
        const { synthesis, operator, someAddress, chainIdFrom, defaultTokenName, defaultTokenSymbol, decimals, originalChainName, SynthType } = await loadFixture(deploy);

        const incorrectTypeSyntheticToken = await deploySynthERC20([defaultTokenName, defaultTokenSymbol, decimals, someAddress, chainIdFrom, originalChainName, SynthType.Unknown]);

        await expect(synthesis.connect(operator).setSynths([incorrectTypeSyntheticToken.address]))
          .revertedWith('Synthesis: wrong synth type');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change synthByOriginal for default synthetic token", async () => {
        const { synthesis, syntheticToken, operator, originalTokenAddress, chainIdFrom } = await loadFixture(deploy);

        const tx = await synthesis.connect(operator).setSynths([syntheticToken.address]);
        await tx.wait();

        expect(await synthesis.getSynth(chainIdFrom, originalTokenAddress))
          .to.equal(syntheticToken.address);
      });
      it("Should check correct change synthByOriginal for custom synthetic token", async () => {
        const { synthesis, syntheticTokenCustom, operator, originalTokenAddressCustom, chainIdFrom } = await loadFixture(deploy);

        const tx = await synthesis.connect(operator).setSynths([syntheticTokenCustom.address]);
        await tx.wait();

        expect(await synthesis.getSynth(chainIdFrom, originalTokenAddressCustom))
          .to.equal(syntheticTokenCustom.address);
      });
      it("Should check correct change synthByOriginal for third-party synthetic token", async () => {
        const { synthesis, thirdPartySynthAdapter, operator, originalThirdPartyTokenAddress, chainIdFrom } = await loadFixture(deploy);

        const tx = await synthesis.connect(operator).setSynths([thirdPartySynthAdapter.address]);
        await tx.wait();

        expect(await synthesis.getSynth(chainIdFrom, originalThirdPartyTokenAddress))
          .to.equal(thirdPartySynthAdapter.address);
      });
      it("Should check correct change synthBySynth for third-party synthetic token", async () => {
        const { synthesis, thirdPartySynthToken, thirdPartySynthAdapter, operator } = await loadFixture(deploy);

        const tx = await synthesis.connect(operator).setSynths([thirdPartySynthAdapter.address]);
        await tx.wait();

        expect(await synthesis.synthBySynth(thirdPartySynthToken.address))
          .to.equal(thirdPartySynthAdapter.address);
      });
      it("Should check correct change synthByOriginal for third party original token", async () => {
        // TO DO: when there is an adapter implementation for original third-party tokens
      });
      it("Should check correct change synthBySynth for third party original token", async () => {
        // TO DO: when there is an adapter implementation for original third-party tokens
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event SynthRegistered", async () => {
        const { synthesis,thirdPartySynthAdapter, operator, originalThirdPartyTokenAddress } = await loadFixture(deploy);

        await expect(synthesis.connect(operator).setSynths([thirdPartySynthAdapter.address]))
          .emit(synthesis, "SynthRegistered")
          .withArgs(originalThirdPartyTokenAddress, thirdPartySynthAdapter.address);
      });
    });
  });

  describe("Should checking the correct operation of the mint() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not a router", async () => {
        const { synthesis, malory, routerContract, tokenAmount, originalTokenAddress, chainIdFrom } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(routerContract);

        await expect(synthesis.connect(malory).mint(originalTokenAddress, tokenAmount, malory.address, malory.address, chainIdFrom))
          .revertedWith('Synthesis: router only');
      });
      it("Should check require if synth is not whitelisted", async () => {
        const { synthesis, syntheticToken, operator, alice, routerContract, tokenAmount, originalTokenAddress, chainIdFrom } = await loadFixture(deploy);

        const tx = await synthesis.connect(operator).setSynths([syntheticToken.address]);
        await tx.wait();

        await expect(synthesis.connect(routerContract).mint(originalTokenAddress, tokenAmount, alice.address, alice.address, chainIdFrom))
          .revertedWith('Whitelist: token not set');
      });
      it("Should check require if syntheticToken is not owned by synthesis", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, originalTokenAddress, chainIdFrom, fee } = await loadFixture(deploy);

        let tx = await synthesis.connect(operator).setSynths([syntheticToken.address]);
        await tx.wait();
        tx = await whitelist.setTokens([[syntheticToken.address, tokenAmountMin, tokenAmountMax, fee, TokenState.NotSet]]);
        await tx.wait();

        await expect(synthesis.connect(routerContract).mint(originalTokenAddress, tokenAmount, alice.address, alice.address, chainIdFrom))
          .revertedWith('Ownable: caller is not the owner');
      });
      it("Should check require if synth is not set", async () => {
        const { synthesis, whitelist, syntheticToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, originalTokenAddress, chainIdFrom, fee } = await loadFixture(deploy);

        const tx = await whitelist.setTokens([[syntheticToken.address, tokenAmountMin, tokenAmountMax, fee, TokenState.NotSet]]);
        await tx.wait();

        await expect(synthesis.connect(routerContract).mint(originalTokenAddress, tokenAmount, alice.address, alice.address, chainIdFrom))
          .revertedWith('Synthesis: synth not set');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change token balance for synthetic token", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, feesTreasuryContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, originalTokenAddress, chainIdFrom, fee } = await loadFixture(deploy);

        await setupSyntheticTokenOrAdapter(synthesis, whitelist, syntheticToken, operator, tokenAmountMin, tokenAmountMax, TokenState.NotSet, fee);

        const expectedFee = tokenAmount * fee / await synthesis.FEE_DENOMINATOR();
        const expectedAmountOut = tokenAmount - expectedFee;

        await expect(synthesis.connect(routerContract).mint(originalTokenAddress, tokenAmount, alice.address, alice.address, chainIdFrom))
          .changeTokenBalances(
            syntheticToken,
            [alice, feesTreasuryContract],
            [expectedAmountOut, expectedFee]
          );
      });
      it("Should check correct change token balance for adapter", async () => {
        const { synthesis, whitelist, thirdPartySynthToken, thirdPartySynthAdapter, operator, alice, routerContract, feesTreasuryContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, originalThirdPartyTokenAddress, chainIdFrom, fee } = await loadFixture(deploy);

        const tx = await thirdPartySynthToken.mint(thirdPartySynthAdapter.address, tokenAmount);
        await tx.wait();

        await setupSyntheticTokenOrAdapter(synthesis, whitelist, thirdPartySynthAdapter, operator, tokenAmountMin, tokenAmountMax, TokenState.NotSet, fee);

        const expectedFee = tokenAmount * fee / await synthesis.FEE_DENOMINATOR();
        const expectedAmountOut = tokenAmount - expectedFee;

        await expect(synthesis.connect(routerContract).mint(originalThirdPartyTokenAddress, tokenAmount, alice.address, alice.address, chainIdFrom))
          .changeTokenBalances(
            thirdPartySynthToken,
            [alice, feesTreasuryContract],
            [expectedAmountOut, expectedFee]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event SynthRegistered for synthetic token", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, originalTokenAddress, chainIdFrom, fee } = await loadFixture(deploy);

        await setupSyntheticTokenOrAdapter(synthesis, whitelist, syntheticToken, operator, tokenAmountMin, tokenAmountMax, TokenState.NotSet, fee);

        await expect(synthesis.connect(routerContract).mint(originalTokenAddress, tokenAmount, alice.address, alice.address, chainIdFrom))
          .emit(synthesis, "Synthesized")
          .withArgs(syntheticToken.address, tokenAmount, alice.address, alice.address);
      });
      it("Should check correct generate event SynthRegistered for adapter", async () => {
        const { synthesis, whitelist, thirdPartySynthToken, thirdPartySynthAdapter, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, originalThirdPartyTokenAddress, chainIdFrom, fee } = await loadFixture(deploy);

        const tx = await thirdPartySynthToken.mint(thirdPartySynthAdapter.address, tokenAmount);
        await tx.wait();

        await setupSyntheticTokenOrAdapter(synthesis, whitelist, thirdPartySynthAdapter, operator, tokenAmountMin, tokenAmountMax, TokenState.NotSet, fee);

        await expect(synthesis.connect(routerContract).mint(originalThirdPartyTokenAddress, tokenAmount, alice.address, alice.address, chainIdFrom))
          .emit(synthesis, "Synthesized")
          .withArgs(thirdPartySynthAdapter.address, tokenAmount, alice.address, alice.address);
      });
    });
  });

  describe("Should checking the correct operation of the emergencyMint() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not a router", async () => {
        const { synthesis, syntheticToken, malory, routerContract, tokenAmount } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(routerContract);

        await expect(synthesis.connect(malory).emergencyMint(syntheticToken.address, tokenAmount, malory.address, malory.address))
          .revertedWith('Synthesis: router only');
      });
      it("Should check require if syntheticToken is not set", async () => {
        const { synthesis, syntheticToken, alice, routerContract, tokenAmount } = await loadFixture(deploy);

        await expect(synthesis.connect(routerContract).emergencyMint(syntheticToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Synthesis: synth not set');
      });
      it("Should check require if syntheticToken is not set", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, fee } = await loadFixture(deploy);

        let tx = await whitelist.setTokens([[syntheticToken.address, tokenAmountMin, tokenAmountMax, fee, TokenState.NotSet]]);
        await tx.wait();
        tx = await synthesis.connect(operator).setSynths([syntheticToken.address]);
        await tx.wait();

        await expect(synthesis.connect(routerContract).emergencyMint(syntheticToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Ownable: caller is not the owner');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change token balance for synthetic token", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, fee } = await loadFixture(deploy);

        await setupSyntheticTokenOrAdapter(synthesis, whitelist, syntheticToken, operator, tokenAmountMin, tokenAmountMax, TokenState.NotSet, fee);

        await expect(synthesis.connect(routerContract).emergencyMint(syntheticToken.address, tokenAmount, alice.address, alice.address))
          .changeTokenBalance(syntheticToken, alice, tokenAmount);
      });
      it("Should check correct change token balance for adapter", async () => {
        const { synthesis, whitelist, thirdPartySynthToken, thirdPartySynthAdapter, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, fee } = await loadFixture(deploy);

        const tx = await thirdPartySynthToken.mint(thirdPartySynthAdapter.address, tokenAmount);
        await tx.wait();

        await setupSyntheticTokenOrAdapter(synthesis, whitelist, thirdPartySynthAdapter, operator, tokenAmountMin, tokenAmountMax, TokenState.NotSet, fee);

        await expect(synthesis.connect(routerContract).emergencyMint(thirdPartySynthAdapter.address, tokenAmount, alice.address, alice.address))
          .changeTokenBalance(thirdPartySynthToken, alice, tokenAmount);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event SynthRegistered for synthetic token", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, fee } = await loadFixture(deploy);

        await setupSyntheticTokenOrAdapter(synthesis, whitelist, syntheticToken, operator, tokenAmountMin, tokenAmountMax, TokenState.NotSet, fee);

        await expect(synthesis.connect(routerContract).emergencyMint(syntheticToken.address, tokenAmount, alice.address, alice.address))
          .emit(synthesis, "Synthesized")
          .withArgs(syntheticToken.address, tokenAmount, alice.address, alice.address);
      });
      it("Should check correct generate event SynthRegistered for adapter", async () => {
        const { synthesis, whitelist, thirdPartySynthToken, thirdPartySynthAdapter, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, fee } = await loadFixture(deploy);

        const tx = await thirdPartySynthToken.mint(thirdPartySynthAdapter.address, tokenAmount);
        await tx.wait();

        await setupSyntheticTokenOrAdapter(synthesis, whitelist, thirdPartySynthAdapter, operator, tokenAmountMin, tokenAmountMax, TokenState.NotSet, fee);

        await expect(synthesis.connect(routerContract).emergencyMint(thirdPartySynthAdapter.address, tokenAmount, alice.address, alice.address))
          .emit(synthesis, "Synthesized")
          .withArgs(thirdPartySynthAdapter.address, tokenAmount, alice.address, alice.address);
      });
    });
  });

  describe("Should checking the correct operation of the burn() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if caller is not a router", async () => {
        const { synthesis, syntheticToken, alice, malory, routerContract, tokenAmount, chainIdFrom } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(routerContract);

        await expect(synthesis.connect(malory).burn(syntheticToken.address, tokenAmount, alice.address, alice.address, chainIdFrom))
          .revertedWith('Synthesis: router only');
      });
      it("Should check require if token not set in whitelist", async () => {
        const { synthesis, syntheticToken, operator, alice, routerContract, tokenAmount, chainIdFrom } = await loadFixture(deploy);

        const tx = await synthesis.connect(operator).setSynths([syntheticToken.address]);
        await tx.wait();

        await expect(synthesis.connect(routerContract).burn(syntheticToken.address, tokenAmount, alice.address, alice.address, chainIdFrom))
          .revertedWith('Whitelist: token not set');
      });
      it("Should check require if synthetic token is not owned by synthesis", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, chainIdFrom, fee } = await loadFixture(deploy);

        let tx = await synthesis.connect(operator).setSynths([syntheticToken.address]);
        await tx.wait();
        tx = await whitelist.setTokens([[syntheticToken.address, tokenAmountMin, tokenAmountMax, fee, TokenState.NotSet]]);
        await tx.wait();

        await expect(synthesis.connect(routerContract).burn(syntheticToken.address, tokenAmount, alice.address, alice.address, chainIdFrom))
          .revertedWith('Ownable: caller is not the owner');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change token balance for synthetic token", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, chainIdFrom, fee } = await loadFixture(deploy);

        await setupMintSyntheticToken(
          synthesis,
          whitelist,
          syntheticToken,
          operator,
          alice,
          routerContract,
          tokenAmountMin,
          tokenAmountMax,
          tokenAmount,
          TokenState.NotSet,
          fee
        );

        await expect(synthesis.connect(routerContract).burn(syntheticToken.address, tokenAmount, alice.address, alice.address, chainIdFrom))
          .changeTokenBalance(syntheticToken, alice, -tokenAmount);
      });
      it("Should check correct change token balance for adapter", async () => {
        const { synthesis, whitelist, thirdPartySynthToken, thirdPartySynthAdapter, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, someAddress, chainIdFrom, fee } = await loadFixture(deploy);

        await setupMintApproveAdapter(
          synthesis,
          whitelist,
          thirdPartySynthToken,
          thirdPartySynthAdapter,
          operator,
          alice,
          routerContract,
          tokenAmountMin,
          tokenAmountMax,
          tokenAmount,
          TokenState.NotSet,
          fee
        );

        await expect(synthesis.connect(routerContract).burn(thirdPartySynthToken.address, tokenAmount, synthesis.address, someAddress, chainIdFrom))
          .changeTokenBalances(
            thirdPartySynthToken,
            [synthesis, thirdPartySynthAdapter],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event Burn for synthetic token", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, chainIdFrom, fee } = await loadFixture(deploy);

        const chainIdTo = chainIdFrom;

        await setupMintSyntheticToken(
          synthesis,
          whitelist,
          syntheticToken,
          operator,
          alice,
          routerContract,
          tokenAmountMin,
          tokenAmountMax,
          tokenAmount,
          TokenState.NotSet,
          fee
        );

        await expect(synthesis.connect(routerContract).burn(syntheticToken.address, tokenAmount, alice.address, alice.address, chainIdTo))
          .emit(synthesis, "Burn")
          .withArgs(syntheticToken.address, tokenAmount, alice.address, alice.address);
      });
      it("Should check correct generate event Burn for adapter", async () => {
        const { synthesis, whitelist, thirdPartySynthToken, thirdPartySynthAdapter, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState,  someAddress, chainIdFrom, fee } = await loadFixture(deploy);
  
        const chainIdTo = chainIdFrom;

        await setupMintApproveAdapter(
          synthesis,
          whitelist,
          thirdPartySynthToken,
          thirdPartySynthAdapter,
          operator,
          alice,
          routerContract,
          tokenAmountMin,
          tokenAmountMax,
          tokenAmount,
          TokenState.NotSet,
          fee
        );
  
        await expect(synthesis.connect(routerContract).burn(thirdPartySynthToken.address, tokenAmount, synthesis.address, someAddress, chainIdTo))
          .emit(synthesis, "Burn")
          .withArgs(thirdPartySynthToken.address, tokenAmount, synthesis.address, someAddress);
      });
      it("Should check correct generate event Move for synthetic token", async () => {
        const { synthesis, whitelist, syntheticToken, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState, chainIdFrom, fee } = await loadFixture(deploy);
  
        const chainIdTo = chainIdFrom + 1;

        await setupMintSyntheticToken(
          synthesis,
          whitelist,
          syntheticToken,
          operator,
          alice,
          routerContract,
          tokenAmountMin,
          tokenAmountMax,
          tokenAmount,
          TokenState.NotSet,
          fee
        );
  
        await expect(synthesis.connect(routerContract).burn(syntheticToken.address, tokenAmount, alice.address, alice.address, chainIdTo))
          .emit(synthesis, "Move")
          .withArgs(syntheticToken.address, tokenAmount, alice.address, alice.address, chainIdTo);
      });
      it("Should check correct generate event Move for adapter", async () => {
        const { synthesis, whitelist, thirdPartySynthToken, thirdPartySynthAdapter, operator, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, TokenState,  someAddress, chainIdFrom, fee } = await loadFixture(deploy);
  
        const chainIdTo = chainIdFrom + 1;

        await setupMintApproveAdapter(
          synthesis,
          whitelist,
          thirdPartySynthToken,
          thirdPartySynthAdapter,
          operator,
          alice,
          routerContract,
          tokenAmountMin,
          tokenAmountMax,
          tokenAmount,
          TokenState.NotSet,
          fee
        );

        await expect(synthesis.connect(routerContract).burn(thirdPartySynthToken.address, tokenAmount, synthesis.address, someAddress, chainIdTo))
          .emit(synthesis, "Move")
          .withArgs(thirdPartySynthToken.address, tokenAmount, synthesis.address, someAddress, chainIdTo);
      });
    });
  });

  async function setupSyntheticTokenOrAdapter(synthesis, whitelist, syntheticTokenOrAdapter, operator, tokenAmountMin, tokenAmountMax, tokenState, fee) {
    let tx = await whitelist.setTokens([[syntheticTokenOrAdapter.address, tokenAmountMin, tokenAmountMax, fee, tokenState]]);
    await tx.wait();
    tx = await synthesis.connect(operator).setSynths([syntheticTokenOrAdapter.address]);
    await tx.wait();
    tx = await syntheticTokenOrAdapter.transferOwnership(synthesis.address);
    await tx.wait();
  }

  async function setupMintSyntheticToken(
    synthesis,
    whitelist,
    syntheticToken,
    operator,
    alice,
    routerContract,
    tokenAmountMin,
    tokenAmountMax,
    tokenAmount,
    tokenState,
    fee
  ) {
    await setupSyntheticTokenOrAdapter(synthesis, whitelist, syntheticToken, operator, tokenAmountMin, tokenAmountMax, tokenState, fee);
    const tx = await synthesis.connect(routerContract).emergencyMint(syntheticToken.address, tokenAmount, alice.address, alice.address);
    await tx.wait();
  }

  async function setupMintApproveAdapter(
    synthesis,
    whitelist,
    thirdPartySynthToken,
    thirdPartySynthAdapter,
    operator,
    alice,
    routerContract,
    tokenAmountMin,
    tokenAmountMax,
    tokenAmount,
    tokenState,
    fee
  ) {
    await setupSyntheticTokenOrAdapter(synthesis, whitelist, thirdPartySynthAdapter, operator, tokenAmountMin, tokenAmountMax, tokenState, fee);
    
    let tx = await thirdPartySynthToken.mint(thirdPartySynthAdapter.address, tokenAmount);
    await tx.wait();
    tx = await synthesis.connect(routerContract).emergencyMint(thirdPartySynthAdapter.address, tokenAmount, alice.address, alice.address);
    await tx.wait();
    tx = await thirdPartySynthToken.connect(alice).approve(routerContract.address, tokenAmount);
    await tx.wait();
    tx = await thirdPartySynthToken.connect(routerContract).transferFrom(alice.address, synthesis.address, tokenAmount);
    await tx.wait();
  }
});