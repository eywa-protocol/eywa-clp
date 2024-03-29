const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');

describe('Whitelist unit tests', () => {

  let whitelist;

  const chainId = network.config.chainId;
  const bridgeAddress = '0x0000000000000000000000000000000000000042';
  const someToken = '0x0000000000000000000000000000000000000088';
  const somePool = '0x0000000000000000000000000000000000000007';
  
  const TokenState = { NotSet: 0, InOut: 1 };
  const PoolState = { NotSet: 0, AddSwapRemove: 1 };

  let owner, alice, mallory;

  // Deploy all contracts before each test suite
  beforeEach(async () => {
    // eslint-disable-next-line no-undef
    [owner, alice, mallory] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('WhitelistV2');
    whitelist = await factory.deploy();
    await whitelist.deployed();
  });

  it('should set token', async() => {
    const min = ethers.utils.parseEther('1');
    const max = ethers.utils.parseEther('10000');
    const fee = 10; // 0.1%
    await whitelist.setTokens([[someToken, min, max, fee, TokenState.InOut]]);
    expect(await whitelist.tokenMin(someToken)).to.equal(min);
    expect(await whitelist.tokenMax(someToken)).to.equal(max);
    expect(await whitelist.bridgeFee(someToken)).to.equal(fee);
    expect(await whitelist.tokenState(someToken)).to.equal(TokenState.InOut);
    const minMax = await whitelist.tokenMinMax(someToken);
    expect(minMax[0]).to.equal(min);
    expect(minMax[1]).to.equal(max);
    const token = await whitelist.tokenStatus(someToken);
    expect(token.token).to.equal(someToken);
    expect(token.min).to.equal(min);
    expect(token.max).to.equal(max);
    expect(token.bridgeFee).to.equal(fee);
    expect(token.state).to.equal(TokenState.InOut);

    const tokens = await whitelist.tokens(0, 100);
    expect(tokens.length).to.equal(1);
    expect(tokens[0].token).to.equal(someToken);
    expect(tokens[0].min).to.equal(min);
    expect(tokens[0].max).to.equal(max);
    expect(tokens[0].bridgeFee).to.equal(fee);
    expect(tokens[0].state).to.equal(TokenState.InOut);
  });

  it('shouldn\'t set token if address wrong', async() => {
    await expect(whitelist.setTokens([[ethers.constants.AddressZero, 0, 0, 0, TokenState.InOut]]))
      .to.be.revertedWith('Whitelist: zero address');
  });

  it('shouldn\'t set token if address wrong', async() => {
    await expect(whitelist.setTokens([[someToken, 10000, 1, 0, TokenState.InOut]]))
      .to.be.revertedWith('Whitelist: min max wrong');
  });

  it('shouldn\'t set token if caller is not an owner', async() => {
    // const message = `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role ${await govBridge.DEFAULT_ADMIN_ROLE()}`;
    await expect(whitelist.connect(mallory).setTokens([[someToken, 10000, 1, 0, TokenState.InOut]]))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should update token', async() => {
    let min = ethers.utils.parseEther('1');
    let max = ethers.utils.parseEther('10000');
    let fee = 10; // 0.1%
    await whitelist.setTokens([[someToken, min, max, fee, TokenState.InOut]]);
    min = ethers.utils.parseEther('10');
    max = ethers.utils.parseEther('100000');
    fee = 100;
    await whitelist.setTokens([[someToken, min, max, fee, TokenState.NotSet]]);
    const token = await whitelist.tokenStatus(someToken);
    expect(token.token).to.equal(someToken);
    expect(token.min).to.equal(min);
    expect(token.max).to.equal(max);
    expect(token.bridgeFee).to.equal(fee);
    expect(token.state).to.equal(TokenState.NotSet);
  });

  it('should set pool', async() => {
    const fee = 10; // 0.1%
    await whitelist.setPools([[somePool, fee, PoolState.AddSwapRemove]]);
    expect(await whitelist.aggregationFee(somePool)).to.equal(fee);
    expect(await whitelist.poolState(somePool)).to.equal(PoolState.AddSwapRemove);
    const pool = await whitelist.poolStatus(somePool);
    expect(pool.pool).to.equal(somePool);
    expect(pool.aggregationFee).to.equal(fee);
    expect(pool.state).to.equal(PoolState.AddSwapRemove);

    const pools = await whitelist.pools(0, 100);
    expect(pools.length).to.equal(1);
    expect(pools[0].pool).to.equal(somePool);
    expect(pools[0].aggregationFee).to.equal(fee);
    expect(pools[0].state).to.equal(PoolState.AddSwapRemove);
  });

  it('shouldn\'t set pool if address wrong', async() => {
    await expect(whitelist.setPools([[ethers.constants.AddressZero, 0, PoolState.AddSwapRemove]]))
      .to.be.revertedWith('Whitelist: zero address');
  });

  it('shouldn\'t set pool if caller is not an owner', async() => {
    await expect(whitelist.connect(mallory).setPools([[somePool, 0, PoolState.AddSwapRemove]]))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('should update pool', async() => {
    let fee = 10; // 0.1%
    await whitelist.setPools([[somePool, fee, PoolState.AddSwapRemove]]);
    fee = 100;
    await whitelist.setPools([[somePool, fee, PoolState.NotSet]]);
    const pool = await whitelist.poolStatus(somePool);
    expect(pool.pool).to.equal(somePool);
    expect(pool.aggregationFee).to.equal(fee);
    expect(pool.state).to.equal(PoolState.NotSet);
  });

});