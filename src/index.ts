import { Pool, PoolClient } from 'pg'

export async function tx<T>(
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
