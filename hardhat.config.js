import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const { DEPLOYER_PRIVATE_KEY } = process.env;

// Hardhat configuration for Celo networks
const config = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    alfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 44787,
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 42220,
    },
  },
  sourcify: {
    enabled: false,
  },
  etherscan: {
    // Etherscan V2 API: a single Etherscan.io API key now works across all
    // supported chains (including Celo) via chainid-based routing.
    // Falling back to CELOSCAN_API_KEY since that's what's currently in your .env
    apiKey: process.env.ETHERSCAN_API_KEY || process.env.CELOSCAN_API_KEY || "",
    customChains: [
      {
        network: "alfajores",
        chainId: 44787,
        urls: {
          apiURL: "https://api-alfajores.celoscan.io/api",
          browserURL: "https://alfajores.celoscan.io",
        },
      },
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io",
        },
      },
    ],
  },
};

export default config;
