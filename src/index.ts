import { Pool, PoolClient } from 'pg'
import { ProxyClient } from './proxy_client'

export default async function tx<T>(
	pg: Pool,
	callback: (db: PoolClient) => Promise<T>
): Promise<T> {
	const proxyClient = new ProxyClient(await pg.connect())
	await proxyClient.query(`BEGIN`)

	try {
		const result = await callback(proxyClient)
		await proxyClient.query(`COMMIT`)
		return result
	} catch (e) {
		await proxyClient.query(`ROLLBACK`)
		throw e
	} finally {
		proxyClient.release()
	}
}
