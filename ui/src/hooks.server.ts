export const handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/appspecific/com.chrome.devtools.json') {
		return new Response('{}', {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return resolve(event);
};