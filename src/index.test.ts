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

	it(`doesn't commit changes on next tick after query error `, async () => {
		let secondPromise
		await expect(
			tx(pg, async (db) => {
				const errorQuery = db.query(`this query has an error`)
				secondPromise = Promise.allSettled([errorQuery]).then(async () => {
					await new Promise((resolve) => setImmediate(resolve))
					await pg.query(`INSERT INTO things(thing) VALUES ('query_error_tick')`)
				})

				await Promise.all([errorQuery, secondPromise])
			})
		).rejects.toThrowErrorMatchingInlineSnapshot(
			`"syntax error at or near \\"this\\""`
		)

		await expect(secondPromise).rejects.toThrowErrorMatchingInlineSnapshot()

		const { rowCount } = await pg.query(
			`SELECT id, thing FROM things WHERE thing = 'query_error_tick'`
		)
		expect(rowCount).toBe(0)
	})
})
