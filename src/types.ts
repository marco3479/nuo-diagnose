// Type definitions for NuoAdmin log parsing and analysis

export type StartOcc = {
	process: string;
	sid: number;
	ts: number;
	iso: string;
	raw: string;
	type?: string;
	address?: string;
	isStart?: boolean;
};

export type DbStateEvent = {
	dbName: string;
	ts: number;
	iso: string;
	state: string;
	message: string;
	raw: string;
};

export type FailureProtocolEvent = {
	dbName: string;
	sid: number;
	node: number;
	iteration: number;
	ts: number;
	iso: string;
	message: string;
	raw: string;
};

export type DbDiff = {
	from: Record<string, any>;
	to: Record<string, any>;
};

export type LogEvent = {
	ts: number;
	iso: string;
	process: string;
	message: string;
	raw: string;
	fileSource?: string;
	sid?: number | null;
	dbDiff?: DbDiff;
};

export type Instance = {
	process: string;
	sid: number;
	start: number;
	end: number;
	firstIso?: string;
	lastIso?: string;
	type?: string;
	address?: string;
};

export type DbStateSegment = {
	state: string;
	start: number;
	end: number;
	iso: string;
	message: string;
};

export type ServerTimeRange = {
	server: string;
	start: number;
	end: number;
	startIso: string;
	endIso: string;
};

export type ParsedLogResult = {
	events: LogEvent[];
	byProcess: Record<string, LogEvent[]>;
	instances: Instance[];
	dbStates: Record<string, DbStateSegment[]>;
	failureProtocols: FailureProtocolEvent[];
	range: { start: number | null; end: number | null };
	server?: string;
	multiFile?: boolean;
};
