import type { IntegrationManifest, StateMetadata } from './registry';
import type { DetectionRule } from './profiles';
import { createProfile } from './profiles';

const rule = (
	capability: string,
	suffix: RegExp,
	type: 'number' | 'boolean' | 'string',
	unit?: string,
	extra: Partial<DetectionRule> = {},
): DetectionRule => ({ capability, suffix, type, unit, readOnly: true, ...extra });
const online = rule('online', /\.(?:info\.connection|hubConnected|online)$/i, 'boolean');
function profile(id: string, name: string, rules: DetectionRule[]): IntegrationManifest {
	const base = createProfile(
		id,
		name,
		[id],
		rules.map(r => ({
			...r,
			accept: (m: StateMetadata) => !/^button(?:\.|$)/i.test(m.role ?? '') && (!r.accept || r.accept(m)),
		})),
		path => path,
	);
	return {
		...base,
		readOnly: true,
		discover(objects, context) {
			return base.discover(objects, context).map(b => ({
				...b,
				capabilities: b.capabilities.map(m => ({
					...m,
					requireAck: true,
					confirmation: 'none' as const,
					maxAgeMs: id === 'openweathermap' ? 7200000 : 300000,
					...(['batteryLevel', 'humidity', 'cloudCover', 'volume'].includes(m.capability)
						? { min: 0, max: 100 }
						: {}),
				})),
			}));
		},
	};
}
/** Cache-only optional inputs. Discovery never grants writes, personal identity or household presence. */
export function contextProfiles(): IntegrationManifest[] {
	return [
		profile('mihome-vacuum', 'Mi Home vacuum status', [
			online,
			rule('batteryLevel', /\.info\.battery$/i, 'number', '%'),
			rule('vacuumState', /\.info\.state$/i, 'number', ''),
			rule('errorCode', /\.info\.error$/i, 'number', ''),
			rule('charging', /\.info\.is_charging$/i, 'boolean', ''),
			rule('cleanedArea', /\.info\.cleanedarea$/i, 'number', 'm²'),
			rule('cleanedMinutes', /\.info\.cleanedtime$/i, 'number', 'min'),
		]),
		profile('radar2', 'Selected radar device observations', [
			online,
			rule('devicePresence', /\.[^.]+\._here$/i, 'boolean', ''),
			rule('presenceLastSeen', /\.[^.]+\._lastHere$/i, 'string', ''),
		]),
		profile('solarmanpv', 'Solarman PV measurements', [
			online,
			rule('power', /\.(?:APo_t1|power|activePower)$/i, 'number', 'W'),
			rule('power', /\.(?:APo_t1|power|activePower)$/i, 'number', 'W', { sourceUnit: 'kW', scale: 1000 }),
			rule('dailyEnergy', /\.Etdy_ge\d+$/i, 'number', 'kWh'),
			rule('energy', /\.(?:Et_ge\d+|totalEnergy)$/i, 'number', 'kWh'),
			rule('temperatureSensor', /\.(?:AC_RDT_T1|temperature)$/i, 'number', '°C', { sourceUnit: '℃' }),
		]),
		profile('openweathermap', 'OpenWeatherMap current and forecast measurements', [
			online,
			rule(
				'temperatureSensor',
				/\.(?:temperature|temperatureMin|temperatureMax|temperatureFeel)$/i,
				'number',
				'°C',
			),
			rule('humidity', /\.humidity$/i, 'number', '%'),
			rule('pressure', /\.pressure$/i, 'number', 'hPa'),
			rule('windSpeed', /\.windSpeed$/i, 'number', 'm/s'),
			rule('precipitation', /\.(?:precipitation|precipitationRain|precipitationSnow)$/i, 'number', 'mm'),
			rule('cloudCover', /\.clouds$/i, 'number', '%'),
			rule('forecastAt', /\.forecast\.(?:period\d+|day\d+)\.date$/i, 'number', ''),
			rule(
				'weatherState',
				/\.(?:forecast\.(?:period\d+|day\d+)|forecast\.current|current)\.state$/i,
				'string',
				'',
			),
		]),
		profile('nina', 'NINA warning observations', [
			online,
			rule('warningCount', /\.(?:numberOfWarn|activeWarn|cancelWarn)$/i, 'number', ''),
			rule('alertSeverity', /\.severity$/i, 'number', ''),
			rule('alertText', /\.(?:headline|description|event)$/i, 'string', ''),
		]),
		profile('harmony', 'Harmony hub and activity feedback', [
			online,
			rule('hubBlocked', /\.hubBlocked$/i, 'boolean', ''),
			rule('currentActivity', /\.(?:currentActivity|current_activity|activity)$/i, 'string', '', {
				accept: m => m.read !== false && !/^button/.test(m.role ?? ''),
			}),
			rule('currentActivity', /\.(?:currentActivity|current_activity)$/i, 'number', ''),
		]),
		profile('alexa2', 'Alexa media feedback', [
			online,
			rule('mediaPlaying', /\.Player\.currentState$/i, 'boolean', ''),
			rule('mediaState', /\.Player\.currentState$/i, 'string', ''),
			rule('mediaTitle', /\.Player\.currentTitle$/i, 'string', ''),
			rule('mediaArtist', /\.Player\.currentArtist$/i, 'string', ''),
			rule('mediaAlbum', /\.Player\.currentAlbum$/i, 'string', ''),
			rule('mediaProgress', /\.Player\.mediaProgress$/i, 'number', ''),
			rule('mediaDuration', /\.Player\.mediaLength$/i, 'number', ''),
			rule('volume', /\.Player\.volume$/i, 'number', '%'),
		]),
	];
}
