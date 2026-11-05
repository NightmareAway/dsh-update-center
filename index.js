/**
 * dsh-update-center — Host half.
 *
 * Deliberately inert. The Client half owns both the check and the write,
 * because it can reach the official `pluginManager` generated Remote
 * (`/api/pluginManager/*`) that the profile's Plugins page already drives.
 * Mounting a second HTTP face on the Host would duplicate that channel and
 * would need a Host restart to pick up every code change.
 */
export function apply() {}
