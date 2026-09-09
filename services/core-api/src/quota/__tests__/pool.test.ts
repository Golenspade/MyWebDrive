import { describe, expect, test } from 'vitest'

import { planPoolAllocation, ROLE_WEIGHTS } from '../pool.js'

describe('planPoolAllocation', () => {
  test('uses weights 1/3/8 and conserves leftover bytes with Hamilton remainders', () => {
    const plan = planPoolAllocation(
      [
        {
          userId: 'u1',
          role: 'user',
          status: 'active',
          committedBytes: 10n,
          reservedBytes: 0n,
          limitBytes: 100n,
        },
        {
          userId: 's1',
          role: 'superuser',
          status: 'active',
          committedBytes: 0n,
          reservedBytes: 20n,
          limitBytes: 100n,
        },
        {
          userId: 'a1',
          role: 'admin',
          status: 'active',
          committedBytes: 0n,
          reservedBytes: 0n,
          limitBytes: 100n,
        },
      ],
      130n,
      10n,
    )

    expect(ROLE_WEIGHTS).toEqual({ user: 1n, superuser: 3n, admin: 8n })
    expect(plan.overcommitted).toBe(false)
    expect(plan.allocableBytes).toBe(90n)
    expect(plan.allocations.map((row) => ({
      userId: row.userId,
      occupiedBytes: row.occupiedBytes,
      limitBytes: row.limitBytes,
    }))).toEqual([
      { userId: 'u1', occupiedBytes: 10n, limitBytes: 17n },
      { userId: 's1', occupiedBytes: 20n, limitBytes: 43n },
      { userId: 'a1', occupiedBytes: 0n, limitBytes: 60n },
    ])
    expect(
      plan.allocations.reduce((sum, row) => sum + (row.limitBytes - row.occupiedBytes), 0n),
    ).toBe(90n)
  })

  test('subtracts reserved bytes from the allocable pool', () => {
    const plan = planPoolAllocation(
      [
        {
          userId: 'u1',
          role: 'user',
          status: 'active',
          committedBytes: 40n,
          reservedBytes: 10n,
          limitBytes: 80n,
        },
      ],
      100n,
      0n,
    )

    expect(plan.allocableBytes).toBe(50n)
    expect(plan.allocations[0]).toMatchObject({
      occupiedBytes: 50n,
      limitBytes: 100n,
    })
  })

  test('pins active limits to occupied when the pool is overcommitted', () => {
    const plan = planPoolAllocation(
      [
        {
          userId: 'u1',
          role: 'user',
          status: 'active',
          committedBytes: 80n,
          reservedBytes: 20n,
          limitBytes: 200n,
        },
        {
          userId: 'u2',
          role: 'admin',
          status: 'active',
          committedBytes: 10n,
          reservedBytes: 0n,
          limitBytes: 200n,
        },
      ],
      50n,
      0n,
    )

    expect(plan.overcommitted).toBe(true)
    expect(plan.allocableBytes).toBe(-60n)
    expect(plan.allocations).toEqual([
      {
        userId: 'u1',
        previousLimitBytes: 200n,
        occupiedBytes: 100n,
        limitBytes: 100n,
      },
      {
        userId: 'u2',
        previousLimitBytes: 200n,
        occupiedBytes: 10n,
        limitBytes: 10n,
      },
    ])
  })

  test('leaves inactive accounts unchanged and still subtracts their occupied bytes', () => {
    const plan = planPoolAllocation(
      [
        {
          userId: 'dead',
          role: 'user',
          status: 'disabled',
          committedBytes: 30n,
          reservedBytes: 0n,
          limitBytes: 90n,
        },
        {
          userId: 'live',
          role: 'user',
          status: 'active',
          committedBytes: 0n,
          reservedBytes: 0n,
          limitBytes: 90n,
        },
      ],
      100n,
      0n,
    )

    expect(plan.allocableBytes).toBe(70n)
    expect(plan.allocations).toEqual([
      {
        userId: 'live',
        previousLimitBytes: 90n,
        occupiedBytes: 0n,
        limitBytes: 70n,
      },
    ])
  })
})
