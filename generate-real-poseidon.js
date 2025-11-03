const fs = require("fs");
const path = require("path");
const { poseidonContract } = require("circomlibjs");

async function generatePoseidonContract() {
  try {
    console.log("生成真正的Poseidon合约...");

    // 生成Poseidon合约的ABI和字节码
    const poseidon = await poseidonContract.createCode(2);

    // 创建一个包装合约，使用内联汇编来部署和调用Poseidon
    const contractCode = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PoseidonHasher
 * @notice 真正的Poseidon哈希实现，与circomlibjs完全兼容
 */
contract PoseidonHasher {
    address private immutable poseidonT3;
    
    constructor() {
        // 部署Poseidon T3合约
        bytes memory bytecode = hex"${poseidon.bytecode.slice(2)}";
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt())
        }
        require(addr != address(0), "Failed to deploy Poseidon");
        poseidonT3 = addr;
    }
    
    /**
     * @notice 计算Poseidon哈希（支持动态数组）
     * @param input 输入数组，长度必须为2
     * @return 哈希结果
     */
    function poseidon(uint256[] memory input) public view returns (uint256) {
        require(input.length == 2, "Input must have exactly 2 elements");
        return poseidon(input[0], input[1]);
    }
    
    /**
     * @notice 计算Poseidon哈希（固定参数）
     * @param a 第一个输入
     * @param b 第二个输入
     * @return 哈希结果
     */
    function poseidon(uint256 a, uint256 b) public view returns (uint256) {
        (bool success, bytes memory result) = poseidonT3.staticcall(
            abi.encode(a, b)
        );
        require(success, "Poseidon call failed");
        return abi.decode(result, (uint256));
    }
    
    /**
     * @notice 计算commitment哈希
     * @param secret secret值
     * @param amount 存款金额
     * @return commitment哈希
     */
    function calculateCommitment(uint256 secret, uint256 amount) 
        external 
        view 
        returns (uint256) 
    {
        return poseidon(secret, amount);
    }
}`;

    // 保存合约文件
    const contractPath = path.join(
      __dirname,
      "contracts",
      "PoseidonHasher.sol"
    );
    fs.writeFileSync(contractPath, contractCode);
    console.log("✅ Poseidon合约已生成:", contractPath);

    // 生成ABI文件
    const abi = [
      {
        inputs: [],
        stateMutability: "nonpayable",
        type: "constructor",
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "secret",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "amount",
            type: "uint256",
          },
        ],
        name: "calculateCommitment",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "uint256[]",
            name: "input",
            type: "uint256[]",
          },
        ],
        name: "poseidon",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "a",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "b",
            type: "uint256",
          },
        ],
        name: "poseidon",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ];

    const abiPath = path.join(
      __dirname,
      "frontend",
      "src",
      "abi",
      "PoseidonHasher.json"
    );
    fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
    console.log("✅ ABI文件已生成:", abiPath);

    console.log("🎉 Poseidon合约生成完成！");
  } catch (error) {
    console.error("❌ 生成Poseidon合约失败:", error);
    process.exit(1);
  }
}

generatePoseidonContract();
