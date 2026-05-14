const fs = require("fs");
const path = require("path");

async function main() {
  const contractFile = path.join(__dirname, "..", "frontend", "contract.js");
  const content = fs.readFileSync(contractFile, "utf8");
  const json = content
    .replace("window.CONTRACT = ", "")
    .replace(/;\s*$/, "");
  const { address, abi } = JSON.parse(json);

  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(address, abi, signer);

  console.log("Creando eventos de ejemplo...");

  const futureDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const originalPrice = ethers.parseEther("0.05");
  const maxResalePrice = ethers.parseEther("0.06");

  const tx = await contract.createEvent(
    "Concierto Blockchain Live 2026",
    "Auditorio Citibanamex, Monterrey",
    futureDate,
    originalPrice,
    maxResalePrice,
    50
  );
  await tx.wait();

  const tx2 = await contract.createEvent(
    "Conferencia DApps & Web3",
    "Tec de Monterrey, Campus Monterrey",
    futureDate + 10 * 24 * 60 * 60,
    ethers.parseEther("0.02"),
    ethers.parseEther("0.025"),
    100
  );
  await tx2.wait();

  console.log("2 eventos de ejemplo creados");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
