const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');
const AddressZero = ethers.constants.AddressZero;

const {
  deployFeesTreasury,
  deployTestTokenPermit
} = require('../setup/setup-contracts');


describe('FeesTreasury unit tests', () => {

  async function deploy(){
    // eslint-disable-next-line no-undef

    let feesTreasury, testToken;
    let owner, alice, malory;

    const tokenAmount = parse18('100');

    const reason = "Reason";

    [owner, alice, malory] = await ethers.getSigners();

    // deployment contracts
    feesTreasury = await deployFeesTreasury();
    testToken = await deployTestTokenPermit(['testToken', 'TT', 18]);


    // preparatory actions
    const tx = await testToken.mint(alice.address, tokenAmount);
    await tx.wait();


    return {
      feesTreasury, testToken,
      owner, alice, malory,
      tokenAmount, reason
    }
  }

  describe("Should checking the correct operation withdraw() function with native cryptocurrency", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { feesTreasury, alice, malory, tokenAmount, reason } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await feesTreasury.owner());

        await expect(feesTreasury.connect(malory).withdraw(reason, AddressZero, tokenAmount, alice.address))
          .revertedWith("Ownable: caller is not the owner");
      });
      it("Should check require if try sent Ether more, than FeesTreasury balance", async () => {
        const { feesTreasury, alice, tokenAmount, reason } = await loadFixture(deploy);

        expect(await ethers.provider.getBalance(feesTreasury.address)).to.lt(tokenAmount);

        await expect(feesTreasury.withdraw(reason, AddressZero, tokenAmount, alice.address))
          .revertedWith("Treasury: Failed to send Ether");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it('Should check correct deposit native asset', async() => {
        const { feesTreasury, alice, tokenAmount } = await loadFixture(deploy);

        await expect(alice.sendTransaction({ to: feesTreasury.address, value: tokenAmount }))
        .changeEtherBalances(
          [alice, feesTreasury],
          [tokenAmount.mul(-1), tokenAmount]
        );
      });
      it('Should check correct withdraw native asset', async() => {
        const { feesTreasury, alice, tokenAmount, reason } = await loadFixture(deploy);
        
        const tx = await alice.sendTransaction({ to: feesTreasury.address, value: tokenAmount });
        await tx.wait();

        await expect(feesTreasury.withdraw(reason, AddressZero, tokenAmount, alice.address))
          .changeEtherBalances(
            [feesTreasury, alice],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event NativeWithdrawn", async () => {
        const { feesTreasury, alice, tokenAmount, reason } = await loadFixture(deploy);

        const tx = await alice.sendTransaction({ to: feesTreasury.address, value: tokenAmount });
        await tx.wait();

        await expect(feesTreasury.withdraw(reason, AddressZero, tokenAmount, alice.address))
          .emit(feesTreasury, "NativeWithdrawn")
          .withArgs(reason, tokenAmount, alice.address);
      });
    });
  });

  describe("Should checking the correct operation withdraw() function with token", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { feesTreasury, testToken, alice, malory, tokenAmount, reason } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await feesTreasury.owner());

        await expect(feesTreasury.connect(malory).withdraw(reason, testToken.address, tokenAmount, alice.address))
          .revertedWith("Ownable: caller is not the owner");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it('Should check correct change token balances for deposit token to feesTreasury', async() => {
        const { feesTreasury, testToken, alice, tokenAmount } = await loadFixture(deploy);

        await expect(testToken.connect(alice).transfer(feesTreasury.address, tokenAmount))
          .changeTokenBalances(
            testToken,
            [alice, feesTreasury],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
      it('Should check correct change token balances for withdraw token from feesTreasury', async() => {
        const { feesTreasury, testToken, alice, tokenAmount, reason } = await loadFixture(deploy);

        const tx = await testToken.connect(alice).transfer(feesTreasury.address, tokenAmount);
        await tx.wait();

        await expect(feesTreasury.withdraw(reason, testToken.address, tokenAmount, alice.address))
          .changeTokenBalances(
            testToken,
            [feesTreasury, alice],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event TokenWithdrawn", async () => {
        const { feesTreasury, testToken, alice, tokenAmount, reason } = await loadFixture(deploy);

        const tx = await testToken.connect(alice).transfer(feesTreasury.address, tokenAmount);
        await tx.wait();

        await expect(feesTreasury.withdraw(reason, testToken.address, tokenAmount, alice.address))
          .emit(feesTreasury, "TokenWithdrawn")
          .withArgs(reason, testToken.address, tokenAmount, alice.address);
      });
    });
  });
});