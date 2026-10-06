import { originOf, readConfig } from '@rublox/runtime'

/** Origins written by the server into index.html (SPEC § 6.6). */
export const config = readConfig()
export const appsOrigin = originOf(config.appsUrl)
