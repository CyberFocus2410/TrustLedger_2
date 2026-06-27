const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment of TrustLedger...");

  // Get the contract factory
  const TrustLedger = await hre.ethers.getContractFactory("TrustLedger");
  
  // Deploy the contract
  const trustLedger = await TrustLedger.deploy();
  await trustLedger.waitForDeployment();
  
  const contractAddress = await trustLedger.getAddress();
  console.log(`TrustLedger deployed successfully to: ${contractAddress}`);

  // Retrieve the contract artifact (contains ABI)
  const artifactPath = path.join(__dirname, "../artifacts/contracts/TrustLedger.sol/TrustLedger.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  
  const contractInfo = {
    address: contractAddress,
    abi: artifact.abi
  };

  // Paths to backend and frontend destinations
  const backendDestDir = path.join(__dirname, "../../backend/app");
  const frontendDestDir = path.join(__dirname, "../../frontend/src");

  // Ensure directories exist
  if (!fs.existsSync(backendDestDir)) {
    fs.mkdirSync(backendDestDir, { recursive: true });
  }
  if (!fs.existsSync(frontendDestDir)) {
    fs.mkdirSync(frontendDestDir, { recursive: true });
  }

  // Write contract_info.json to backend and frontend
  fs.writeFileSync(
    path.join(backendDestDir, "contract_info.json"),
    JSON.stringify(contractInfo, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(frontendDestDir, "contract_info.json"),
    JSON.stringify(contractInfo, null, 2),
    "utf8"
  );

  console.log("Contract address and ABI exported to backend/app/contract_info.json and frontend/src/contract_info.json successfully.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
