// test/environment.ts
import { ethers } from "hardhat";
import { BaseWallet, Contract, Signer, getBytes, solidityPacked } from "ethers";
import {
  EntryPoint,
  Paymaster,
  PrivacyPool,
  SmartAccount,
  SmartAccountFactory,
  MockVerifier,
  MockERC20,
  MockUniswapRouter,
} from "../typechain-types";
import { PackedUserOperation } from "./utils/UserOperation";

// --- Inlined Poseidon Deployment Functions ---
const { poseidonContract } = require("circomlibjs");

async function _deployPoseidon(signer: Signer) {
    const poseidonBytecode = poseidonContract.createCode(2);
    const poseidonABI = poseidonContract.generateABI(2);
    const PoseidonFactory = new ethers.ContractFactory(
        poseidonABI,
        poseidonBytecode,
        signer
    );
    const poseidonHasher = await PoseidonFactory.deploy();
    await poseidonHasher.waitForDeployment();
    return {
        address: await poseidonHasher.getAddress(),
        contract: poseidonHasher,
    };
}

async function _deployPoseidon5(signer: Signer) {
    const poseidon5Bytecode = poseidonContract.createCode(5);
    const poseidon5ABI = poseidonContract.generateABI(5);
    const Poseidon5Factory = new ethers.ContractFactory(
        poseidon5ABI,
        poseidon5Bytecode,
        signer
    );
    const poseidonHasher5 = await Poseidon5Factory.deploy();
    await poseidonHasher5.waitForDeployment();
    return {
        address: await poseidonHasher5.getAddress(),
        contract: poseidonHasher5,
    };
}


/**
 * @dev A helper function to pack uints for accountGasLimits and gasFees.
 * This is often needed when creating UserOperations.
 * @param high The high 128 bits.
 * @param low The low 128 bits.
 * @returns The packed 256-bit value.
 */
export function packUints(high: bigint, low: bigint): string {
  return solidityPacked(["uint128", "uint128"], [high, low]);
}
/**
 * @dev Represents the complete testing environment with all deployed contracts and signers.
 */
export interface TestEnvironment {
  owner: Signer;
  user: Signer;
  bundler: Signer;
  entryPoint: EntryPoint;
  verifier: MockVerifier;
  privacyPool: PrivacyPool;
  factory: SmartAccountFactory;
  paymaster: Paymaster;
  weth: MockERC20;
  usdc: MockERC20;
  mockUniswapRouter: MockUniswapRouter;
}

/**
 * @notice Deploys the entire test environment for Account Abstraction.
 * @dev This function is designed to be used with `loadFixture` from Hardhat Network Helpers.
 * It deploys all necessary contracts (`EntryPoint`, `Verifier`, `PrivacyPool`, `SmartAccountFactory`, `Paymaster`)
 * and returns them as a single object for use in tests.
 * Using `loadFixture(deployTestEnvironment)` ensures that the deployment logic is run only once,
 * and each test gets a fresh, snapshot-reverted state, making tests fast and reliable.
 * @returns {Promise<TestEnvironment>} A promise that resolves to the `TestEnvironment` object.
 */
