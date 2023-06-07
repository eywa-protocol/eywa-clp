const { ethers } = require("hardhat");
testToken = require("../../artifacts/contracts/amm_pool/SynthERC20.sol/SynthERC20.json")
plainpoolAbi = require("../../artifacts/mock/plainpool.vy/plainpool.json")
plainPoolTwoAbi = require("../../artifacts/mock/plainTwo.vy/plainTwo.json")
plainHubPoolAbi = require("../../artifacts/mock/plainHubPool.vy/plainHubPool.json")
newPoolAbi = require("../../artifacts/mock/poolnew.vy/poolnew.json")
oldPoolAbi = require("../../artifacts/mock/poolold.vy/poolold.json")

const A = 200;                 // amplification coefficient for the pool.
const fee = 5000000;           // pool swap fee
const amountToAdd = ethers.utils.parseEther("100000");
const owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

async function main() {

    const provider = new ethers.providers.getDefaultProvider('http://127.0.0.1:8545/')

    const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
    const connectedWallet = wallet.connect(provider)
    //4pool
    const poolOldFactory = new ethers.Contract("0x686d67265703D1f124c45E33d47d794c566889Ba", oldPoolAbi.abi, connectedWallet)
    //6 pool
    const poolFactory = new ethers.Contract("0xa218eD442715Fc42ac96a6323B47538684a36e4B", newPoolAbi.abi, connectedWallet)


    let tokenFactory = new ethers.ContractFactory(testToken.abi, testToken.bytecode, connectedWallet)

    ////////////////////////////////USDT POOL\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
    let sUSDT_BSC = await tokenFactory.deploy("sUSDT_BSC", "sUSDT_BSC", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sUSDT_MUMBAI = await tokenFactory.deploy("sUSDT_MUMBAI", "sUSDT_MUMBAI", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let USDT = await tokenFactory.deploy("USDT", "USDT", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sUSDT_AGOR = await tokenFactory.deploy("sUSDT_AGOR", "sUSDT_AGOR", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sUSDT_AVCH = await tokenFactory.deploy("sUSDT_AVCH", "sUSDT_AVCH", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sUSDT_GOR = await tokenFactory.deploy("sUSDT_GOR", "sUSDT_GOR", 18, ethers.constants.AddressZero, 111, "chain", '2')

    //DEPLOY 6 POOL
    console.log("deploy usdt pool")
    await poolFactory.deploy_plain_pool("eUSDT pool", "eUSDT", [sUSDT_BSC.address, sUSDT_MUMBAI.address, USDT.address, sUSDT_AGOR.address, sUSDT_AVCH.address, sUSDT_GOR.address], A, fee, 0, 0, { gasLimit: 2_000_000 })
    console.log("usdt pool deployed")

    let currentPoolAdr = await poolFactory.pool_list(await poolFactory.pool_count() - 1)
    let usdtPool = new ethers.Contract(currentPoolAdr, plainpoolAbi.abi, connectedWallet)
    console.log("mint usdt")
    await sUSDT_BSC.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sUSDT_MUMBAI.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await USDT.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sUSDT_AGOR.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sUSDT_AVCH.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sUSDT_GOR.mint(owner, amountToAdd, { gasLimit: 2_000_000 })

    console.log("approve usdt")
    await sUSDT_BSC.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sUSDT_MUMBAI.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await USDT.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sUSDT_AGOR.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sUSDT_AVCH.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sUSDT_GOR.approve(currentPoolAdr, ethers.constants.MaxUint256)


    //add 6 pool
    console.log("add liquidity to usdt pool")
    await usdtPool.add_liquidity([amountToAdd, amountToAdd, amountToAdd, amountToAdd, amountToAdd, amountToAdd], 0, { gasLimit: 2_000_000 })
    ////////////////////////////////USDC POOL\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
    let sUSDC_BSC = await tokenFactory.deploy("sUSDC_BSC", "sUSDC_BSC", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sUSDC_MUMBAI = await tokenFactory.deploy("sUSDC_MUMBAI", "sUSDC_MUMBAI", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let USDC = await tokenFactory.deploy("USDC", "USDC", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sUSDC_AGOR = await tokenFactory.deploy("sUSDC_AGOR", "sUSDC_AGOR", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sUSDC_AVCH = await tokenFactory.deploy("sUSDT_AVCH", "sUSDC_AVCH", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sUSDC_GOR = await tokenFactory.deploy("sUSDC_GOR", "sUSDC_GOR", 18, ethers.constants.AddressZero, 111, "chain", '2')

    //DEPLOY 6 POOL
    console.log("deploy usdc pool")
    await poolFactory.deploy_plain_pool("eUSDC pool", "eUSDC", [sUSDC_BSC.address, sUSDC_MUMBAI.address, USDC.address, sUSDC_AGOR.address, sUSDC_AVCH.address, sUSDC_GOR.address], A, fee, 0, 0, { gasLimit: 2_000_000 })
    console.log("usdc pool deployed")

    currentPoolAdr = await poolFactory.pool_list(await poolFactory.pool_count() - 1)
    let usdcPool = new ethers.Contract(currentPoolAdr, plainpoolAbi.abi, connectedWallet)
    console.log("mint usdc")
    await sUSDC_BSC.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sUSDC_MUMBAI.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await USDC.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sUSDC_AGOR.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sUSDC_AVCH.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sUSDC_GOR.mint(owner, amountToAdd, { gasLimit: 2_000_000 })

    console.log("approve usdc")
    await sUSDC_BSC.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sUSDC_MUMBAI.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await USDC.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sUSDC_AGOR.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sUSDC_AVCH.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sUSDC_GOR.approve(currentPoolAdr, ethers.constants.MaxUint256)


    //add 6 pool
    console.log("add liquidity to usdc pool")
    await usdcPool.add_liquidity([amountToAdd, amountToAdd, amountToAdd, amountToAdd, amountToAdd, amountToAdd], 0, { gasLimit: 2_000_000 })

    ////////////////////////////////DAI POOL\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
    let sDAI_BSC = await tokenFactory.deploy("sDAI_BSC", "sDAI_BSC", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sDAI_MUMBAI = await tokenFactory.deploy("sDAI_MUMBAI", "sDAI_MUMBAI", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let DAI = await tokenFactory.deploy("DAI", "DAI", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sDAI_AGOR = await tokenFactory.deploy("sDAI_AGOR", "sDAI_AGOR", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sDAI_AVCH = await tokenFactory.deploy("sDAI_AVCH", "sDAI_AVCH", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sDAI_GOR = await tokenFactory.deploy("sDAI_GOR", "sDAI_GOR", 18, ethers.constants.AddressZero, 111, "chain", '2')

    //DEPLOY 6 POOL
    console.log("deploy DAI pool")
    await poolFactory.deploy_plain_pool("eDAI pool", "eDAI", [sDAI_BSC.address, sDAI_MUMBAI.address, DAI.address, sDAI_AGOR.address, sDAI_AVCH.address, sDAI_GOR.address], A, fee, 0, 0, { gasLimit: 2_000_000 })
    console.log("DAI pool deployed")

    currentPoolAdr = await poolFactory.pool_list(await poolFactory.pool_count() - 1)
    let daiPool = new ethers.Contract(currentPoolAdr, plainpoolAbi.abi, connectedWallet)
    console.log("mint dai")
    await sDAI_BSC.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sDAI_MUMBAI.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await DAI.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sDAI_AGOR.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sDAI_AVCH.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sDAI_GOR.mint(owner, amountToAdd, { gasLimit: 2_000_000 })

    console.log("approve dai")
    await sDAI_BSC.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sDAI_MUMBAI.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await DAI.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sDAI_AGOR.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sDAI_AVCH.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sDAI_GOR.approve(currentPoolAdr, ethers.constants.MaxUint256)


    //add 6 pool
    console.log("add liquidity to dai pool")
    await daiPool.add_liquidity([amountToAdd, amountToAdd, amountToAdd, amountToAdd, amountToAdd, amountToAdd], 0, { gasLimit: 2_000_000 })


    ////////////////////////////////BUSD POOL\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
    let sBUSD_BSC = await tokenFactory.deploy("sBUSD_BSC", "sBUSD_BSC", 18, ethers.constants.AddressZero, 111, "chain", '2')
    let sBUSD_GOR = await tokenFactory.deploy("sBUSD_GOR", "sBUSD_GOR", 18, ethers.constants.AddressZero, 111, "chain", '2')

    //DEPLOY 2 POOL
    console.log("deploy busd pool")
    await poolOldFactory.deploy_plain_pool("eBUSD", "eBUSD", [sBUSD_BSC.address, sBUSD_GOR.address, ethers.constants.AddressZero, ethers.constants.AddressZero], A, fee, 0, 0, { gasLimit: 2_000_000 })
    console.log("busd pool deployed")

    currentPoolAdr = await poolOldFactory.pool_list(await poolOldFactory.pool_count() - 1)
    let busdPool = new ethers.Contract(currentPoolAdr, plainPoolTwoAbi.abi, connectedWallet)
    console.log("mint busd")
    await sBUSD_BSC.mint(owner, amountToAdd, { gasLimit: 2_000_000 })
    await sBUSD_GOR.mint(owner, amountToAdd, { gasLimit: 2_000_000 })

    console.log("approve busd")
    await sBUSD_BSC.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await sBUSD_GOR.approve(currentPoolAdr, ethers.constants.MaxUint256)


    //add 2 pool
    console.log("add liquidity to busd pool")
    await busdPool.add_liquidity([amountToAdd, amountToAdd], 0, { gasLimit: 2_000_000 })

    ////////////////////////////////HUB POOL\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

    //DEPLOY 4 POOL
    console.log("deploy hub pool")
    await poolOldFactory.deploy_plain_pool("Hub pool", "EUSD", [usdtPool.address, usdcPool.address, daiPool.address, busdPool.address], A, fee, 0, 0, { gasLimit: 2_000_000 })
    console.log("hub pool deployed")

    currentPoolAdr = await poolOldFactory.pool_list(await poolOldFactory.pool_count() - 1)
    let hubPool = new ethers.Contract(currentPoolAdr, plainHubPoolAbi.abi, connectedWallet)

    console.log("approve hub")
    await usdtPool.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await usdcPool.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await daiPool.approve(currentPoolAdr, ethers.constants.MaxUint256)
    await busdPool.approve(currentPoolAdr, ethers.constants.MaxUint256)

    //add 2 pool
    console.log("add liquidity to hub pool")
    await hubPool.add_liquidity([amountToAdd, amountToAdd, amountToAdd, amountToAdd], 0, { gasLimit: 2_000_000 })
}

main();

