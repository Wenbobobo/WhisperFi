import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";

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
    },
  },
  networks: {
    hardhat: {
      hardfork: "cancun", // 为本地网络启用 Cancun
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