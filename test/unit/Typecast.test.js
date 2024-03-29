const { ethers } = require('hardhat');
const { expect } = require('chai');


describe('Typecast unit tests', () => {

  let typecast;

  const a1 = '0x1234567890123456789012345678901234567890';
  const x1 = '0x0000000000000000000000001234567890123456789012345678901234567890';

  before(async () => {
    const factory = await ethers.getContractFactory('TypecastMock');
    typecast = await factory.deploy();
    await typecast.deployed();
  });

  it("should cast address to bytes32", async function () {
    const x2 = await typecast.castToBytes32(a1);
    expect(x1).to.equal(x2);
  });

  it("should bytes32 cast to address", async function () {
    const a2 = await typecast.castToAddress(x1);
    expect(a1).to.equal(a2);
  });
  
});
