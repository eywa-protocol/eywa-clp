//POOL=2 npx hardhat test ./test/PoolAdapter.test.js
const { ethers } = require("hardhat");
const { expect } = require("chai");

const parse18 = ethers.utils.parseEther;
const zeroAddress = ethers.constants.AddressZero;
let factory, poolAdapter, curveBalancer, oldLPBalance, oldBalanceOne, oldBalanceTwo;

contract("StableSwap", () => {
  const deployTokens = async (amount) => {
    let tokens = [];
    for (let i = 0; i < amount; i++) {
      factory = await ethers.getContractFactory("TestTokenPermit");
      const token = await factory.deploy("Token" + i, "TKN" + i, 18);
      await token.deployed();
      tokens.push(token);
    }
    return tokens;
  }

  const tokenCall = async (selector, p1, p2, tokens) => {
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].address != zeroAddress) {
        tokens[i][selector](p1, p2);
      }
    }
  }
  describe("Synthesis unit tests", () => {
    const poolType = process.env.POOL?.trim() || "crypto";
    const A = 200; // amplification coefficient for the pool.
    const fee = 5000000; // pool swap fee
    let treasury;
    let pool, lpToken;

    let tokens;
    let owner, notOwner;

    beforeEach(async () => {
      [owner, notOwner] = await ethers.getSigners();
      factory = await ethers.getContractFactory("BalancerTreasury");
      treasury = await factory.deploy();
      await treasury.deployed();
      factory = poolType == "crypto" ? await ethers.getContractFactory("CryptoPoolAdapter") : await ethers.getContractFactory("BalancedStablePoolAdapter");
      poolAdapter = await factory.deploy();
      await poolAdapter.deployed();

      factory = await ethers.getContractFactory("CurveBalancier");
      curveBalancer = await factory.deploy(treasury.address);
      await curveBalancer.deployed();

      await curveBalancer.addTrustedAddress(poolAdapter.address);
      await curveBalancer.addTrustedAddress(owner.address);
      await treasury.grantRole(await treasury.BALANCER_ROLE(), curveBalancer.address);
      poolType == "crypto" ? null : await poolAdapter.setCurveBalancer(curveBalancer.address);

      if (poolType == "2") {
        tokens = await deployTokens(2);
        factory = await ethers.getContractFactory("plainTwo");
        pool = await factory.deploy();
        await pool.deployed();
        await pool.initialize(
          "TwoPool",
          "eTWO",
          [tokens[0].address, tokens[1].address, zeroAddress, zeroAddress],
          Array(4).fill(18),
          A,
          fee
        );
        await tokenCall("mint(address,uint256)", owner.address, parse18("10000"), tokens);
        await tokenCall("approve(address,uint256)", pool.address, parse18("10000"), tokens);
        await pool["add_liquidity(uint256[2],uint256)"](
          Array(2).fill(parse18("1000")),
          0
        );
      } else if (poolType == "4") {
        tokens = await deployTokens(4);
        factory = await ethers.getContractFactory("plainHubPool");
        pool = await factory.deploy();
        await pool.deployed();
        await pool.initialize(
          "FourPool",
          "eFOUR",
          [tokens[0].address, tokens[1].address, tokens[2].address, tokens[3].address],
          Array(4).fill(18),
          A,
          fee
        );
        await tokenCall("mint(address,uint256)", owner.address, parse18("10000"), tokens);
        await tokenCall("approve(address,uint256)", pool.address, parse18("10000"), tokens);
        await pool["add_liquidity(uint256[4],uint256)"](
          Array(4).fill(parse18("1000")),
          0
        );
      } else if (poolType == "6") {
        tokens = await deployTokens(6);
        factory = await ethers.getContractFactory("plainSix");
        pool = await factory.deploy();
        await pool.deployed();
        await pool.initialize(
          "SixPool",
          "eSIX",
          [tokens[0].address, tokens[1].address, tokens[2].address, tokens[3].address, tokens[4].address, tokens[5].address],
          Array(6).fill(18),
          A,
          fee
        );
        await tokenCall("mint(address,uint256)", owner.address, parse18("10000"), tokens);
        await tokenCall("approve(address,uint256)", pool.address, parse18("10000"), tokens);
        await pool["add_liquidity(uint256[6],uint256)"](
          Array(6).fill(parse18("1000")),
          0
        );
      } else if (poolType == "crypto") {
        factory = await ethers.getContractFactory("curveLPTokenV5");
        lpToken = await factory.deploy();
        await lpToken.deployed();
        tokens = await deployTokens(2);
        factory = await ethers.getContractFactory("cryptoPool");
        pool = await factory.deploy(zeroAddress);
        await pool.deployed();
        await lpToken.initialize(
          "cryptoPool",
          "eCRPT",
          pool.address
        )
        await pool.initialize(
          200000000,
          100000000000000,
          5000000,
          45000000,
          10000000000,
          5000000000000000,
          5500000000000,
          5000000000,
          600,
          BigInt("1000000000000000000"),
          lpToken.address,
          [tokens[0].address, tokens[1].address],
          18
        );
        await tokenCall("mint(address,uint256)", owner.address, parse18("10000"), tokens);
        await tokenCall("approve(address,uint256)", pool.address, parse18("10000"), tokens);
        await pool["add_liquidity(uint256[2],uint256)"](
          Array(2).fill(parse18("1000")),
          0
        );
      }

      // await tokenCall("mint(address,uint256)", treasury.address, parse18("10000"), tokens);
    });

    it("PoolAdapter: should add liquidity balanced", async function () {
      //disbalance pool
      await tokenCall("mint(address,uint256)", treasury.address, parse18("10000"), tokens);
      poolType == "crypto" ? null : await pool["exchange(int128,int128,uint256,uint256)"](0, 1, parse18("1000"), 0)
      await tokenCall("mint(address,uint256)", poolAdapter.address, parse18("100"), tokens);
      await tokenCall("approve(address,uint256)", curveBalancer.address, parse18("100"), tokens);
      oldLPBalance = poolType == "crypto" ? await lpToken.balanceOf(owner.address) : await pool.balanceOf(owner.address)
      poolType == "crypto" ? await poolAdapter.addLiquidity(pool.address, parse18("5"), 0, owner.address, 0, owner.address) : await poolAdapter.addLiquidity(pool.address, tokens[0].address, parse18("5"), parse18("1000"), 0, owner.address, tokens.length, owner.address)
      expect(poolType == "crypto" ? await lpToken.balanceOf(owner.address) : await pool.balanceOf(owner.address)).to.be.above(oldLPBalance);
    });

    it("PoolAdapter: should add liquidity balanced if receiver is poolAdapter", async function () {
      //disbalance pool
      await tokenCall("mint(address,uint256)", treasury.address, parse18("10000"), tokens);
      poolType == "crypto" ? null : await pool["exchange(int128,int128,uint256,uint256)"](0, 1, parse18("1000"), 0)
      await tokenCall("mint(address,uint256)", poolAdapter.address, parse18("100"), tokens);
      await tokenCall("approve(address,uint256)", curveBalancer.address, parse18("100"), tokens);
      oldLPBalance = poolType == "crypto" ? await lpToken.balanceOf(poolAdapter.address) : await pool.balanceOf(poolAdapter.address)
      poolType == "crypto" ? await poolAdapter.addLiquidity(pool.address, parse18("5"), 0, poolAdapter.address, 0, owner.address) : await poolAdapter.addLiquidity(pool.address, tokens[0].address, parse18("5"), parse18("1000"), 0, poolAdapter.address, tokens.length, owner.address)
      expect(poolType == "crypto" ? await lpToken.balanceOf(poolAdapter.address) : await pool.balanceOf(poolAdapter.address)).to.be.above(oldLPBalance);
    });

    it("PoolAdapter: shouldn't add liquidity balanced", async function () {
      //disbalance pool
      poolType == "crypto" ? null : await pool["exchange(int128,int128,uint256,uint256)"](0, 1, parse18("1000"), 0)
      await tokenCall("mint(address,uint256)", poolAdapter.address, parse18("100"), tokens);
      await tokenCall("approve(address,uint256)", curveBalancer.address, parse18("100"), tokens);
      oldLPBalance = poolType == "crypto" ? await lpToken.balanceOf(owner.address) : await pool.balanceOf(owner.address);
      poolType == "crypto" ? await poolAdapter.addLiquidity(pool.address, parse18("5"), 0, owner.address, ethers.constants.MaxUint256, owner.address) : await poolAdapter.addLiquidity(pool.address, tokens[0].address, parse18("5"), 0, 0, owner.address, tokens.length, owner.address)
      expect(poolType == "crypto" ? await lpToken.balanceOf(owner.address) : await pool.balanceOf(owner.address)).to.be.equal(oldLPBalance);
    });

    it("PoolAdapter: should exchange tokens", async function () {
      oldBalanceTwo = await tokens[1].balanceOf(owner.address);
      await tokens[0].mint(poolAdapter.address, parse18('10'));
      poolType == "crypto" ? await poolAdapter.swap(tokens[0].address, pool.address, 0, 1, tokens[1].address, owner.address, 0, owner.address, 0) : await poolAdapter.swap(tokens[0].address, pool.address, 0, 1, tokens[1].address, owner.address, 0, owner.address);
      expect(await tokens[1].balanceOf(owner.address)).to.be.above(oldBalanceTwo);
    });

    it("PoolAdapter: should exchange tokens if receiver is poolAdapter", async function () {
      oldBalanceTwo = await tokens[1].balanceOf(poolAdapter.address);
      await tokens[0].mint(poolAdapter.address, parse18('10'));
      poolType == "crypto" ? await poolAdapter.swap(tokens[0].address, pool.address, 0, 1, tokens[1].address, poolAdapter.address, 0, owner.address, 0) : await poolAdapter.swap(tokens[0].address, pool.address, 0, 1, tokens[1].address, poolAdapter.address, 0, owner.address);
      expect(await tokens[1].balanceOf(poolAdapter.address)).to.be.above(oldBalanceTwo);
    });

    it("PoolAdapter: should remove liquidity", async function () {
      poolType == "crypto" ? await lpToken.approve(poolAdapter.address, parse18("100")) : await pool.approve(poolAdapter.address, 100);
      poolType == "crypto" ? await lpToken.transfer(poolAdapter.address, parse18("100")) : await pool.transfer(poolAdapter.address, 100);
      oldBalanceOne = await tokens[0].balanceOf(owner.address);
      await poolAdapter.removeLiquidity(pool.address, 0, owner.address, tokens[0].address, 0, owner.address);
      expect(await tokens[0].balanceOf(owner.address)).to.be.above(oldBalanceOne);
    });

    it("PoolAdapter: should remove liquidity if receiver is poolAdapter", async function () {
      poolType == "crypto" ? await lpToken.approve(poolAdapter.address, parse18("100")) : await pool.approve(poolAdapter.address, 100);
      poolType == "crypto" ? await lpToken.transfer(poolAdapter.address, parse18("100")) : await pool.transfer(poolAdapter.address, 100);
      oldBalanceOne = await tokens[0].balanceOf(poolAdapter.address);
      await poolAdapter.removeLiquidity(pool.address, 0, poolAdapter.address, tokens[0].address, 0, owner.address);
      expect(await tokens[0].balanceOf(poolAdapter.address)).to.be.above(oldBalanceOne);
    });

    it("PoolAdapter: shouldn't exchange tokens if expected minAmountOut > minDy", async function () {
      oldBalanceTwo = await tokens[1].balanceOf(owner.address);
      await tokens[0].mint(poolAdapter.address, parse18('10'));
      poolType == "crypto" ? await poolAdapter.swap(tokens[0].address, pool.address, 0, 1, tokens[1].address, owner.address, ethers.constants.MaxUint256, owner.address, 0) : await poolAdapter.swap(tokens[0].address, pool.address, 0, 1, tokens[1].address, owner.address, ethers.constants.MaxUint256, owner.address);
      expect(await tokens[1].balanceOf(owner.address)).to.be.equal(oldBalanceTwo);
    });

    it("PoolAdapter: shouldn't remove liquidity if expected minAmountOut > minDy", async function () {
      poolType == "crypto" ? await lpToken.approve(poolAdapter.address, parse18("100")) : await pool.approve(poolAdapter.address, 100);
      poolType == "crypto" ? await lpToken.transfer(poolAdapter.address, parse18("100")) : await pool.transfer(poolAdapter.address, 100);
      oldBalanceOne = await tokens[0].balanceOf(owner.address);
      await poolAdapter.removeLiquidity(pool.address, 0, owner.address, tokens[0].address, ethers.constants.MaxUint256, owner.address);
      expect(await tokens[0].balanceOf(owner.address)).to.be.equal(oldBalanceOne);
    });

    it("PoolAdapter: shouldn't set Curve Balancer if caller is not an owner", async function () {
      poolType == "crypto" ? null : await expect(poolAdapter.connect(notOwner).setCurveBalancer(ethers.constants.AddressZero)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
