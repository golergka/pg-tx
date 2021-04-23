import { Pool, PoolClient } from 'pg'
import { ProxyClient } from './proxy_client'

/**
 * @param pg node postgres pool
 * @param callback callback that will use provided transaction client
 * @param forceRollback force rollback even without errors - useful for integration tests
 * @returns
 */
export default async function tx<T>(
	pg: Pool,
	callback: (db: PoolClient) => Promise<T>,
	forceRollback?: boolean
): Promise<T> {
	const client = await pg.connect()
	const proxyClient = new ProxyClient(client)
	await proxyClient.query(`BEGIN`)

	try {
		const result = await callback(proxyClient)
		proxyClient.proxyRelease()
		await client.query(forceRollback ? `ROLLBACK` : `COMMIT`)
		return result
	} catch (e) {
		proxyClient.proxyRelease()
		await client.query(`ROLLBACK`)
		throw e
	} finally {
		client.release()
	}
}
