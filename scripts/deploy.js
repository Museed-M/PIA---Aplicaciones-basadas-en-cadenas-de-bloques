const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Desplegando con la cuenta:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  const Factory = await ethers.getContractFactory("TicketMarketplace");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("Contrato desplegado en:", address);

  const artifact = await artifacts.readArtifact("TicketMarketplace");
  const out = {
    address,
    abi: artifact.abi
  };
  const frontendPath = path.join(__dirname, "..", "frontend", "contract.js");
  fs.writeFileSync(
    frontendPath,
    "window.CONTRACT = " + JSON.stringify(out, null, 2) + ";\n"
  );
  console.log("ABI y direccion escritos en frontend/contract.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
