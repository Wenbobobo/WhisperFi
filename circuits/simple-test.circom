pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

// 简化的测试电路，只做基本的Poseidon哈希测试
template SimpleTest() {
    signal input a;
    signal input b;
    signal output out;
    
    component hasher = Poseidon(2);
    hasher.inputs[0] <== a;
    hasher.inputs[1] <== b;
    
    out <== hasher.out;
}

component main = SimpleTest();
