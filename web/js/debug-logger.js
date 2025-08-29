(function () {
	const enabled = () => localStorage.getItem('debug') === '1';

	function log(...args) {
		if (!enabled()) return;
		console.log('[DEBUG]', ...args);
	}

	function warn(...args) {
		if (!enabled()) return;
		console.warn('[DEBUG]', ...args);
	}

	function error(...args) {
		if (!enabled()) return;
		console.error('[DEBUG]', ...args);
	}

	// Global error handlers
	window.addEventListener('error', (e) => {
		error('GlobalError:', {
			message: e.message,
			filename: e.filename,
			lineno: e.lineno,
			colno: e.colno,
			error: e.error
		});
	});

	window.addEventListener('unhandledrejection', (e) => {
		error('UnhandledRejection:', e.reason);
	});

	// Wrap fetch to log requests
	const _fetch = window.fetch;
	window.fetch = async function (input, init = {}) {
		const start = performance.now();
		try {
			const res = await _fetch(input, init);
			const dur = Math.round(performance.now() - start);
			log('fetch', {
				url: typeof input === 'string' ? input : input?.url,
				method: init?.method || 'GET',
				status: res.status,
				ok: res.ok,
				ms: dur
			});
			return res;
		} catch (err) {
			const dur = Math.round(performance.now() - start);
			error('fetch failed', {
				url: typeof input === 'string' ? input : input?.url,
				method: init?.method || 'GET',
				ms: dur,
				err
			});
			throw err;
		}
	};

	// Public toggles
	Object.defineProperty(window, 'enableDebugLogging', { value: () => localStorage.setItem('debug', '1') });
	Object.defineProperty(window, 'disableDebugLogging', { value: () => localStorage.removeItem('debug') });

	log('Debug logger active. Use disableDebugLogging() to turn off.');
})();



