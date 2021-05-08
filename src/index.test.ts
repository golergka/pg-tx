import { Pool, PoolClient } from 'pg'
import tx from '.'

describe(`tx`, () => {
	describe('with Pool client', () => {
		let pg: Pool

		beforeEach(async () => {
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
		afterEach(async () => {
			await pg.query(`DROP TABLE THINGS`)
			await pg.end()
		})

		it(`commits changes when there's no error`, async () => {
			await tx(pg, async (db) => {
				db.query(`INSERT INTO things (thing) VALUES ('committed')`)
			})

			const {
				rows: [committed]
			} = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'committed'`
			)
			expect(committed).toBeDefined()
			expect(committed.thing).toEqual('committed')
		})

		it(`doesn't commit changes with forcedRollback`, async () => {
			await tx(
				pg,
				async (db) => {
					await db.query(`INSERT INTO things (thing) VALUES ('committed')`)
				},
				true
			)

			const { rowCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'committed'`
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
					await db.query(
						`INSERT INTO things(thing) VALUES ('query_error_tick')`
					)
				})()
				await Promise.all([db.query(`this query has an error`), laterPromise])
			})

			await expect(txPromise).rejects.toThrowErrorMatchingInlineSnapshot(
				`"syntax error at or near \\"this\\""`
			)

			await expect(laterPromise).rejects.toThrowErrorMatchingInlineSnapshot(
				`"Transaction client already released, see more: https://tinyurl.com/py2upfcw"`
			)

			const { rowCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'query_error_tick'`
			)
			expect(rowCount).toBe(0)
		})

		it(`handles nested transactions`, async () => {
			await tx(pg, async (rootDb) => {
				await tx(rootDb, async (comittedDb) => {
					await comittedDb.query(
						`INSERT INTO things (thing) VALUES ('committed')`
					)
				})
				await expect(
					tx(rootDb, async (rolledbackDb) => {
						await rolledbackDb.query(
							`INSERT INTO things (thing) VALUES ('rolledback')`
						)
						throw new Error(`rollback this block`)
					})
				).rejects.toThrowError(`rollback this block`)
			})
			const { rowCount: comittedCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'committed'`
			)
			expect(comittedCount).toBe(1)
			const { rowCount: rolledbackCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'rolledback'`
			)
			expect(rolledbackCount).toBe(0)
		})
	})

	describe('with PoolClient client', () => {
		let pool: Pool
		let pg: PoolClient

		beforeEach(async () => {
			const { POSTGRES_URL } = process.env

			if (!POSTGRES_URL) {
				throw new Error('Must specify POSTGRES_URL')
			}

			pool = new Pool({ connectionString: POSTGRES_URL })
			pg = await pool.connect()

			await pg.query(`CREATE TABLE things (
				id SERIAL PRIMARY KEY,
				thing TEXT NOT NULL
			)`)
		})
		afterEach(async () => {
			await pg.query(`DROP TABLE THINGS`)
			await pg.release()
			await pool.end()
		})

		it(`commits changes when there's no error`, async () => {
			await tx(pg, async (db) => {
				await db.query(`INSERT INTO things (thing) VALUES ('committed')`)
			})

			const {
				rows: [committed]
			} = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'committed'`
			)
			expect(committed).toBeDefined()
			expect(committed.thing).toEqual('committed')
		})

		it(`doesn't commit changes with forcedRollback`, async () => {
			await tx(
				pg,
				async (db) => {
					db.query(`INSERT INTO things (thing) VALUES ('committed')`)
				},
				true
			)

			const { rowCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'committed'`
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
					await db.query(
						`INSERT INTO things(thing) VALUES ('query_error_tick')`
					)
				})()
				await Promise.all([db.query(`this query has an error`), laterPromise])
			})

			await expect(txPromise).rejects.toThrowErrorMatchingInlineSnapshot(
				`"syntax error at or near \\"this\\""`
			)

			await expect(laterPromise).rejects.toThrowErrorMatchingInlineSnapshot(
				`"Transaction client already released, see more: https://tinyurl.com/py2upfcw"`
			)

			const { rowCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'query_error_tick'`
			)
			expect(rowCount).toBe(0)
		})

		it(`doesnt't start a transaction if client is already in a transaction`, async () => {
			await pg.query(`BEGIN`)
			await tx(pg, async (db) => {
				await db.query(`INSERT INTO things (thing) VALUES ('committed')`)
			})
			const { rowCount: beforeRollbackCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'committed'`
			)
			expect(beforeRollbackCount).toBe(1)
			await pg.query(`ROLLBACK`)
			const { rowCount: afterRollbackCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'committed'`
			)
			expect(afterRollbackCount).toBe(0)
		})

		it(`handles nested transactions`, async () => {
			await tx(pg, async (rootDb) => {
				await tx(rootDb, async (comittedDb) => {
					await comittedDb.query(
						`INSERT INTO things (thing) VALUES ('committed')`
					)
				})
				await expect(
					tx(rootDb, async (rolledbackDb) => {
						await rolledbackDb.query(
							`INSERT INTO things (thing) VALUES ('rolledback')`
						)
						throw new Error(`rollback this block`)
					})
				).rejects.toThrowError(`rollback this block`)
			})
			const { rowCount: comittedCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'committed'`
			)
			expect(comittedCount).toBe(1)
			const { rowCount: rolledbackCount } = await pg.query(
				`SELECT id, thing FROM things WHERE thing = 'rolledback'`
			)
			expect(rolledbackCount).toBe(0)
		})
	})
})
