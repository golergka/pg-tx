# pg-tx - Transactions for node-postgres

[![npm version](https://badge.fury.io/js/pg-tx.svg)](https://badge.fury.io/js/pg-tx)

This package implements transactions on top of [node-postgres](http://node-postgres.com), based on [this answer](https://stackoverflow.com/a/65588782/312725), but improved to remove a class of subtle bugs.

## Usage

```Typescript
import tx from `pg-tx`

const pg = new Pool()

await tx(pg, async (db) => {
  await db.query(`UPDATE accounts SET money = money - 50 WHERE name = 'bob'`)
  await db.query(`UPDATE accounts SET money = money + 50 WHERE name = 'alice'`)
})

await tx(pg, async (db) => {
  await db.query(`UPDATE accounts SET money = money - 50 WHERE name = 'bob'`)
  await db.query(`UPDATE accounts SET money = money + 50 WHERE name = 'debbie'`)

  // Any errors thrown inside the callback will terminate the transaction
  throw new Error(`screw Debbie`)
})

// You can also use it with other packages that use Pool or PoolClient, like pgtyped
import { sql } from '@pgtyped/query'

const updateAccount = sql<IUpdateAccountQuery>`
  UPDATE accounts
  SET money = momey + $delta
  WHERE name = $name
`

await tx(pg, async(db) => {
  await udpateAccount.run({ name: 'bob', delta: -50 })
  await udpateAccount.run({ name: 'charlie', delta: 50 })
})

```

## Why use this package

Naive approach to pg transactions, featured in [this answer](https://stackoverflow.com/a/65588782/312725) and used in many projects looks like this:

```Typescript
// DO NOT USE THIS CODE
export default async function tx<T>(
	pg: Pool,
	callback: (db: PoolClient) => Promise<T>
): Promise<T> {
	const client = await pg.connect()
	await client.query(`BEGIN`)

	try {
		const result = await callback(client)
		await client.query(`COMMIT`)
		return result
	} catch (e) {
		await client.query(`ROLLBACK`)
		throw e
	} finally {
		client.release()
	}
}
```

However, this approach contains a subtle bug, because the `client` it passes to the callback stays valid after transaction finishes (successfully or not), and can be unknowingly used. In essence, it's a variation of use-after-free bug, but with database clients instead of memory.

Here's a demonstration of code that can trigger this condition:

```Typescript
async function failsQuickly(db: PoolClient) {
  await db.query(`This query has an error`)
}

async function executesSlowly(db: PoolClient) {
  // Takes a couple of seconds to complete
  await externalApiCall()
  // This operation will be executed OUTSIDE of transaction block!
  await db.query(`
    UPDATE external_api_calls 
    SET amount = amount + 1 
    WHERE service = 'some_service'
  `)
}

await tx(pg, async (db) => {
  await Promise.all([
    failsQuickly(db),
    executesSlowly(db)
  ])
})
```

To prevent this, we use ProxyClient, which implements a disposable pattern. After the client has been released, any attempts to use it will throw an error.
