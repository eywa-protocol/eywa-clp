const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');
const AddressZero = ethers.constants.AddressZero;

const {
  deployBalancerTreasury,
  deployTestTokenPermit
} = require('../setup/setup-contracts');


describe('balancerTreasury unit tests', () => {

  async function deploy(){
    // eslint-disable-next-line no-undef

    let balancerTreasury, testToken;
    let owner, balancer, alice, malory;

    const tokenAmount = parse18('100');
    const halfTokenAmount = tokenAmount.div(2);

    const reason = "Reason";

    [owner, balancer, alice, malory] = await ethers.getSigners();

    // deployment contracts
    balancerTreasury = await deployBalancerTreasury();
    testToken = await deployTestTokenPermit(['testToken', 'TT', 18]);


    // preparatory actions
    const DEFAULT_ADMIN_ROLE = await balancerTreasury.DEFAULT_ADMIN_ROLE();
    const BALANCER_ROLE = await balancerTreasury.BALANCER_ROLE();

    let tx = await balancerTreasury.grantRole(BALANCER_ROLE, balancer.address);
    await tx.wait();
    tx = await testToken.mint(alice.address, tokenAmount);
    await tx.wait();


    return {
      balancerTreasury, testToken,
      owner, balancer, alice, malory,
      tokenAmount, halfTokenAmount, reason, DEFAULT_ADMIN_ROLE, BALANCER_ROLE
    }
  }

  describe("Should checking the correct operation withdraw() function with native cryptocurrency", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't role DEFAULT_ADMIN_ROLE or BALANCER_ROLE", async () => {
        const { balancerTreasury, alice, malory, tokenAmount, reason, DEFAULT_ADMIN_ROLE, BALANCER_ROLE } = await loadFixture(deploy);

        expect(await balancerTreasury.hasRole(DEFAULT_ADMIN_ROLE, malory.address)).to.equal(false);
        expect(await balancerTreasury.hasRole(BALANCER_ROLE, malory.address)).to.equal(false);

        await expect(balancerTreasury.connect(malory).withdraw(reason, AddressZero, tokenAmount, alice.address))
          .revertedWith("EywaTreasury: only trusted");
      });
      it("Should check require if try sent Ether more, than balancerTreasury balance", async () => {
        const { balancerTreasury, balancer, alice, tokenAmount, reason } = await loadFixture(deploy);

        expect(await ethers.provider.getBalance(balancerTreasury.address)).to.lt(tokenAmount);

        await expect(balancerTreasury.withdraw(reason, AddressZero, tokenAmount, alice.address))
          .revertedWith("Treasury: Failed to send Ether");

        await expect(balancerTreasury.connect(balancer).withdraw(reason, AddressZero, tokenAmount, alice.address))
          .revertedWith("Treasury: Failed to send Ether");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it('Should check correct deposit native asset', async() => {
        const { balancerTreasury, alice, tokenAmount } = await loadFixture(deploy);

        await expect(alice.sendTransaction({ to: balancerTreasury.address, value: tokenAmount }))
        .changeEtherBalances(
          [alice, balancerTreasury],
          [tokenAmount.mul(-1), tokenAmount]
        );
      });
      it('Should check correct withdraw native asset', async() => {
        const { balancerTreasury, balancer, alice, tokenAmount, halfTokenAmount, reason } = await loadFixture(deploy);
        
        const tx = await alice.sendTransaction({ to: balancerTreasury.address, value: tokenAmount });
        await tx.wait();

        await expect(balancerTreasury.withdraw(reason, AddressZero, halfTokenAmount, alice.address))
          .changeEtherBalances(
            [balancerTreasury, alice],
            [halfTokenAmount.mul(-1), halfTokenAmount]
          );

        await expect(balancerTreasury.connect(balancer).withdraw(reason, AddressZero, halfTokenAmount, alice.address))
          .changeEtherBalances(
            [balancerTreasury, alice],
            [halfTokenAmount.mul(-1), halfTokenAmount]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event NativeWithdrawn", async () => {
        const { balancerTreasury, balancer, alice, tokenAmount, halfTokenAmount, reason } = await loadFixture(deploy);

        const tx = await alice.sendTransaction({ to: balancerTreasury.address, value: tokenAmount });
        await tx.wait();

        await expect(balancerTreasury.withdraw(reason, AddressZero, halfTokenAmount, alice.address))
          .emit(balancerTreasury, "NativeWithdrawn")
          .withArgs(reason, halfTokenAmount, alice.address);

        await expect(balancerTreasury.connect(balancer).withdraw(reason, AddressZero, halfTokenAmount, alice.address))
          .emit(balancerTreasury, "NativeWithdrawn")
          .withArgs(reason, halfTokenAmount, alice.address);
      });
    });
  });

  describe("Should checking the correct operation withdraw() function with token", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't role DEFAULT_ADMIN_ROLE or BALANCER_ROLE", async () => {
        const { balancerTreasury, testToken, alice, malory, tokenAmount, reason, DEFAULT_ADMIN_ROLE, BALANCER_ROLE } = await loadFixture(deploy);

        expect(await balancerTreasury.hasRole(DEFAULT_ADMIN_ROLE, malory.address)).to.equal(false);
        expect(await balancerTreasury.hasRole(BALANCER_ROLE, malory.address)).to.equal(false);

        await expect(balancerTreasury.connect(malory).withdraw(reason, testToken.address, tokenAmount, alice.address))
          .revertedWith("EywaTreasury: only trusted");
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it('Should check correct change token balances for deposit token to balancerTreasury', async() => {
        const { balancerTreasury, testToken, alice, tokenAmount } = await loadFixture(deploy);

        await expect(testToken.connect(alice).transfer(balancerTreasury.address, tokenAmount))
          .changeTokenBalances(
            testToken,
            [alice, balancerTreasury],
            [tokenAmount.mul(-1), tokenAmount]
          );
      });
      it('Should check correct change token balances for withdraw token from balancerTreasury', async() => {
        const { balancerTreasury, testToken, balancer, alice, tokenAmount, halfTokenAmount, reason } = await loadFixture(deploy);

        const tx = await testToken.connect(alice).transfer(balancerTreasury.address, tokenAmount);
        await tx.wait();

        await expect(balancerTreasury.withdraw(reason, testToken.address, halfTokenAmount, alice.address))
          .changeTokenBalances(
            testToken,
            [balancerTreasury, alice],
            [halfTokenAmount.mul(-1), halfTokenAmount]
          );

        await expect(balancerTreasury.connect(balancer).withdraw(reason, testToken.address, halfTokenAmount, alice.address))
          .changeTokenBalances(
            testToken,
            [balancerTreasury, alice],
            [halfTokenAmount.mul(-1), halfTokenAmount]
          );
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event TokenWithdrawn", async () => {
        const { balancerTreasury, testToken, balancer, alice, tokenAmount, halfTokenAmount, reason } = await loadFixture(deploy);

        const tx = await testToken.connect(alice).transfer(balancerTreasury.address, tokenAmount);
        await tx.wait();

        await expect(balancerTreasury.withdraw(reason, testToken.address, halfTokenAmount, alice.address))
          .emit(balancerTreasury, "TokenWithdrawn")
          .withArgs(reason, testToken.address, halfTokenAmount, alice.address);

        await expect(balancerTreasury.connect(balancer).withdraw(reason, testToken.address, halfTokenAmount, alice.address))
          .emit(balancerTreasury, "TokenWithdrawn")
          .withArgs(reason, testToken.address, halfTokenAmount, alice.address);
      });
    });
  });
});