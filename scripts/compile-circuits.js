const { exec, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const circuits = ["withdraw"]; // We only need to recompile withdraw for now

console.log("Starting circuit compilation...");

circuits.forEach((circuit) => {
  const circuitPath = path.join(__dirname, "..", "circuits", `${circuit}.circom`);
  const outputDir = path.join(__dirname, "..", "circuits", `${circuit}_js`);
  const r1csPath = path.join(__dirname, "..", "circuits", `${circuit}.r1cs`);
  const ptauPath = path.join(__dirname, "..", "circuits", "powersOfTau28_hez_final_16.ptau");
  const zkeyPath = path.join(__dirname, "..", "circuits", `${circuit}_0001.zkey`);
  const verificationKeyPath = path.join(__dirname, "..", "circuits", "verification_key.json");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Compile the circuit to R1CS and WASM
const compileCommand = `temp_circom\\circom.exe "${circuitPath}" --r1cs --wasm --output "${outputDir}" -l node_modules`;  console.log(`Executing: ${compileCommand}`);
  try {
    execSync(compileCommand, { stdio: "inherit" });
    console.log(`✅ Successfully compiled ${circuit}.circom`);
    // Move R1CS file to the circuits directory for the next step
    fs.renameSync(path.join(outputDir, `${circuit}.r1cs`), r1csPath);
  } catch (error) {
    console.error(`❌ Error compiling ${circuit}.circom:`, error.message);
    return; // Stop if compilation fails
  }

  // 2. Generate the ZKey (Trusted Setup)
  const setupCommand = `npx snarkjs groth16 setup "${r1csPath}" "${ptauPath}" "${zkeyPath}"`;
  console.log(`Executing: ${setupCommand}`);
  try {
    execSync(setupCommand, { stdio: "inherit" });
    console.log(`✅ Successfully generated ${circuit}_0001.zkey`);
  } catch (error) {
    console.error(`❌ Error generating zkey for ${circuit}:`, error.message);
    return;
  }
  
  // 3. Export the verification key
  const exportVKeyCommand = `npx snarkjs zkey export verificationkey "${zkeyPath}" "${verificationKeyPath}"`;
    console.log(`Executing: ${exportVKeyCommand}`);
    try {
        execSync(exportVKeyCommand, { stdio: 'inherit' });
        console.log(`✅ Successfully exported verification key to ${verificationKeyPath}`);
    } catch (error) {
        console.error(`❌ Error exporting verification key for ${circuit}:`, error.message);
        return;
    }
});
