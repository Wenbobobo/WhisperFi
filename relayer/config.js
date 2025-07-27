// relayer/config.js
// Relayer 服务配置 - 环境感知设计

/**
 * 网络配置映射
 */
const NETWORK_CONFIG = {
    // 本地测试网配置
    31337: {
        name: 'localhost',
        rpcUrl: 'http://127.0.0.1:8545',
        // 本地测试网使用模拟地址 - 实际部署时会被替换
        tokens: {
            WETH: {
                symbol: "WETH",
                address: "0x0000000000000000000000000000000000000001", // 占位符
                decimals: 18,
                name: "Wrapped Ether"
            },
            USDC: {
                symbol: "USDC", 
                address: "0x0000000000000000000000000000000000000002", // 占位符
                decimals: 6,
                name: "USD Coin"
            }
        },
        // Uniswap V3 配置
        uniswap: {
            routerAddress: "0x0000000000000000000000000000000000000003", // 占位符
            factoryAddress: "0x0000000000000000000000000000000000000004" // 占位符
        }
    },

    // Mainnet 配置（将来扩展用）
    1: {
        name: 'mainnet',
        rpcUrl: process.env.MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/your-key',
        tokens: {
            WETH: {
                symbol: "WETH",
                address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                decimals: 18,
                name: "Wrapped Ether"
            },
            USDC: {
                symbol: "USDC",
                address: "0xA0b86a33E6417C7DE0E331b3f5a3Dd6D64C4d4a2",
                decimals: 6,
                name: "USD Coin"
            }
        },
        uniswap: {
            routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984"
        }
    }
};

/**
 * 获取当前网络配置
 * @param {number} chainId - 链 ID
 * @returns {Object} 网络配置
 */
function getNetworkConfig(chainId) {
    const config = NETWORK_CONFIG[chainId];
    if (!config) {
        throw new Error(`不支持的网络 Chain ID: ${chainId}`);
    }
    return config;
}

/**
 * 获取代币配置
 * @param {number} chainId - 链 ID  
 * @param {string} symbol - 代币符号
 * @returns {Object} 代币配置
 */
function getTokenConfig(chainId, symbol) {
    const networkConfig = getNetworkConfig(chainId);
    const token = networkConfig.tokens[symbol];
    if (!token) {
        throw new Error(`不支持的代币: ${symbol} on chain ${chainId}`);
    }
    return token;
}

module.exports = {
    NETWORK_CONFIG,
    getNetworkConfig,
    getTokenConfig
};