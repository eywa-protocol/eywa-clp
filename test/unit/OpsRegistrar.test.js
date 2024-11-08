const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');

describe('OpsRegistrar unit tests', () => {

  let opsRegistrar;

  const zeroAddress = ethers.constants.AddressZero;
  const chainId = network.config.chainId;
  const bridgeAddress = '0x0000000000000000000000000000000000000042';
  const someAddress = '0x0000000000000000000000000000000000000088';

  let owner, alice, mallory;

  // Deploy all contracts before each test suite
  beforeEach(async () => {
    // eslint-disable-next-line no-undef
    [owner, alice, mallory] = await ethers.getSigners();

    let factory = await ethers.getContractFactory('OpsRegistrar');
    opsRegistrar = await factory.deploy();
    await opsRegistrar.deployed();
  });

  it('should set complex op', async() => {
    await opsRegistrar.registerComplexOp([['LM', true]]);
    expect(await opsRegistrar.ops(ethers.utils.solidityKeccak256(['string'], ['LM']))).to.equal(true);
  });

  it('shouldn\'t set ops registrar if caller is not an owner', async() => {
    await expect(opsRegistrar.connect(mallory).registerComplexOp([['LM', true]]))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

});