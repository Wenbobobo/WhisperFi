const { task } = require("hardhat/config");

task("test-contract-hash", "测试合约的哈希功能").setAction(
  async (taskArgs, hre) => {
    console.log("=== 合约Poseidon哈希测试 ===\n");

    try {
      // 获取部署的合约地址
      const fs = require("fs");
      let contractAddress;
      try {
        const deploymentData = JSON.parse(
          fs.readFileSync("./deployments.json", "utf8")
        );
        contractAddress = deploymentData.PrivacyPool;
        console.log(`使用已部署的合约地址: ${contractAddress}`);
      } catch {
        console.log("未找到已部署的合约，将部署新合约...");

        // 部署新合约进行测试
        const Verifier = await hre.ethers.getContractFactory("Verifier");
        const verifier = await Verifier.deploy();
        await verifier.waitForDeployment();

        const PrivacyPool = await hre.ethers.getContractFactory("PrivacyPool");
        const privacyPool = await PrivacyPool.deploy(
          await verifier.getAddress(),
          await hre.ethers.getSigners()[0].getAddress()
        );
        await privacyPool.waitForDeployment();

        contractAddress = await privacyPool.getAddress();
        console.log(`新部署的合约地址: ${contractAddress}`);
      }

      // 连接到合约
      const PrivacyPool = await hre.ethers.getContractFactory("PrivacyPool");
      const privacyPool = PrivacyPool.attach(contractAddress);

      // 测试合约的PoseidonT3功能
      console.log("\n1. 测试PoseidonT3哈希函数:");

      const testCases = [
        [1n, 2n],
        [0n, 0n],
        [123456789n, 987654321n],
        [
          8175042333908131853555108599311849679722172756805630201899011284758317870395n,
          0n,
        ],
      ];

      // 获取PoseidonT3合约地址
      const treeAddress = await privacyPool.tree();
      const PoseidonMerkleTree = await hre.ethers.getContractFactory(
        "PoseidonMerkleTree"
      );
      const tree = PoseidonMerkleTree.attach(treeAddress);

      for (let i = 0; i < testCases.length; i++) {
        const [left, right] = testCases[i];
        try {
          // 直接调用poseidon函数进行测试
          const result = await tree.poseidon([left, right]);

          console.log(`测试用例 ${i + 1}:`);
          console.log(`  输入: [${left.toString()}, ${right.toString()}]`);
          console.log(`  输出: ${result.toString()}`);
          console.log(`  输出(hex): ${result.toString()}`);
          console.log("");
        } catch (error) {
          console.log(`测试用例 ${i + 1} 失败:`, error.message);
        }
      }

      // 测试实际的Merkle树状态
      console.log("2. 测试Merkle树状态:");
      const root = await privacyPool.getRoot();
      console.log(`当前根节点: ${root}`);
      console.log(`根节点(BigInt): ${BigInt(root).toString()}`);
    } catch (error) {
      console.error("测试失败:", error.message);
    }
  }
);

module.exports = {};
