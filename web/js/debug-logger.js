(function () {
	const enabled = () => localStorage.getItem('debug') === '1';

	// Mask console methods unless explicitly enabled
	const originalConsole = {
		log: console.log,
		debug: console.debug,
		info: console.info,
		warn: console.warn,
		error: console.error
	};

	const noop = () => {};
	function applyConsoleMask() {
		if (enabled()) {
			console.log = originalConsole.log.bind(console);
			console.debug = originalConsole.debug.bind(console);
			console.info = originalConsole.info.bind(console);
			console.warn = originalConsole.warn.bind(console);
			console.error = originalConsole.error.bind(console);
		} else {
			console.log = noop;
			console.debug = noop;
			console.info = noop;
			console.warn = noop;
			// Keep error visible by default in the browser
			console.error = originalConsole.error.bind(console);
		}
	}

	applyConsoleMask();

	// Global error handlers
	window.addEventListener('error', (e) => {
		console.error('[DEBUG]', 'GlobalError:', {
			message: e.message,
			filename: e.filename,
			lineno: e.lineno,
			colno: e.colno,
			error: e.error
		});
	});

	window.addEventListener('unhandledrejection', (e) => {
		console.error('[DEBUG]', 'UnhandledRejection:', e.reason);
	});

	// Wrap fetch to log requests
	const _fetch = window.fetch;
	window.fetch = async function (input, init = {}) {
		const start = performance.now();
		try {
			const res = await _fetch(input, init);
			const dur = Math.round(performance.now() - start);
			console.log('[DEBUG]', 'fetch', {
				url: typeof input === 'string' ? input : input?.url,
				method: init?.method || 'GET',
				status: res.status,
				ok: res.ok,
				ms: dur
			});
			return res;
		} catch (err) {
			const dur = Math.round(performance.now() - start);
			console.error('[DEBUG]', 'fetch failed', {
				url: typeof input === 'string' ? input : input?.url,
				method: init?.method || 'GET',
				ms: dur,
				err
			});
			throw err;
		}
	};

	// Public toggles
	Object.defineProperty(window, 'enableDebugLogging', { value: () => { localStorage.setItem('debug', '1'); applyConsoleMask(); } });
	Object.defineProperty(window, 'disableDebugLogging', { value: () => { localStorage.removeItem('debug'); applyConsoleMask(); } });

	console.log('[DEBUG]', 'Debug logger active. Use disableDebugLogging() to turn off.');
})();



