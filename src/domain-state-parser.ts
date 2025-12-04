// Parser for show-database.txt files from diagnose packages

export type DomainProcess = {
	type: 'TE' | 'SM';
	address: string;
	port: number;
	startId: number;
	serverId: string;
	pid: number;
	nodeId: number;
	lastAck: number;
	status: string;
};

export type DomainServer = {
	serverId: string;
	address: string;
	port: number;
	lastAck: number;
	status: string;
	role: string;
	leader?: string;
	log?: string;
};

export type DomainDatabase = {
	name: string;
	state: string;
	processes: DomainProcess[];
};

export type DomainState = {
	serverVersion: string;
	serverLicense: string;
	serverTime: string;
	clientToken: string;
	servers: DomainServer[];
	databases: DomainDatabase[];
	raw: string;
};

/**
 * Parse a show-database.txt file into structured data
 */
export function parseShowDatabase(text: string): DomainState {
	const lines = text.split('\n').map(l => l.trim()).filter(l => l);
	
	const state: DomainState = {
		serverVersion: '',
		serverLicense: '',
		serverTime: '',
		clientToken: '',
		servers: [],
		databases: [],
		raw: text,
	};

	let section: 'header' | 'servers' | 'databases' = 'header';
	let currentDatabase: DomainDatabase | null = null;

	for (const line of lines) {
		// Parse header information
		if (line.startsWith('server version:')) {
			const match = line.match(/server version:\s*([^,]+),\s*server license:\s*(.+)/);
			if (match) {
				state.serverVersion = match[1]?.trim() || '';
				state.serverLicense = match[2]?.trim() || '';
			}
		} else if (line.startsWith('server time:')) {
			const match = line.match(/server time:\s*([^,]+),\s*client token:\s*(.+)/);
			if (match) {
				state.serverTime = match[1]?.trim() || '';
				state.clientToken = match[2]?.trim() || '';
			}
		}
		// Section headers
		else if (line === 'Servers:') {
			section = 'servers';
		} else if (line === 'Databases:') {
			section = 'databases';
		}
		// Parse servers
		else if (section === 'servers' && line.startsWith('[')) {
			// Example: [nuodb_admin_0] nuodb_admin_0:48005 [last_ack = 4.91] ACTIVE (FOLLOWER, Leader=nuodb_sm_0, log=131/1068/1068) Connected
			const serverMatch = line.match(/\[([^\]]+)\]\s+([^:\s]+):(\d+)\s+\[last_ack\s*=\s*([\d.]+)\]\s+(\w+)\s+\(([^)]+)\)\s*(\w+)?/);
			if (serverMatch) {
				const serverId = serverMatch[1] || '';
				const address = serverMatch[2] || '';
				const port = parseInt(serverMatch[3] || '0');
				const lastAck = parseFloat(serverMatch[4] || '0');
				const status = serverMatch[5] || '';
				const roleInfo = serverMatch[6] || '';
				const connected = serverMatch[7] || '';

				// Parse role info: "FOLLOWER, Leader=nuodb_sm_0, log=131/1068/1068" or "LEADER, Leader=nuodb_sm_0, log=131/1068/1068"
				const roleMatch = roleInfo.match(/(\w+)(?:,\s*Leader=([^,]+))?(?:,\s*log=([^,]+))?/);
				const role = roleMatch?.[1] || '';
				const leader = roleMatch?.[2];
				const log = roleMatch?.[3];

				state.servers.push({
					serverId,
					address,
					port,
					lastAck,
					status: connected ? `${status} ${connected}` : status,
					role,
					leader,
					log,
				});
			}
		}
		// Parse databases
		else if (section === 'databases') {
			// Database name line: "  conv [state = AWAITING_ARCHIVE_HISTORIES_INC]"
			const dbMatch = line.match(/^([a-zA-Z0-9_-]+)\s+\[state\s*=\s*([^\]]+)\]/);
			if (dbMatch) {
				// Save previous database
				if (currentDatabase) {
					state.databases.push(currentDatabase);
				}
				// Start new database
				currentDatabase = {
					name: dbMatch[1] || '',
					state: dbMatch[2] || '',
					processes: [],
				};
			}
			// Process lines: "[TE] ip-10-0-152-139.eu-west-2.compute.internal/nuodb_te_0:48006 [start_id = 39] ..."
			else if (currentDatabase && (line.startsWith('[TE]') || line.startsWith('[SM]'))) {
				const processMatch = line.match(/\[(TE|SM)\]\s+([^\/]+)\/([^:]+):(\d+)\s+\[start_id\s*=\s*(\d+)\]\s+\[server_id\s*=\s*([^\]]+)\]\s+\[pid\s*=\s*(\d+)\]\s+\[node_id\s*=\s*(\d+)\]\s+\[last_ack\s*=\s*([\d.]+)\]\s+([^:]+)/);
				if (processMatch) {
					currentDatabase.processes.push({
						type: processMatch[1] as 'TE' | 'SM',
						address: processMatch[2] || '',
						port: parseInt(processMatch[4] || '0'),
						startId: parseInt(processMatch[5] || '0'),
						serverId: processMatch[6] || '',
						pid: parseInt(processMatch[7] || '0'),
						nodeId: parseInt(processMatch[8] || '0'),
						lastAck: parseFloat(processMatch[9] || '0'),
						status: processMatch[10] || '',
					});
				}
			}
		}
	}

	// Save last database
	if (currentDatabase) {
		state.databases.push(currentDatabase);
	}

	return state;
}
