const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse6 } = require('../../utils/common');
const AddressZero = ethers.constants.AddressZero;
const MaxUint256 = ethers.constants.MaxUint256;

const {
  deploySynthERC20
} = require('../setup/setup-contracts');


describe('SynthERC20 unit tests', () => {
  async function deploy(){
    // eslint-disable-next-line no-undef

    const SynthType = {
      Unknown: 0,
      DefaultSynth: 1,
      CustomSynth: 2,
      ThirdPartySynth: 3,
      ThirdPartyToken: 4
    };

    let syntheticToken;
    let owner, alice, malory;
  
    const tokenAmount = parse6('100');

    const originalTokenAddress = '0x55d398326f99059ff775485246999027b3197955';

    const chainIdFrom = 56;

    const originalChainSymbol = 'BSC';
    const tokenName = 's USDT BSC';
    const tokenSymbol = 'sUSDT_BSC';
    const decimals = 18;
    
    [owner, operator, alice, malory, routerContract, feesTreasuryContract] = await ethers.getSigners();


    // deployment contracts
    syntheticToken = await deploySynthERC20([tokenName, tokenSymbol, decimals, originalTokenAddress, chainIdFrom, originalChainSymbol, SynthType.DefaultSynth]);


    return {
      syntheticToken,
      owner, alice, malory,
      tokenAmount, originalTokenAddress, chainIdFrom, tokenName, tokenSymbol, decimals, originalChainSymbol, 
      SynthType
    }
  }
  
  describe("Should checking the values initialized on deploy", () => {
    it("Should check correct set values", async () => {
      const { syntheticToken, originalTokenAddress, chainIdFrom, tokenName, tokenSymbol, decimals, originalChainSymbol, SynthType } = await loadFixture(deploy);

      expect(await syntheticToken.name()).to.equal(tokenName);
      expect(await syntheticToken.symbol()).to.equal(tokenSymbol);
      expect(await syntheticToken.decimals()).to.equal(decimals);
      expect((await syntheticToken.originalToken()).toLowerCase()).to.equal(originalTokenAddress.toLowerCase());
      expect(await syntheticToken.chainIdFrom()).to.equal(chainIdFrom);
      expect(await syntheticToken.chainSymbolFrom()).to.equal(originalChainSymbol);
      expect(await syntheticToken.synthType()).to.equal(SynthType.DefaultSynth);
      expect(await syntheticToken.cap()).to.equal(MaxUint256);
      expect(await syntheticToken.synthToken()).to.equal(syntheticToken.address);
    });
  });

  describe("Should checking the correct operation of the setCap() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { syntheticToken, malory, tokenAmount } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await syntheticToken.owner());

        await expect(syntheticToken.connect(malory).setCap(tokenAmount))
          .revertedWith("Ownable: caller is not the owner");
      });
      it("Should check require if new cap less than current total supply", async () => {
        const { syntheticToken, alice, tokenAmount } = await loadFixture(deploy);

        const tx = await syntheticToken.mint(alice.address, tokenAmount);
        await tx.wait();

        const totalSupply = await syntheticToken.totalSupply();

        expect(totalSupply).to.gt(0);

        const wrongCap = totalSupply.sub(1);

        await expect(syntheticToken.setCap(wrongCap))
          .revertedWith("SynthERC20: cap exceeded");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check current change cap", async () => {
        const { syntheticToken, tokenAmount } = await loadFixture(deploy);
        
        const totalSupply = await syntheticToken.totalSupply();

        const newCap = totalSupply.add(tokenAmount);

        const tx = await syntheticToken.setCap(newCap);
        await tx.wait();

        expect(await syntheticToken.cap()).to.equal(newCap);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event CapSet", async () => {
        const { syntheticToken, tokenAmount } = await loadFixture(deploy);

        const totalSupply = await syntheticToken.totalSupply();

        const newCap = totalSupply.add(tokenAmount);

        await expect(syntheticToken.setCap(newCap))
          .emit(syntheticToken, "CapSet")
          .withArgs(newCap);
      });
    });
  });

  describe("Should checking the correct operation of the mint() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { syntheticToken, alice, malory, tokenAmount } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await syntheticToken.owner());

        await expect(syntheticToken.connect(malory).mint(alice.address, tokenAmount))
          .revertedWith("Ownable: caller is not the owner");
      });
      it("Should check require if cap exceeded", async () => {
        const { syntheticToken, alice, tokenAmount } = await loadFixture(deploy);

        const tx = await syntheticToken.setCap(tokenAmount);
        await tx.wait();

        const cap = await syntheticToken.cap();
        const totalSupply = await syntheticToken.totalSupply();

        const wrongMintTokenAmount = cap.add(1);

        expect(totalSupply.add(wrongMintTokenAmount)).to.gt(cap)

        await expect(syntheticToken.mint(alice.address, wrongMintTokenAmount))
          .revertedWith("ERC20Capped: cap exceeded");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check current change token balance", async () => {
        const { syntheticToken, alice, tokenAmount } = await loadFixture(deploy);

        await expect(syntheticToken.mint(alice.address, tokenAmount))
          .changeTokenBalance(syntheticToken, alice, tokenAmount);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event Transfer", async () => {
        const { syntheticToken, alice, tokenAmount } = await loadFixture(deploy);
        
        await expect(syntheticToken.mint(alice.address, tokenAmount))
          .emit(syntheticToken, "Transfer")
          .withArgs(AddressZero, alice.address, tokenAmount);
      });
    });
  });

  describe("Should checking the correct operation of the burn() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { syntheticToken, alice, malory,tokenAmount } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await syntheticToken.owner());

        await expect(syntheticToken.connect(malory).burn(alice.address, tokenAmount))
          .revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check current change token balance", async () => {
        const { syntheticToken, alice, tokenAmount } = await loadFixture(deploy);

        const tx = await syntheticToken.mint(alice.address, tokenAmount);
        await tx.wait();

        await expect(syntheticToken.burn(alice.address, tokenAmount))
          .changeTokenBalance(syntheticToken, alice, tokenAmount.mul(-1));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event Transfer", async () => {
        const { syntheticToken, alice, tokenAmount } = await loadFixture(deploy);

        const tx = await syntheticToken.mint(alice.address, tokenAmount);
        await tx.wait();

        await expect(syntheticToken.burn(alice.address, tokenAmount))
          .emit(syntheticToken, "Transfer")
          .withArgs(alice.address, AddressZero, tokenAmount);
      });
    });
  });
});