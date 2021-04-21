import { Pool, PoolClient } from 'pg'
import { ProxyClient } from './proxy_client'

export default async function tx<T>(
	pg: Pool,
	callback: (db: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pg.connect()
	const proxyClient = new ProxyClient(client)
	await proxyClient.query(`BEGIN`)

	try {
		const result = await callback(proxyClient)
    proxyClient.proxyRelease()
		await client.query(`COMMIT`)
		return result
	} catch (e) {
    proxyClient.proxyRelease()
		await client.query(`ROLLBACK`)
		throw e
	} finally {
		client.release()
	}
}
