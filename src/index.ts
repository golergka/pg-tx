import { Pool, PoolClient } from 'pg'
import { getClient, releaseClient } from './client'
import { ProxyClient } from './proxy_client'
import {
	beginTransaction,
	commitTransaction,
	cancelTransaction
} from './transaction'

/**
 * @param pg node postgres pool
 * @param callback callback that will use provided transaction client
 * @param forceRollback force rollback even without errors - useful for tests
 * @returns
 */
export default async function tx<T>(
	pg: Pool | PoolClient,
	callback: (db: PoolClient) => Promise<T>,
	forceRollback?: boolean
): Promise<T> {
	const { client, clientMode } = await getClient(pg)
	const transactionMode = await beginTransaction({ client, clientMode })

	try {
		let result: T
		const proxyClient = new ProxyClient(client)
		try {
			result = await callback(proxyClient)
		} catch (e) {
			await cancelTransaction({ client, transactionMode })
			throw e
		} finally {
			proxyClient.proxyRelease()
		}

		if (forceRollback) {
			await cancelTransaction({ client, transactionMode })
		} else {
			await commitTransaction({ client, transactionMode })
		}

		return result
	} finally {
		releaseClient({ client, clientMode })
	}
}
