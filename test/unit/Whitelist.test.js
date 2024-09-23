const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { parse18 } = require('../../utils/common');
const AddressZero = ethers.constants.AddressZero;

const {
  deployWhitelistV2
} = require('../setup/setup-contracts');

describe('Whitelist unit tests', () => {

  async function deploy(){

    let whitelist;
    let owner, malory;

    const chainId = network.config.chainId;
    const bridgeAddress = '0x0000000000000000000000000000000000000042';
    const tokenAddress = '0x0000000000000000000000000000000000000088';
    const poolAddress = '0x0000000000000000000000000000000000000007';

    const tokenAmountMin = parse18('10')
    const tokenAmountMax = parse18('10000')
    const bridgeFee = 1;
    const aggregationFee = 1;

    const TokenState = { NotSet: 0, InOut: 1 };
    const PoolState = { NotSet: 0, AddSwapRemove: 1 };

    [owner, malory] = await ethers.getSigners();
  
    // deployment contracts
    whitelist = await deployWhitelistV2();

    return {
      whitelist,
      owner, malory,
      chainId, bridgeAddress, tokenAddress, poolAddress,
      tokenAmountMin, tokenAmountMax, bridgeFee, aggregationFee,
      TokenState, PoolState
    }
  }

  describe("Should checking the correct operation of the setTokens() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { whitelist, malory, tokenAddress, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await whitelist.owner());

        await expect(whitelist.connect(malory).setTokens([[tokenAddress, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]))
          .revertedWith("Ownable: caller is not the owner");
      });
      it('Should check require if address wrong', async() => {
        const { whitelist, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState } = await loadFixture(deploy);

        await expect(whitelist.setTokens([[AddressZero, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]))
          .revertedWith('Whitelist: zero address');
      });
      it('Should check require if min max wrong', async() => {
        const { whitelist, tokenAddress, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState } = await loadFixture(deploy);

        await expect(whitelist.setTokens([[tokenAddress, tokenAmountMax, tokenAmountMin, bridgeFee, TokenState.InOut]]))
          .revertedWith('Whitelist: min max wrong');
      });
      it('Should check require if bridgeFee wrong', async() => {
        const { whitelist, tokenAddress, tokenAmountMin, tokenAmountMax, TokenState } = await loadFixture(deploy);

        const wrongBridgeFee = (await whitelist.FEE_DENOMINATOR()).add(1);

        await expect(whitelist.setTokens([[tokenAddress, tokenAmountMin, tokenAmountMax, wrongBridgeFee, TokenState.InOut]]))
          .revertedWith('Whitelist: fee > 100%');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it('Should check correct set token', async() => {
        const { whitelist, tokenAddress, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState } = await loadFixture(deploy);

        const tx = await whitelist.setTokens([[tokenAddress, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]);
        await tx.wait();

        expect(await whitelist.tokenMin(tokenAddress)).to.equal(tokenAmountMin);
        expect(await whitelist.tokenMax(tokenAddress)).to.equal(tokenAmountMax);
        expect(await whitelist.bridgeFee(tokenAddress)).to.equal(bridgeFee);
        expect(await whitelist.tokenState(tokenAddress)).to.equal(TokenState.InOut);

        const minMax = await whitelist.tokenMinMax(tokenAddress);
        expect(minMax[0]).to.equal(tokenAmountMin);
        expect(minMax[1]).to.equal(tokenAmountMax);

        const token = await whitelist.tokenStatus(tokenAddress);
        expect(token.token).to.equal(tokenAddress);
        expect(token.min).to.equal(tokenAmountMin);
        expect(token.max).to.equal(tokenAmountMax);
        expect(token.bridgeFee).to.equal(bridgeFee);
        expect(token.state).to.equal(TokenState.InOut);
    
        const tokens = await whitelist.tokens(0, 100);
        expect(tokens.length).to.equal(1);
        expect(tokens[0].token).to.equal(tokenAddress);
        expect(tokens[0].min).to.equal(tokenAmountMin);
        expect(tokens[0].max).to.equal(tokenAmountMax);
        expect(tokens[0].bridgeFee).to.equal(bridgeFee);
        expect(tokens[0].state).to.equal(TokenState.InOut);
      });
      it('Should check correct update token', async() => {
        const { whitelist, tokenAddress, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState } = await loadFixture(deploy);

        let tx = await whitelist.setTokens([[tokenAddress, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]);
        await tx.wait();

        const newTokenAmountMin = tokenAmountMin.add(1);
        const newTokenAmountMax = tokenAmountMax.add(1);
        const newBridgeFee = bridgeFee + 1;

        tx = await whitelist.setTokens([[tokenAddress, newTokenAmountMin, newTokenAmountMax, newBridgeFee, TokenState.NotSet]]);
        await tx.wait();
        
        const token = await whitelist.tokenStatus(tokenAddress);
        expect(token.token).to.equal(tokenAddress);
        expect(token.min).to.equal(newTokenAmountMin);
        expect(token.max).to.equal(newTokenAmountMax);
        expect(token.bridgeFee).to.equal(newBridgeFee);
        expect(token.state).to.equal(TokenState.NotSet);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event TokenSet", async () => {
        const { whitelist, tokenAddress, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState } = await loadFixture(deploy);

        await expect(whitelist.setTokens([[tokenAddress, tokenAmountMin, tokenAmountMax, bridgeFee, TokenState.InOut]]))
          .emit(whitelist, "TokenSet")
          .withArgs(tokenAddress, tokenAmountMax, tokenAmountMin, bridgeFee, TokenState.InOut);
      });
    });
  });

  describe("Should checking the correct operation of the setPools() function", () => {
    describe("Should checking the requires", () => {
      it("Should check require if sender isn't owner", async () => {
        const { whitelist, malory, poolAddress, aggregationFee, PoolState } = await loadFixture(deploy);

        expect(malory.address).to.not.equal(await whitelist.owner());

        await expect(whitelist.connect(malory).setPools([[poolAddress, aggregationFee, PoolState.AddSwapRemove]]))
          .revertedWith('Ownable: caller is not the owner');
      });
      it('Should check require if address wrong', async() => {
        const { whitelist, aggregationFee, PoolState } = await loadFixture(deploy);

        await expect(whitelist.setPools([[AddressZero, aggregationFee, PoolState.AddSwapRemove]]))
          .to.be.revertedWith('Whitelist: zero address');
      });
      it('Should check require if aggregationFee wrong', async() => {
        const { whitelist, poolAddress, PoolState } = await loadFixture(deploy);

        const wrongAggregationFee = (await whitelist.FEE_DENOMINATOR()).add(1);

        await expect(whitelist.setPools([[poolAddress, wrongAggregationFee, PoolState.AddSwapRemove]]))
          .revertedWith('Whitelist: fee > 100%');
      });
    });
    describe("Should checking the correct changes state variables", () => {
      it('Should check correct set pool', async() => {
        const { whitelist, poolAddress, aggregationFee, PoolState } = await loadFixture(deploy);

        const tx = await whitelist.setPools([[poolAddress, aggregationFee, PoolState.AddSwapRemove]]);
        await tx.wait();

        expect(await whitelist.aggregationFee(poolAddress)).to.equal(aggregationFee);
        expect(await whitelist.poolState(poolAddress)).to.equal(PoolState.AddSwapRemove);

        const pool = await whitelist.poolStatus(poolAddress);
        expect(pool.pool).to.equal(poolAddress);
        expect(pool.aggregationFee).to.equal(aggregationFee);
        expect(pool.state).to.equal(PoolState.AddSwapRemove);
    
        const pools = await whitelist.pools(0, 100);
        expect(pools.length).to.equal(1);
        expect(pools[0].pool).to.equal(poolAddress);
        expect(pools[0].aggregationFee).to.equal(aggregationFee);
        expect(pools[0].state).to.equal(PoolState.AddSwapRemove);
      });
      it('Should check correct update pool', async() => {
        const { whitelist, poolAddress, aggregationFee, PoolState } = await loadFixture(deploy);

        let tx = await whitelist.setPools([[poolAddress, aggregationFee, PoolState.AddSwapRemove]]);
        await tx.wait();

        const newAggregationFee = aggregationFee + 1;

        tx = await whitelist.setPools([[poolAddress, newAggregationFee, PoolState.NotSet]]);
        await tx.wait();

        const pool = await whitelist.poolStatus(poolAddress);
        expect(pool.pool).to.equal(poolAddress);
        expect(pool.aggregationFee).to.equal(newAggregationFee);
        expect(pool.state).to.equal(PoolState.NotSet);
      });
    });
    describe("Should checking the correct emit event", () => {
      it("Should check correct generate event PoolSet", async () => {
        const { whitelist, poolAddress, aggregationFee, PoolState } = await loadFixture(deploy);

        await expect(whitelist.setPools([[poolAddress, aggregationFee, PoolState.AddSwapRemove]]))
          .emit(whitelist, "PoolSet")
          .withArgs(poolAddress, aggregationFee, PoolState.AddSwapRemove);
      });
    });
  });
});