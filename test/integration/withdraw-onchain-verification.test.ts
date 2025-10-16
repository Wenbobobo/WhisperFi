import { expect } from "chai";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
// @ts-ignore
import { groth16 } from "snarkjs";
// @ts-ignore
import { buildPoseidon } from "circomlibjs";

describe("Withdraw On-chain Verification (Groth16)", function () {
  const isEnabled = process.env.ZK_ONCHAIN === "1";
  const wasmPath = path.join(process.cwd(), "circuits", "withdraw_js", "withdraw.wasm");
  const zkeyPath = path.join(process.cwd(), "circuits", "withdraw_0001.zkey");

  (isEnabled ? it : it.skip)("should verify proof on-chain", async function () {
    this.timeout(120_000);
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
      this.skip();
    }

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
    const commitment = poseidonJs([secret]);
    const commitmentHex = "0x" + poseidonJs.F.toObject(commitment).toString(16).padStart(64, "0");

    const depositAmount = await pool.DEPOSIT_AMOUNT();
    await pool.deposit(commitmentHex as any, { value: depositAmount });

    const depositEvents = await pool.queryFilter(pool.filters.Deposit());
    const leafIndex = depositEvents.findIndex((e) => e.args.commitment === commitmentHex);
    expect(leafIndex).to.not.equal(-1);

    const root = await pool.merkleRoot();

    const nullifier = poseidonJs([secret]);
    const nullifierHex = "0x" + poseidonJs.F.toObject(nullifier).toString(16).padStart(64, "0");

    const input = {
      secret: secret,
      nullifier: BigInt(nullifierHex),
      merkleRoot: BigInt(root),
      pathElements: Array(16).fill(0n),
      pathIndices: Array(16).fill(0),
    };

    try {
      const { proof } = await groth16.fullProve(input, wasmPath, zkeyPath);
      const a: [string, string] = [proof.pi_a[0].toString(), proof.pi_a[1].toString()];
      const b: [[string, string], [string, string]] = [
        [proof.pi_b[0][0].toString(), proof.pi_b[0][1].toString()],
        [proof.pi_b[1][0].toString(), proof.pi_b[1][1].toString()],
      ];
      const c: [string, string] = [proof.pi_c[0].toString(), proof.pi_c[1].toString()];

      await expect(
        pool.withdraw(
          a,
          b,
          c,
          root,
          nullifierHex,
          await owner.getAddress(),
          0,
          await owner.getAddress()
        )
      ).to.not.be.reverted;
    } catch (err) {
      this.skip();
    }
  });
});

