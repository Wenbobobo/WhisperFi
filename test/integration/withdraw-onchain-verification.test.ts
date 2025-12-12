import { expect } from "chai";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import { groth16 } from "snarkjs";
// @ts-ignore
import { buildPoseidon } from "circomlibjs";

describe("Withdraw On-chain Verification (Groth16)", function () {
  // Prefer build outputs to ensure they reflect latest circuit changes
  const wasmPath = path.join(process.cwd(), "circuits", "build", "withdraw", "withdraw_js", "withdraw.wasm");
  const zkeyPath = path.join(process.cwd(), "circuits", "build", "withdraw", "withdraw_0001.zkey");

  it("should verify proof on-chain", async function () {
    this.timeout(120_000);
    expect(fs.existsSync(wasmPath), "withdraw.wasm missing").to.be.true;
    expect(fs.existsSync(zkeyPath), "withdraw_0001.zkey missing").to.be.true;

    const [owner] = await ethers.getSigners();

    const { poseidonContract } = require("circomlibjs");
    const poseidon2Bytecode = poseidonContract.createCode(2);
    const poseidon2ABI = poseidonContract.generateABI(2);
    const Poseidon2Factory = new ethers.ContractFactory(poseidon2ABI, poseidon2Bytecode, owner);
    const poseidon2 = await Poseidon2Factory.deploy();
    await poseidon2.waitForDeployment();

    const poseidon5Bytecode = poseidonContract.createCode(5);
    const poseidon5ABI = poseidonContract.generateABI(5);
    const Poseidon5Factory = new ethers.ContractFactory(poseidon5ABI, poseidon5Bytecode, owner);
    const poseidon5 = await Poseidon5Factory.deploy();
    await poseidon5.waitForDeployment();

    const verifierFactory = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await verifierFactory.deploy();
    await verifier.waitForDeployment();

    const poolFactory = await ethers.getContractFactory("PrivacyPool");
    const pool = await poolFactory.deploy(
      await verifier.getAddress(),
      await poseidon2.getAddress(),
      await poseidon5.getAddress(),
      await owner.getAddress()
    );
    await pool.waitForDeployment();

    const poseidonJs = await buildPoseidon();
    const secret = BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
    const depositAmount = await pool.DEPOSIT_AMOUNT();
    // Commitment uses Poseidon(2)(secret, amount)
    const commitment = poseidonJs([secret, BigInt(depositAmount.toString())]);
    const commitmentHex = "0x" + poseidonJs.F.toObject(commitment).toString(16).padStart(64, "0");
    await pool.deposit(commitmentHex as any, { value: depositAmount });

    const depositEvents = await pool.queryFilter(pool.filters.Deposit());
    const leafIndex = depositEvents.findIndex((e) => e.args.commitment === commitmentHex);
    expect(leafIndex).to.not.equal(-1);

    // Build Merkle path consistent with on-chain tree (depth=16)
    const TREE_DEPTH = 16;
    const SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    const seed = Buffer.from("PrivacyPool-Zero");
    const seedHashHex = ethers.keccak256(seed);
    let currentZero = BigInt(seedHashHex) % SNARK_SCALAR_FIELD;
    const zeros: bigint[] = [];
    for (let i = 0; i < TREE_DEPTH; i++) {
      zeros[i] = currentZero;
      const h = poseidonJs([currentZero, currentZero]);
      currentZero = BigInt(poseidonJs.F.toObject(h));
    }

    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let levelIndex = leafIndex;
    let running = BigInt(poseidonJs.F.toObject(commitment));
    for (let level = 0; level < TREE_DEPTH; level++) {
      const isLeft = levelIndex % 2 === 0;
      const sibling = zeros[level];
      pathElements.push(sibling);
      pathIndices.push(isLeft ? 0 : 1);
      const left = isLeft ? running : sibling;
      const right = isLeft ? sibling : running;
      const h = poseidonJs([left, right]);
      running = BigInt(poseidonJs.F.toObject(h));
      levelIndex = Math.floor(levelIndex / 2);
    }

    const computedRoot = running;
    // Nullifier uses Poseidon(2)(secret, 0)
    const nullifier = poseidonJs([secret, 0n]);
    const nullifierHex = "0x" + poseidonJs.F.toObject(nullifier).toString(16).padStart(64, "0");

    const input = {
      secret: secret,
      amount: BigInt(depositAmount.toString()),
      pathElements,
      pathIndices,
    } as any;

    const rootBytes32 = ethers.toBeHex(computedRoot, 32);

    const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
    const circuitHash = BigInt(publicSignals[0]);
    const expectedHash = BigInt(poseidonJs.F.toObject(poseidonJs([computedRoot, BigInt(nullifierHex)])));
    expect(circuitHash, "publicInputsHash mismatch").to.equal(expectedHash);
    // Cross-check with on-chain Poseidon contract to ensure hashing parity
    const contractHash = await poseidon2["poseidon(uint256[2])"]([BigInt(rootBytes32), BigInt(nullifierHex)]);
    expect(BigInt(contractHash.toString()), "poseidon(sol) vs circuit mismatch").to.equal(expectedHash);

    // Use snarkjs calldata export to avoid coordinate ordering mistakes
    const callData = await groth16.exportSolidityCallData(proof, publicSignals);
    const raw = callData
      .replace(/["[\]\s]/g, "")
      .split(",")
      .map((x: string) => x.trim());

    const a: [string, string] = [raw[0], raw[1]];
    const b: [[string, string], [string, string]] = [
      [raw[2], raw[3]],
      [raw[4], raw[5]],
    ];
    const c: [string, string] = [raw[6], raw[7]];
    const exportedInputs = raw.slice(8).map((x) => BigInt(x));
    expect(exportedInputs[0], "exported public input mismatch").to.equal(expectedHash);

    await expect(
      pool.withdraw(
        a,
        b,
        c,
        rootBytes32,
        nullifierHex,
        await owner.getAddress(),
        0,
        await owner.getAddress()
      )
    ).to.not.be.reverted;
  });
});
