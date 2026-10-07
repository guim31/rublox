import { newId } from '@rublox/schema'

/** Id of a row made on the server (the same alphabet as ids made by the studio). */
export function newRowId(): string {
  return newId()
}
