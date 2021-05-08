import { Pool, PoolClient } from 'pg'
import { ProxyClient } from './proxy_client'

/**
 * @param pg node postgres pool
 * @param callback callback that will use provided transaction client
 * @param forceRollback force rollback even without errors - useful for tests
 * @returns
 */
export default async function tx<T>(
	pg: Pool|PoolClient,
	callback: (db: PoolClient) => Promise<T>,
	forceRollback?: boolean
): Promise<T> {
	let connected
	let client: PoolClient  
	if (pg instanceof Pool) {
		client = await pg.connect()
		connected = true
	} else {
		client = pg
		connected = false
	}
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
		if (connected) {
			client.release()
		}
	}
}
