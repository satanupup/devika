export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["appspecific/com.chrome.devtools.json","assets/bootup.mp3","assets/devika-avatar.png","assets/devika-avatar.svg","assets/loading-lottie.json","assets/user-avatar.png","assets/user-avatar.svg","favicon.png"]),
	mimeTypes: {".json":"application/json",".mp3":"audio/mpeg",".png":"image/png",".svg":"image/svg+xml"},
	_: {
		client: {"start":"_app/immutable/entry/start.B6ydCSOu.js","app":"_app/immutable/entry/app.uw7IaqHJ.js","imports":["_app/immutable/entry/start.B6ydCSOu.js","_app/immutable/chunks/entry.BIL_Uj07.js","_app/immutable/chunks/scheduler.bGE2cUeY.js","_app/immutable/chunks/index.B_CZ4j-t.js","_app/immutable/entry/app.uw7IaqHJ.js","_app/immutable/chunks/preload-helper.Dch09mLN.js","_app/immutable/chunks/scheduler.bGE2cUeY.js","_app/immutable/chunks/index.kEmxZ03U.js"],"stylesheets":[],"fonts":[],"uses_env_dynamic_public":false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/logs",
				pattern: /^\/logs\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/settings",
				pattern: /^\/settings\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			}
		],
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
