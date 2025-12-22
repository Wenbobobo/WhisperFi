import { ethers } from "hardhat";
import { buildPoseidon } from "circomlibjs";
import { groth16 } from "snarkjs";
import { CONTRACTS } from "../frontend/src/config/contracts";
import PrivacyPoolABI from "../artifacts/contracts/PrivacyPool.sol/PrivacyPool.json";

async function main() {
  console.log("\n🧪 Testing Withdraw with Different Value Sizes\n");
  console.log("=".repeat(70));

  const secret = BigInt("0x8c8046baa7e735ae031cae0a8bae147d5b9660db119d51fb1d7cf76d2e0a91");
  const amount = BigInt("100000000000000000");
  const ZERO_VALUE = "5738151709701895985996174429509233181681189240650583716378205449277091542814";

  const [signer] = await ethers.getSigners();
  const privacyPool = new ethers.Contract(
    CONTRACTS.PRIVACY_POOL_ADDRESS,
    PrivacyPoolABI.abi,
    signer
  );

  const filter = privacyPool.filters.Deposit();
  const events = await privacyPool.queryFilter(filter);
  if (events.length === 0) throw new Error("No deposits found!");

  const commitments = events.map((e: any) => e.args.commitment);
  const leafIndex = 0;

  const poseidon = await buildPoseidon();
  class SimpleMerkleTree {
    private zeros: bigint[] = [];
    private levelNodes: Map<number, bigint>[] = [];
    private root: bigint = 0n;

    constructor(private levels: number, leaves: string[], zeroValue: string, private poseidon: any) {
      this.levelNodes = Array.from({ length: levels + 1 }, () => new Map());
      let currentZero = BigInt(zeroValue);
      for (let i = 0; i < levels; i++) {
        this.zeros[i] = currentZero;
        currentZero = this.hash(currentZero, currentZero);
      }
      this.root = currentZero;
      leaves.forEach((leaf, idx) => this.insertLeaf(BigInt(leaf), idx));
    }

    private hash(left: bigint, right: bigint): bigint {
      return BigInt(this.poseidon.F.toString(this.poseidon([left, right])));
    }

    private insertLeaf(leaf: bigint, index: number): void {
      this.levelNodes[0].set(index, leaf);
      let currentIndex = index;
      let currentHash = leaf;
      for (let level = 0; level < this.levels; level++) {
        const isRight = currentIndex % 2 === 1;
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
        const sibling = this.levelNodes[level].get(siblingIndex) ?? this.zeros[level];
        const left = isRight ? sibling : currentHash;
        const right = isRight ? currentHash : sibling;
        currentHash = this.hash(left, right);
        const parentIndex = Math.floor(currentIndex / 2);
        this.levelNodes[level + 1].set(parentIndex, currentHash);
        currentIndex = parentIndex;
      }
      this.root = currentHash;
    }

    getRoot(): string {
      return "0x" + this.root.toString(16).padStart(64, "0");
    }

    getProof(index: number): { pathElements: string[]; pathIndices: number[] } {
      const pathElements: string[] = [];
      const pathIndices: number[] = [];
      let currentIndex = index;
      for (let level = 0; level < this.levels; level++) {
        const siblingIndex = currentIndex ^ 1;
        const sibling = this.levelNodes[level].get(siblingIndex) ?? this.zeros[level];
        pathElements.push("0x" + sibling.toString(16).padStart(64, "0"));
        pathIndices.push(currentIndex % 2);
        currentIndex = Math.floor(currentIndex / 2);
      }
      return { pathElements, pathIndices };
    }
  }

  const tree = new SimpleMerkleTree(16, commitments, ZERO_VALUE, poseidon);
  const merkleRoot = tree.getRoot();
  const { pathElements, pathIndices } = tree.getProof(leafIndex);

  const nullifierHash = poseidon([secret, 0n]);
  const nullifier = "0x" + poseidon.F.toObject(nullifierHash).toString(16).padStart(64, '0');

  console.log("⚙️  Generating ZK Proof...");
  const circuitInput = {
    secret: secret.toString(),
    amount: amount.toString(),
    pathElements: pathElements.map(p => BigInt(p).toString()),
    pathIndices: pathIndices
  };

  const { proof, publicSignals } = await groth16.fullProve(
    circuitInput,
    "frontend/public/zk/withdraw.wasm",
    "frontend/public/zk/withdraw.zkey"
  );

  console.log(`✅ Proof generated!`);

  // Try with different value representations
  const tests = [
    {
      name: "Small dummy values",
      proofA: [1n, 2n],
      proofB: [[3n, 4n], [5n, 6n]],
      proofC: [7n, 8n]
    },
    {
      name: "Medium values (1000-8000)",
      proofA: [1000n, 2000n],
      proofB: [[3000n, 4000n], [5000n, 6000n]],
      proofC: [7000n, 8000n]
    },
    {
      name: "Real proof values as strings",
      proofA: [proof.pi_a[0].toString(), proof.pi_a[1].toString()],
      proofB: [
        [proof.pi_b[0][0].toString(), proof.pi_b[0][1].toString()],
        [proof.pi_b[1][0].toString(), proof.pi_b[1][1].toString()],
      ],
      proofC: [proof.pi_c[0].toString(), proof.pi_c[1].toString()]
    },
    {
      name: "Real proof values as BigInt",
      proofA: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
      proofB: [
        [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
        [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])],
      ],
      proofC: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])]
    }
  ];

  const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const fee = 0n;
  const relayer = ethers.ZeroAddress;

  for (const test of tests) {
    console.log(`\n🧪 Testing with: ${test.name}`);
    try {
      await privacyPool.withdraw.staticCall(
        test.proofA,
        test.proofB,
        test.proofC,
        merkleRoot,
        nullifier,
        recipient,
        fee,
        relayer
      );
      console.log(`  ✅ Static call succeeded (or reverted with contract error)`);
    } catch (error: any) {
      if (error.message.includes("function selector")) {
        console.log(`  ❌ FAILED: Function selector not recognized`);
      } else {
        console.log(`  ✅ Function recognized, contract reverted: ${error.message.split('\n')[0]}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);
