// test/environment.ts
import { ethers } from "hardhat";
import {
  BaseWallet,
  Contract,
  Signer,
  getBytes,
  solidityPacked,
} from "ethers";
import {
  EntryPoint,
  EntryPoint__factory,
  Paymaster,
  PrivacyPool,
  SmartAccount,
  SmartAccountFactory,
  Groth16Verifier,
  MockERC20,
} from "../typechain-types";
import { PackedUserOperation } from "./utils/UserOperation";

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
  verifier: Groth16Verifier;
  privacyPool: PrivacyPool;
  factory: SmartAccountFactory;
  paymaster: Paymaster;
  weth: MockERC20;
  usdc: MockERC20;
}
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

  // 2. Deploy Verifier
  const verifierFactory = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await verifierFactory.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();

  // 3. Deploy PoseidonHasher (Mock version for testing)
  const poseidonHasherFactory = await ethers.getContractFactory("PoseidonHasherMock");
  const poseidonHasher = await poseidonHasherFactory.deploy();
  await poseidonHasher.waitForDeployment();
  const poseidonHasherAddress = await poseidonHasher.getAddress();

  // 4. Deploy PrivacyPool
  const privacyPoolFactory = await ethers.getContractFactory("PrivacyPool");
  const privacyPool = await privacyPoolFactory.deploy(
    verifierAddress,
    poseidonHasherAddress,
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
  const weth = await mockERC20Factory.deploy(
    "Wrapped Ethereum",
    "WETH",
    18,
    ethers.parseEther("1000000")
  ) as MockERC20;
  await weth.waitForDeployment();
  
  // Deploy USDC with 6 decimals and initial supply of 1 million tokens
  const usdc = await mockERC20Factory.deploy(
    "USD Coin",
    "USDC",
    6,
    ethers.parseUnits("1000000", 6)
  ) as MockERC20;
  await usdc.waitForDeployment();

  // 8. Fund Paymaster
  await paymaster.connect(owner).depositToEntryPoint({ value: ethers.parseEther("1") });
  await paymaster.connect(owner).setSupportedTarget(await privacyPool.getAddress(), true);

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
