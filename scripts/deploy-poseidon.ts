import { ethers } from "hardhat";
import { Signer } from "ethers";
const { poseidonContract } = require("circomlibjs");

/**
 * @title Deploy Poseidon Hasher Contract
 * @notice 使用 circomlibjs 生成并部署与前端完全兼容的 Poseidon 哈希合约
 * @dev 这个脚本生成支持 2 个输入的 Poseidon 哈希函数合约
 */
async function main(signer?: Signer) {
    console.log("🚀 开始部署 Poseidon 哈希合约...");

    try {
        // 1. 从 circomlibjs 生成 Poseidon 合约的字节码和 ABI
        console.log("📦 正在生成 Poseidon 合约字节码...");
        const poseidonBytecode = poseidonContract.createCode(2);
        
        console.log("📋 正在生成 Poseidon 合约 ABI...");
        const poseidonABI = poseidonContract.generateABI(2);

        // 2. 使用 ethers 创建合约工厂
        console.log("🏭 正在创建合约工厂...");
        const deployer = signer ?? (await ethers.getSigners())[0];
        const PoseidonFactory = new ethers.ContractFactory(
            poseidonABI,
            poseidonBytecode,
            deployer
        );

        // 3. 部署合约
        console.log("⚡ 正在部署 PoseidonHasher 合约...");
        const poseidonHasher = await PoseidonFactory.deploy();
        
        // 4. 等待部署完成
        console.log("⏳ 等待部署确认...");
        await poseidonHasher.waitForDeployment();
        
        const contractAddress = await poseidonHasher.getAddress();
        
        // 5. 输出部署结果
        console.log("✅ PoseidonHasher 合约部署成功！");
        console.log(`📍 合约地址: ${contractAddress}`);
        console.log(`🔗 网络: ${(await ethers.provider.getNetwork()).name}`);
        
        // 6. 验证合约功能（可选）
        console.log("🧪 正在验证合约功能...");
        try {
            // 测试 poseidon 函数 - 使用具体的函数签名避免冲突
            const testInput = [1n, 2n];
            const result = await (poseidonHasher as any)["poseidon(uint256[2])"](testInput);
            console.log(`✅ 测试成功 - poseidon([1, 2]) = ${result}`);
        } catch (error) {
            console.warn("⚠️  合约功能验证失败:", error);
        }

        return {
            address: contractAddress,
            contract: poseidonHasher,
            abi: poseidonABI
        };

    } catch (error) {
        console.error("❌ 部署 Poseidon 合约时出错:", error);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main()
        .then((result) => {
            console.log("🎉 Poseidon 合约部署完成！");
            console.log(`📍 最终地址: ${result.address}`);
        })
        .catch((error) => {
            console.error("💥 部署失败:", error);
            process.exit(1);
        });
}

export { main as deployPoseidon };