export async function deployTestEnvironment(): Promise<TestEnvironment> {
  const [owner, user, bundler] = await ethers.getSigners();

  // 1. Deploy EntryPoint
  const entryPointFactory = await ethers.getContractFactory("EntryPoint");
  const entryPoint = await entryPointFactory.deploy();
  await entryPoint.waitForDeployment();
  const entryPointAddress = await entryPoint.getAddress();

  // 2. Deploy MockVerifier (for testing - always returns true)
  const verifierFactory = await ethers.getContractFactory("MockVerifier");
  const verifier = await verifierFactory.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();

  // 3. Deploy PoseidonHasher using inlined deployment function
  const poseidonDeployment = await _deployPoseidon(owner);
  const poseidonHasherAddress = poseidonDeployment.address;

  // Deploy Poseidon5 Hasher for public inputs hashing
  const poseidon5Deployment = await _deployPoseidon5(owner);
  const poseidonHasher5Address = poseidon5Deployment.address;

  // 4. Deploy PrivacyPool
  const privacyPoolFactory = await ethers.getContractFactory("PrivacyPool");
  const privacyPool = await privacyPoolFactory.deploy(
    verifierAddress,
    poseidonHasherAddress,
    poseidonHasher5Address,
    await owner.getAddress()
  );
  await privacyPool.waitForDeployment();

  // 5. Deploy SmartAccountFactory
  const factoryFactory = await ethers.getContractFactory("SmartAccountFactory");
  const factory = await factoryFactory.deploy(entryPointAddress);
  await factory.waitForDeployment();

  // 6. Deploy Paymaster
  const paymasterFactory = await ethers.getContractFactory("Paymaster");
  const paymaster = (await paymasterFactory.deploy(
    entryPointAddress,
    await owner.getAddress()
  )) as Paymaster;
  await paymaster.waitForDeployment();

  // 7. Deploy MockERC20 tokens
  const mockERC20Factory = await ethers.getContractFactory("MockERC20");

  // Deploy WETH with 18 decimals and initial supply of 1 million tokens
  const weth = (await mockERC20Factory.deploy(
    "Wrapped Ethereum",
    "WETH",
    18,
    ethers.parseEther("1000000")
  )) as MockERC20;
  await weth.waitForDeployment();

  // Deploy USDC with 6 decimals and initial supply of 1 million tokens
  const usdc = (await mockERC20Factory.deploy(
    "USD Coin",
    "USDC",
    6,
    ethers.parseUnits("1000000", 6)
  )) as MockERC20;
  await usdc.waitForDeployment();

  // 8. Deploy MockUniswapRouter
  const mockUniswapRouterFactory = await ethers.getContractFactory(
    "MockUniswapRouter"
  );
  const mockUniswapRouter =
    (await mockUniswapRouterFactory.deploy()) as MockUniswapRouter;
  await mockUniswapRouter.waitForDeployment();

  // 8.1. Configure WETH/USDC trading pair in MockUniswapRouter
  console.log("⚙️ 配置 MockUniswapRouter 交易对...");
  const wethAddress = await weth.getAddress();
  const usdcAddress = await usdc.getAddress();
  
  // Set exchange rate: 1 WETH = 2000 USDC (考虑到 WETH 18位小数，USDC 6位小数)
  // rate = 2000 * 10^6 = 2000000000 (输出USDC数量，已考虑小数位差异)
  const exchangeRate = ethers.parseUnits("2000", 6); // 2000 USDC per WETH
  await mockUniswapRouter.setExchangeRate(wethAddress, usdcAddress, exchangeRate);
  
  // Also set reverse pair (USDC -> WETH): 1 USDC = 0.0005 WETH
  // rate = 0.0005 * 10^18 = 500000000000000 (输出WETH数量)
  const reverseExchangeRate = ethers.parseUnits("0.0005", 18); // 0.0005 WETH per USDC
  await mockUniswapRouter.setExchangeRate(usdcAddress, wethAddress, reverseExchangeRate);
  
  console.log(`✅ 交易对配置完成:`);
  console.log(`   - WETH (${wethAddress}) -> USDC: ${ethers.formatUnits(exchangeRate, 6)} USDC per WETH`);
  console.log(`   - USDC (${usdcAddress}) -> WETH: ${ethers.formatEther(reverseExchangeRate)} WETH per USDC`);

  // 9. Fund Paymaster
  await paymaster
    .connect(owner)
    .depositToEntryPoint({ value: ethers.parseEther("1") });
  await paymaster
    .connect(owner)
    .setSupportedTarget(await privacyPool.getAddress(), true);

  return {
    owner,
    user,
    bundler,
    entryPoint,
    verifier,
    privacyPool,
    factory,
    paymaster,
    weth,
    usdc,
    mockUniswapRouter,
  };
}

/**
 * @notice Retrieves a client instance for a specific SmartAccount.
 * @dev This function attaches the `SmartAccount` ABI to a given address,
 * allowing you to interact with a specific smart account contract.
 * @param smartAccountAddress The address of the SmartAccount.
 * @param signer The signer to connect to the contract instance.
 * @returns {SmartAccount} An instance of the SmartAccount contract.
 */
export async function getSmartAccountClient(
  smartAccountAddress: string,
  signer: Signer
): Promise<SmartAccount> {
  return (await ethers.getContractAt(
    "SmartAccount",
    smartAccountAddress,
    signer
  )) as SmartAccount;
}

/**
 * @notice Generates a complete, signed UserOperation for testing.
 * @dev This utility function simplifies the creation of UserOperations.
 * It takes the test environment and a set of parameters, computes the hash,
 * signs it with the user's signer, and returns the complete `PackedUserOperation`.
 * @param env The deployed `TestEnvironment`.
 * @param sender The address of the smart account sending the operation.
 * @param callData The `execute` call data to be included in the UserOp.
 * @param overrides Optional partial `UserOperation` fields to override defaults.
 * @returns {Promise<PackedUserOperation>} A promise that resolves to the signed UserOperation.
 */
export async function generateUserOp(
  env: TestEnvironment,
  sender: string,
  callData: string,
  overrides: Partial<PackedUserOperation> = {}
): Promise<PackedUserOperation> {
  const { entryPoint, user, paymaster } = env;

  // Get the current block for timestamp-based validation
  const currentBlock = await ethers.provider.getBlock("latest");
  const validUntil = currentBlock!.timestamp + 3600; // Valid for 1 hour
  const validAfter = 0;

  const paymasterAndData = await paymaster.createPaymasterAndData(
    100000, // verificationGasLimit
    50000, // postOpGasLimit
    validUntil,
    validAfter
  );

  const userOp: PackedUserOperation = {
    sender: sender,
    nonce: overrides.nonce ?? 0n,
    initCode: overrides.initCode ?? "0x",
    callData: callData,
    accountGasLimits:
      overrides.accountGasLimits ?? packUints(500000n, 1000000n),
    preVerificationGas: overrides.preVerificationGas ?? 21000n,
    gasFees: overrides.gasFees ?? packUints(10n ** 9n, 2n * 10n ** 9n), // 1 Gwei, 2 Gwei
    paymasterAndData: overrides.paymasterAndData ?? paymasterAndData,
    signature: "0x", // Placeholder, will be replaced after signing
  };

  const userOpHash = await entryPoint.getUserOpHash(userOp);
  const signature = await user.signMessage(getBytes(userOpHash));
  userOp.signature = signature;

  return userOp;
}
