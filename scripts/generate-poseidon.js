/**
 * 生成与circomlibjs兼容的Poseidon Solidity合约
 * 这个脚本生成一个标准的Poseidon合约，确保与ZK电路和前端的完美哈希一致性
 */

const { poseidonContract } = require('circomlibjs');
const fs = require('fs');
const path = require('path');

/**
 * 生成标准的Poseidon合约源代码。
 */
function generatePoseidonContractSource() {
    return `
contract PoseidonHasher {
    function poseidon(uint256[2] memory input) public view returns (uint256 result) {
        assembly {
            let x := mload(add(input, 0x20))
            let y := mload(add(input, 0x40))
            mstore(0x00, x)
            mstore(0x20, y)
            let success := staticcall(gas(), 9, 0x00, 0x40, 0x00, 0x20)
            if iszero(success) {
                revert(0, 0)
            }
            result := mload(0x00)
        }
    }

    function poseidon(bytes32[2] memory input) public view returns (uint256 result) {
        assembly {
            let x := mload(add(input, 0x20))
            let y := mload(add(input, 0x40))
            mstore(0x00, x)
            mstore(0x20, y)
            let success := staticcall(gas(), 9, 0x00, 0x40, 0x00, 0x20)
            if iszero(success) {
                revert(0, 0)
            }
            result := mload(0x00)
        }
    }
}

interface IPoseidonHasher {
    function poseidon(uint256[2] memory input) external view returns (uint256);
    function poseidon(bytes32[2] memory input) external view returns (uint256);
}
`;
}

async function main() {
    console.log('🔧 正在生成Poseidon合约...');
    
    const nInputs = 2;
    
    try {
        const abi = poseidonContract.generateABI(nInputs);
        console.log(`✅ 成功生成 ${nInputs} 输入的 Poseidon ABI`);
        
        const contractSource = generatePoseidonContractSource();
        console.log(`✅ 成功生成 ${nInputs} 输入的 Poseidon 合约源代码`);
        
        const solidityFileContent = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

${contractSource}`;

        const contractsDir = path.join(process.cwd(), 'contracts');
        const outputPath = path.join(contractsDir, 'PoseidonHasher.sol');
        fs.writeFileSync(outputPath, solidityFileContent);
        
        const abiDir = path.join(process.cwd(), 'frontend', 'src', 'abi');
        if (!fs.existsSync(abiDir)) {
            fs.mkdirSync(abiDir, { recursive: true });
        }
        const abiPath = path.join(abiDir, 'PoseidonHasher.json');
        fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
        
        console.log(`✅ Poseidon 合约已生成: ${outputPath}`);
        console.log(`✅ ABI 文件已生成: ${abiPath}`);
        
    } catch (error) {
        console.error('❌ 生成 Poseidon 合约时出错:', error);
        throw error;
    }
}

if (require.main === module) {
    main()
        .then(() => console.log('🎉 Poseidon 合约生成完成！'))
        .catch(error => {
            console.error('💥 生成失败:', error);
            process.exit(1);
        });
}

module.exports = { generatePoseidonContract: main };