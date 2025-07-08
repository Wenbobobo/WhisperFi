const { exec } = require("child_process");
const path = require("path");

const circuits = ["deposit", "withdraw", "trade"];

const circomPath = path.join(__dirname, "..", "node_modules", ".bin", "circom");

circuits.forEach(circuit => {
    const command = `"${circomPath}" circuits/${circuit}.circom --r1cs --wasm --output circuits/build/${circuit}`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error compiling ${circuit}.circom: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
        }
        console.log(`Successfully compiled ${circuit}.circom`);
    });
});
