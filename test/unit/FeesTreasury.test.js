const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');


describe('FeesTreasury unit tests', () => {

  let feesTreasury, tokenX;

  let owner, alice, mallory;

  // Deploy all contracts before each test suite
  beforeEach(async () => {
    // eslint-disable-next-line no-undef
    [owner, alice, mallory] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('FeesTreasury');
    feesTreasury = await factory.deploy();
    await feesTreasury.deployed();

    factory = await ethers.getContractFactory('TestTokenPermit');
    tokenX = await factory.deploy('TokenX', 'TOX', 18);
    await tokenX.deployed();

    await tokenX.mint(owner.address, parse18('1000000'));
  });

  it('should deposit erc20', async() => {
    await tokenX.transfer(feesTreasury.address, parse18('1000'));
    expect(await tokenX.balanceOf(feesTreasury.address)).to.equal(parse18('1000'));
  });

  it('should deposit native asset', async() => {
    await owner.sendTransaction({
      to: feesTreasury.address,
      value: parse18('1'),
    });
    expect(await ethers.provider.getBalance(feesTreasury.address)).to.equal(parse18('1'));
  });

  it('should withdraw erc20', async() => {
    await tokenX.transfer(feesTreasury.address, parse18('1000000'));
    expect(await tokenX.balanceOf(owner.address)).to.equal(0);
    await feesTreasury.withdraw("", tokenX.address, parse18('1000000'), alice.address);
    expect(await tokenX.balanceOf(alice.address)).to.equal(parse18('1000000'));
  });

  it('should withdraw native asset', async() => {
    const before = await ethers.provider.getBalance(alice.address);
    await owner.sendTransaction({
      to: feesTreasury.address,
      value: parse18('1'),
    });
    await feesTreasury.withdraw("", ethers.constants.AddressZero, parse18('1'), alice.address);
    expect(await ethers.provider.getBalance(alice.address)).to.equal(before.add(parse18('1')));
  });

  it('shouldn\'t withdraw if caller is not an owner', async() => {
    await expect(feesTreasury.connect(mallory).withdraw("", tokenX.address, parse18('1000000'), mallory.address))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

});