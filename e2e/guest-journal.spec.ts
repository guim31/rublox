import { expect, type Page, test } from '@playwright/test'
import { addComponent, newProject } from './helpers.ts'

/**
 * A guest's edit followed at once by leaving the page (signing in, a reload, a closed tab):
 * the page unloads before IndexedDB commits, and the transaction is aborted. The edit used to
 * be lost (and with it, the button a guest moved into their account). The studio keeps each
 * edit in a journal until IndexedDB confirmed it (`storage/journal.ts`).
 *
 * The race is made certain: while `__rxLeaving` is set, every transaction on a guest project's
 * database aborts, as at an unload.
 */
async function abortProjectWrites(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __rxLeaving?: boolean }
    w.__rxLeaving = false
    const transaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (
      this: IDBDatabase,
      ...args: Parameters<IDBDatabase['transaction']>
    ) {
      const created = transaction.apply(this, args)
      if (w.__rxLeaving && this.name.startsWith('rublox-project-')) {
        queueMicrotask(() => {
          try {
            created.abort()
          } catch {}
        })
      }
      return created
    }
  })
}

test('an edit made just before leaving the page is not lost', async ({ page }) => {
  await abortProjectWrites(page)
  await newProject(page, 'Journal')
  await addComponent(page, 'Text')
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')

  // The page "leaves" right after the edit: IndexedDB never gets it.
  await page.evaluate(() => {
    ;(window as unknown as { __rxLeaving: boolean }).__rxLeaving = true
  })
  await addComponent(page, 'Button')
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
  // Never "saved": the edit is not in IndexedDB.
  await expect(page.getByTestId('save-state')).not.toHaveAttribute('data-state', 'saved', {
    timeout: 2000,
  })

  await page.reload()
  await expect(page.getByTestId('layer-Texte1')).toBeVisible()
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
  // Kept for good this time: once more, without the journal's help.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('rublox:pending:')) localStorage.removeItem(key)
    }
  })
  await page.reload()
  await expect(page.getByTestId('layer-Bouton1')).toBeVisible()
})
