import { readFileSync } from 'node:fs'
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-gota-dhaaga',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

describe('phase 1 lockdown rules', () => {
  it('denies anonymous reads and writes', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'shops/s1')))
    await assertFails(setDoc(doc(db, 'shops/s1'), { name: 'x' }))
  })

  it('denies signed-in users too until phase 2 rules land', async () => {
    const db = testEnv.authenticatedContext('sumitra').firestore()
    await assertFails(getDoc(doc(db, 'shops/s1/customers/c1')))
  })
})
