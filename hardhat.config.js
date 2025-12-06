require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

/** @type */
module.exports = {
  solidity: {
    version: "0.8.20", 
    settings: {
      optimizer: { enabled: true, runs: 1 },
      viaIR: true, 
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      allowUnlimitedContractSize: true, 
    },
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
};
