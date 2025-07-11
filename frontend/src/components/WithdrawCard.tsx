// src/components/WithdrawCard.tsx
"use client";

import { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, CircularProgress, Link, Alert, Stepper, Step, StepLabel } from '@mui/material';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { MerkleTree } from 'fixed-merkle-tree';
// @ts-ignore
import { groth16 } from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';

import { CONTRACTS } from '../config/contracts';
import PrivacyPoolArtifact from '../abi/PrivacyPool.json';
import { parseNote, generateCommitment, generateNullifierHash } from '../utils/crypto';

const PRIVACY_POOL_ADDRESS = CONTRACTS.PRIVACY_POOL_ADDRESS as `0x${string}`;
const PrivacyPoolAbi = PrivacyPoolArtifact.abi;
const steps = ['Generate Proof', 'Submit Transaction'];

export default function WithdrawCard() {
  const [note, setNote] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [isProving, setIsProving] = useState(false);
  const [proof, setProof] = useState<any>(null);
  const [publicSignals, setPublicSignals] = useState<any>(null);

  const { chain, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const generateProof = async () => {
    if (!address || !publicClient) {
      alert('Please connect your wallet first.');
      return;
    }
    if (!note) {
      alert('Please enter your note.');
      return;
    }

    setIsProving(true);
    setActiveStep(0);

    try {
      // 1. Parse the note to get secret and nullifier
      const { secret, nullifier } = parseNote(note);
      const depositAmount = ethers.parseEther('0.1');
      const commitment = await generateCommitment(secret, depositAmount);
      const nullifierHash = await generateNullifierHash(secret); // 根据电路，使用 secret 计算 nullifier

      console.log('Generated commitment:', commitment);
      console.log('Generated commitment (BigInt):', BigInt(commitment).toString());
      console.log('Secret:', secret);
      console.log('Nullifier:', nullifier);
      console.log('Amount:', depositAmount.toString());
      console.log('Nullifier Hash:', nullifierHash);
      console.log('Using contract address:', PRIVACY_POOL_ADDRESS);
      console.log('Contract address lowercase:', PRIVACY_POOL_ADDRESS.toLowerCase());
      
      // 额外调试：检查最新区块和合约是否有任何交易
      const latestBlock = await publicClient.getBlockNumber();
      console.log('Latest block number:', Number(latestBlock));
      
      // 检查是否有任何发送到合约地址的交易
      try {
        const contractCode = await publicClient.getBytecode({ address: PRIVACY_POOL_ADDRESS });
        console.log('Contract exists (has bytecode):', contractCode !== undefined && contractCode !== '0x');
      } catch (e) {
        console.log('Error checking contract bytecode:', e);
      }

      // 2. Fetch all deposit events to build the tree
      // 使用更直接的方法获取事件日志
      const depositEventSignature = ethers.id("Deposit(bytes32,uint32,uint256)");
      console.log('Computed event signature:', depositEventSignature);
      
      // 正确的事件签名
      const correctSignature = "0xa945e51eec50ab98c161376f0db4cf2aeba3ec92755fe2fcd388bdbbb80ff196";
      if (depositEventSignature !== correctSignature) {
        console.warn('Event signature mismatch! Expected:', correctSignature, 'Got:', depositEventSignature);
      }
      
      let logs: any[] = [];
      let methodUsed = "";
      
      try {
        // 先尝试使用 viem 的原生方法
        const result = await publicClient.request({
          method: 'eth_getLogs',
          params: [{
            address: PRIVACY_POOL_ADDRESS.toLowerCase(),
            topics: [depositEventSignature],
            fromBlock: '0x0',
            toBlock: 'latest'
          }]
        });
        logs = result as any[];
        methodUsed = "Method 1";
        console.log('Method 1 - Found logs:', logs.length);
        
        // 如果方法1没有找到日志，尝试备用方法
        if (logs.length === 0) {
          throw new Error("No logs found with Method 1, trying alternatives");
        }
      } catch (error) {
        console.error('Method 1 failed or found no logs, trying alternative:', error);
        try {
          // 备用方法：不使用 topics 过滤，获取所有日志然后手动过滤
          const result = await publicClient.request({
            method: 'eth_getLogs',
            params: [{
              address: PRIVACY_POOL_ADDRESS.toLowerCase(),
              fromBlock: '0x0',
              toBlock: 'latest'
            }]
          });
          const allLogs = result as any[];
          // 手动过滤 Deposit 事件
          logs = allLogs.filter((log: any) => 
            log.topics && log.topics[0] === depositEventSignature
          );
          methodUsed = "Method 2";
          console.log('Method 2 - Found logs:', logs.length, 'from total:', allLogs.length);
          
          // 如果方法2也没有找到日志，尝试最后的方法
          if (logs.length === 0) {
            throw new Error("No logs found with Method 2, trying Method 3");
          }
        } catch (error2) {
          console.error('Method 2 also failed or found no logs:', error2);
          // 最后的备用方法：逐区块查找
          const latestBlock = await publicClient.getBlockNumber();
          logs = [];
          methodUsed = "Method 3";
          console.log('Method 3 - Scanning blocks 0 to', Number(latestBlock));
          for (let i = 0; i <= Number(latestBlock); i++) {
            try {
              const blockResult = await publicClient.request({
                method: 'eth_getLogs',
                params: [{
                  address: PRIVACY_POOL_ADDRESS.toLowerCase(),
                  fromBlock: `0x${i.toString(16)}`,
                  toBlock: `0x${i.toString(16)}`
                }]
              });
              const blockLogs = blockResult as any[];
              const depositLogs = blockLogs.filter((log: any) => 
                log.topics && log.topics[0] === depositEventSignature
              );
              logs.push(...depositLogs);
              if (depositLogs.length > 0) {
                console.log(`Found ${depositLogs.length} deposit events in block ${i}`);
              }
            } catch (e) {
              // 忽略单个区块的错误
            }
          }
          console.log('Method 3 - Total found logs:', logs.length);
        }
      }
      
      // 手动解析事件日志
      const commitments = logs.map((log: any) => {
        // 第一个 topic 是事件签名，第二个 topic 是 indexed commitment
        return log.topics[1];
      });
      
      console.log(`${methodUsed} - Found deposit events:`, logs.length);
      console.log('Commitments from events:', commitments);
      console.log('Looking for commitment:', commitment);
      console.log('Contract address used:', PRIVACY_POOL_ADDRESS.toLowerCase());
      console.log('Event signature used:', depositEventSignature);
      
      // 3. Initialize Poseidon and build the Merkle tree using OpenZeppelin-compatible logic
      const poseidon = await buildPoseidon();
      
      // OpenZeppelin style hash function (but using Poseidon instead of Keccak256)
      const hashFunction = (left: any, right: any) => {
        const leftBigInt = BigInt(left);
        const rightBigInt = BigInt(right);
        
        // Use the same ordering logic as OpenZeppelin's commutativeKeccak256
        // Always put the smaller value first
        const [first, second] = leftBigInt < rightBigInt ? [leftBigInt, rightBigInt] : [rightBigInt, leftBigInt];
        
        const result = poseidon([first, second]);
        return poseidon.F.toString(result);
      };
      
      console.log('Building OpenZeppelin-compatible Merkle tree with Poseidon hash');
      console.log('Commitments for tree building:', commitments.slice(0, 3)); // Show first 3
      
      // Convert commitments to BigInt format for tree building
      const commitmentsAsBigInt = commitments.map(c => BigInt(c).toString());
      console.log('Commitments as BigInt strings:', commitmentsAsBigInt.slice(0, 3)); // Show first 3
      
      const tree = new MerkleTree(20, commitmentsAsBigInt, { 
        hashFunction, 
        zeroElement: '0'  // Use string zero
      });

      // 4. Find the commitment and generate the Merkle proof
      const commitmentAsBigInt = BigInt(commitment).toString();
      const leafIndex = commitmentsAsBigInt.findIndex(c => c === commitmentAsBigInt);
      if (leafIndex < 0) {
        throw new Error('Note not found in deposits. It may not have been mined yet, or the note is incorrect.');
      }
      console.log('Found commitment at index:', leafIndex);
      console.log('Commitment (BigInt string):', commitmentAsBigInt);
      console.log('Matching tree element:', commitmentsAsBigInt[leafIndex]);
      
      const { pathElements, pathIndices } = tree.path(leafIndex);

      // 5. Prepare inputs for the ZK circuit
      // 获取合约当前的实际root，而不是使用计算的tree root
      console.log('Getting current root from contract...');
      const contractRoot = await publicClient.readContract({
        address: PRIVACY_POOL_ADDRESS,
        abi: PrivacyPoolAbi,
        functionName: 'root'
      });
      console.log('Contract root:', contractRoot);
      console.log('Tree root (calculated):', tree.root);
      
      const rootBigInt = BigInt(contractRoot.toString());
      console.log('Using contract root for proof:', rootBigInt.toString());
      console.log('Path elements:', pathElements);
      console.log('Path indices:', pathIndices);
      
      // 根据电路定义准备正确的输入
      // 确保所有值都在正确的字段范围内
      const secretBigInt = BigInt(secret);
      const nullifierHashBigInt = BigInt(nullifierHash); // 这应该是从secret计算出的nullifierHash
      const amountBigInt = BigInt(ethers.parseEther('0.1'));
      // 使用合约的实际root而不是计算的root
      
      console.log('Values before circuit input:');
      console.log('Secret BigInt:', secretBigInt.toString());
      console.log('Nullifier Hash BigInt (calculated from secret):', nullifierHashBigInt.toString());
      console.log('Amount BigInt:', amountBigInt.toString());
      console.log('Root BigInt (contract):', rootBigInt.toString());
      console.log('Path elements length:', pathElements.length);
      console.log('Path indices length:', pathIndices.length);
      
      // 确保 pathElements 只包含路径元素，不包含路径索引
      console.log('Raw pathElements:', pathElements);
      console.log('Raw pathElements type:', typeof pathElements);
      console.log('Raw pathElements length:', pathElements ? pathElements.length : 'undefined');
      
      const cleanPathElements = pathElements.map((el: any) => {
        const element = BigInt(el.toString());
        console.log('Path element:', element.toString());
        return element;
      });
      
      console.log('Clean pathElements length:', cleanPathElements.length);
      
      // 验证路径元素数量是否正确
      if (cleanPathElements.length !== 20) {
        console.error('ERROR: Expected 20 path elements, got:', cleanPathElements.length);
        throw new Error(`Invalid path elements count: expected 20, got ${cleanPathElements.length}`);
      }
      
      // 修正输入格式以匹配更新后的电路期望
      const input = {
        secret: secretBigInt.toString(),
        amount: amountBigInt.toString(),
        pathElements: cleanPathElements.map(e => e.toString()),
        pathIndices: pathIndices.map(i => i.toString()),
        merkleRoot: rootBigInt.toString(),
        nullifier: nullifierHashBigInt.toString()
      };
      
      // 在电路中验证commitment计算
      console.log('Circuit input validation:');
      console.log('Secret for circuit:', secretBigInt.toString());
      console.log('Amount for circuit:', amountBigInt.toString());
      console.log('Expected commitment (hex):', commitment);
      console.log('Expected commitment (BigInt):', BigInt(commitment).toString());
      console.log('Leaf found at index:', leafIndex);
      console.log('Commitment from events[' + leafIndex + ']:', commitments[leafIndex]);
      
      // 手动验证Merkle proof
      console.log('Manual Merkle proof verification:');
      const poseidonForVerification = await buildPoseidon();
      let currentHash = BigInt(commitment);
      console.log('Starting with leaf (commitment):', currentHash.toString());
      
      for (let i = 0; i < pathElements.length; i++) {
        const pathElement = BigInt(pathElements[i].toString());
        const isRight = pathIndices[i] === 1;
        
        console.log(`Level ${i}:`);
        console.log('  Current hash:', currentHash.toString());
        console.log('  Path element:', pathElement.toString());
        console.log('  Is right child:', isRight);
        
        let nextHash;
        if (isRight) {
          // 当前节点是右子节点，路径元素是左兄弟节点
          nextHash = poseidonForVerification([pathElement, currentHash]);
        } else {
          // 当前节点是左子节点，路径元素是右兄弟节点
          nextHash = poseidonForVerification([currentHash, pathElement]);
        }
        
        currentHash = BigInt(poseidonForVerification.F.toString(nextHash));
        console.log('  Next hash:', currentHash.toString());
      }
      
      console.log('Final computed root:', currentHash.toString());
      console.log('Contract root:', rootBigInt.toString());
      console.log('Roots match:', currentHash.toString() === rootBigInt.toString());
      
      console.log('Circuit input prepared (BigInt format):', {
        secret: input.secret.toString(),
        amount: input.amount.toString(),
        pathElements: input.pathElements.slice(0, 3), // 只显示前3个
        pathElementsLength: input.pathElements.length, // 显示完整长度
        pathIndices: input.pathIndices.slice(0, 3), // 只显示前3个
        pathIndicesLength: input.pathIndices.length, // 显示完整长度
        merkleRoot: input.merkleRoot.toString(),
        nullifier: input.nullifier.toString(),
      });

      // 额外验证输入格式
      console.log('Input validation:');
      console.log('- secret type:', typeof input.secret, 'value:', input.secret.toString());
      console.log('- amount type:', typeof input.amount, 'value:', input.amount.toString());
      console.log('- pathElements type:', typeof input.pathElements, 'length:', input.pathElements.length);
      console.log('- pathElements[0] type:', typeof input.pathElements[0], 'value:', input.pathElements[0].toString());
      console.log('- pathIndices type:', typeof input.pathIndices, 'length:', input.pathIndices.length);
      console.log('- pathIndices[0] type:', typeof input.pathIndices[0], 'value:', input.pathIndices[0].toString());
      console.log('- merkleRoot type:', typeof input.merkleRoot, 'value:', input.merkleRoot.toString());
      console.log('- nullifier type:', typeof input.nullifier, 'value:', input.nullifier.toString());

      // 6. Generate the ZK proof
      console.log('Starting ZK proof generation...');
      
      // 添加超时机制
      const proofTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('ZK proof generation timeout after 30 seconds')), 30000)
      );
      
      const proofGeneration = groth16.fullProve(
        input,
        '/zk/withdraw.wasm',
        '/zk/withdraw.zkey'
      );
      
      const { proof, publicSignals } = await Promise.race([
        proofGeneration,
        proofTimeout
      ]);

      console.log('ZK proof generated successfully!');
      console.log('Proof structure:', {
        pi_a_length: proof.pi_a ? proof.pi_a.length : 'undefined',
        pi_b_length: proof.pi_b ? proof.pi_b.length : 'undefined', 
        pi_c_length: proof.pi_c ? proof.pi_c.length : 'undefined'
      });
      console.log('Public signals:', publicSignals);
      console.log('Public signals length:', publicSignals ? publicSignals.length : 'undefined');

      setProof(proof);
      setPublicSignals(publicSignals);
      setActiveStep(1);
    } catch (err) {
      console.error(err);
      alert(`Error generating proof: ${err.message}`);
    } finally {
      setIsProving(false);
    }
  };

  const handleWithdraw = () => {
    if (!proof || !publicSignals) {
      alert('Please generate a proof first.');
      return;
    }

    // Validate proof structure
    if (!proof.pi_a || !proof.pi_b || !proof.pi_c || 
        !Array.isArray(proof.pi_a) || proof.pi_a.length < 2 ||
        !Array.isArray(proof.pi_b) || proof.pi_b.length < 2 ||
        !Array.isArray(proof.pi_c) || proof.pi_c.length < 2) {
      alert('Invalid proof structure. Please regenerate the proof.');
      console.error('Invalid proof structure:', proof);
      return;
    }

    // Validate public signals
    if (!Array.isArray(publicSignals) || publicSignals.length < 2) {
      alert('Invalid public signals. Please regenerate the proof.');
      console.error('Invalid public signals:', publicSignals);
      return;
    }

    console.log('Public signals validation passed:');
    console.log('- Root (publicSignals[0]):', publicSignals[0]);
    console.log('- Nullifier Hash (publicSignals[1]):', publicSignals[1]);
    console.log('- Recipient (current address):', address);

    // 将BigInt公共信号转换为正确的bytes32格式
    const rootBytes32 = ethers.toBeHex(BigInt(publicSignals[0]), 32);
    const nullifierBytes32 = ethers.toBeHex(BigInt(publicSignals[1]), 32);
    
    console.log('Converted values for contract:');
    console.log('- Root (bytes32):', rootBytes32);
    console.log('- Nullifier Hash (bytes32):', nullifierBytes32);

    // Format the proof for the smart contract
    const formattedProof = {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
      c: [proof.pi_c[0], proof.pi_c[1]]
    };

    writeContract({
      address: PRIVACY_POOL_ADDRESS,
      abi: PrivacyPoolAbi,
      functionName: 'withdraw',
      args: [
        formattedProof.a,
        formattedProof.b, 
        formattedProof.c,
        rootBytes32, // 转换后的root
        nullifierBytes32, // 转换后的nullifier
        address, // recipient (current user's address)
        ethers.parseEther('0.1') // amount
      ],
      chain: chain,
      account: address,
    });
  };

  return (
    <Card sx={{ mt: 4, maxWidth: 600, mx: 'auto' }}>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Withdraw Funds
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter your private note to withdraw your deposited funds. The system will verify your ownership and generate a zero-knowledge proof.
        </Typography>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <TextField
          fullWidth
          label="Your Private Note"
          variant="outlined"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isProving || isPending || isConfirming}
          sx={{ mb: 2 }}
          helperText="Paste the complete note you saved during deposit (starts with 'private-defi-')"
        />
        <Box sx={{ position: 'relative' }}>
          {activeStep === 0 && (
            <Button variant="contained" onClick={generateProof} disabled={!note || isProving} fullWidth size="large">
              {isProving ? 'Verifying Note & Generating Proof...' : 'Verify Note & Generate Proof'}
            </Button>
          )}
          {activeStep === 1 && (
            <Button variant="contained" onClick={handleWithdraw} disabled={isPending || isConfirming} fullWidth size="large">
              {isPending ? 'Confirm in wallet...' : isConfirming ? 'Submitting Transaction...' : 'Withdraw 0.1 ETH'}
            </Button>
          )}
          {(isProving || isPending || isConfirming) && <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px' }} />}
        </Box>
        {isConfirmed && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Withdrawal successful! 
            <Link href={`${chain?.blockExplorers?.default.url}/tx/${hash}`} target="_blank" rel="noopener">
              View on Explorer
            </Link>
          </Alert>
        )}
        {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
                Error: {(error as any).shortMessage || error.message}
            </Alert>
        )}
      </CardContent>
    </Card>
  );
}