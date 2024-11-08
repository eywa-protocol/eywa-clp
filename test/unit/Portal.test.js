const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');
const AddressZero = ethers.constants.AddressZero;

const {
  deployAddressBook,
  deployWhitelistV2,
  deployTestTokenPermit,
  deployPortalV2
} = require('../setup/setup-contracts');


describe('Portal unit tests', () => {

  async function deploy(){
    // eslint-disable-next-line no-undef

    const TokenState = {
      NotSet: 0,
      InOut: 1
    }

    let portal, addressBook, whitelist, testToken;
    let owner, alice, malory, routerContract, feesTreasuryContract;
  
    const tokenAmountMin = parse18('10');
    const tokenAmountMax = parse18('10000');
    const tokenAmount = parse18('100');

    const someAddress = '0x0000000000000000000000000000000000000123';

    const chainIdCurrent = network.config.chainId;
    
    const fee = 1;

    [owner, alice, malory, routerContract, feesTreasuryContract] = await ethers.getSigners();


    // deployment contracts
    addressBook = await deployAddressBook();
    whitelist = await deployWhitelistV2();
    portal = await deployPortalV2([addressBook.address]);
    testToken = await deployTestTokenPermit(['USDT', 'USDT', 18]);

    // preparatory actions
    let tx = await addressBook.setWhitelist(whitelist.address);
    await tx.wait();
    tx = await addressBook.setPortal([[chainIdCurrent, portal.address]]);
    await tx.wait();


    // contrats emulation
    tx = await addressBook.setRouter([[chainIdCurrent, routerContract.address]]);
    await tx.wait();
    tx = await addressBook.setTreasury(feesTreasuryContract.address);
    await tx.wait();

    return {
      portal, addressBook, whitelist, testToken,
      owner, alice, malory, routerContract, feesTreasuryContract,
      chainIdCurrent, someAddress,
      tokenAmountMin, tokenAmountMax, tokenAmount,
      fee, TokenState
    }
  }

  describe("Should checking the values initialized on deploy", () => {
    it("Should check correct set addressBook", async () => {
      const { portal, addressBook } = await loadFixture(deploy);

      expect(await portal.addressBook()).to.equal(addressBook.address);
    });
  });

  describe("Should checking the correct operation of the setAddressBook() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { portal, malory, someAddress } = await loadFixture(deploy);

        expect(await portal.owner()).to.not.equal(malory.address);

        await expect(portal.connect(malory).setAddressBook(someAddress))
          .revertedWith("Ownable: caller is not the owner");
      });
      it("Should check require if new address is zero", async () => {
        const { portal, owner } = await loadFixture(deploy);

        expect(await portal.owner()).to.equal(owner.address);

        await expect(portal.connect(owner).setAddressBook(AddressZero))
          .revertedWith("EndPoint: zero address");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check change addressBook", async () => {
        const { portal, owner, someAddress } = await loadFixture(deploy);

        expect(await portal.owner()).to.equal(owner.address);

        const tx = await portal.connect(owner).setAddressBook(someAddress);
        await tx.wait();

        expect(await portal.addressBook()).to.equal(someAddress);
      });
    });
  });

  describe("Should checking the correct operation of the lock() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't router", async () => {
        const { portal, testToken, alice, malory, routerContract, tokenAmount } = await loadFixture(deploy);
      
        expect(malory.address).to.not.equal(routerContract);

        await expect(portal.connect(malory).lock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Portal: router only')
      });
      it("Should check require if token not set in whitelist", async () => {
        const { portal, testToken, alice, routerContract, tokenAmount } = await loadFixture(deploy);

        await expect(portal.connect(routerContract).lock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Whitelist: token not set')
      });
      it("Should check require if worng amount token", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, fee, TokenState } = await loadFixture(deploy);
      
        const tx = await whitelist.setTokens([[testToken.address, tokenAmountMin, tokenAmountMax, fee, TokenState.InOut]]);
        await tx.wait();

        const worngTokenAmountMin = tokenAmountMin.sub(1);

        await expect(portal.connect(routerContract).lock(testToken.address, worngTokenAmountMin, alice.address, alice.address))
          .revertedWith('Portal: wrong amount')

        const worngTokenAmountMax = tokenAmountMax.add(1);

        await expect(portal.connect(routerContract).lock(testToken.address, worngTokenAmountMax, alice.address, alice.address))
          .revertedWith('Portal: wrong amount')
      });
      it("Should check require if token set in whitelist as NotSet", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);
      
        const tx = await whitelist.setTokens([[testToken.address, tokenAmountMin, tokenAmountMax, fee, TokenState.NotSet]]);
        await tx.wait();

        await expect(portal.connect(routerContract).lock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Portal: token must be whitelisted')
      });
      it("Should check require if insufficient balance", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);

        let tx = await whitelist.setTokens([[testToken.address, tokenAmountMin, tokenAmountMax, fee, TokenState.InOut]]);
        await tx.wait();

        let balanceInPortal = await portal.balanceOf(testToken.address);
        let currentBalance = await testToken.balanceOf(portal.address);
        let balanceDifferent = currentBalance.sub(balanceInPortal);

        expect(balanceDifferent).to.lt(tokenAmount);

        await expect(portal.connect(routerContract).lock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Portal: insufficient balance')

        const worngAmountToken = tokenAmount.sub(1);

        tx = await testToken.mint(alice.address, worngAmountToken);
        await tx.wait();
        tx = await testToken.connect(alice).transfer(portal.address, worngAmountToken);
        await tx.wait();

        balanceInPortal = await portal.balanceOf(testToken.address);
        currentBalance = await testToken.balanceOf(portal.address);
        balanceDifferent = currentBalance.sub(balanceInPortal);

        expect(balanceDifferent).to.lt(tokenAmount);

        await expect(portal.connect(routerContract).lock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Portal: insufficient balance')
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change value in balanceOf", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);

        await setupMintTransferToken(portal, whitelist, testToken, alice, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState.InOut);

        const balanceInPortalBefore = await portal.balanceOf(testToken.address);
        const currentBalance = await testToken.balanceOf(portal.address);
        const balanceDifferentBefore = currentBalance.sub(balanceInPortalBefore);

        expect(balanceDifferentBefore).to.gte(tokenAmount);

        tx = await portal.connect(routerContract).lock(testToken.address, tokenAmount, alice.address, alice.address);
        await tx.wait();

        const balanceInPortalAfter = await portal.balanceOf(testToken.address);
        const balanceDifferentAfter = currentBalance.sub(balanceInPortalAfter);

        expect(balanceDifferentAfter).to.equal(balanceDifferentBefore.sub(tokenAmount));
        expect(balanceInPortalAfter).to.equal(balanceInPortalBefore.add(tokenAmount));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event Locked", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);

        await setupMintTransferToken(portal, whitelist, testToken, alice, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState.InOut);

        await expect(portal.connect(routerContract).lock(testToken.address, tokenAmount, alice.address, alice.address))
          .emit(portal, "Locked")
          .withArgs(testToken.address, tokenAmount, alice.address, alice.address);
      });
    });
  });

  describe("Should checking the correct operation of the unlock() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't router", async () => {
        const { portal, testToken, alice, malory, routerContract, tokenAmount } = await loadFixture(deploy);
      
        expect(malory.address).to.not.equal(routerContract);

        await expect(portal.connect(malory).unlock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Portal: router only')
      });
      it("Should check require if token not set in whitelist", async () => {
        const { portal, testToken, alice, routerContract, tokenAmount } = await loadFixture(deploy);

        await expect(portal.connect(routerContract).unlock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Whitelist: token not set')
      });
      it("Should check require if token set in whitelist as NotSet", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);
      
        const tx = await whitelist.setTokens([[testToken.address, tokenAmountMin, tokenAmountMax, fee, TokenState.NotSet]]);
        await tx.wait();

        await expect(portal.connect(routerContract).unlock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Portal: token must be whitelisted')
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change token balances", async () => {
        const { portal, whitelist, testToken, alice, routerContract, feesTreasuryContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);
      
        await setupMintTransferLockToken(portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState.InOut);

        const expectedFee = tokenAmount.mul(fee).div(await portal.FEE_DENOMINATOR());
        const expectedAmountOut = tokenAmount.sub(expectedFee);

        await expect(portal.connect(routerContract).unlock(testToken.address, tokenAmount, alice.address, alice.address))
          .changeTokenBalances(
            testToken,
            [portal, alice, feesTreasuryContract],
            [tokenAmount.mul(-1), expectedAmountOut, expectedFee]
          );
      });
      it("Should check correct change value in balanceOf", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);
      
        await setupMintTransferLockToken(portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState.InOut);

        const balanceInPortalBefore = await portal.balanceOf(testToken.address);

        tx = await portal.connect(routerContract).unlock(testToken.address, tokenAmount, alice.address, alice.address);
        await tx.wait();

        const balanceInPortalAfter = await portal.balanceOf(testToken.address);

        expect(balanceInPortalAfter).to.equal(balanceInPortalBefore.sub(tokenAmount));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event Unlocked", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);
      
        await setupMintTransferLockToken(portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState.InOut);

        await expect(portal.connect(routerContract).unlock(testToken.address, tokenAmount, alice.address, alice.address))
          .emit(portal, "Unlocked")
          .withArgs(testToken.address, tokenAmount, alice.address, alice.address);
      });
    });
  });

  describe("Should checking the correct operation of the emergencyUnlock() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't router", async () => {
        const { portal, testToken, alice, malory, routerContract, tokenAmount } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(routerContract);

        await expect(portal.connect(malory).emergencyUnlock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Portal: router only')
      });
      it("Should check require if token not set in whitelist", async () => {
        const { portal, testToken, alice, routerContract, tokenAmount } = await loadFixture(deploy);

        await expect(portal.connect(routerContract).emergencyUnlock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Whitelist: token not set')
      });
      it("Should check require if token set in whitelist as NotSet", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);

        const tx = await whitelist.setTokens([[testToken.address, tokenAmountMin, tokenAmountMax, fee, TokenState.NotSet]]);
        await tx.wait();

        await expect(portal.connect(routerContract).emergencyUnlock(testToken.address, tokenAmount, alice.address, alice.address))
          .revertedWith('Portal: token must be whitelisted')
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it("Should check correct change token balances", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);
      
        await setupMintTransferLockToken(portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState.InOut);

        await expect(portal.connect(routerContract).emergencyUnlock(testToken.address, tokenAmount, alice.address, alice.address))
          .changeTokenBalances(
            testToken,
            [portal, alice],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
      it("Should check correct change value in balanceOf", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);
      
        await setupMintTransferLockToken(portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState.InOut);

        const balanceInPortalBefore = await portal.balanceOf(testToken.address);

        tx = await portal.connect(routerContract).emergencyUnlock(testToken.address, tokenAmount, alice.address, alice.address);
        await tx.wait();

        const balanceInPortalAfter = await portal.balanceOf(testToken.address);

        expect(balanceInPortalAfter).to.equal(balanceInPortalBefore.sub(tokenAmount));
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event Unlocked", async () => {
        const { portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState } = await loadFixture(deploy);
      
        await setupMintTransferLockToken(portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, TokenState.InOut);

        await expect(portal.connect(routerContract).emergencyUnlock(testToken.address, tokenAmount, alice.address, alice.address))
          .emit(portal, "Unlocked")
          .withArgs(testToken.address, tokenAmount, alice.address, alice.address);
      });
    });
  });

  async function setupMintTransferToken(portal, whitelist, testToken, alice, tokenAmountMin, tokenAmountMax, tokenAmount, fee, tokenState) {
    let tx = await whitelist.setTokens([[testToken.address, tokenAmountMin, tokenAmountMax, fee, tokenState]]);
    await tx.wait();
    tx = await testToken.mint(alice.address, tokenAmount);
    await tx.wait();
    tx = await testToken.connect(alice).transfer(portal.address, tokenAmount);
    await tx.wait();
  }

  async function setupMintTransferLockToken(portal, whitelist, testToken, alice, routerContract, tokenAmountMin, tokenAmountMax, tokenAmount, fee, tokenState) {
    await setupMintTransferToken(portal, whitelist, testToken, alice, tokenAmountMin, tokenAmountMax, tokenAmount, fee, tokenState);

    const tx = await portal.connect(routerContract).lock(testToken.address, tokenAmount, alice.address, alice.address);
    await tx.wait();
  }
});