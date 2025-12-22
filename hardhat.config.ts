import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "solidity-coverage";
import * as dotenv from "dotenv";
import * as fs from "fs";

// Load environment variables
dotenv.config();

// Load wallet configuration if exists
const walletEnvPath = "./config/wallet.env";
if (fs.existsSync(walletEnvPath)) {
  const walletEnv = dotenv.parse(fs.readFileSync(walletEnvPath));
  if (walletEnv.KEY) {
    process.env.PRIVATE_KEY = walletEnv.KEY;
  }
}

const isCoverage = !!process.env.SOLIDITY_COVERAGE;

// 加载测试设置
import "./test/setup";

// 加载任务
require("./tasks/test-hash.js");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun", // 添加这行以支持瞬态存储
      viaIR: isCoverage, // enable IR optimizer under coverage to avoid stack-too-deep
    },
  },
  networks: {
    hardhat: {
      hardfork: "cancun", // 为本地网络启用 Cancun
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 300000, // 5分钟超时，给ZK证明生成足够的时间
    require: ["./test/setup.ts"], // 自动加载测试设置文件
  },
};

export default config;
