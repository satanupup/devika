import * as universal from '../entries/pages/_layout.js';

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/+layout.js";
export const imports = ["_app/immutable/nodes/0.Q8eSoqFM.js","_app/immutable/chunks/scheduler.bGE2cUeY.js","_app/immutable/chunks/index.kEmxZ03U.js","_app/immutable/chunks/each.BQ4xmkpy.js","_app/immutable/chunks/stores.BAYBFcWu.js","_app/immutable/chunks/entry.BIL_Uj07.js","_app/immutable/chunks/index.B_CZ4j-t.js","_app/immutable/chunks/Toaster.svelte_svelte_type_style_lang.EMaQRHGs.js","_app/immutable/chunks/mode.DHKxe2hb.js"];
export const stylesheets = ["_app/immutable/assets/0.Bi15mpB-.css","_app/immutable/assets/Toaster.CDv3jphE.css"];
export const fonts = [];
