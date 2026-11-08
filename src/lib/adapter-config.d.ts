// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			integrationProfiles?: unknown[];
			controlClients?: unknown[];
			controlSecret?: string;
			modelProvider?: unknown;
			modelToken?: string;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
