# Blockchain-Based Procurement & Liquidation System

A secure, hybrid Web3 web application designed to manage institutional funding requests. This system bridges traditional role-based approvals with blockchain immutability, using smart contracts to create a transparent and tamper-proof audit trail for organizational expenditures.

## Key Features

* **Role-Based Access Control (RBAC):** Tailored dashboards and permissions for Faculty, Deans, Accounting, and Administrators.
* **Cryptographic Identity Proofs:** Faculty requests are secured using off-chain ECDSA digital signatures via MetaMask, ensuring non-repudiation without incurring gas fees for standard users.
* **Dual-Ledger Architecture:** * **Approval Ledger:** Anchors the finalized budget, multi-signature approval trail, and verification hashes to the blockchain.
  * **Liquidation Ledger:** Anchors the actual spent amount, itemized lists, and Official Receipt (OR) numbers to a secondary smart contract to create an immutable expense receipt.
* **Real-Time Verification Engine:** Built-in cryptographic scanners that cross-reference the off-chain PostgreSQL database with the Ethereum ledger to instantly detect data tampering.

## Tech Stack

* **Frontend:** Vue 3 (Composition API), Vite, Pinia (State Management)
* **Backend & Database:** Supabase (PostgreSQL, Authentication)
* **Blockchain:** Solidity, Ethers.js v6, Ethereum Sepolia Testnet
* **Development Environment:** Visual Studio Code, Node.js

## Prerequisites

Before you begin, ensure you have the following installed:
* [Node.js](https://nodejs.org/) (LTS Version)
* A modern web browser (Chrome, Edge, Brave)
* [MetaMask Browser Extension](https://metamask.io/) connected to the **Sepolia Testnet**
* Testnet ETH (Sepolia) for gas fees (Administrators/Approvers only)

## Installation & Setup

**1. Clone the repository**
```sh
git clone https://github.com/CentiiBit/procurement-system.git
cd procurement-system
```
**2. Install Dependencies**
```sh
npm install
```
**3. Configure Environment Variables**
Create a .env file in the root directory. Do not commit this file to GitHub. Add your Supabase keys and Smart Contract addresses:
```sh
# Supabase Configuration
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"

# Blockchain Configuration (Sepolia Testnet)
VITE_CONTRACT_ADDRESS="0x_Your_Approval_Contract_Address"
VITE_LIQUIDATION_CONTRACT_ADDRESS="0x_Your_Liquidation_Contract_Address"
```
**4.Run the Development Server**
```sh
npm run dev
```
## Security & Architecture Notes

* **Data Integrity:** The system uses SHA-256 hashing to normalize and verify off-chain data against on-chain transaction hashes.

* **Separation of Concerns:** The approval phase and liquidation phase execute on two completely isolated smart contracts to maintain clean, scalable data structures and prevent database overwrites.

* **Gas Optimization:** End-users (Faculty) utilize off-chain cryptographic signing, shifting the gas costs of on-chain anchoring entirely to the administrative/accounting levels.

# Author
**Mark Vincent F. Villegas**
* GitHub: [@CentiiBit](https://github.com/CentiiBit)
