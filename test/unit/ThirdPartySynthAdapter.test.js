const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');
const MaxUint256 = ethers.constants.MaxUint256;

const {
  deployTestTokenPermit,
  deployThirdPartySynthAdapter
} = require('../setup/setup-contracts');


describe('ThirdPartySynthAdapter unit tests', () => {

  async function deploy(){
    // eslint-disable-next-line no-undef

    const SynthType = {
      Unknown: 0,
      DefaultSynth: 1,
      CustomSynth: 2,
      ThirdPartySynth: 3,
      ThirdPartyToken: 4
    };

    let thirdPartySynthToken, thirdPartySynthAdapter;
    let owner, alice, malory;
  
    const tokenAmount = parse18('100');

    const originalThirdPartyTokenAddress = '0x55d398326f99059ff775485246999027b3197955';

    const chainIdFrom = 56;
    const originalChainName = 'BSC';
    const thirdPartySynthTokenName = 's USDT BSC';
    const thirdPartySynthTokenSymbol = 'sUSDT_BSC';
    const decimals = 18;

    [owner, alice, malory] = await ethers.getSigners();

    // deployment contracts
    thirdPartySynthToken = await deployTestTokenPermit([thirdPartySynthTokenName, thirdPartySynthTokenSymbol, decimals]);
    thirdPartySynthAdapter = await deployThirdPartySynthAdapter([originalThirdPartyTokenAddress, thirdPartySynthToken.address, chainIdFrom, originalChainName, decimals]);

    // preparatory actions
    const tx = await thirdPartySynthToken.mint(thirdPartySynthAdapter.address, tokenAmount);
    await tx.wait();

    return {
      thirdPartySynthAdapter, thirdPartySynthToken,
      owner, alice, malory,
      tokenAmount,
      originalThirdPartyTokenAddress, chainIdFrom, originalChainName,
      thirdPartySynthTokenName, thirdPartySynthTokenSymbol, decimals, 
      SynthType
    }
  }

  describe("Should checking the correct operation of the setCap() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if decimals is wrong", async () => {
        const { thirdPartySynthToken, originalThirdPartyTokenAddress, chainIdFrom, originalChainName, decimals } = await loadFixture(deploy);

        const wrongDecimals = decimals + 1;

        await expect(deployThirdPartySynthAdapter([originalThirdPartyTokenAddress, thirdPartySynthToken.address, chainIdFrom, originalChainName, wrongDecimals]))
          .revertedWith("ThirdPartySynthAdapter: wrong decimals");
      });
    });
    describe("Should checking the values initialized on deploy", () => {
      it("Should check correct set values", async () => {
        const { thirdPartySynthAdapter, thirdPartySynthToken, originalThirdPartyTokenAddress, chainIdFrom, originalChainName, decimals, SynthType } = await loadFixture(deploy);

        expect((await thirdPartySynthAdapter.originalToken()).toLowerCase()).to.equal(originalThirdPartyTokenAddress.toLowerCase());
        expect(await thirdPartySynthAdapter.chainIdFrom()).to.equal(chainIdFrom);
        expect(await thirdPartySynthAdapter.chainSymbolFrom()).to.equal(originalChainName);
        expect(await thirdPartySynthAdapter.synthType()).to.equal(SynthType.ThirdPartySynth);
        expect(await thirdPartySynthAdapter.synthToken()).to.equal(thirdPartySynthToken.address);
        expect(await thirdPartySynthAdapter.cap()).to.equal(MaxUint256);
        expect(await thirdPartySynthAdapter.decimals()).to.equal(decimals);
      });
    });
  });


  describe("Should checking the correct operation of the setCap() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { thirdPartySynthAdapter, malory, tokenAmount } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await thirdPartySynthAdapter.owner());

        await expect(thirdPartySynthAdapter.connect(malory).setCap(tokenAmount))
          .revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change cap", async () => {
        const { thirdPartySynthAdapter, tokenAmount } = await loadFixture(deploy);

        const tx = await thirdPartySynthAdapter.setCap(tokenAmount);
        await tx.wait();

        expect(await thirdPartySynthAdapter.cap()).to.equal(tokenAmount);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event CapSet", async () => {
        const { thirdPartySynthAdapter, tokenAmount } = await loadFixture(deploy);

        await expect(thirdPartySynthAdapter.setCap(tokenAmount))
          .emit(thirdPartySynthAdapter, "CapSet")
          .withArgs(tokenAmount);
      });
    });
  });

  describe("Should checking the correct operation of the mint() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { thirdPartySynthAdapter, alice, malory, tokenAmount } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await thirdPartySynthAdapter.owner());

        await expect(thirdPartySynthAdapter.connect(malory).mint(alice.address, tokenAmount))
          .revertedWith("Ownable: caller is not the owner");
      });
      it("Should check require if token amount more than balance", async () => {
        const { thirdPartySynthAdapter, thirdPartySynthToken, alice, tokenAmount } = await loadFixture(deploy);

        const wrongTokenAmount = tokenAmount.add(1);

        expect(await thirdPartySynthToken.balanceOf(thirdPartySynthAdapter.address)).to.lt(wrongTokenAmount);

        await expect(thirdPartySynthAdapter.mint(alice.address, wrongTokenAmount))
          .revertedWith("ThirdPartySynthAdapter: wrong amount");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change token balances", async () => {
        const { thirdPartySynthAdapter, thirdPartySynthToken, alice, tokenAmount } = await loadFixture(deploy);

        await expect(thirdPartySynthAdapter.mint(alice.address, tokenAmount))
          .changeTokenBalances(
            thirdPartySynthToken,
            [thirdPartySynthAdapter, alice],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event Transfer", async () => {
        const { thirdPartySynthAdapter, thirdPartySynthToken, alice, tokenAmount } = await loadFixture(deploy);

        await expect(thirdPartySynthAdapter.mint(alice.address, tokenAmount))
          .emit(thirdPartySynthToken, "Transfer")
          .withArgs(thirdPartySynthAdapter.address, alice.address, tokenAmount);
      });
    });
  });

  describe("Should checking the correct operation of the burn() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { thirdPartySynthAdapter, alice, malory, tokenAmount } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await thirdPartySynthAdapter.owner());

        await expect(thirdPartySynthAdapter.connect(malory).burn(alice.address, tokenAmount))
          .revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change token balances", async () => {
        const { thirdPartySynthAdapter, thirdPartySynthToken, alice, tokenAmount } = await loadFixture(deploy);

        await mintApprove(thirdPartySynthAdapter, thirdPartySynthToken, alice, tokenAmount);

        await expect(thirdPartySynthAdapter.burn(alice.address, tokenAmount))
          .changeTokenBalances(
            thirdPartySynthToken,
            [alice, thirdPartySynthAdapter],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event SynthRegistered", async () => {
        it("Should check correct generate event Transfer", async () => {
          const { thirdPartySynthAdapter, thirdPartySynthToken, alice, tokenAmount } = await loadFixture(deploy);

          await mintApprove(thirdPartySynthAdapter, thirdPartySynthToken, alice, tokenAmount);
  
          await expect(thirdPartySynthAdapter.burn(alice.address, tokenAmount))
            .emit(thirdPartySynthToken, "Transfer")
            .withArgs(alice.address, thirdPartySynthAdapter.address, tokenAmount);
        });
      });
    });
  });

  async function mintApprove(thirdPartySynthAdapter, thirdPartySynthToken, alice, tokenAmount) {
    let tx = await thirdPartySynthAdapter.mint(alice.address, tokenAmount);
    await tx.wait();
    tx = await thirdPartySynthToken.connect(alice).approve(thirdPartySynthAdapter.address, tokenAmount);
    await tx.wait();
  }
});



