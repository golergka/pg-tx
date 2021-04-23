import { Pool } from 'pg'
import tx from '.'

describe(`tx`, () => {
	let pg: Pool

	beforeAll(async () => {
		const { POSTGRES_URL } = process.env

		if (!POSTGRES_URL) {
			throw new Error('Must specify POSTGRES_URL')
		}

		pg = new Pool({ connectionString: POSTGRES_URL })

		await pg.query(`CREATE TABLE things (
      id SERIAL PRIMARY KEY,
      thing TEXT NOT NULL
    )`)
	})
	afterAll(async () => {
		await pg.query(`DROP TABLE THINGS`)
		await pg.end()
	})

	it(`commits changes when there's no error`, async () => {
		await tx(pg, async (db) => {
			db.query(`INSERT INTO things (thing) VALUES ('comitted')`)
		})

		const {
			rows: [committed]
		} = await pg.query(`SELECT id, thing FROM things WHERE thing = 'comitted'`)
		expect(committed).toBeDefined()
		expect(committed.thing).toEqual('comitted')
	})

	it(`doesn't commit changes with forcedRollback`, async () => {
		await tx(pg, async (db) => {
			db.query(`INSERT INTO things (thing) VALUES ('comitted')`)
		})

		const { rowCount } = await pg.query(
			`SELECT id, thing FROM things WHERE thing = 'node_error'`
		)
		expect(rowCount).toBe(0)
	})

	it(`doesn't commit changes when there's a Node exception`, async () => {
		await expect(
			tx(pg, async (db) => {
				await db.query(`INSERT INTO things (thing) VALUES ('node_error')`)
				throw new Error(`node error`)
			})
		).rejects.toThrowError(`node error`)

		const { rowCount } = await pg.query(
			`SELECT id, thing FROM things WHERE thing = 'node_error'`
		)
		expect(rowCount).toBe(0)
	})

	it(`doesn't commit changes when there's a query error`, async () => {
		await expect(
			tx(pg, async (db) => {
				await db.query(`INSERT INTO things(thing) VALUES ('query_error')`)
				await db.query(`this query has an error`)
			})
		).rejects.toThrowErrorMatchingInlineSnapshot(
			`"syntax error at or near \\"this\\""`
		)

		const { rowCount } = await pg.query(
			`SELECT id, thing FROM things WHERE thing = 'query_error'`
		)
		expect(rowCount).toBe(0)
	})

	it(`doesn't commit changes on next tick after query error`, async () => {
		let laterPromise
		const txPromise = tx(pg, async (db) => {
			laterPromise = (async () => {
				try {
					await txPromise
				} catch (e) {
					// ignore error, we just needed to wait until it completed
				}
				await new Promise((resolve) => {
					setImmediate(resolve)
				})
				await db.query(`INSERT INTO things(thing) VALUES ('query_error_tick')`)
			})()
			await Promise.all([db.query(`this query has an error`), laterPromise])
		})

		await expect(txPromise).rejects.toThrowErrorMatchingInlineSnapshot(
			`"syntax error at or near \\"this\\""`
		)

		await expect(laterPromise).rejects.toThrowErrorMatchingInlineSnapshot(
			`"client already released"`
		)

		const { rowCount } = await pg.query(
			`SELECT id, thing FROM things WHERE thing = 'query_error_tick'`
		)
		expect(rowCount).toBe(0)
	})
})
