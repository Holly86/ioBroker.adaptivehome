// ioBroker eslint template configuration file for js and ts files
// Please note that esm or react based modules need additional modules loaded.
import config from '@iobroker/eslint-config';
import globals from 'globals';

export default [
	...config,
	{
		// specify files to exclude from linting here
		ignores: [
			'.local/**',
			'.dev-server/',
			'.vscode/',
			'*.test.js',
			'test/**/*.js',
			'*.config.mjs',
			'build',
			'dist',
			'admin/words.js',
			'admin/admin.d.ts',
			'admin/blockly.js',
			'**/adapter-config.d.ts',
			'widgets/**/*.js'
		],
	},
	{
		// you may disable some 'jsdoc' warnings - but using jsdoc is highly recommended
		// as this improves maintainability. jsdoc warnings will not block build process.
		rules: {
			'jsdoc/require-jsdoc':'off',
			'jsdoc/require-param':'off',
			'jsdoc/require-returns-description':'off',
			// 'jsdoc/require-jsdoc': 'off',
			// 'jsdoc/require-param': 'off',
			// 'jsdoc/require-param-description': 'off',
			// 'jsdoc/require-returns-description': 'off',
			// 'jsdoc/require-returns-check': 'off',
		},
	},
	{files:['src/**/*.test.ts'],rules:{'@typescript-eslint/require-await':'off','@typescript-eslint/explicit-function-return-type':'off','@typescript-eslint/no-use-before-define':'off'}},
	{files:['admin/adaptivehome.js'],languageOptions:{globals:{...globals.browser,io:'readonly'}}},
	{files:['scripts/**/*.cjs','examples/**/*.cjs','test/**/*.cjs'],languageOptions:{globals:globals.node}},
	{files:['test/**/*.cjs'],languageOptions:{globals:globals.mocha}},
	{files:['test/browser-controller.cjs'],languageOptions:{globals:globals.browser}},
];
