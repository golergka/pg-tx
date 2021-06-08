import { PoolClient, Pool } from 'pg'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isPoolClient(p: any): p is PoolClient {
	return typeof p['release'] === 'function'
}

/** Whether we got a ready client, or connected it ourselves */
export enum ClientMode {
	Provided,
	Connected
}

export interface ClientDetails {
	client: PoolClient
	clientMode: ClientMode
}

export async function getClient(pg: Pool | PoolClient): Promise<ClientDetails> {
	if (isPoolClient(pg)) {
		return { client: pg, clientMode: ClientMode.Provided }
	} else {
		return {
			client: await pg.connect(),
			clientMode: ClientMode.Connected
		}
	}
}

export function releaseClient({ client, clientMode }: ClientDetails): void {
	if (clientMode === ClientMode.Connected) {
		client.release()
	}
}
